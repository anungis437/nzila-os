def create_local_artifact(executable, directory, result):
    version = local_command([str(executable), "version"], directory).decode("utf-8")
    if re.search(r"(?m)^Version:\s+1\.3\.4\s*$", version) is None:
        fail("ORAS_VERSION_MISMATCH")
    result["orasVersion"] = "1.3.4"
    if hashlib.sha256(PAYLOAD_BYTES).hexdigest() != SOURCE_SHA:
        fail("BOUND_PAYLOAD_MISMATCH")
    (directory / PAYLOAD_NAME).write_bytes(PAYLOAD_BYTES)
    layout = directory / "layout"
    local_command([str(executable), "push", "--oci-layout", str(layout) + ":" + TARGET_TAG,
                   "--artifact-type", PROOF_TYPE, "--image-spec", "v1.1",
                   "--annotation", "org.opencontainers.image.created=" + FIXED_CREATED,
                   "--export-manifest", str(directory / "manifest.json"),
                   PAYLOAD_NAME + ":" + PAYLOAD_TYPE], directory)
    body = (directory / "manifest.json").read_bytes()
    try:
        value = validate_local_manifest(body, PAYLOAD_BYTES, b"{}")
    except ManifestContractError as error:
        fail(str(error))
    for descriptor, expected in ((value["layers"][0], PAYLOAD_BYTES), (value["config"], b"{}")):
        if (layout / "blobs" / "sha256" / descriptor["digest"].split(":")[1]).read_bytes() != expected:
            fail("LOCAL_OCI_BLOB_MISMATCH")
    result["localPayloadSha256"] = SOURCE_SHA
    result["localManifestDigest"] = LOCAL_MANIFEST_DIGEST
    return body
