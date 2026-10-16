import urllib.parse

DATA_HOST = "nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io"


class RedirectRejected(ValueError):
    def __init__(self, predicate):
        super().__init__(predicate)
        self.predicate = predicate


def validate_redirect(location, evidence):
    evidence["REDIRECT_PRESENT"] = bool(location)
    if not location:
        raise RedirectRejected("REDIRECT_LOCATION_MISSING")
    if any(ord(character) <= 32 or ord(character) == 127 for character in location):
        raise RedirectRejected("REDIRECT_CONTROL_CHARACTER_PRESENT")
    if "\\" in location:
        raise RedirectRejected("REDIRECT_BACKSLASH_PRESENT")
    try:
        url = urllib.parse.urlsplit(location)
        port = url.port
        hostname = url.hostname
    except ValueError:
        raise RedirectRejected("REDIRECT_PARSE_FAILED") from None
    evidence.update({
        "REDIRECT_SCHEME": "https" if url.scheme == "https" else "UNAPPROVED",
        "REDIRECT_HOST": DATA_HOST if hostname == DATA_HOST else "UNAPPROVED",
        "REDIRECT_PORT": port,
        "REDIRECT_QUERY_PRESENT": bool(url.query),
        "REDIRECT_PATH_PRESENT": bool(url.path),
    })
    if url.scheme != "https":
        raise RedirectRejected("REDIRECT_SCHEME_INVALID")
    if hostname != DATA_HOST:
        raise RedirectRejected("REDIRECT_HOST_INVALID")
    if port not in (None, 443):
        raise RedirectRejected("REDIRECT_PORT_INVALID")
    if url.username is not None or url.password is not None:
        raise RedirectRejected("REDIRECT_USERINFO_PRESENT")
    if url.fragment or "#" in location:
        raise RedirectRejected("REDIRECT_FRAGMENT_PRESENT")
    if not url.path:
        raise RedirectRejected("REDIRECT_PATH_INVALID")
    evidence["REDIRECT_VALIDATION"] = "PASS"
    return url.path + ("?" + url.query if url.query else "")
