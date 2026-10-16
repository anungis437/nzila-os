//go:build linux && amd64

package main

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

type forbiddenReader struct{}

func (forbiddenReader) Read([]byte) (int, error) {
	panic("production default must deny before reading any payload")
}

func TestActualProductionEntrypointDeniedBeforeInputOrBackend(t *testing.T) {
	err := runProduction(forbiddenReader{})
	if err == nil || err.Error() != "FUTURE_EXECUTION_AUTHORITY_DIGEST_REQUIRED" {
		t.Fatal("actual entrypoint enabled", err)
	}
}

func localFixture(t *testing.T) string {
	t.Helper()
	path, err := os.MkdirTemp(".", ".source-test-")
	if err != nil {
		t.Fatal(err)
	}
	path, err = filepath.Abs(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(path) })
	return path
}

func TestActualDurableReceiptConsumedAcrossAuthorityPinsAndCannotMoveRoot(t *testing.T) {
	request, _ := fixture(t)
	boundary := filepath.Join(localFixture(t), ".g3a-transaction-SOURCE_ONLY_TEST")
	root := filepath.Join(boundary, "receipts")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	request["inputRoot"], request["receiptRoot"] = filepath.Join(boundary, "inputs"), root
	auth := request["authority"].(map[string]interface{})
	auth["inputRoot"], auth["receiptRoot"] = request["inputRoot"], root
	pin, _ := authorityDigest(encode(t, auth))
	plan, err := validateRequest(encode(t, request), pin)
	if err != nil {
		t.Fatal(err)
	}
	if err = writeConsumedReceipt(plan); err != nil {
		t.Fatal(err)
	}
	first, err := os.ReadFile(receiptPath(plan))
	if err != nil {
		t.Fatal(err)
	}
	plan.Pin = strings.Repeat("b", 64)
	if writeConsumedReceipt(plan) == nil {
		t.Fatal("transaction replay across authority pins")
	}
	second, _ := os.ReadFile(receiptPath(plan))
	if !bytes.Equal(first, second) {
		t.Fatal("receipt overwritten")
	}
	request["receiptRoot"] = localFixture(t)
	if _, err = validateRequest(encode(t, request), pin); err == nil {
		t.Fatal("ledger relocation bypassed consumption")
	}
}

func TestBoundedMountConstructorOptionsAndNoRetry(t *testing.T) {
	for _, c := range []limits{maxima, {8192, 2, 12288, 3}} {
		specs, err := boundedSpecs(c)
		if err != nil {
			t.Fatal(err)
		}
		var calls []string
		err = mountBoundedRoots("/source-only-root", c, func(source, target, kind string, flags uintptr, options string) error {
			if source != "none" || kind != "tmpfs" || flags != syscall.MS_NOSUID|syscall.MS_NODEV {
				t.Fatal("executable hard-bound mount flags changed")
			}
			calls = append(calls, filepath.Base(target)+":"+options)
			return nil
		})
		if err != nil || len(calls) != 2 || calls[0] != "build:"+specs[0].Options || calls[1] != "tmp:"+specs[1].Options {
			t.Fatal("mount options differ", err, calls)
		}
	}
	calls := 0
	err := mountBoundedRoots("/source-only-root", maxima, func(string, string, string, uintptr, string) error {
		calls++
		return syscall.ENOSPC
	})
	if !errors.Is(err, syscall.ENOSPC) || calls != 1 {
		t.Fatal("mount failure retried")
	}
	c := maxima
	c.TmpBytes++
	calls = 0
	if mountBoundedRoots("/source-only-root", c, func(string, string, string, uintptr, string) error {
		calls++
		return nil
	}) == nil || calls != 0 {
		t.Fatal("bad capacity reached mount")
	}
}

