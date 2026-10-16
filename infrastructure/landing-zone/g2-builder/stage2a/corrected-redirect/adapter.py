CORRECTED_MARKER = "NZILA_G2_CORRECTED_REDIRECT_RESULT="
READBACK_MARKER = CORRECTED_MARKER


def approved_redirect(location, evidence):
    try:
        path = validate_redirect(location, evidence)
    except RedirectRejected as error:
        evidence["CURRENT_REDIRECT_VALIDATION"] = "FAIL"
        evidence["CURRENT_REDIRECT_FAILURE_PREDICATE"] = error.predicate
        raise ReadbackFailure("REDIRECT_VALIDATION_" + error.predicate + "_FAILED") from None
    evidence["CURRENT_REDIRECT_VALIDATION"] = "PASS"
    evidence["CURRENT_REDIRECT_FAILURE_PREDICATE"] = "NONE"
    evidence["HOST"] = DATA_HOST
    return path
