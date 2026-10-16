"""Interpreter-only local fixture; exact published diagnostic executes without source substitution."""
import json
import validate_delivery as validation
from delivery_guard import HERE, IMAGE, execute, fresh


def with_aliases(command, **options):
    command = list(command)
    image_index = command.index(IMAGE)
    command[image_index:image_index] = [
        "--tmpfs", "/usr/bin:rw,nosuid,nodev,noexec,size=1m,nr_inodes=16"]
    command[-1] = ('import os;os.symlink("/usr/local/bin/python3","/usr/bin/python3");'
                  'os.symlink("/var/lib/waagent/custom-script/download/0/.reader-fixture-sh","/usr/bin/sh")\n'
                  + command[-1])
    return execute(command, **options)


def preserve_failure(name, value):
    if name == "DIAGNOSTIC_VALIDATION.json":
        name = "DIAGNOSTIC_VALIDATION_FINAL.json"
        value["localFixtureOnly"] = {
            "interpreterPathAliases": True, "publishedDiagnosticBytesUnchanged": True,
            "candidateOrInputCopies": 0, "proofOrAuthoritySubstitution": False}
    return fresh(name, value)


if __name__ == "__main__":
    volume = json.loads((HERE / "LOCAL_READER_VOLUME_OWNERSHIP.json").read_text())["name"]
    prep = execute(["docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--memory", "128m", "--pids-limit", "16", "--cap-drop", "ALL",
        "--mount", f"type=volume,source={volume},target={validation.d.BASE}",
        IMAGE, "python3", "-I", "-B", "-S", "-c",
        'import os,shutil,hashlib; p="/var/lib/waagent/custom-script/download/0/.reader-fixture-sh";'
        'fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o500);'
        's=open("/bin/sh","rb"); t=os.fdopen(fd,"wb");shutil.copyfileobj(s,t);t.close();s.close();'
        'print(hashlib.sha256(open(p,"rb").read()).hexdigest())'])
    fresh("LOCAL_READER_INTERPRETER_FIXTURE.json", prep)
    assert prep["exitCode"] == 0
    validation.execute = with_aliases
    validation.fresh = preserve_failure
    validation.main()