func TestExactInputFilesDigestCensusNoSymlinkRegularAndNonrootPermissions(t *testing.T) {
	original := frozenInputs
	defer func() { frozenInputs = original }()
	content := []byte("source-only regular file fixture, never executed")
	frozenInputs = map[string]frozenInput{"portable-assembler": {int64(len(content)), shaBytes(content)}}
	for _, name := range []string{"valid", "tamper", "missing", "extra", "directory", "symlink", "fifo", "unreadable", "nonexec", "size"} {
		t.Run(name, func(t *testing.T) {
			root := localFixture(t)
			path := filepath.Join(root, "portable-assembler")
			if err := os.WriteFile(path, content, 0555); err != nil {
				t.Fatal(err)
			}
			switch name {
			case "tamper":
				if err := os.Chmod(path, 0755); err != nil {
					t.Fatal(err)
				}
				raw := append([]byte(nil), content...)
				raw[0] ^= 1
				if err := os.WriteFile(path, raw, 0555); err != nil {
					t.Fatal(err)
				}
			case "missing", "directory", "symlink", "fifo":
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
				if name == "directory" {
					if err := os.Mkdir(path, 0755); err != nil {
						t.Fatal(err)
					}
				}
				if name == "symlink" {
					if err := os.Symlink("/outside", path); err != nil {
						t.Fatal(err)
					}
				}
				if name == "fifo" {
					if err := syscall.Mkfifo(path, 0555); err != nil {
						t.Fatal(err)
					}
				}
			case "extra":
				if err := os.WriteFile(filepath.Join(root, "unadvertised"), nil, 0444); err != nil {
					t.Fatal(err)
				}
			case "unreadable":
				if err := os.Chmod(path, 0500); err != nil {
					t.Fatal(err)
				}
			case "nonexec":
				if err := os.Chmod(path, 0444); err != nil {
					t.Fatal(err)
				}
			case "size":
				if err := os.Chmod(path, 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(path, []byte("wrong"), 0555); err != nil {
					t.Fatal(err)
				}
			}
			err := validateInputFiles(root)
			if (err == nil) != (name == "valid") {
				t.Fatal("unexpected census disposition", err)
			}
		})
	}
	root := localFixture(t)
	if err := os.Chmod(root, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "portable-assembler"), content, 0555); err != nil {
		t.Fatal(err)
	}
	if err := readonlyInputRoot(root); err == nil || err.Error() != "OUTER_INPUT_ROOT_NOT_KERNEL_READONLY" {
		t.Fatal("writable outer input accepted", err)
	}
	link := filepath.Join(localFixture(t), "symlink-inputs")
	if err := os.Symlink(root, link); err != nil {
		t.Fatal(err)
	}
	if readonlyInputRoot(link) == nil {
		t.Fatal("root symlink accepted")
	}
}

func TestNoInputCopyCleanupDoesNotMutateOuterSource(t *testing.T) {
	build, temporary, input := localFixture(t), localFixture(t), localFixture(t)
	if err := os.WriteFile(filepath.Join(build, "fixture"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(temporary, "fixture"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(input, "preserved")
	if err := os.WriteFile(marker, []byte("immutable outer inputs"), 0444); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(marker)
	if err := emptyRoots(build, temporary); err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadFile(marker)
	if !bytes.Equal(before, after) {
		t.Fatal("external source changed")
	}
	for _, path := range []string{build, temporary} {
		entries, err := os.ReadDir(path)
		if err != nil || len(entries) != 0 {
			t.Fatal("cleanup failed", err)
		}
	}
}

func TestOutputEvidenceRegularOnlyAndBoundedWriter(t *testing.T) {
	path := localFixture(t)
	if err := os.WriteFile(filepath.Join(path, "fixture.txt"), []byte("source-only"), 0600); err != nil {
		t.Fatal(err)
	}
	var buffer bytes.Buffer
	hash, err := exportOutputArchive(&buffer, path)
	if err != nil || hash != shaBytes(buffer.Bytes()) {
		t.Fatal("evidence not hash-bound", err)
	}
	if err = os.Symlink("/outside", filepath.Join(path, "escape")); err != nil {
		t.Fatal(err)
	}
	if _, err = exportOutputArchive(&buffer, path); err == nil {
		t.Fatal("symlink exported")
	}
	bound := &cappedBuffer{limit: 3}
	if _, err = bound.Write([]byte("abcd")); err == nil || bound.Len() != 0 {
		t.Fatal("overflow")
	}
}

func TestNoCallerEnvironmentAuthorityOverride(t *testing.T) {
	t.Setenv("G3A_EXECUTION_AUTHORITY_SHA256", strings.Repeat("a", 64))
	t.Setenv("TRUSTED_EXECUTION_AUTHORITY_SHA256", strings.Repeat("a", 64))
	if runProduction(forbiddenReader{}) == nil {
		t.Fatal("environment enabled production")
	}
}
