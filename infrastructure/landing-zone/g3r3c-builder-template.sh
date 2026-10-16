#!/bin/bash
set -euo pipefail
umask 077
fail() { printf '%s\n' "DENY:$1" >&2; exit 1; }
mode="${1:-}"
run="${2:-}"
[[ "$mode" == preflight || "$mode" == build ]] || fail MODE
[[ "$run" =~ ^[a-f0-9]{32}$ ]] || fail RUN_ID
[[ "$(id -u)" == 0 ]] || fail ROOT_SUPERVISOR_REQUIRED
registry='nzilag2tzo75uuozprbo.azurecr.io'
data_host='nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io'
base='docker.io/library/golang@sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff'
account='nzila-g3-rootless'
prefix="nzila-g3-$run"
workspace="/run/nzila-g3-build/$run"
receipt="/run/nzila-g3-receipts/$run.json"
image="$registry/g3-synthetic-runtime:g3-$run"
for tool in docker dockerd-rootless.sh rootlesskit slirp4netns newuidmap newgidmap systemd-run systemctl bpftool sha256sum base64 findmnt getent id timeout flock curl df awk grep stat readlink date sort mkdir chown chmod cat rm seq sleep find wc pgrep; do
  command -v "$tool" >/dev/null 2>&1 || fail TOOLING
done
[[ "$(findmnt -n -o FSTYPE --target /run)" == tmpfs ]] || fail VOLATILE_RUN_REQUIRED
[[ "$(awk 'END { print NR }' /proc/swaps)" == 1 ]] || fail SWAP_PRESENT
[[ "$(stat -c '%U' /run)" == root ]] || fail RUN_OWNER
uid="$(id -u "$account" 2>/dev/null)" || fail EXISTING_ROOTLESS_ACCOUNT_REQUIRED
[[ "$uid" =~ ^[0-9]+$ && "$uid" -gt 0 ]] || fail ACCOUNT
getent passwd "$account" | awk -F: '$7=="/usr/sbin/nologin" || $7=="/bin/false" {valid=1} END {exit !valid}' || fail ACCOUNT_LOGIN
if pgrep -u "$uid" >/dev/null; then
  fail ROOTLESS_ACCOUNT_BUSY
else
  [[ "$?" == 1 ]] || fail PROCESS_CENSUS
fi
awk -F: -v name="$account" '$1==name && $3>=65536 {valid=1} END {exit !valid}' /etc/subuid || fail SUBUID
awk -F: -v name="$account" '$1==name && $3>=65536 {valid=1} END {exit !valid}' /etc/subgid || fail SUBGID
docker buildx version >/dev/null 2>&1 || fail BUILDX
systemctl is-system-running --quiet || fail SYSTEMD_NOT_HEALTHY
verify_fence() {
  local unit="$1" group policy attachments
  group="$(systemctl show --property=ControlGroup --value "$unit")"
  [[ "$group" == "/system.slice/$unit" ]] || fail OWNED_CGROUP
  policy="$(systemctl show --property=IPAddressDeny --value "$unit")"
  [[ "$policy" == *169.254.0.0/16* && "$policy" == *fe80::/64* ]] || fail METADATA_POLICY
  attachments="$(bpftool cgroup show "/sys/fs/cgroup$group" 2>/dev/null)" || fail BPF_QUERY
  printf '%s\n' "$attachments" | grep -Eq '(^|[[:space:]])(cgroup_inet_)?ingress([[:space:]]|$)' || fail BPF_INGRESS
  printf '%s\n' "$attachments" | grep -Eq '(^|[[:space:]])(cgroup_inet_)?egress([[:space:]]|$)' || fail BPF_EGRESS
}
[[ ! -e /run/nzila-g3-build || ( -d /run/nzila-g3-build && ! -L /run/nzila-g3-build && "$(stat -c '%U:%a' /run/nzila-g3-build)" == root:711 ) ]] || fail ROOT_DIRECTORY
[[ ! -e /run/nzila-g3-receipts || ( -d /run/nzila-g3-receipts && ! -L /run/nzila-g3-receipts && "$(stat -c '%U:%a' /run/nzila-g3-receipts)" == root:700 ) ]] || fail RECEIPT_DIRECTORY
for pair in "$registry=10.90.2.5" "$data_host=10.90.2.4"; do
  host="${pair%=*}"
  expected="${pair#*=}"
  addresses="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u)" || fail PRIVATE_DNS
  [[ "$addresses" == "$expected" ]] || fail PRIVATE_DNS_ADDRESS
  curl --silent --show-error --connect-timeout 5 --max-time 10 \
    --resolve "$host:443:$expected" --output /dev/null "https://$host/v2/" 2>/dev/null || fail PRIVATE_TCP_TLS
