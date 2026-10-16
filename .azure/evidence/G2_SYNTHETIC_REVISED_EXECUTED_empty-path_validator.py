def validate_download_uri(location, evidence):
    if not location:
        raise ReadbackFailure("REDIRECT_LOCATION_MISSING")
    if any(ord(value) <= 32 or ord(value) == 127 for value in location):
        raise ReadbackFailure("REDIRECT_CONTROL_CHARACTER_PRESENT")
    if "\\" in location:
        raise ReadbackFailure("REDIRECT_BACKSLASH_PRESENT")
    try:
        url = urllib.parse.urlsplit(location)
        port, host = url.port, url.hostname
    except ValueError:
        raise ReadbackFailure("REDIRECT_PARSE_FAILED") from None
    path_class = "EMPTY" if not url.path else "ABSOLUTE" if url.path.startswith("/") else "OTHER"
    evidence.update({
        "REDIRECT_SCHEME": "https" if url.scheme == "https" else "UNAPPROVED",
        "REDIRECT_HOST": DATA_HOST if host == DATA_HOST else "UNAPPROVED",
        "REDIRECT_PORT": port, "REDIRECT_QUERY_PRESENT": bool(url.query),
        "REDIRECT_PATH_CLASS": path_class,
    })
    if url.scheme != "https":
        raise ReadbackFailure("REDIRECT_SCHEME_INVALID")
    if host != DATA_HOST:
        raise ReadbackFailure("REDIRECT_HOST_INVALID")
    if port is not None:
        raise ReadbackFailure("REDIRECT_PORT_INVALID")
    if url.username is not None or url.password is not None:
        raise ReadbackFailure("REDIRECT_USERINFO_PRESENT")
    if url.fragment or "#" in location:
        raise ReadbackFailure("REDIRECT_FRAGMENT_PRESENT")
    if path_class == "OTHER":
        raise ReadbackFailure("REDIRECT_PATH_INVALID")
    evidence["CURRENT_REDIRECT_VALIDATION"] = "PASS"
    return location
