"""Actual fixed diagnostic checks followed by explicitly synthetic portable parser fixtures."""
import io
import json
import unittest
from delivery_guard import HERE, IMAGE, execute, fresh, guard
import delivery_evidence as d
import test_delivery_evidence as tests


def main():
    guard()
    volume = json.loads((HERE / "LOCAL_READER_VOLUME_OWNERSHIP.json").read_text())["name"]
    driver = r'''
import json,os,pathlib,subprocess
base=pathlib.Path("/var/lib/waagent/custom-script/download/0")
script=pathlib.Path("/delivery/FIXED_DIAGNOSTIC.sh").read_text()
def diagnostic():
 return subprocess.run(["/bin/sh","-s"],input=script,capture_output=True,text=True,timeout=90)
positive=diagnostic()
assert positive.returncode==0,(positive.stdout,positive.stderr)
assert positive.stdout.startswith("G3A_FINAL_DELIVERY_EXACT_V1 ") and len(positive.stdout.rstrip("\n"))<=3800
negative=[]
for name,wrong,mode in (("g3a-handoff",0o700,0o500),("g3a-proof-capsule",0o600,0o400),
 (".g3a-isolation-proof-hard-bound-static/proof.json",0o644,0o600),
 (".g3a-hard-delivery-evidence/handoff.json",0o644,0o600)):
 os.chmod(base/name,wrong)
 try:
  result=diagnostic()
  assert result.returncode!=0 and not result.stdout
  negative.append({"case":name+":wrong-mode","exitCode":result.returncode})
 finally: os.chmod(base/name,mode)
root=base/".g3a-isolation-proof-hard-bound-static"
original=root.with_name(".owned-saved-proof")
os.rename(root,original);os.symlink(original.name,root)
try:
 result=diagnostic()
 assert result.returncode!=0 and not result.stdout
 negative.append({"case":"symlink-proof-directory","exitCode":result.returncode})
finally: root.unlink();os.rename(original,root)
bundle=base/"g3a-proof-capsule"
with bundle.open("r+b") as f:
 f.seek(512);byte=f.read(1);f.seek(512);f.write(bytes([byte[0]^1]))
try:
 result=diagnostic()
 assert result.returncode!=0 and not result.stdout
 negative.append({"case":"wrong-whole-bundle-hash","exitCode":result.returncode})
finally:
 with bundle.open("r+b") as f: f.seek(512);f.write(byte)
restored=diagnostic()
assert restored.returncode==0 and restored.stdout==positive.stdout
print(json.dumps({"scope":"ACTUAL_LOCAL_READONLY_DIAGNOSTIC_NOT_PINNED_GUEST",
 "exactDiagnostic":positive.stdout.rstrip("\n"),"diagnosticCharacters":len(positive.stdout.rstrip("\n")),
 "negatives":negative,"allOriginalBytesRestored":True}))
'''
    command = ["docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
               "--memory", "256m", "--pids-limit", "32", "--cap-drop", "ALL",
               "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
               "--mount", f"type=bind,source={HERE},target=/delivery,readonly",
               "--mount", f"type=volume,source={volume},target={d.BASE}",
               IMAGE, "python3", "-I", "-B", "-S", "-c", driver]
    result = execute(command)
    fresh("DIAGNOSTIC_VALIDATION.json", result)
    if result["exitCode"]:
        raise RuntimeError("ACTUAL_DIAGNOSTIC_FAILED")
    record = json.loads(result["stdout"])
    decoded = d.decode(record["exactDiagnostic"])
    assert decoded == tests.actual()
    fresh("ACTUAL_COMPLETE_DELIVERY_ENVELOPE.json", decoded)
    output = io.StringIO()
    suite = unittest.defaultTestLoader.loadTestsFromModule(tests)
    validation = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
    fresh("PARSER_VALIDATION.json", {"tests": validation.testsRun, "success": validation.wasSuccessful(),
        "output": output.getvalue(), "positiveFixtureScope": "SYNTHETIC_PIN_SUBSTITUTION_ONLY_NOT_LIVE_PROOF",
        "actualLocalPinnedParserAccepted": False, "actualExactRoundtrip": True,
        "diagnosticInvocationBytes": len(d.diagnostic_script().encode()),
        "diagnosticOutputCharacters": record["diagnosticCharacters"]})
    if not validation.wasSuccessful():
        raise RuntimeError("PORTABLE_PARSER_TEST_FAILURE")
    print("ACTUAL_DIAGNOSTIC_AND_PORTABLE_PARSER_PASS", record["diagnosticCharacters"])


if __name__ == "__main__":
    main()
