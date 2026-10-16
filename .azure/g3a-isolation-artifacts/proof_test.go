package main

import (
	"archive/tar"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestMain(m *testing.M) {
	if len(os.Args) == 2 && os.Args[1] == "--guest-isolation-proof" {
		os.Exit(guestProof())
	}
	if len(os.Args) == 2 && os.Args[1] == "--_isolated-proof-child" {
		os.Exit(isolatedProofChild())
	}
	os.Exit(m.Run())
}

func testRoot(t *testing.T) string {
	t.Helper()
	root, err := os.MkdirTemp("buildcache", "fixture-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(root) })
	return filepath.Join(root, "capsule")
}

func TestCensusIdentity(t *testing.T) {
	n, sha, err := census()
	if err != nil || n != 141 || len(sha) != 64 {
		t.Fatalf("census: %d %s %v", n, sha, err)
	}
}

func TestHistoricalExtractionPreserved(t *testing.T) {
	root := testRoot(t)
	c, err := extract(root)
	if err != nil || !c.Candidate {
		t.Fatalf("extract: %v", err)
	}
	if _, err = extract(root); err == nil {
		t.Fatal("existing root accepted")
	}
	if _, err = os.Stat(filepath.Join(root, "app", "entry.py")); err != nil {
		t.Fatal(err)
	}
	aliases, err := stageSONAMEAliases(root)
	if err != nil || len(aliases) != 4 {
		t.Fatalf("embedded SONAME alias staging: %v, %v", aliases, err)
	}
	for _, alias := range aliases {
		a, err := os.Stat(filepath.Join(root, alias["source"]))
		if err != nil {
			t.Fatal(err)
		}
		b, err := os.Stat(filepath.Join(root, alias["alias"]))
		if err != nil || !os.SameFile(a, b) {
			t.Fatal("alias not same embedded inode")
		}
	}
}

func TestExtractionNegativeNoMutation(t *testing.T) {
	for _, mode := range []string{"traversal", "symlink", "tamper", "duplicate"} {
		t.Run(mode, func(t *testing.T) {
			original := payload
			defer func() { payload = original }()
			reader := tar.NewReader(bytes.NewReader(original))
			var buf bytes.Buffer
			writer := tar.NewWriter(&buf)
			changed := false
			for {
				h, err := reader.Next()
				if err == io.EOF {
					break
				}
				if err != nil {
					t.Fatal(err)
				}
				raw, err := io.ReadAll(reader)
				if err != nil {
					t.Fatal(err)
				}
				doChange := !changed && h.Name != "census.json"
				if doChange {
					changed = true
					switch mode {
					case "traversal":
						h.Name = "../escape"
					case "symlink":
						h.Typeflag, h.Linkname, h.Size, raw = tar.TypeSymlink, "/outside", 0, nil
					case "tamper":
						raw[0] ^= 1
					}
				}
				if err = writer.WriteHeader(h); err != nil {
					t.Fatal(err)
				}
				if _, err = writer.Write(raw); err != nil {
					t.Fatal(err)
				}
				if doChange && mode == "duplicate" {
					if err = writer.WriteHeader(h); err != nil {
						t.Fatal(err)
					}
					if _, err = writer.Write(raw); err != nil {
						t.Fatal(err)
					}
				}
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			payload = buf.Bytes()
			root := testRoot(t)
			if _, err := extract(root); err == nil {
				t.Fatal("invalid archive accepted")
			}
			if _, err := os.Stat(root); !os.IsNotExist(err) {
				t.Fatal("invalid extraction mutated root")
			}
			if _, err := os.Stat(filepath.Join(filepath.Dir(root), "escape")); !os.IsNotExist(err) {
				t.Fatal("escaped extraction")
			}
		})
	}
}

func TestProductionDisabledNoMutation(t *testing.T) {
	for _, mode := range []string{"--transaction", "--production", "--run", "", "--guest-isolation-proof"} {
		root := testRoot(t)
		if err := run([]string{mode, root}); err == nil || !strings.Contains(err.Error(), "PRODUCTION_TRANSACTION_DISABLED") {
			t.Fatalf("unexpected disabled mode: %v", err)
		}
		if _, err := os.Stat(root); !os.IsNotExist(err) {
			t.Fatal("disabled transaction mutated root")
		}
	}
}

func TestStructuredFailClosed(t *testing.T) {
	r := newResult()
	fail(&r, "namespaceClone", "EPERM_OR_EACCES")
	r.Checks["mountNamespace"] = "UNSUPPORTED"
	raw, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	var decoded proofResult
	if json.Unmarshal(raw, &decoded) != nil || decoded.Outcome != "FAIL" ||
		decoded.FailedPrimitive != "namespaceClone" || allPass(decoded.Checks) || len(raw)+len(marker) > 4096 {
		t.Fatal("structured fail-closed contract")
	}
	for k := range r.Checks {
		r.Checks[k] = "PASS"
	}
	if !allPass(r.Checks) {
		t.Fatal("complete pass rejected")
	}
	delete(r.Checks, "hostFSNegative")
	if allPass(r.Checks) {
		t.Fatal("missing gate promoted")
	}
}

func TestBaselineComplete(t *testing.T) {
	b, err := captureBaseline()
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Namespaces) != 7 || len(strings.Fields(b.Status["Uid"])) != 4 ||
		len(strings.Fields(b.Status["Gid"])) != 4 || b.Architecture != "linux/amd64" || b.Kernel == "" {
		t.Fatal("incomplete baseline")
	}
}

func TestDirectChildNoHostMutation(t *testing.T) {
	root := testRoot(t)
	before, err := captureBaseline()
	if err != nil {
		t.Fatal(err)
	}
	if code := isolatedProofChild(); code != 1 {
		t.Fatal("direct internal dispatch accepted host namespace")
	}
	after, err := captureBaseline()
	if err != nil {
		t.Fatal(err)
	}
	a, _ := json.Marshal(before)
	b, _ := json.Marshal(after)
	if !bytes.Equal(a, b) {
		t.Fatal("direct child changed host state")
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatal("direct child wrote root")
	}
}

func TestRootProofSourceContract(t *testing.T) {
	raw, err := os.ReadFile("proof_linux.go")
	if err != nil {
		t.Fatal(err)
	}
	normalize := func(s string) string { return strings.Join(strings.Fields(s), "") }
	source := normalize(string(raw))
	for _, required := range []string{
		"Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWNET",
		"syscall.MS_REC|syscall.MS_PRIVATE",
		"syscall.Chroot(root)", "syscall.Setgroups([]int{})",
		"syscall.Setresuid(65532, 65532, 65532)", "syscall.Setresgid(65532, 65532, 65532)",
		"syscall.SYS_GETRESUID", "syscall.SYS_GETRESGID", "syscall.SYS_CAPGET",
		"syscall.SYS_CAPSET", "syscall.AllThreadsSyscall6",
		"syscall.EROFS", "\"/var/lib/waagent\"", "\"/etc/shadow\"", "\"/proc\", \"/sys\"",
		"cmd.Env = []string", "\"/runtime/app/entry.py\", \"/runtime\"",
		"\"/work/write-probe\", \"/output/write-probe\"",
	} {
		if !strings.Contains(source, normalize(required)) {
			t.Fatalf("missing source contract: %s", required)
		}
	}
	for _, forbidden := range []string{"exec.Command(\"python", "exec.Command(\"curl", "exec.Command(\"unshare",
		"exec.Command(\"mount", "exec.Command(\"chmod", "syscall.Unshare", "syscall.Mount(\"proc\""} {
		if strings.Contains(source, normalize(forbidden)) {
			t.Fatalf("unexpected host userspace/thread-local fallback: %s", forbidden)
		}
	}
}

func TestProofDisposableFixture(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}

	cwd := filepath.Dir(testRoot(t))
	cwd, err = filepath.Abs(cwd)
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(exe, "--guest-isolation-proof")
	cmd.Dir = cwd
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C"}
	raw, runErr := cmd.CombinedOutput()
	lines := strings.Split(strings.TrimSpace(string(raw)), "\n")
	if len(lines) != 1 || !strings.HasPrefix(lines[0], marker) || len(raw) >= 4096 {
		t.Fatalf("bounded marker absent: %s", raw)
	}
	var r proofResult
	if json.Unmarshal([]byte(strings.TrimPrefix(lines[0], marker)), &r) != nil || r.Checks["baseline"] != "PASS" ||
		r.EmbeddedCount != 141 || r.BaselineSHA256 == "" || r.EvidenceSHA256 == "" {
		t.Fatalf("baseline/census evidence missing: %s", raw)
	}
	evidence, err := os.ReadFile(filepath.Join(cwd, r.EvidenceFile))
	if err != nil || digest(evidence) != r.EvidenceSHA256 {
		t.Fatal("evidence digest mismatch")
	}
	if os.Getenv("G3A_FIXTURE_EXPECT") == "PASS" {
		if runErr != nil || r.Outcome != "PASS" || !allPass(r.Checks) || r.RuntimeCount == 0 {
			t.Fatalf("privileged disposable fixture failed: %s\nevidence: %s", raw, evidence)
		}
	} else if runErr == nil || r.Outcome != "FAIL" || r.FailedPrimitive != "namespaceClone" ||
		r.Checks["mountNamespace"] != "UNSUPPORTED" {
		t.Fatalf("dropped-caps expected unsupported: %s", raw)
	}
}

func TestDisconnectedRouteContract(t *testing.T) {
	for _, ipv6 := range []bool{false, true} {
		if _, err := disconnectedRoutes(nil, ipv6); err != nil {
			t.Fatal("empty route table rejected")
		}
	}
	z := strings.Repeat("0", 32)
	null := z + " 00 " + z + " 00 " + z + " ffffffff 00000001 00000000 00200200 lo\n"
	if n, err := disconnectedRoutes([]byte(null), true); n != 1 || err != nil {
		t.Fatal("kernel reject sentinel rejected")
	}
	for _, invalid := range []string{strings.Replace(null, "00200200", "00000001", 1),
		strings.Replace(null, "lo\n", "eth0\n", 1), strings.Replace(null, " 00 ", " 80 ", 1)} {
		if _, err := disconnectedRoutes([]byte(invalid), true); err == nil {
			t.Fatal("usable/ambiguous IPv6 route accepted")
		}
	}
	if _, err := disconnectedRoutes([]byte("Iface Destination Gateway\n"), false); err != nil {
		t.Fatal(err)
	}
	if _, err := disconnectedRoutes([]byte("Iface Destination Gateway\neth0 00000000 0100000A\n"), false); err == nil {
		t.Fatal("IPv4 route accepted")
	}
}
