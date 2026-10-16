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
printf '%s' 'KioNCiFEb2NrZXJmaWxlDQohLmRvY2tlcmlnbm9yZQ0KIWdvLm1vZA0KIW1haW4uZ28NCiFtYWluX3Rlc3QuZ28NCg==' | base64 -d > "$workspace/source/.dockerignore"
[[ "$(sha256sum "$workspace/source/.dockerignore" | awk '{print $1}')" == 0e736bee763bbb11fab05e3fb3b990be56438b1efe327d76fc476ebc3d170a69 ]] || fail SOURCE_HASH
chmod 644 "$workspace/source/.dockerignore"
printf '%s' 'RlJPTSBkb2NrZXIuaW8vbGlicmFyeS9nb2xhbmdAc2hhMjU2OmJjZWY5OTJiNzdiMWUyMDMxYWFhYTUxZGE3NWNlYmMzMmRhOGU5YzE4MmUxMmU2MzNlYTc5MDIzYzc5ZDllZmYgQVMgY29tcGlsZXINCkVOViBDR09fRU5BQkxFRD0wIEdPT1M9bGludXggR09BUkNIPWFtZDY0IEdPVE9PTENIQUlOPWxvY2FsIEdPUFJPWFk9b2ZmIEdPU1VNREI9b2ZmIFRaPVVUQw0KV09SS0RJUiAvc3JjDQpDT1BZIGdvLm1vZCAuLw0KQ09QWSBtYWluLmdvIG1haW5fdGVzdC5nbyAuLw0KUlVOIC0tbmV0d29yaz1ub25lIGdvIHRlc3QgLWNvdW50PTEgLXYgLi8uLi4gJiYgZ28gdmV0IC4vLi4uDQpSVU4gLS1uZXR3b3JrPW5vbmUgbWtkaXIgL291dCBcDQogICAgJiYgZ28gYnVpbGQgLWEgLXRyaW1wYXRoIC1idWlsZHZjcz1mYWxzZSAtbGRmbGFncz0iLXMgLXcgLWJ1aWxkaWQ9IiAtbyAvb3V0L3Byb29mLXNlcnZlci1hIC4gXA0KICAgICYmIGdvIGJ1aWxkIC1hIC10cmltcGF0aCAtYnVpbGR2Y3M9ZmFsc2UgLWxkZmxhZ3M9Ii1zIC13IC1idWlsZGlkPSIgLW8gL291dC9wcm9vZi1zZXJ2ZXItYiAuIFwNCiAgICAmJiBjbXAgL291dC9wcm9vZi1zZXJ2ZXItYSAvb3V0L3Byb29mLXNlcnZlci1iIFwNCiAgICAmJiBzaGEyNTZzdW0gL291dC9wcm9vZi1zZXJ2ZXItYSAvb3V0L3Byb29mLXNlcnZlci1iDQoNCkZST00gc2NyYXRjaCBBUyBydW50aW1lDQpDT1BZIC0tZnJvbT1jb21waWxlciAvb3V0L3Byb29mLXNlcnZlci1hIC9wcm9vZi1zZXJ2ZXINClVTRVIgNjU1MzI6NjU1MzINCkVYUE9TRSAzMDAwDQpFTlRSWVBPSU5UIFsiL3Byb29mLXNlcnZlciJdDQo=' | base64 -d > "$workspace/source/Dockerfile"
[[ "$(sha256sum "$workspace/source/Dockerfile" | awk '{print $1}')" == 96eb04f564a60154c11e16793afe5f4a73af0d904d7c98b69e666cce48cd32c8 ]] || fail SOURCE_HASH
chmod 644 "$workspace/source/Dockerfile"
printf '%s' 'bW9kdWxlIG56aWxhLmxvY2FsL2czLXN5bnRoZXRpYy1wcm9vZg0KDQpnbyAxLjI2LjkNCg==' | base64 -d > "$workspace/source/go.mod"
[[ "$(sha256sum "$workspace/source/go.mod" | awk '{print $1}')" == 0e4b2c72b43150985ef1023487b7faa90945909f00b1e75de52be0e15ba51406 ]] || fail SOURCE_HASH
chmod 644 "$workspace/source/go.mod"
printf '%s' 'cGFja2FnZSBtYWluCgppbXBvcnQgKAoJImJ5dGVzIgoJImNyeXB0by9obWFjIgoJImNyeXB0by9yYW5kIgoJImNyeXB0by9zaGEyNTYiCgkiZW5jb2RpbmcvYmFzZTY0IgoJImVuY29kaW5nL2hleCIKCSJlbmNvZGluZy9qc29uIgoJImVycm9ycyIKCSJsb2ciCgkibmV0L2h0dHAiCgkibmV0L2h0dHAvaHR0cHRlc3QiCgkic3RyaW5ncyIKCSJ0ZXN0aW5nIgopCgpmdW5jIGZha2VNYXRlcmlhbCh0ICp0ZXN0aW5nLlQpIHN0cmluZyB7Cgl0LkhlbHBlcigpCgliIDo9IG1ha2UoW11ieXRlLCAzMikKCWlmIF8sIGVyciA6PSByYW5kLlJlYWQoYik7IGVyciAhPSBuaWwgewoJCXQuRmF0YWwoImxvY2FsIHJhbmRvbSBtYXRlcmlhbCBnZW5lcmF0aW9uIGZhaWxlZCIpCgl9CglyZXR1cm4gYmFzZTY0LlJhd1VSTEVuY29kaW5nLkVuY29kZVRvU3RyaW5nKGIpCn0KCmZ1bmMgcmVxdWVzdChoIGh0dHAuSGFuZGxlciwgbWV0aG9kLCByb3V0ZSwgYm9keSwgY29udGVudFR5cGUgc3RyaW5nKSAqaHR0cHRlc3QuUmVzcG9uc2VSZWNvcmRlciB7CglyIDo9IGh0dHB0ZXN0Lk5ld1JlcXVlc3QobWV0aG9kLCByb3V0ZSwgc3RyaW5ncy5OZXdSZWFkZXIoYm9keSkpCglyLkhlYWRlci5TZXQoIkNvbnRlbnQtVHlwZSIsIGNvbnRlbnRUeXBlKQoJdyA6PSBodHRwdGVzdC5OZXdSZWNvcmRlcigpCgloLlNlcnZlSFRUUCh3LCByKQoJcmV0dXJuIHcKfQoKZnVuYyBwcm9vZih0ICp0ZXN0aW5nLlQsIHNlY3JldCwgbm9uY2Ugc3RyaW5nKSBzdHJpbmcgewoJdC5IZWxwZXIoKQoJdyA6PSByZXF1ZXN0KGhhbmRsZXIoZnVuYygpIHN0cmluZyB7IHJldHVybiBzZWNyZXQgfSksICJQT1NUIiwgIi9wcm9vZi9zZWNyZXQiLCBgeyJub25jZSI6ImArbm9uY2UrYCJ9YCwgImFwcGxpY2F0aW9uL2pzb24iKQoJaWYgdy5Db2RlICE9IDIwMCB7CgkJdC5GYXRhbCgicHJvb2YgcmVxdWVzdCBmYWlsZWQiKQoJfQoJdmFyIHJlc3VsdCBwcm9vZlJlc3BvbnNlCglpZiBlcnIgOj0ganNvbi5Vbm1hcnNoYWwody5Cb2R5LkJ5dGVzKCksICZyZXN1bHQpOyBlcnIgIT0gbmlsIHsKCQl0LkZhdGFsKCJpbnZhbGlkIHByb29mIEpTT04iKQoJfQoJaWYgcmVzdWx0LlByb3RvY29sICE9IHByb3RvY29sIHx8IHJlc3VsdC5BbGdvcml0aG0gIT0gIkhNQUMtU0hBMjU2IiB8fCBsZW4ocmVzdWx0LlByb29mKSAhPSA2NCB7CgkJdC5GYXRhbCgiaW52YWxpZCBwcm9vZiByZXNwb25zZSBzaGFwZSIpCgl9CgltYWMgOj0gaG1hYy5OZXcoc2hhMjU2Lk5ldywgW11ieXRlKHNlY3JldCkpCglfLCBfID0gbWFjLldyaXRlKFtdYnl0ZShub25jZSkpCglpZiAhaG1hYy5FcXVhbChbXWJ5dGUocmVzdWx0LlByb29mKSwgW11ieXRlKGhleC5FbmNvZGVUb1N0cmluZyhtYWMuU3VtKG5pbCkpKSkgewoJCXQuRmF0YWwoInByb29mIGRvZXMgbm90IG1hdGNoIGluZGVwZW5kZW50IEhNQUMiKQoJfQoJcmV0dXJuIHJlc3VsdC5Qcm9vZgp9CgpmdW5jIFRlc3RQcm9vZlNlbWFudGljcyh0ICp0ZXN0aW5nLlQpIHsKCXNlY3JldCwgb3RoZXIsIG5vbmNlLCBzZWNvbmQgOj0gZmFrZU1hdGVyaWFsKHQpLCBmYWtlTWF0ZXJpYWwodCksIGZha2VNYXRlcmlhbCh0KSwgZmFrZU1hdGVyaWFsKHQpCglhIDo9IHByb29mKHQsIHNlY3JldCwgbm9uY2UpCglpZiBhICE9IHByb29mKHQsIHNlY3JldCwgbm9uY2UpIHx8IGEgPT0gcHJvb2YodCwgc2VjcmV0LCBzZWNvbmQpIHx8IGEgPT0gcHJvb2YodCwgb3RoZXIsIG5vbmNlKSB7CgkJdC5GYXRhbCgiSE1BQyBkZXRlcm1pbmlzbSBvciBjaGFsbGVuZ2Uva2V5IHNlcGFyYXRpb24gZmFpbGVkIikKCX0KfQoKZnVuYyBUZXN0SGVhbHRoQW5kUm91dGVzKHQgKnRlc3RpbmcuVCkgewoJaCA6PSBoYW5kbGVyKGZ1bmMoKSBzdHJpbmcgeyB0LkZhdGFsKCJoZWFsdGggb3IgaW52YWxpZCByb3V0ZSBhY2Nlc3NlZCBzZWNyZXQiKTsgcmV0dXJuICIiIH0pCglmb3IgXywgYyA6PSByYW5nZSBbXXN0cnVjdCB7CgkJbWV0aG9kLCByb3V0ZSBzdHJpbmcKCQlzdGF0dXMgICAgICAgIGludAoJfXsKCQl7IkdFVCIsICIvaGVhbHRoeiIsIDIwMH0sIHsiUE9TVCIsICIvaGVhbHRoeiIsIDQwNX0sCgkJeyJHRVQiLCAiL3Byb29mL3NlY3JldCIsIDQwNX0sIHsiR0VUIiwgIi91bmtub3duIiwgNDA0fSwKCQl7IkdFVCIsICIvaGVhbHRoL3JlYWRpbmVzcyIsIDQwNH0sIHsiR0VUIiwgIi9oZWFsdGgvbGl2ZW5lc3MiLCA0MDR9LAoJfSB7CgkJdC5SdW4oYy5tZXRob2QrYy5yb3V0ZSwgZnVuYyh0ICp0ZXN0aW5nLlQpIHsKCQkJdyA6PSByZXF1ZXN0KGgsIGMubWV0aG9kLCBjLnJvdXRlLCAiIiwgIiIpCgkJCWlmIHcuQ29kZSAhPSBjLnN0YXR1cyB7CgkJCQl0LkZhdGFsKCJ1bmV4cGVjdGVkIHJvdXRlIHN0YXR1cyIpCgkJCX0KCQkJaWYgYy5zdGF0dXMgPT0gMjAwICYmIHcuQm9keS5TdHJpbmcoKSAhPSAie1wic3RhdHVzXCI6XCJva1wifVxuIiB7CgkJCQl0LkZhdGFsKCJoZWFsdGggb3V0cHV0IGlzIG5vdCBtaW5pbWFsIGRldGVybWluaXN0aWMgc3RhdHVzIikKCQkJfQoJCQlpZiB3LkhlYWRlcigpLkdldCgiQ2FjaGUtQ29udHJvbCIpICE9ICJuby1zdG9yZSIgewoJCQkJdC5GYXRhbCgicmVzcG9uc2UgaXMgY2FjaGVhYmxlIikKCQkJfQoJCX0pCgl9Cn0KCmZ1bmMgVGVzdEludmFsaWROb25jZUFuZEJvZHkodCAqdGVzdGluZy5UKSB7Cglub25jZSA6PSBmYWtlTWF0ZXJpYWwodCkKCWNhc2VzIDo9IFtdc3RydWN0eyBuYW1lLCBib2R5LCBjb250ZW50VHlwZSBzdHJpbmcgfXsKCQl7ImVtcHR5IiwgYHsibm9uY2UiOiIifWAsICJhcHBsaWNhdGlvbi9qc29uIn0sCgkJeyJzaG9ydCIsIGB7Im5vbmNlIjoiYWJjIn1gLCAiYXBwbGljYXRpb24vanNvbiJ9LAoJCXsibm9uY2Fub25pY2FsIiwgYHsibm9uY2UiOiJgICsgc3RyaW5ncy5SZXBlYXQoIiEiLCA0MykgKyBgIn1gLCAiYXBwbGljYXRpb24vanNvbiJ9LAoJCXsid3Jvbmd0eXBlIiwgYHsibm9uY2UiOjEwfWAsICJhcHBsaWNhdGlvbi9qc29uIn0sCgkJeyJudWxsIiwgYHsibm9uY2UiOm51bGx9YCwgImFwcGxpY2F0aW9uL2pzb24ifSwKCQl7Im1pc3NpbmciLCBge31gLCAiYXBwbGljYXRpb24vanNvbiJ9LAoJCXsidW5rbm93biIsIGB7Im5vbmNlIjoiYCArIG5vbmNlICsgYCIsImV4dHJhIjp0cnVlfWAsICJhcHBsaWNhdGlvbi9qc29uIn0sCgkJeyJkdXBsaWNhdGUiLCBgeyJub25jZSI6ImAgKyBub25jZSArIGAiLCJub25jZSI6ImAgKyBub25jZSArIGAifWAsICJhcHBsaWNhdGlvbi9qc29uIn0sCgkJeyJ0cmFpbGluZyIsIGB7Im5vbmNlIjoiYCArIG5vbmNlICsgYCJ9IHt9YCwgImFwcGxpY2F0aW9uL2pzb24ifSwKCQl7Im1hbGZvcm1lZCIsIGB7Im5vbmNlIjpgLCAiYXBwbGljYXRpb24vanNvbiJ9LAoJCXsib3ZlcnNpemUiLCBgeyJub25jZSI6ImAgKyBzdHJpbmdzLlJlcGVhdCgiQSIsIDEwMDApICsgYCJ9YCwgImFwcGxpY2F0aW9uL2pzb24ifSwKCQl7Im92ZXJzaXpld2hpdGVzcGFjZSIsIHN0cmluZ3MuUmVwZWF0KCIgIiwgMzAwKSArIGB7Im5vbmNlIjoiYCArIG5vbmNlICsgYCJ9YCwgImFwcGxpY2F0aW9uL2pzb24ifSwKCQl7Indyb25nY29udGVudCIsIGB7Im5vbmNlIjoiYCArIG5vbmNlICsgYCJ9YCwgInRleHQvcGxhaW4ifSwKCQl7Im1pc3Npbmdjb250ZW50IiwgYHsibm9uY2UiOiJgICsgbm9uY2UgKyBgIn1gLCAiIn0sCgkJeyJ3cm9uZ2NoYXJzZXQiLCBgeyJub25jZSI6ImAgKyBub25jZSArIGAifWAsICJhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9bGF0aW4xIn0sCgl9Cglmb3IgXywgYyA6PSByYW5nZSBjYXNlcyB7CgkJdC5SdW4oYy5uYW1lLCBmdW5jKHQgKnRlc3RpbmcuVCkgewoJCQloIDo9IGhhbmRsZXIoZnVuYygpIHN0cmluZyB7IHQuRmF0YWwoImludmFsaWQgcmVxdWVzdCBhY2Nlc3NlZCBzZWNyZXQiKTsgcmV0dXJuICIiIH0pCgkJCXcgOj0gcmVxdWVzdChoLCAiUE9TVCIsICIvcHJvb2Yvc2VjcmV0IiwgYy5ib2R5LCBjLmNvbnRlbnRUeXBlKQoJCQlpZiB3LkNvZGUgIT0gNDAwIHx8IHcuQm9keS5TdHJpbmcoKSAhPSAie1wic3RhdHVzXCI6XCJpbnZhbGlkX3JlcXVlc3RcIn1cbiIgewoJCQkJdC5GYXRhbCgiaW52YWxpZCBpbnB1dCBkaWQgbm90IGZhaWwgY2xvc2VkIGdlbmVyaWNhbGx5IikKCQkJfQoJCX0pCgl9Cn0KCmZ1bmMgVGVzdE1pc3NpbmdTZWNyZXQodCAqdGVzdGluZy5UKSB7Cgl3IDo9IHJlcXVlc3QoaGFuZGxlcihmdW5jKCkgc3RyaW5nIHsgcmV0dXJuICIiIH0pLCAiUE9TVCIsICIvcHJvb2Yvc2VjcmV0IiwgYHsibm9uY2UiOiJgK2Zha2VNYXRlcmlhbCh0KStgIn1gLCAiYXBwbGljYXRpb24vanNvbiIpCglpZiB3LkNvZGUgIT0gNTAzIHx8IHcuQm9keS5TdHJpbmcoKSAhPSAie1wic3RhdHVzXCI6XCJ1bmF2YWlsYWJsZVwifVxuIiB7CgkJdC5GYXRhbCgibWlzc2luZyBzZWNyZXQgZGlkIG5vdCBmYWlsIGNsb3NlZCBnZW5lcmljYWxseSIpCgl9Cn0KCnR5cGUgZmFpbGluZ1dyaXRlciBzdHJ1Y3R7IGhlYWRlciBodHRwLkhlYWRlciB9CgpmdW5jICh3IGZhaWxpbmdXcml0ZXIpIEhlYWRlcigpIGh0dHAuSGVhZGVyIHsgcmV0dXJuIHcuaGVhZGVyIH0KZnVuYyAodyBmYWlsaW5nV3JpdGVyKSBXcml0ZUhlYWRlcihpbnQpICAgICB7fQpmdW5jICh3IGZhaWxpbmdXcml0ZXIpIFdyaXRlKFtdYnl0ZSkgKGludCwgZXJyb3IpIHsKCXJldHVybiAwLCBlcnJvcnMuTmV3KCJwcml2YXRlIHdyaXRlIGRldGFpbHMgbXVzdCBub3QgcmVhY2ggbG9ncyIpCn0KCmZ1bmMgVGVzdE5vbkRpc2Nsb3N1cmVJbmNsdWRpbmdFcnJvcnModCAqdGVzdGluZy5UKSB7CglzZWNyZXQsIG5vbmNlIDo9IGZha2VNYXRlcmlhbCh0KSwgZmFrZU1hdGVyaWFsKHQpCgl2YXIgbG9ncyBieXRlcy5CdWZmZXIKCXByZXZpb3VzIDo9IGxvZy5Xcml0ZXIoKQoJbG9nLlNldE91dHB1dCgmbG9ncykKCWRlZmVyIGxvZy5TZXRPdXRwdXQocHJldmlvdXMpCgloIDo9IGhhbmRsZXIoZnVuYygpIHN0cmluZyB7IHJldHVybiBzZWNyZXQgfSkKCXcgOj0gcmVxdWVzdChoLCAiUE9TVCIsICIvcHJvb2Yvc2VjcmV0IiwgYHsibm9uY2UiOiJgK25vbmNlK2AifWAsICJhcHBsaWNhdGlvbi9qc29uIikKCXIgOj0gaHR0cHRlc3QuTmV3UmVxdWVzdCgiUE9TVCIsICIvcHJvb2Yvc2VjcmV0Iiwgc3RyaW5ncy5OZXdSZWFkZXIoYHsibm9uY2UiOiJgK25vbmNlK2AifWApKQoJci5IZWFkZXIuU2V0KCJDb250ZW50LVR5cGUiLCAiYXBwbGljYXRpb24vanNvbiIpCgloLlNlcnZlSFRUUChmYWlsaW5nV3JpdGVye21ha2UoaHR0cC5IZWFkZXIpfSwgcikKCV8sIF8gPSAoc2FuaXRpemVkSFRUUExvZ3t9KS5Xcml0ZShbXWJ5dGUoc2VjcmV0ICsgbm9uY2UpKQoJZm9yIF8sIG91dHB1dCA6PSByYW5nZSBbXXN0cmluZ3t3LkJvZHkuU3RyaW5nKCksIGxvZ3MuU3RyaW5nKCl9IHsKCQlmb3IgXywgZm9yYmlkZGVuIDo9IHJhbmdlIFtdc3RyaW5ne3NlY3JldCwgbm9uY2UsICJHM19QUk9PRl9TRUNSRVQiLCAicHJpdmF0ZSB3cml0ZSBkZXRhaWxzIiwgInZhdWx0LmF6dXJlLm5ldCJ9IHsKCQkJaWYgc3RyaW5ncy5Db250YWlucyhvdXRwdXQsIGZvcmJpZGRlbikgewoJCQkJdC5GYXRhbCgic2Vuc2l0aXZlIGlucHV0IG9yIHByaXZhdGUgZXJyb3IgZGV0YWlsIGRpc2Nsb3NlZCIpCgkJCX0KCQl9Cgl9CglpZiAhc3RyaW5ncy5Db250YWlucyhsb2dzLlN0cmluZygpLCAicmVzcG9uc2Vfd3JpdGVfZmFpbGVkIikgfHwgIXN0cmluZ3MuQ29udGFpbnMobG9ncy5TdHJpbmcoKSwgImh0dHBfc2VydmVyX2Vycm9yIikgewoJCXQuRmF0YWwoImVycm9ycyB3ZXJlIG5vdCBzdXJmYWNlZCBhcyBzYW5pdGl6ZWQgZXZlbnRzIikKCX0KfQo=' | base64 -d > "$workspace/source/main_test.go"
[[ "$(sha256sum "$workspace/source/main_test.go" | awk '{print $1}')" == 7671f20e81e740303783e049c2cb078896fab3f81dd08095a0d41a5c672c8461 ]] || fail SOURCE_HASH
chmod 644 "$workspace/source/main_test.go"
printf '%s' 'cGFja2FnZSBtYWluCgppbXBvcnQgKAoJImNvbnRleHQiCgkiY3J5cHRvL2htYWMiCgkiY3J5cHRvL3NoYTI1NiIKCSJlbmNvZGluZy9iYXNlNjQiCgkiZW5jb2RpbmcvaGV4IgoJImVuY29kaW5nL2pzb24iCgkiZXJyb3JzIgoJImlvIgoJImxvZyIKCSJtaW1lIgoJIm5ldCIKCSJuZXQvaHR0cCIKCSJvcyIKCSJvcy9zaWduYWwiCgkic3lzY2FsbCIKCSJ0aW1lIgopCgpjb25zdCBwcm90b2NvbCA9ICJnMy1zZWNyZXQtcHJvb2YtdjEiCmNvbnN0IG1heGltdW1Cb2R5Qnl0ZXMgPSAyNTYKCnR5cGUgcHJvb2ZSZXNwb25zZSBzdHJ1Y3QgewoJUHJvdG9jb2wgIHN0cmluZyBganNvbjoicHJvdG9jb2wiYAoJQWxnb3JpdGhtIHN0cmluZyBganNvbjoiYWxnb3JpdGhtImAKCVByb29mICAgICBzdHJpbmcgYGpzb246InByb29mImAKfQoKZnVuYyByZXNwb25kKHcgaHR0cC5SZXNwb25zZVdyaXRlciwgc3RhdHVzIGludCwgYm9keSBhbnkpIHsKCXcuSGVhZGVyKCkuU2V0KCJDb250ZW50LVR5cGUiLCAiYXBwbGljYXRpb24vanNvbiIpCgl3LkhlYWRlcigpLlNldCgiQ2FjaGUtQ29udHJvbCIsICJuby1zdG9yZSIpCgl3LkhlYWRlcigpLlNldCgiWC1Db250ZW50LVR5cGUtT3B0aW9ucyIsICJub3NuaWZmIikKCXcuV3JpdGVIZWFkZXIoc3RhdHVzKQoJaWYgZXJyIDo9IGpzb24uTmV3RW5jb2Rlcih3KS5FbmNvZGUoYm9keSk7IGVyciAhPSBuaWwgewoJCWxvZy5QcmludChgeyJldmVudCI6InJlc3BvbnNlX3dyaXRlX2ZhaWxlZCJ9YCkKCX0KfQoKZnVuYyBzdGF0dXNSZXNwb25zZSh3IGh0dHAuUmVzcG9uc2VXcml0ZXIsIHN0YXR1cyBpbnQsIHZhbHVlIHN0cmluZykgewoJcmVzcG9uZCh3LCBzdGF0dXMsIHN0cnVjdCB7CgkJU3RhdHVzIHN0cmluZyBganNvbjoic3RhdHVzImAKCX17dmFsdWV9KQp9CgpmdW5jIG5vbmNlRnJvbVJlcXVlc3QodyBodHRwLlJlc3BvbnNlV3JpdGVyLCByICpodHRwLlJlcXVlc3QpIChzdHJpbmcsIGJvb2wpIHsKCW1lZGlhVHlwZSwgcGFyYW1ldGVycywgZXJyIDo9IG1pbWUuUGFyc2VNZWRpYVR5cGUoci5IZWFkZXIuR2V0KCJDb250ZW50LVR5cGUiKSkKCWlmIGVyciAhPSBuaWwgfHwgbWVkaWFUeXBlICE9ICJhcHBsaWNhdGlvbi9qc29uIiB8fCBsZW4ocGFyYW1ldGVycykgPiAxIHx8CgkJKGxlbihwYXJhbWV0ZXJzKSA9PSAxICYmIHBhcmFtZXRlcnNbImNoYXJzZXQiXSAhPSAidXRmLTgiKSB7CgkJcmV0dXJuICIiLCBmYWxzZQoJfQoJci5Cb2R5ID0gaHR0cC5NYXhCeXRlc1JlYWRlcih3LCByLkJvZHksIG1heGltdW1Cb2R5Qnl0ZXMpCglkZWZlciByLkJvZHkuQ2xvc2UoKQoJZGVjb2RlciA6PSBqc29uLk5ld0RlY29kZXIoci5Cb2R5KQoJc3RhcnQsIGVyciA6PSBkZWNvZGVyLlRva2VuKCkKCWlmIGVyciAhPSBuaWwgfHwgc3RhcnQgIT0ganNvbi5EZWxpbSgneycpIHsKCQlyZXR1cm4gIiIsIGZhbHNlCgl9CglrZXksIGVyciA6PSBkZWNvZGVyLlRva2VuKCkKCWlmIGVyciAhPSBuaWwgfHwga2V5ICE9ICJub25jZSIgewoJCXJldHVybiAiIiwgZmFsc2UKCX0KCXZhciBub25jZSBzdHJpbmcKCWlmIGVyciA6PSBkZWNvZGVyLkRlY29kZSgmbm9uY2UpOyBlcnIgIT0gbmlsIHsKCQlyZXR1cm4gIiIsIGZhbHNlCgl9CgllbmQsIGVyciA6PSBkZWNvZGVyLlRva2VuKCkKCWlmIGVyciAhPSBuaWwgfHwgZW5kICE9IGpzb24uRGVsaW0oJ30nKSB7CgkJcmV0dXJuICIiLCBmYWxzZQoJfQoJdmFyIGV4dHJhIGFueQoJaWYgZXJyIDo9IGRlY29kZXIuRGVjb2RlKCZleHRyYSk7IGVyciAhPSBpby5FT0YgewoJCXJldHVybiAiIiwgZmFsc2UKCX0KCWRlY29kZWQsIGVyciA6PSBiYXNlNjQuUmF3VVJMRW5jb2RpbmcuU3RyaWN0KCkuRGVjb2RlU3RyaW5nKG5vbmNlKQoJaWYgZXJyICE9IG5pbCB8fCBsZW4oZGVjb2RlZCkgIT0gMzIgfHwgbGVuKG5vbmNlKSAhPSA0MyB8fAoJCWJhc2U2NC5SYXdVUkxFbmNvZGluZy5FbmNvZGVUb1N0cmluZyhkZWNvZGVkKSAhPSBub25jZSB7CgkJcmV0dXJuICIiLCBmYWxzZQoJfQoJcmV0dXJuIG5vbmNlLCB0cnVlCn0KCmZ1bmMgaGFuZGxlcihzZWNyZXQgZnVuYygpIHN0cmluZykgaHR0cC5IYW5kbGVyIHsKCXJldHVybiBodHRwLkhhbmRsZXJGdW5jKGZ1bmModyBodHRwLlJlc3BvbnNlV3JpdGVyLCByICpodHRwLlJlcXVlc3QpIHsKCQlzd2l0Y2ggci5VUkwuUGF0aCB7CgkJY2FzZSAiL2hlYWx0aHoiOgoJCQlpZiByLk1ldGhvZCAhPSBodHRwLk1ldGhvZEdldCB7CgkJCQl3LkhlYWRlcigpLlNldCgiQWxsb3ciLCBodHRwLk1ldGhvZEdldCkKCQkJCXN0YXR1c1Jlc3BvbnNlKHcsIGh0dHAuU3RhdHVzTWV0aG9kTm90QWxsb3dlZCwgIm1ldGhvZF9ub3RfYWxsb3dlZCIpCgkJCQlyZXR1cm4KCQkJfQoJCQlzdGF0dXNSZXNwb25zZSh3LCBodHRwLlN0YXR1c09LLCAib2siKQoJCWNhc2UgIi9wcm9vZi9zZWNyZXQiOgoJCQlpZiByLk1ldGhvZCAhPSBodHRwLk1ldGhvZFBvc3QgewoJCQkJdy5IZWFkZXIoKS5TZXQoIkFsbG93IiwgaHR0cC5NZXRob2RQb3N0KQoJCQkJc3RhdHVzUmVzcG9uc2UodywgaHR0cC5TdGF0dXNNZXRob2ROb3RBbGxvd2VkLCAibWV0aG9kX25vdF9hbGxvd2VkIikKCQkJCXJldHVybgoJCQl9CgkJCW5vbmNlLCB2YWxpZCA6PSBub25jZUZyb21SZXF1ZXN0KHcsIHIpCgkJCWlmICF2YWxpZCB7CgkJCQlzdGF0dXNSZXNwb25zZSh3LCBodHRwLlN0YXR1c0JhZFJlcXVlc3QsICJpbnZhbGlkX3JlcXVlc3QiKQoJCQkJcmV0dXJuCgkJCX0KCQkJdmFsdWUgOj0gc2VjcmV0KCkKCQkJaWYgdmFsdWUgPT0gIiIgewoJCQkJc3RhdHVzUmVzcG9uc2UodywgaHR0cC5TdGF0dXNTZXJ2aWNlVW5hdmFpbGFibGUsICJ1bmF2YWlsYWJsZSIpCgkJCQlyZXR1cm4KCQkJfQoJCQltYWMgOj0gaG1hYy5OZXcoc2hhMjU2Lk5ldywgW11ieXRlKHZhbHVlKSkKCQkJXywgXyA9IG1hYy5Xcml0ZShbXWJ5dGUobm9uY2UpKQoJCQlyZXNwb25kKHcsIGh0dHAuU3RhdHVzT0ssIHByb29mUmVzcG9uc2V7cHJvdG9jb2wsICJITUFDLVNIQTI1NiIsIGhleC5FbmNvZGVUb1N0cmluZyhtYWMuU3VtKG5pbCkpfSkKCQlkZWZhdWx0OgoJCQlzdGF0dXNSZXNwb25zZSh3LCBodHRwLlN0YXR1c05vdEZvdW5kLCAibm90X2ZvdW5kIikKCQl9Cgl9KQp9Cgp0eXBlIHNhbml0aXplZEhUVFBMb2cgc3RydWN0e30KCmZ1bmMgKHNhbml0aXplZEhUVFBMb2cpIFdyaXRlKHAgW11ieXRlKSAoaW50LCBlcnJvcikgewoJbG9nLlByaW50KGB7ImV2ZW50IjoiaHR0cF9zZXJ2ZXJfZXJyb3IifWApCglyZXR1cm4gbGVuKHApLCBuaWwKfQoKZnVuYyBydW4oKSBlcnJvciB7CglzZXJ2ZXIgOj0gJmh0dHAuU2VydmVyewoJCUhhbmRsZXI6ICAgICAgICAgICBoYW5kbGVyKGZ1bmMoKSBzdHJpbmcgeyByZXR1cm4gb3MuR2V0ZW52KCJHM19QUk9PRl9TRUNSRVQiKSB9KSwKCQlSZWFkSGVhZGVyVGltZW91dDogMyAqIHRpbWUuU2Vjb25kLAoJCVJlYWRUaW1lb3V0OiAgICAgICA1ICogdGltZS5TZWNvbmQsCgkJV3JpdGVUaW1lb3V0OiAgICAgIDUgKiB0aW1lLlNlY29uZCwKCQlJZGxlVGltZW91dDogICAgICAgMTUgKiB0aW1lLlNlY29uZCwKCQlNYXhIZWFkZXJCeXRlczogICAgNDA5NiwKCQlFcnJvckxvZzogICAgICAgICAgbG9nLk5ldyhzYW5pdGl6ZWRIVFRQTG9ne30sICIiLCAwKSwKCX0KCWxpc3RlbmVyLCBlcnIgOj0gbmV0Lkxpc3RlbigidGNwIiwgIjozMDAwIikKCWlmIGVyciAhPSBuaWwgewoJCXJldHVybiBlcnIKCX0KCWN0eCwgc3RvcCA6PSBzaWduYWwuTm90aWZ5Q29udGV4dChjb250ZXh0LkJhY2tncm91bmQoKSwgb3MuSW50ZXJydXB0LCBzeXNjYWxsLlNJR1RFUk0pCglkZWZlciBzdG9wKCkKCWRvbmUgOj0gbWFrZShjaGFuIGVycm9yLCAxKQoJZ28gZnVuYygpIHsgZG9uZSA8LSBzZXJ2ZXIuU2VydmUobGlzdGVuZXIpIH0oKQoJbG9nLlByaW50KGB7ImV2ZW50IjoicnVudGltZV9zdGFydCJ9YCkKCXNlbGVjdCB7CgljYXNlIGVyciA6PSA8LWRvbmU6CgkJcmV0dXJuIGVycgoJY2FzZSA8LWN0eC5Eb25lKCk6CgkJc2h1dGRvd24sIGNhbmNlbCA6PSBjb250ZXh0LldpdGhUaW1lb3V0KGNvbnRleHQuQmFja2dyb3VuZCgpLCA1KnRpbWUuU2Vjb25kKQoJCWRlZmVyIGNhbmNlbCgpCgkJaWYgZXJyIDo9IHNlcnZlci5TaHV0ZG93bihzaHV0ZG93bik7IGVyciAhPSBuaWwgewoJCQlfID0gc2VydmVyLkNsb3NlKCkKCQkJcmV0dXJuIGVycgoJCX0KCQllcnIgOj0gPC1kb25lCgkJaWYgZXJyb3JzLklzKGVyciwgaHR0cC5FcnJTZXJ2ZXJDbG9zZWQpIHsKCQkJcmV0dXJuIG5pbAoJCX0KCQlyZXR1cm4gZXJyCgl9Cn0KCmZ1bmMgbWFpbigpIHsKCWxvZy5TZXRGbGFncygwKQoJaWYgZXJyIDo9IHJ1bigpOyBlcnIgIT0gbmlsIHsKCQlsb2cuUHJpbnQoYHsiZXZlbnQiOiJydW50aW1lX2ZhaWxlZCJ9YCkKCQlvcy5FeGl0KDEpCgl9Cn0K' | base64 -d > "$workspace/source/main.go"
[[ "$(sha256sum "$workspace/source/main.go" | awk '{print $1}')" == 1466e36d31c18c946a20eb4af6842d4309d18c1746a8971c19ad075ca87a6bd9 ]] || fail SOURCE_HASH
chmod 644 "$workspace/source/main.go"
printf '%s' 'IyBHMyBzeW50aGV0aWMgcHJvb2YgVjEKCkF1dGhvcml0eTogYEczX1NZTlRIRVRJQ19QUk9PRl9WMWAuIExpbmVhZ2U6IGBQUk9TUEVDVElWRV9HM1IyX0lNQUdFX1FVQUxJRklDQVRJT05gLgpUaGlzIGlzIGEgbmV3IHByb3NwZWN0aXZlIHNvdXJjZSwgbm90IGEgcmVwYWlyIG9yIHJlY292ZXJ5IG9mIHRoZSByZWplY3RlZApbc3ludGhldGljLWhlYWx0aCBjYW5kaWRhdGVdKC4uLy4uLy4uL3N5bnRoZXRpYy1oZWFsdGgvKS4gTG9jYWwgcXVhbGlmaWNhdGlvbgpkb2VzIG5vdCBhdXRob3JpemUgQXp1cmUgZXhlY3V0aW9uIG9yIHJlZ2lzdHJ5IHVwbG9hZC4KCiMjIFByb3RvY29sCgotIGBHRVQgL2hlYWx0aHpgIHJldHVybnMgb25seSBgeyJzdGF0dXMiOiJvayJ9YC4KLSBgUE9TVCAvcHJvb2Yvc2VjcmV0YCBhY2NlcHRzIGBhcHBsaWNhdGlvbi9qc29uYCAob3B0aW9uYWxseSBgY2hhcnNldD11dGYtOGApLAogIGEgbWF4aW11bSAyNTYtYnl0ZSBib2R5LCBhbmQgZXhhY3RseSBvbmUgYG5vbmNlYCBwcm9wZXJ0eS4KLSBHZW5lcmF0ZSAzMiByYW5kb20gbm9uY2UgYnl0ZXMgb3V0c2lkZSB0aGUgYXBwbGljYXRpb24gYW5kIGVuY29kZSBjYW5vbmljYWwKICB1bnBhZGRlZCBiYXNlNjR1cmwgKDQzIGNoYXJhY3RlcnMpLiBUaGUga2V5IGlzIHRoZSBVVEYtOCB2YWx1ZSBpbmplY3RlZCBhcwogIGBHM19QUk9PRl9TRUNSRVRgOyB0aGUgbWVzc2FnZSBpcyB0aGUgVVRGLTggKiplbmNvZGVkIG5vbmNlIHN0cmluZyoqLCBub3QKICBkZWNvZGVkIG5vbmNlIGJ5dGVzLgotIFJlc3BvbnNlOiBgeyJwcm90b2NvbCI6ImczLXNlY3JldC1wcm9vZi12MSIsImFsZ29yaXRobSI6IkhNQUMtU0hBMjU2IiwicHJvb2YiOiI8NjQgbG93ZXJjYXNlIGhleCBjaGFyYWN0ZXJzPiJ9YC4KICBDb21wYXJlIGRlY29kZWQgSE1BQyBieXRlcyB3aXRoIGEgY29uc3RhbnQtdGltZSBjb21wYXJpc29uLgotIE1pc3Npbmcgc2VjcmV0OiBIVFRQIDUwMyBgeyJzdGF0dXMiOiJ1bmF2YWlsYWJsZSJ9YC4gSW52YWxpZCByZXF1ZXN0czogSFRUUAogIDQwMCBgeyJzdGF0dXMiOiJpbnZhbGlkX3JlcXVlc3QifWAuIFdyb25nIG1ldGhvZHM6IDQwNTsgdW5rbm93biByb3V0ZXM6IDQwNC4KLSBSZXNwb25zZXMgYXJlIG5vbi1jYWNoZWFibGUuIE5vIHNlY3JldCwgc2VjcmV0IGxlbmd0aCwgbm9uY2UsIHRva2VuLCBzb3VyY2UKICBVUkksIGVudmlyb25tZW50IGR1bXAgb3IgcHJpdmF0ZSBlcnJvciBkZXRhaWxzIGFyZSBsb2dnZWQvcmV0dXJuZWQuIEVycm9ycwogIGVtaXQgb25seSBmaXhlZCBzYW5pdGl6ZWQgZXZlbnQgbmFtZXMuCgpVc2UgYSBjcnlwdG9ncmFwaGljYWxseSByYW5kb20sIGhpZ2gtZW50cm9weSBzeW50aGV0aWMgc2VjcmV0OiBITUFDIG91dHB1dCBpcwpub3QgZW5jcnlwdGlvbiBhbmQgcGVybWl0cyBvZmZsaW5lIGd1ZXNzZXMgYWdhaW5zdCBhIHdlYWsgc2VjcmV0LiBBIGNoYWxsZW5nZQpwcm92ZXMgcG9zc2Vzc2lvbiBvZiB0aGUgaW5qZWN0ZWQgdmFsdWUsICoqbm90KiogQXp1cmUgS2V5IFZhdWx0IGluamVjdGlvbiwKZGlyZWN0IG1hbmFnZWQtaWRlbnRpdHkgYWNjZXNzIG9yIG5ldHdvcmsvUkJBQyBjb250cm9scy4gVGhvc2UgcmVtYWluIHNlcGFyYXRlCmZ1dHVyZSBwcm9vZnMuIERvIG5vdCBleHBvc2UgdGhpcyBwcml2YXRlIHByb29mIGVuZHBvaW50IHB1YmxpY2x5LgoKIyMgUmVwcm9kdWNpYmxlIGxvY2FsIGJ1aWxkCgpUaGUgRG9ja2VyZmlsZSBwaW5zIHRoZSB2ZXJpZmllZCBMaW51eC9hbWQ2NCBHbyAxLjI2LjkgYnVpbGRlciBtYW5pZmVzdC4KVGhlIHJ1bnRpbWUgaXMgYHNjcmF0Y2hgLCBVSUQvR0lEIGA2NTUzMjo2NTUzMmAsIHdpdGggb25lIHN0YXRpYyBiaW5hcnkgYW5kIG5vCnNoZWxsL3BhY2thZ2UgbWFuYWdlci4gTm8gcHJlYnVpbHQgaG9zdCBiaW5hcnkgaXMgcmVxdWlyZWQuIFRoZSBjb21waWxlciBydW5zCnRlc3RzIGFuZCB2ZXQgd2l0aG91dCBuZXR3b3JrLCB0aGVuIGNvbXBpbGVzIHR3aWNlIChgLXRyaW1wYXRoYCwKYC1idWlsZHZjcz1mYWxzZWAsIGVtcHR5IGJ1aWxkIElELCBDR08gZGlzYWJsZWQpIGFuZCBjb21wYXJlcyBiaW5hcnkgYnl0ZXMuClRoZSBidWlsZCBjb250ZXh0IGFsbG93bGlzdCBjb250YWlucyBvbmx5IHRoZSBEb2NrZXJmaWxlLCBpZ25vcmUgZmlsZSwgR28KbW9kdWxlLCBzb3VyY2UgYW5kIHRlc3RzLiBTdGFuZGFyZCBsaWJyYXJ5IG9ubHk6IG5vIGBnby5zdW1gIHJlcXVpcmVkLgoKYGBgcG93ZXJzaGVsbApkb2NrZXIgYnVpbGQgLS1wbGF0Zm9ybSBsaW51eC9hbWQ2NCAtLW5ldHdvcmsgbm9uZSAtLXByb2dyZXNzIHBsYWluIC0tbG9hZCAtLXRhZyBuemlsYS1nM3IyaS1sb2NhbCBpbmZyYXN0cnVjdHVyZVxsYW5kaW5nLXpvbmVcZzMtc291cmNlXHdvcmtsb2FkXHN5bnRoZXRpYy1wcm9vZgpgYGAKClRoZSBsb2NhbCBxdWFsaWZpZXIgcmVjb3JkcyBjb21waWxlci9iYXNlL2NvbnRleHQvY29uZmlnL2JpbmFyeSBkaWdlc3RzIGFuZAp1c2VzIGZha2UgcmFuZG9tIHByb29mIG1hdGVyaWFsIG9ubHkuIEl0IHJ1bnMgdGhlIGNvbnRhaW5lciB3aXRoIGEgcmVhZC1vbmx5CnJvb3QgZmlsZXN5c3RlbSwgbm8gY2FwYWJpbGl0aWVzLCBuby1uZXctcHJpdmlsZWdlcyBhbmQgYC0tbmV0d29yayBub25lYC4KQSBub24tcm9vdCwgcmVhZC1vbmx5IGxvY2FsIHRlc3QgY2xpZW50IHNoYXJlcyB0aGF0IGlzb2xhdGVkIG5ldHdvcmsgbmFtZXNwYWNlOwpubyBob3N0IHBvcnQgaXMgcHVibGlzaGVkLiBUaGUgYXBwIGxpc3RlbnMgb25seSBvbiBwb3J0IDMwMDAsCm1ha2VzIG5vIG91dGJvdW5kIGNhbGxzLCBuZWVkcyBubyBsb2NhbCB3cml0ZXMgYW5kIHNodXRzIGRvd24gb24gU0lHVEVSTS4KQUNBIEhUVFAgcHJvYmVzIHByb3ZpZGUgaGVhbHRoIGNoZWNraW5nOyBubyBzaGVsbC1iYXNlZCBEb2NrZXIgaGVhbHRoIGNvbW1hbmQKaXMgYWRkZWQgdG8gdGhlIHNjcmF0Y2ggcnVudGltZS4KClJldGFpbiBub25jZSwgZXhwZWN0ZWQvb2JzZXJ2ZWQgcHJvb2YsIEhUVFAgc3RhdHVzLCB0aW1lc3RhbXAsIGZ1dHVyZSByZWdpc3RyeQpkaWdlc3QsIHJldmlzaW9uLCBzZWNyZXQgbG9naWNhbCBJRCBhbmQgYSBzYWZlbHkgb2J0YWluZWQgc2VjcmV0IHZlcnNpb24uCk5ldmVyIHJldGFpbiByYXcgc2VjcmV0IG1hdGVyaWFsIG9yIGluamVjdGVkIGNvbnRhaW5lciBlbnZpcm9ubWVudCBpbnNwZWN0aW9uLgpMb2NhbCBpbWFnZS9jb25maWcgSURzIGFyZSAqKm5vdCoqIGZ1dHVyZSBBQ1IgcmVnaXN0cnkgbWFuaWZlc3QgYXV0aG9yaXR5LgpGdXR1cmUgZGVwbG95bWVudCBtdXN0IHVzZSBhbiBleHBsaWNpdGx5IGF1dGhvcml6ZWQgaW1tdXRhYmxlIHJlZ2lzdHJ5IGRpZ2VzdC4K' | base64 -d > "$workspace/source/README.md"
[[ "$(sha256sum "$workspace/source/README.md" | awk '{print $1}')" == f13aa60d4ff791404b84ff7cbaad63245d7652ae1c686f5cc0fdf801529ff4c0 ]] || fail SOURCE_HASH
chmod 644 "$workspace/source/README.md"
[[ "$(find "$workspace/source" -mindepth 1 -maxdepth 1 -type f | wc -l)" == 6 ]] || fail SOURCE_COUNT
[[ "$(printf '%s' '[{"path":".dockerignore","sha256":"0e736bee763bbb11fab05e3fb3b990be56438b1efe327d76fc476ebc3d170a69"},{"path":"Dockerfile","sha256":"96eb04f564a60154c11e16793afe5f4a73af0d904d7c98b69e666cce48cd32c8"},{"path":"go.mod","sha256":"0e4b2c72b43150985ef1023487b7faa90945909f00b1e75de52be0e15ba51406"},{"path":"main_test.go","sha256":"7671f20e81e740303783e049c2cb078896fab3f81dd08095a0d41a5c672c8461"},{"path":"main.go","sha256":"1466e36d31c18c946a20eb4af6842d4309d18c1746a8971c19ad075ca87a6bd9"},{"path":"README.md","sha256":"f13aa60d4ff791404b84ff7cbaad63245d7652ae1c686f5cc0fdf801529ff4c0"}]' | sha256sum | awk '{print $1}')" == 63851138029b8081b680f9e3b59e5a07d7ef8689fc308a19604ad78f13134958 ]] || fail TREE_MANIFEST
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
