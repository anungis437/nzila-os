import json
from pathlib import Path
import shlex
import subprocess
import unittest

import evidence_transport as transport


class ReadOnlyReaderTests(unittest.TestCase):
    def test_linux_exact_bytes_and_fail_closed_file_guards(self):
        report = json.loads((Path(__file__).resolve().parent.parent / "g3a-isolation-artifacts" /
                             "PARENT_INTEGRATION_REPORT.json").read_text())
        envelope = report["positiveFixtureFullOutputs"]["exactEvidenceEnvelope"]
        preset = transport.dictionary(report)
        script = transport.reader_script(".g3a-isolation-proof-123/proof.json", preset)
        reader = shlex.split(script.split("/usr/bin/python3 -I -B -S -c ", 1)[1])[-1]
        fixture = r'''
import json, os, pathlib, subprocess, sys
data = json.load(sys.stdin)
directory = pathlib.Path("/var/lib/waagent/custom-script/download/0/.g3a-isolation-proof-123")
directory.mkdir(mode=0o700)
for name, key in (("baseline.json", "baselineJson"), ("proof.json", "proofJson")):
    path = directory / name
    path.write_bytes(data[key].encode())
    path.chmod(0o600)
def read():
    result = subprocess.run([sys.executable, "-I", "-B", "-S", "-c", data["reader"]],
                            capture_output=True, text=True)
    return {"exit": result.returncode, "stdout": result.stdout, "stderr": result.stderr}
positive = read()
(directory / "proof.json").chmod(0o644)
mode = read()
(directory / "proof.json").chmod(0o600)
(directory / "baseline.json").rename(directory / "baseline-original.json")
(directory / "baseline.json").symlink_to("baseline-original.json")
symlink = read()
print(json.dumps({"positive": positive, "mode": mode, "symlink": symlink}))
'''
        result = subprocess.run([
            "docker", "run", "--rm", "--pull", "never", "-i", "--network", "none", "--read-only",
            "--tmpfs", "/var/lib/waagent/custom-script/download/0:rw,mode=0700",
            "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce",
            "python3", "-B", "-S", "-c", fixture,
        ], input=json.dumps({"baselineJson": envelope["baselineJson"],
                             "proofJson": envelope["proofJson"], "reader": reader}),
            capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stderr)
        cases = json.loads(result.stdout)
        self.assertEqual(cases["positive"]["exit"], 0, cases["positive"]["stderr"])
        decoded = transport.decode(cases["positive"]["stdout"], preset)
        self.assertEqual(decoded, {key: envelope[key] for key in transport.FIELDS})
        for name in ("mode", "symlink"):
            self.assertNotEqual(cases[name]["exit"], 0)
            self.assertNotIn(transport.MARKER, cases[name]["stdout"])

    def test_path_traversal_rejected_before_script_creation(self):
        for path in ("../../proof.json", "/tmp/proof.json", ".g3a-isolation-proof-1/../proof.json"):
            with self.assertRaisesRegex(ValueError, "LIVE_EVIDENCE_PATH_BOUND"):
                transport.reader_script(path, b"dictionary")


if __name__ == "__main__":
    unittest.main()