done
[[ "$(df -Pk /run | awk 'NR==2 {print $4}')" -ge 8388608 ]] || fail VOLATILE_SPACE
[[ ! -e "$workspace" && ! -e "$receipt" ]] || fail RUN_ALREADY_OWNED
for unit in "$prefix-engine.service" "$prefix-build.service" "$prefix-guard.timer" "$prefix-guard.service"; do
  [[ "$(systemctl show --property=LoadState --value "$unit")" == not-found ]] || fail UNIT_CONFLICT
done
if [[ "$mode" == preflight ]]; then
  printf '%s\n' PREFLIGHT_STATIC_HOST_CHECKS_PASS
  exit 0
fi
expiry="${3:-}"
token="${4:-}"
[[ "$expiry" =~ ^[0-9]{10}$ && -n "$token" && ${#token} -le 16384 ]] || fail TOKEN_INPUT
now="$(date -u +%s)"
remaining="$((expiry-now))"
[[ "$remaining" -gt 2100 && "$remaining" -le 10800 ]] || fail TOKEN_LIFETIME
set --
mkdir -m 711 -p /run/nzila-g3-build
mkdir -m 700 -p /run/nzila-g3-receipts
exec 9>/run/nzila-g3-build/mission.lock
flock -n 9 || fail CONFLICTING_BUILD
mkdir -m 711 "$workspace"
printf '%s\n' "$run" > "$workspace/owner"
cat > "$workspace/cleanup.sh" <<'G3_CLEANUP'
#!/bin/bash
set -euo pipefail
umask 077
run="$1"
[[ "$run" =~ ^[a-f0-9]{32}$ ]] || exit 91
workspace="/run/nzila-g3-build/$run"
prefix="nzila-g3-$run"
registry='nzilag2tzo75uuozprbo.azurecr.io'
receipt="/run/nzila-g3-receipts/$run.json"
[[ -f "$receipt" && ! -e "$workspace" ]] && exit 0
[[ -d "$workspace" && ! -L "$workspace" && "$(stat -c '%U:%a' "$workspace")" == root:711 ]] || exit 92
[[ "$(cat "$workspace/owner")" == "$run" ]] || exit 93
exec 8>"$workspace/cleanup.lock"
flock -x 8
[[ -f "$receipt" && ! -e "$workspace" ]] && exit 0
systemctl stop "$prefix-build.service" >/dev/null 2>&1 || {
  [[ "$(systemctl show --property=LoadState --value "$prefix-build.service")" == not-found ]] || exit 94
}
if [[ -S "$workspace/runtime/docker.sock" ]]; then
  export DOCKER_HOST="unix://$workspace/runtime/docker.sock"
  export DOCKER_CONFIG="$workspace/runtime/docker"
  if docker logout "$registry" >/dev/null 2>&1; then
    logout_status=PASS
  else
    logout_status=FAILED_CONFIG_WILL_BE_DESTROYED
  fi
else
  logout_status=NO_OWNED_DAEMON
fi
systemctl stop "$prefix-engine.service" >/dev/null 2>&1 || {
  [[ "$(systemctl show --property=LoadState --value "$prefix-engine.service")" == not-found ]] || exit 95
}
for unit in "$prefix-build.service" "$prefix-engine.service"; do
  [[ "$(systemctl show --property=LoadState --value "$unit")" == not-found ]] && continue
  [[ "$(systemctl show --property=MainPID --value "$unit")" == 0 ]] || exit 96
  [[ "$(systemctl show --property=ControlPID --value "$unit")" == 0 ]] || exit 97
done
[[ "$workspace" == "/run/nzila-g3-build/$run" ]] || exit 98
rm -rf --one-file-system -- "$workspace"
[[ ! -e "$workspace" ]] || exit 99
printf '{"run":"%s","workspaceAbsent":true,"rawTokenResidualInWorkspace":0,"logout":"%s","guestOnly":true}\n' "$run" "$logout_status" > "$receipt"
systemctl stop "$prefix-guard.timer" >/dev/null 2>&1 || {
  [[ "$(systemctl show --property=LoadState --value "$prefix-guard.timer")" == not-found ]] || exit 100
}
G3_CLEANUP
chmod 700 "$workspace/cleanup.sh"
cleanup() {
  trap - EXIT INT TERM HUP
  unset token
  if /bin/bash "$workspace/cleanup.sh" "$run"; then
    exit 1
  fi
  [[ -f "$receipt" && ! -e "$workspace" ]] && exit 1
  printf '%s\n' CLEANUP_FAILED_GUARD_REQUIRES_RECONCILIATION >&2
  exit 1
}
trap cleanup EXIT INT TERM HUP
systemd-run --quiet --collect --unit="$prefix-guard" \
  --on-active=1900s --timer-property=AccuracySec=1s \
  --timer-property=RemainAfterElapse=no --property=Type=oneshot \
  --property=TimeoutStartSec=60s --property=StandardOutput=null --property=StandardError=null \
  /bin/bash "$workspace/cleanup.sh" "$run" || fail GUARD_CREATION
systemctl is-active --quiet "$prefix-guard.timer" || fail GUARD_NOT_ARMED
mkdir -m 700 "$workspace/runtime"
chown "$account" "$workspace/runtime"
mkdir -m 755 "$workspace/source"
@@SOURCE_PAYLOAD@@
[[ "$(sha256sum "$workspace/source/Dockerfile" | awk '{print $1}')" == 96eb04f564a60154c11e16793afe5f4a73af0d904d7c98b69e666cce48cd32c8 ]] || fail DOCKERFILE_HASH
grep -q '^FROM docker.io/library/golang@sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff AS compiler$' "$workspace/source/Dockerfile" || fail BASE_AUTHORITY
rootless="$(command -v dockerd-rootless.sh)"
cat > "$workspace/worker.sh" <<'G3_WORKER'
#!/bin/bash
set -euo pipefail
umask 077
workspace="$1"
run="$2"
registry='nzilag2tzo75uuozprbo.azurecr.io'
base='docker.io/library/golang@sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff'
export DOCKER_HOST="unix://$workspace/runtime/docker.sock"
export DOCKER_CONFIG="$workspace/runtime/docker"
mkdir -m 700 "$DOCKER_CONFIG"
for attempt in $(seq 1 30); do
  [[ -f "$workspace/fence-ready" ]] && break
  sleep 1
done
[[ -f "$workspace/fence-ready" ]] || exit 81
docker --host "$DOCKER_HOST" info --format '{{json .SecurityOptions}}' | grep -q rootless
docker --host "$DOCKER_HOST" pull "$base" >/dev/null 2>&1
docker --host "$DOCKER_HOST" build --network none --pull=false --no-cache \
  --label "nzila.g3.run=$run" --tag "$registry/g3-synthetic-runtime:g3-$run" "$workspace/source" >/dev/null 2>&1
docker --host "$DOCKER_HOST" login "$registry" --username 00000000-0000-0000-0000-000000000000 \
  --password-stdin < "$CREDENTIALS_DIRECTORY/acr-token" >/dev/null 2>&1
docker --host "$DOCKER_HOST" push "$registry/g3-synthetic-runtime:g3-$run" >/dev/null 2>&1
docker --host "$DOCKER_HOST" logout "$registry" >/dev/null 2>&1
printf '%s\n' PUSH_AND_LOGOUT_TERMINAL > "$workspace/runtime/push-terminal"
G3_WORKER
chmod 755 "$workspace/worker.sh"
common=(--property="User=$account" --property="Group=$account"
  --property=ProtectHome=yes --property=ProtectSystem=strict
  --property="ReadWritePaths=$workspace/runtime" --property="ReadOnlyPaths=$workspace/source"
  --property="InaccessiblePaths=-/run/docker.sock -/var/run/docker.sock -/run/user"
  --property=PrivateTmp=yes --property=ProtectProc=invisible
  --property=IPAddressDeny=link-local --property=RestrictSUIDSGID=no
  --property=MemoryMax=6G --property=MemorySwapMax=0
  --property=KillMode=control-group --property=TimeoutStopSec=10s
  --property=SendSIGKILL=yes --property=StandardOutput=null --property=StandardError=null)
systemd-run --quiet --collect --unit="$prefix-engine" "${common[@]}" \
  --property=Delegate=yes --property=RuntimeMaxSec=1860s \
  --property="Environment=HOME=$workspace/runtime XDG_RUNTIME_DIR=$workspace/runtime" \
  "$rootless" --host="unix://$workspace/runtime/docker.sock" \
  --data-root="$workspace/runtime/engine" --exec-root="$workspace/runtime/exec" \
  --storage-driver=vfs --bridge=none --iptables=false || fail ENGINE_START
for attempt in $(seq 1 30); do
  [[ -S "$workspace/runtime/docker.sock" ]] && break
  sleep 1
done
[[ -S "$workspace/runtime/docker.sock" ]] || fail ENGINE_SOCKET
verify_fence "$prefix-engine.service"
printf '%s' "$token" > "$workspace/acr-token"
unset token
systemd-run --quiet --unit="$prefix-build" "${common[@]}" \
  --property=RuntimeMaxSec=1800s --property="LoadCredential=acr-token:$workspace/acr-token" \
  --property="Environment=HOME=$workspace/runtime" \
  /bin/bash "$workspace/worker.sh" "$workspace" "$run" || fail BUILD_OR_PUSH
for attempt in $(seq 1 30); do
  [[ -n "$(systemctl show --property=ControlGroup --value "$prefix-build.service")" ]] && break
  sleep 1
done
verify_fence "$prefix-build.service"
printf '%s\n' EFFECTIVE_CGROUP_ATTACHMENTS_OBSERVED > "$workspace/fence-ready"
for attempt in $(seq 1 1800); do
  state="$(systemctl show --property=ActiveState --value "$prefix-build.service")"
  [[ "$state" == inactive || "$state" == failed ]] && break
  sleep 1
done
[[ "$(systemctl show --property=ActiveState --value "$prefix-build.service")" == inactive ]] || fail BUILD_NOT_TERMINAL
[[ "$(systemctl show --property=ExecMainStatus --value "$prefix-build.service")" == 0 ]] || fail BUILD_FAILED
[[ -f "$workspace/runtime/push-terminal" ]] || fail PUSH_TERMINAL_MISSING
/bin/bash "$workspace/cleanup.sh" "$run" || fail CLEANUP
trap - EXIT INT TERM HUP
[[ -f "$receipt" && ! -e "$workspace" ]] || fail CLEANUP_RECEIPT
printf '%s\n' BUILD_TERMINAL_REQUIRES_CONTROLLER_MANIFEST_READBACK
