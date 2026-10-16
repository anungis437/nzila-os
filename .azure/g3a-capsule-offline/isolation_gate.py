"""Adjudicate recorded pinned-guest evidence; fixture flags never grant authority."""

from pathlib import Path

PINNED_IMAGE = "Canonical:ubuntu-24_04-lts:server:24.04.202609040"
CAPABILITIES = {"CAP_SYS_ADMIN", "CAP_SYS_CHROOT", "CAP_SETUID", "CAP_SETGID"}
SYSCALLS = {"unshare_mount", "unshare_network", "unshare_pid", "mount_readonly", "pivot_root",
            "setresuid", "setresgid", "prctl_no_new_privs", "seccomp_filter"}


def qualify(evidence):
    missing = []
    if evidence.get("image") != PINNED_IMAGE:
        missing.append("PINNED_IMAGE_IDENTITY")
    if evidence.get("source") != "RECORDED_PINNED_GUEST":
        missing.append("PINNED_GUEST_CAPABILITY_EVIDENCE")
    if not CAPABILITIES.issubset(set(evidence.get("effectiveCapabilities", []))):
        missing.append("INHERITED_CAP_SYS_ADMIN_SYS_CHROOT_SETUID_SETGID")
    if not SYSCALLS.issubset(set(evidence.get("successfulSyscalls", []))):
        missing.append("GUEST_NAMESPACE_MOUNT_UID_AND_SECCOMP_SYSCALLS")
    if evidence.get("credentialAndCapabilityDropVerified") is not True:
        missing.append("POST_DROP_NO_PRIVILEGE_ESCALATION")
    if evidence.get("boundaryNegativeTestsVerified") is not True:
        missing.append("READONLY_INPUT_HOST_FILESYSTEM_AND_NETWORK_BOUNDARY_NEGATIVES")
    return {"status": "BLOCKED" if missing else "QUALIFIED", "missing": missing,
            "fixtureSufficiencyDoesNotConstituteGuestEvidence": True}


def pinned_evidence(base: Path):
    # The sealed witness records transport, marker and hash only. It does not
    # record the process capability set, kernel restrictions or isolation tests.
    import json
    vm = json.loads((base / "g3a-ca-live" / "EVENT_031.json").read_text())["value"]
    image = vm["storageProfile"]["imageReference"]
    return {
        "image": ":".join(image[key] for key in ("publisher", "offer", "sku", "version")),
        "source": "SEALED_ARM_VM_MODEL_ONLY",
        "capabilityObservation": "ABSENT",
        "syscallObservation": "ABSENT",
        "capabilityAbsenceIsNotCapabilityFailure": True,
    }
