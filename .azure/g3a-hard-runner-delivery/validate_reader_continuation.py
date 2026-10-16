"""Test-only fixed-path alias for this local image; published reader bytes are unchanged."""
import validate_delivery as validation
from delivery_guard import execute, fresh


def with_local_python_alias(command, **options):
    command = list(command)
    image_index = command.index(validation.IMAGE)
    command[image_index:image_index] = [
        "--tmpfs", "/usr/bin:rw,nosuid,nodev,noexec,size=1m,nr_inodes=16"]
    command[-1] = 'import os;os.symlink("/usr/local/bin/python3","/usr/bin/python3")\n' + command[-1]
    return execute(command, **options)


def preserve_failure(name, value):
    if name == "DIAGNOSTIC_VALIDATION.json":
        name = "DIAGNOSTIC_VALIDATION_V2.json"
        value["localFixtureOnly"] = {
            "reason": "Existing local image has Python at /usr/local/bin; pinned Ubuntu uses /usr/bin",
            "aliasOnly": True, "inputCopies": 0, "publishedDiagnosticUnchanged": True}
    return fresh(name, value)


if __name__ == "__main__":
    validation.execute = with_local_python_alias
    validation.fresh = preserve_failure
    validation.main()
