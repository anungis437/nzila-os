<h2>:mag: Vulnerabilities of <code>nzilacanadaacr.azurecr.io/nzila-os-union-eyes:wave1a-4341f2f70250</code></h2>

<details open="true"><summary>:package: Image Reference</strong> <code>nzilacanadaacr.azurecr.io/nzila-os-union-eyes:wave1a-4341f2f70250</code></summary>
<table>
<tr><td>digest</td><td><code>sha256:b4130e8961e019bdd900fa863859c0ce6f6cb748f0362261344b997a5c7ae48d</code></td><tr><tr><td>vulnerabilities</td><td><img alt="critical: 1" src="https://img.shields.io/badge/critical-1-8b1924"/> <img alt="high: 3" src="https://img.shields.io/badge/high-3-e25d68"/> <img alt="medium: 0" src="https://img.shields.io/badge/medium-0-lightgrey"/> <img alt="low: 0" src="https://img.shields.io/badge/low-0-lightgrey"/> <!-- unspecified: 0 --></td></tr>
<tr><td>platform</td><td>linux/amd64</td></tr>
<tr><td>size</td><td>274 MB</td></tr>
<tr><td>packages</td><td>868</td></tr>
</table>
</details></table>
</details>

<table>
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
</table>

