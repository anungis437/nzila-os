"""Public DNS-absent fixture with private control/topology binding; no RBAC claim."""

import ipaddress
import socket


class ObserverFailure(RuntimeError):
    pass


def observe(host, expected_host, internal_environment, private_positive, resolve=socket.getaddrinfo):
    if host != expected_host or not host.endswith(".canadacentral.azurecontainerapps.io") or not all((
        internal_environment, private_positive,
    )):
        raise ObserverFailure("PUBLIC_OBSERVER_TARGET_OR_PRIVATE_CONTROL_UNBOUND")
    try:
        answers = resolve(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        if error.errno not in (socket.EAI_NONAME, getattr(socket, "EAI_NODATA", socket.EAI_NONAME)):
            raise ObserverFailure("PUBLIC_DNS_INFRASTRUCTURE_FAILURE_INCONCLUSIVE") from error
        return {"status": "DENIED", "meaning": "BOUND_INTERNAL_TARGET_PUBLIC_DNS_ABSENT_NOT_RBAC",
                "hostname": host, "publicAddress": None, "proofCredentialsUsed": False}
    addresses = {answer[4][0] for answer in answers}
    if any(ipaddress.ip_address(address).is_global for address in addresses):
        raise ObserverFailure("PUBLIC_ADDRESS_PRESENT_DENIAL_NOT_PROVEN")
    raise ObserverFailure("PUBLIC_DNS_ABSENT_CONTRACT_NOT_MET_PRIVATE_OR_EMPTY_ANSWER_INCONCLUSIVE")
