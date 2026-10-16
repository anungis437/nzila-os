"""Append a separately hash-bound readonly reader footer, preserving original ELF and candidate."""
import hashlib
import json
import struct
import zlib
from delivery_guard import HERE, execute, fresh, guard, sha
import delivery_evidence as evidence


def main():
    guard()
    initial = json.loads((HERE / "DELIVERY_CONSTANTS.json").read_text())
    script = evidence.embedded_reader_code(initial)
    wrapper = script.split("<<'G3A_READ_ONLY_EXACT_DELIVERY'\n", 1)[1].rsplit("\nG3A_READ_ONLY_EXACT_DELIVERY", 1)[0]
    wrapper = wrapper.replace(repr(initial["shimSha256"]), "SHIM_SHA")
    wrapper = wrapper.replace("'shimBytes': " + str(initial["shimBytes"]), "'shimBytes': SHIM_BYTES")
    compressed = zlib.compress(wrapper.encode(), 9)
    original = (HERE / "g3a-handoff").read_bytes()
    magic = b"G3A_READ_ONLY_BOUND_READER_V1"
    binary = original + compressed + struct.pack("<Q", len(compressed)) + magic
    final = dict(initial, shimSha256=hashlib.sha256(binary).hexdigest(), shimBytes=len(binary))
    fresh("g3a-handoff-bound-reader", binary)
    fresh("DELIVERY_CONSTANTS_FINAL.json", final)
    source = f'''#!/bin/sh
set -eu
exec /usr/bin/python3 -I -B -S - <<'G3A_FIXED_READ_ONLY'
import hashlib,os,stat,zlib
p="/var/lib/waagent/custom-script/download/0/g3a-handoff"
fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
try:
 s=os.fstat(fd)
 assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o500 and s.st_size=={len(binary)}
 h=hashlib.sha256()
 while True:
  b=os.read(fd,1048576)
  if not b: break
  h.update(b)
 assert h.hexdigest()=="{final["shimSha256"]}"
 os.lseek(fd,{len(original)},os.SEEK_SET)
 raw=os.read(fd,{len(compressed)})
 assert len(raw)=={len(compressed)}
 d=zlib.decompressobj()
 code=d.decompress(raw,131073)
 assert len(code)<=131072 and d.eof and not d.unused_data and not d.unconsumed_tail
 assert hashlib.sha256(code).hexdigest()=="{hashlib.sha256(wrapper.encode()).hexdigest()}"
 after=os.fstat(fd)
 assert after.st_size==s.st_size and after.st_mtime_ns==s.st_mtime_ns
 exec(compile(code,"<hash-bound-read-only-delivery-reader>","exec"),{{"SHIM_SHA":"{final["shimSha256"]}","SHIM_BYTES":{len(binary)}}})
finally: os.close(fd)
G3A_FIXED_READ_ONLY
'''
    assert len(source) <= 3800
    fresh("FIXED_DIAGNOSTIC.sh", source)
    fresh("READER_PACKAGING.json", {
        "schema": "g3a-separate-readonly-reader-footer/v1",
        "originalELFSha256": sha(HERE / "g3a-handoff"), "originalELFBytes": len(original),
        "finalShimSha256": final["shimSha256"], "finalShimBytes": len(binary),
        "compiledELFPrefixUnchanged": binary[:len(original)] == original,
        "footerBytes": len(binary) - len(original), "compressedReaderBytes": len(compressed),
        "readerWrapperSha256": hashlib.sha256(wrapper.encode()).hexdigest(),
        "sealedReaderSha256": initial["fixedReaderSha256"], "sealedDictionarySha256": initial["dictionarySha256"],
        "diagnosticSha256": hashlib.sha256(source.encode()).hexdigest(), "diagnosticBytes": len(source.encode()),
        "objectCount": 2, "arbitraryProofOrExecutionConfiguration": False,
    })
    previous = json.loads((HERE / "HANDOFF_VALIDATION_CONTINUATION.json").read_text())
    command = previous["results"][-1]["command"]
    volume = "nzila-g3a-hard-delivery-reader-14500503"
    assert execute(["docker", "volume", "inspect", volume])["exitCode"] != 0
    created = execute(["docker", "volume", "create", "--label", "nzila.scope=g3a-hard-runner-delivery",
                       "--label", "nzila.owner=14500503", volume])
    fresh("LOCAL_READER_VOLUME_OWNERSHIP.json", {"name": volume, "created": created, "preexisting": False})
    assert created["exitCode"] == 0
    command = [part.replace("nzila-g3a-hard-delivery-14500503", volume) for part in command]
    command[-1] = command[-1].replace('open("/delivery/"+name,"rb")',
        'open("/delivery/"+("g3a-handoff-bound-reader" if name=="g3a-handoff" else name),"rb")')
    command[-1] = command[-1].replace("/delivery/DELIVERY_CONSTANTS.json", "/delivery/DELIVERY_CONSTANTS_FINAL.json")
    result = execute(command)
    fresh("FINAL_HANDOFF_VALIDATION.json", result)
    if result["exitCode"]:
        raise RuntimeError("FINAL_READER_BOUND_SHIM_HANDOFF_FAILED")
    print("FINAL_READER_BOUND_SHIM_ACTUAL_HANDOFF_PASS", final["shimSha256"], final["shimBytes"])


if __name__ == "__main__":
    main()
