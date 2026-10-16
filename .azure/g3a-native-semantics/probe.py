"""Executed solely by the exact staged CPython inside a no-proc isolated root."""

import importlib.util
import json
import os
import ssl
import subprocess
import sys


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def main():
    mode = sys.argv[1]
    absent = {path: not os.path.exists(path) for path in
              ("/dev/urandom", "/dev/random", "/dev/hwrng", "/dev/srandom", "/proc",
               "/dev/stdin", "/dev/stdout", "/dev/stderr", "/dev/tty")}
    require(all(absent.values()), "UNAUTHORIZED_RANDOM_PROC_STDIO_TTY_PATH")
    if mode == "entropy":
        require(not os.path.exists("/dev"), "ENTROPY_FIXTURE_HAS_DEVICE_DIRECTORY")
        operations = {}
        for name, operation in (
            ("os.getrandom", lambda: os.getrandom(32)),
            ("os.urandom", lambda: os.urandom(32)),
            ("ssl.RAND_bytes", lambda: ssl.RAND_bytes(32)),
            ("ssl.RAND_pseudo_bytes", lambda: ssl.RAND_pseudo_bytes(32)[0]),
        ):
            result = operation()
            require(len(result) == 32, name + "_WRONG_SIZE")
            operations[name] = {"status": "PASS", "bytes": len(result), "entropyBytesRetained": False}
        context = ssl.create_default_context(cafile="/bound-ca.pem")
        require(context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname,
                "BOUND_CA_SSL_CONTEXT_INVALID")
        operations["ssl.contextWithBoundCA"] = {"status": "PASS", "certStore": context.cert_store_stats()}
        secrets_spec = importlib.util.find_spec("secrets")
        if secrets_spec is None:
            operations["secrets.token_bytes"] = {
                "status": "FAIL", "error": "ModuleNotFoundError: secrets is absent from exact embedded runtime",
                "substitutedHostModule": False,
            }
        else:
            import secrets
            require(len(secrets.token_bytes(32)) == 32, "SECRETS_ENTROPY_SIZE")
            operations["secrets.token_bytes"] = {"status": "PASS", "bytes": 32, "entropyBytesRetained": False}
        print(json.dumps({
            "mode": mode, "status": "PASS" if secrets_spec is not None else "FAIL",
            "python": sys.version, "ssl": ssl.OPENSSL_VERSION, "startup": "PASS",
            "deviceCensus": [], "absentPaths": absent, "operations": operations,
            "syscallObservation": "NOT_AVAILABLE", "networkRequests": 0,
        }), flush=True)
        return 0 if secrets_spec is not None else 2
    require(mode == "descriptor", "UNBOUND_PROBE_MODE")
    require(sorted(os.listdir("/dev")) == ["null"], "DEVICE_SURFACE_NOT_NULL_ONLY")
    read_fd = os.open("/dev/null", os.O_RDONLY)
    require(os.read(read_fd, 1) == b"", "NULL_READ_NOT_EOF")
    os.close(read_fd)
    write_fd = os.open("/dev/null", os.O_WRONLY)
    require(os.write(write_fd, b"bounded-null-witness") == 20, "NULL_DISCARD_SHORT_WRITE")
    os.close(write_fd)
    unrelated = os.open("/probe-data", os.O_RDONLY)
    os.dup2(unrelated, 19, inheritable=True)
    if unrelated != 19:
        os.close(unrelated)
    child = subprocess.run(["/fd-witness"], stdin=subprocess.DEVNULL, capture_output=True,
                           close_fds=True, env={"PATH": "/unavailable"}, timeout=30)
    os.close(19)
    witness = json.loads(child.stdout)
    require(child.returncode == 0 and witness["pass"], "NO_PROC_CHILD_FD_CONTRACT_FAILED")
    print(json.dumps({"mode": mode, "status": "PASS", "nullRead": "EOF",
                      "nullWrite": "DISCARDED", "child": witness,
                      "deviceCensus": sorted(os.listdir("/dev")), "absentPaths": absent,
                      "unrelatedDescriptorOpenedInParent": 19, "closeFds": True,
                      "staticChildShaBoundByController": True, "networkRequests": 0}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
