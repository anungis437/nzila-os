#!/usr/bin/env bash
set -Eeuo pipefail

source_commit='__SOURCE_COMMIT__'
expected_archive_sha256='__SOURCE_ARCHIVE_SHA256__'
approved_apt_sources_json='__APPROVED_APT_SOURCES_JSON__'
stage='serial-proof-initialization'

mkdir -p /opt/nzila-g2 /var/log
exec > >(tee -a /dev/ttyS0 /var/log/nzila-g2-builder.log) 2>&1

emit_result() {
  local status="$1"
  printf '{"marker":"NZILA_G2_SYNTHETIC_BUILDER_V1","status":"%s","stage":"%s","sourceCommit":"%s","sourceArchiveSha256":"%s","imagePush":"NOT_ATTEMPTED"}\n' \
    "$status" "$stage" "$source_commit" "$expected_archive_sha256" | tee /dev/ttyS0
}

on_error() {
  local exit_code="$?"
  trap - ERR
  emit_result "FAILED"
  exit "$exit_code"
}
trap on_error ERR

stage='package-egress-approval'
if [[ "$approved_apt_sources_json" == "[]" ]]; then
  emit_result "BOOTSTRAP_NOT_READY"
  exit 78
fi

stage='source-archive-integrity'
printf '%s  %s\n' "$expected_archive_sha256" /opt/nzila-g2/source.tar | sha256sum --check --status
mkdir -p /opt/nzila-g2/source
tar --extract --file=/opt/nzila-g2/source.tar --directory=/opt/nzila-g2/source --strip-components=1

stage='apt-source-egress-match'
python3 - "$approved_apt_sources_json" <<'PY'
import glob
import json
import pathlib
import shlex
import sys
from urllib.parse import urlparse

approved = {
    (entry["protocol"].lower(), entry["fqdn"].lower())
    for entry in json.loads(sys.argv[1])
}
configured = set()
paths = ["/etc/apt/sources.list", *glob.glob("/etc/apt/sources.list.d/*.list"), *glob.glob("/etc/apt/sources.list.d/*.sources")]

for name in paths:
    path = pathlib.Path(name)
    if not path.is_file():
        continue
    lines = path.read_text(encoding="utf-8").splitlines()
    if path.suffix == ".sources":
        lines = [line.split(":", 1)[1].strip() for line in lines if line.lower().startswith("uris:")]
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        for token in shlex.split(stripped):
            if token.lower().startswith(("http://", "https://")):
                parsed = urlparse(token)
                protocol = "https" if parsed.scheme == "https" else "http"
                configured.add((protocol, (parsed.hostname or "").lower()))

if not approved or configured != approved:
    print(json.dumps({
        "status": "BLOCKED",
        "approved": sorted(approved),
        "configured": sorted(configured),
    }, separators=(",", ":")))
    sys.exit(78)
PY

stage='package-installation'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install --yes --no-install-recommends golang-go buildah

stage='static-go-build'
cd /opt/nzila-g2/source
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags='-s -w' -o health-server .

stage='local-scratch-image-build'
buildah bud --format oci --file Dockerfile --tag "localhost/nzila/synthetic-health:${source_commit}" .

stage='complete-unpushed'
emit_result "BUILT_NOT_PUSHED"
