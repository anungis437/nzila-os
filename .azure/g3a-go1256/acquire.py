"""One official archive, verified before bounded safe extraction. No installation."""

import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / "g3a-compressor"
EXPECTED = "f022b6aad78e362bcba9b0b94d09ad58c5a70c6ba3b7582905fababf5fe0181a"
URL = "https://go.dev/dl/go1.25.6.linux-amd64.tar.gz"
SIZE = 59768880


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def check(value, code):
    if not value:
        raise RuntimeError(code)


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        self.hops = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlsplit(newurl)
        check(target.scheme == "https" and target.hostname == "dl.google.com" and
              target.path == "/go/go1.25.6.linux-amd64.tar.gz" and not target.query and
              not target.fragment and not target.username and target.port in (None, 443),
              "NON_OFFICIAL_ARCHIVE_REDIRECT")
        check(not self.hops, "MULTIPLE_ARCHIVE_REDIRECTS")
        self.hops.append({"status": code, "url": newurl})
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    metadata_url = "https://go.dev/dl/?mode=json&include=all"
    with urllib.request.urlopen(metadata_url, timeout=40) as response:
        metadata = response.read(5000001)
    check(len(metadata) <= 5000000, "RELEASE_METADATA_BOUND")
    release = next(item for item in json.loads(metadata) if item["version"] == "go1.25.6")
    file = next(item for item in release["files"] if item["filename"] == "go1.25.6.linux-amd64.tar.gz")
    check(file["sha256"] == EXPECTED and file["size"] == SIZE and file["os"] == "linux" and
          file["arch"] == "amd64" and file["kind"] == "archive", "OFFICIAL_RELEASE_CONTRACT")
    fresh("OFFICIAL_GO1256_METADATA.json", {
        "url": metadata_url, "responseSha256": hashlib.sha256(metadata).hexdigest(),
        "releaseVersion": release["version"], "archive": file,
        "beforeArchiveDownload": True,
    })
    redirects = OfficialRedirect()
    opener = urllib.request.build_opener(redirects)
    archive_path = HERE / "go1.25.6.linux-amd64.tar.gz"
    count, digest = 0, hashlib.sha256()
    with opener.open(URL, timeout=60) as response, archive_path.open("xb") as output:
        final_url = response.geturl()
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            count += len(chunk)
            check(count <= SIZE, "ARCHIVE_DOWNLOAD_OVERSIZE")
            digest.update(chunk)
            output.write(chunk)
    actual = digest.hexdigest()
    fresh("GO1256_DOWNLOAD.json", {
        "source": "GO_DEV_OFFICIAL", "requestedURL": URL, "finalURL": final_url,
        "redirects": redirects.hops, "bytes": count, "expectedSHA256": EXPECTED, "actualSHA256": actual,
        "archiveIntegrity": "PASS" if actual == EXPECTED and count == SIZE else "FAIL_QUARANTINED_NOT_EXTRACTED",
        "archiveDownloads": 1, "systemInstallation": False, "machinePATHChanged": False,
    })
    check(actual == EXPECTED and count == SIZE, "ARCHIVE_HASH_SIZE_FAILURE_QUARANTINED_STOP")
    destination = HERE / "toolchain"
    check(not destination.exists(), "TOOLCHAIN_DESTINATION_ALREADY_EXISTS")
    inventory, directories, total = {}, [], 0
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        seen = set()
        for item in members:
            path = PurePosixPath(item.name)
            check(not path.is_absolute() and "\\" not in item.name and
                  not any(part in ("", ".", "..") for part in path.parts) and
                  path.parts[0] == "go" and item.name not in seen and
                  (item.isfile() or item.isdir()) and item.mode & ~0o777 == 0,
                  "UNSAFE_ARCHIVE_MEMBER_STOP")
            seen.add(item.name)
            check(item.size >= 0 and item.size <= 100000000, "ARCHIVE_MEMBER_SIZE_BOUND")
            total += item.size
            check(total <= 600000000, "ARCHIVE_TOTAL_SIZE_BOUND")
        destination.mkdir()
        for item in members:
            path = destination.joinpath(*PurePosixPath(item.name).parts)
            check(path.resolve().is_relative_to(destination.resolve()), "ARCHIVE_PATH_ESCAPE")
            if item.isdir():
                path.mkdir(parents=True, exist_ok=True)
                directories.append({"name": item.name, "mode": item.mode})
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(item) as source, path.open("xb") as output:
                digest, count = hashlib.sha256(), 0
                while True:
                    chunk = source.read(65536)
                    if not chunk:
                        break
                    count += len(chunk)
                    check(count <= item.size, "EXTRACTED_FILE_OVERFLOW")
                    digest.update(chunk)
                    output.write(chunk)
            check(count == item.size, "EXTRACTED_FILE_SIZE")
            inventory[item.name] = {"bytes": count, "sha256": digest.hexdigest(), "mode": item.mode}
    fresh("GO1256_TOOLCHAIN_INVENTORY.json", {
        "status": "PASS", "archiveSha256": EXPECTED, "extractedBytes": total,
        "files": inventory, "directories": directories, "memberCensus": len(members),
        "safeExtraction": "PASS_NO_LINKS_DEVICES_ABSOLUTE_OR_TRAVERSAL",
        "requiredSourceSubtrees": ["go/src/compress/gzip", "go/src/compress/flate"],
        "requiredExecutablePaths": ["go/bin/go", "go/pkg/tool/linux_amd64/compile",
                                    "go/pkg/tool/linux_amd64/link", "go/pkg/tool/linux_amd64/asm",
                                    "go/pkg/tool/linux_amd64/vet"],
        "modeApplication": "ARCHIVE_MODES_BOUND_EXECUTABLES_CHMODDED_INSIDE_ISOLATION_ONLY",
    })
    harness = HERE / "harness"
    harness.mkdir()
    for name in ("go.mod", "main.go", "main_test.go"):
        raw = (PRIOR / "harness" / name).read_bytes()
        with (harness / name).open("xb") as output:
            output.write(raw)
    fresh("HARNESS_SOURCE_BINDING.json", {
        "source": str(PRIOR / "harness"), "compressionVariablesChanged": "ONLY_TOOLCHAIN_VERSION",
        "files": {name: hashlib.sha256((harness / name).read_bytes()).hexdigest()
                  for name in ("go.mod", "main.go", "main_test.go")},
    })
    print(json.dumps({"archiveIntegrity": "PASS", "safeExtraction": "PASS",
                      "archiveBytes": SIZE, "extractedBytes": total, "fileCount": len(inventory)}, indent=2))


if __name__ == "__main__":
    main()
