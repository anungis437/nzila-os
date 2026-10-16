#!/bin/sh
set -eu
exec /usr/bin/python3 -I -B -S - <<'G3A_FIXED_READ_ONLY'
import hashlib,os,stat,zlib
p="/var/lib/waagent/custom-script/download/0/g3a-handoff"
fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
try:
 s=os.fstat(fd)
 assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o500 and s.st_size==3104508
 h=hashlib.sha256()
 while True:
  b=os.read(fd,1048576)
  if not b: break
  h.update(b)
 assert h.hexdigest()=="7a87ff5b79765b64a8a7af51be44ce0a2700ed0590647b4f8514bcbb615e5c20"
 os.lseek(fd,3092604,os.SEEK_SET)
 raw=os.read(fd,11867)
 assert len(raw)==11867
 d=zlib.decompressobj()
 code=d.decompress(raw,131073)
 assert len(code)<=131072 and d.eof and not d.unused_data and not d.unconsumed_tail
 assert hashlib.sha256(code).hexdigest()=="90f250a39a5a03ba36db93273270ee2fc630e9cc03593ab343d929b6f69eda2b"
 after=os.fstat(fd)
 assert after.st_size==s.st_size and after.st_mtime_ns==s.st_mtime_ns
 exec(compile(code,"<hash-bound-read-only-delivery-reader>","exec"),{"SHIM_SHA":"7a87ff5b79765b64a8a7af51be44ce0a2700ed0590647b4f8514bcbb615e5c20","SHIM_BYTES":3104508})
finally: os.close(fd)
G3A_FIXED_READ_ONLY
