#!/bin/bash
set -euo pipefail
umask 077
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' '{"schemaVersion":1,"phase":"Q1_PREFLIGHT","fatal":"PYTHON3_OBSERVATIONAL_COLLECTOR_ABSENT"}'
  exit 1
fi
python3 - <<'G3R3D_PREFLIGHT'
import json, os, pwd, shutil, socket, subprocess

def query(argv, limit=400):
    try:
        result = subprocess.run(argv, capture_output=True, text=True, timeout=8)
        return {"exit": result.returncode, "value": result.stdout.strip()[:limit]}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"exit": -1, "error": type(error).__name__}

def text(file):
    with open(file, encoding="utf-8") as stream:
        return stream.read()

def connect(host):
    try:
        with socket.create_connection((host, 443 if host != "169.254.169.254" else 80), timeout=3):
            return "CONNECTED"
    except OSError as error:
        return "UNREACHABLE:" + type(error).__name__

account = "nzila-g3-rootless"
try:
    user = pwd.getpwnam(account)
    identity = {"name": account, "uid": user.pw_uid, "gid": user.pw_gid, "shell": user.pw_shell}
except KeyError:
    identity = {"name": account, "exists": False}

tools = {name: shutil.which(name) is not None for name in [
    "docker", "dockerd-rootless.sh", "rootlesskit", "slirp4netns", "newuidmap",
    "newgidmap", "systemd-run", "systemctl", "bpftool", "sha256sum", "base64",
    "curl", "timeout", "flock"
]}
memory = {}
for line in text("/proc/meminfo").splitlines():
    key, value = line.split(":", 1)
    if key in ("MemTotal", "MemAvailable", "SwapTotal"):
        memory[key + "Bytes"] = int(value.strip().split()[0]) * 1024
run = os.statvfs("/run")
rootfs = os.statvfs("/")
mount = query(["findmnt", "-n", "-o", "FSTYPE,OPTIONS", "--target", "/run"], 160)
controllers = text("/sys/fs/cgroup/cgroup.controllers").strip() if os.path.isfile("/sys/fs/cgroup/cgroup.controllers") else ""
units = query(["systemctl", "list-units", "--all", "--no-legend", "--plain", "nzila-g3*"], 700)
processes = 0
for name in os.listdir("/proc"):
    if not name.isdigit():
        continue
    try:
        with open("/proc/" + name + "/cmdline", "rb") as stream:
            command = stream.read(8192)
        if b"/run/nzila-g3-" in command or b"nzila-g3r3d-" in command:
            processes += 1
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        pass
dns = {}
paths = {}
for host, expected in [
    ("nzilag2tzo75uuozprbo.azurecr.io", "10.90.2.5"),
    ("nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io", "10.90.2.4")
]:
    try:
        addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(host, 443, socket.AF_INET)})
        dns[host] = {"addresses": addresses, "expected": expected}
        paths[host] = connect(expected) if addresses == [expected] else "NOT_ATTEMPTED_WRONG_DNS"
    except socket.gaierror as error:
        dns[host] = {"error": type(error).__name__}
        paths[host] = "NOT_ATTEMPTED_DNS_FAILURE"
subids = {}
for file in ("/etc/subuid", "/etc/subgid"):
    subids[file] = any(line.split(":")[0] == account and int(line.strip().split(":")[2]) >= 65536
                       for line in text(file).splitlines() if len(line.split(":")) == 3) if os.path.isfile(file) else False
rootless_socket = "/run/user/" + str(identity.get("uid", "missing")) + "/docker.sock"
rootless = {"socketExists": os.path.exists(rootless_socket), "info": "NOT_ATTEMPTED_NO_EXISTING_ROOTLESS_SOCKET"}
if tools["docker"] and rootless["socketExists"] and identity.get("uid", 0) > 0 and os.stat(rootless_socket).st_uid == identity["uid"]:
    rootless["info"] = query(["runuser", "-u", account, "--", "docker", "--host", "unix://" + rootless_socket,
                             "info", "--format", "{{json .SecurityOptions}}"], 180)
result = {
    "schemaVersion": 1, "phase": "Q1_PREFLIGHT", "effectiveSupervisorUid": os.geteuid(),
    "os": query(["lsb_release", "-ds"], 100), "kernel": os.uname().release,
    "systemd": query(["systemctl", "--version"], 180),
    "systemdState": query(["systemctl", "is-system-running"], 60),
    "transientUnitSupport": tools["systemd-run"] and os.path.isdir("/run/systemd/system"),
    "cgroupMode": "v2" if controllers else "NOT_V2_OR_NO_CONTROLLERS",
    "controllers": controllers, "account": identity, "subordinateIds": subids,
    "tools": tools, "rootless": rootless, "buildx": query(["docker", "buildx", "version"], 140) if tools["docker"] else {"exit": -1},
    "memory": memory, "rootFsAvailableBytes": rootfs.f_bavail * rootfs.f_frsize,
    "runMount": mount, "runAvailableBytes": run.f_bavail * run.f_frsize,
    "swapEntries": len(text("/proc/swaps").splitlines()) - 1,
    "g3Units": units, "g3ProcessCount": processes, "privateDns": dns, "privateTcp443": paths,
    "outsideImdsTcp80": connect("169.254.169.254"), "metadataRequests": 0,
    "persistentGuestChanges": 0, "containerPulls": 0, "builds": 0, "acrAuthentication": 0
}
encoded = json.dumps(result, separators=(",", ":"))
if len(encoded.encode()) > 3900:
    raise RuntimeError("Q1_OUTPUT_EXCEEDS_BOUNDED_RUN_COMMAND_OUTPUT")
print(encoded)
G3R3D_PREFLIGHT
