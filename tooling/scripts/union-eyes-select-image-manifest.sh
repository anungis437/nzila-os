#!/usr/bin/env bash
# Given a registry manifest document, print the digest of the linux/amd64 image
# manifest when it is an OCI image index or Docker manifest list, or nothing
# when it is already a single image manifest. Attestation manifests
# (vnd.docker.reference.type, unknown/unknown platform) are never selected.
# Exits non-zero unless exactly one candidate exists, or on an unknown type.
set -euo pipefail
DOC="${1:?manifest json}"
jq -er '
  def is_index: (.mediaType // "") as $t
    | ($t == "application/vnd.oci.image.index.v1+json" or $t == "application/vnd.docker.distribution.manifest.list.v2+json")
      or ($t == "" and (.manifests | type) == "array" and (.config == null));
  def is_image: (.config.digest | type) == "string";
  if is_index then
    [ .manifests[]
      | select(.platform.os == "linux" and .platform.architecture == "amd64")
      | select((.annotations["vnd.docker.reference.type"] // "") == "")
      | .digest ] as $c
    | if ($c | length) == 1 and ($c[0] | test("^sha256:[0-9a-f]{64}$")) then $c[0]
      else error("expected exactly one linux/amd64 image manifest in the index, found \($c | length)") end
  elif is_image then ""
  else error("unsupported manifest document") end
' "$DOC"
