"""Offline design gates. Not a deployment, push, bootstrap or probe controller."""

import ipaddress
import re

G2_TARGET = "nzilag2tzo75uuozprbo"
SUBJECT = "repo:anungis437/nzila-os:environment:g3-proof"
INPUT_REPOSITORY = "g3-build-inputs"


class ContractError(RuntimeError):
    pass


def ensure(value, message):
    if not value:
        raise ContractError(message)


def federation(subject, audiences, issuer, password_credentials, owner_ids):
    ensure(subject == SUBJECT and audiences == ["api://AzureADTokenExchange"] and
           issuer == "https://token.actions.githubusercontent.com", "FEDERATION_NOT_G3_ONLY")
    ensure(password_credentials == [], "PASSWORD_OR_CLIENT_SECRET_FORBIDDEN")
    ensure(isinstance(owner_ids, list) and owner_ids and len(set(owner_ids)) == len(owner_ids) and
           all(isinstance(value, str) and re.fullmatch(
               r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", value) for value in owner_ids),
           "TENANT_OWNER_OBJECT_IDS_NOT_BOUND")
    return "READY"


def input_phase(registry, phase, producer_ip, approved, locked_readback=False, private_readback=False):
    ensure(isinstance(registry, str) and re.fullmatch(r"[a-z0-9]{5,50}", registry) and
           registry != G2_TARGET, "INPUT_REGISTRY_MUST_BE_G3_ONLY")
    ensure(phase in {"PRODUCER_STAGING", "PRIVATE_LOCKED"}, "UNKNOWN_PHASE")
    if phase == "PRODUCER_STAGING":
        ensure(approved is True, "STAGING_GOVERNANCE_NOT_APPROVED")
        try:
            network = ipaddress.ip_network(producer_ip, strict=True)
        except ValueError as error:
            raise ContractError("PRODUCER_SINGLE_PUBLIC_IPV4_REQUIRED") from error
        ensure(network.version == 4 and network.prefixlen == 32 and network.network_address.is_global,
               "PRODUCER_SINGLE_PUBLIC_IPV4_REQUIRED")
        return {"publicNetworkAccess": "Enabled", "defaultAction": "Deny", "ipRules": [str(network)],
                "trustedServices": "None", "builderExecutionAllowed": False}
    ensure(producer_ip == "", "LOCKED_PHASE_RETAINS_PRODUCER_RULE")
    return {"publicNetworkAccess": "Disabled", "defaultAction": "Deny", "ipRules": [],
            "trustedServices": "None",
            "builderExecutionAllowed": locked_readback is True and private_readback is True}


def input_rights(push_principal, reader_principal, probe_principal, input_registry_id, target_registry_id):
    ensure(len({push_principal, reader_principal, probe_principal}) == 3,
           "DATA_PLANE_IDENTITIES_COLLAPSED")
    ensure(input_registry_id != target_registry_id, "INPUT_AND_TARGET_REGISTRIES_COLLAPSED")
    return [
        {"principal": push_principal, "scope": target_registry_id, "role": "RepositoryWriter",
         "repository": "g3-synthetic-runtime"},
        {"principal": reader_principal, "scope": input_registry_id, "role": "RepositoryReader",
         "repository": INPUT_REPOSITORY},
    ]


def public_denial(internal_readback, private_positive, public_response, public_dns_absent,
                  independent_observer, target_bound):
    ensure(internal_readback and private_positive and independent_observer and target_bound,
           "PUBLIC_OBSERVER_OR_PRIVATE_CONTROL_UNPROVEN")
    ensure(public_response is None and public_dns_absent,
           "PUBLIC_INGRESS_DENIAL_NOT_PROVEN_BY_THIS_FIXTURE")
    return {"status": "DENIED", "meaning": "PUBLIC_DNS_ABSENT_PRIVATE_INGRESS_BOUNDARY_NOT_RBAC_DENIAL"}
