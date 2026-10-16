package main

import (
	"archive/tar"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func alter(t *testing.T, mode string) {
	t.Helper()
	original := payload
	t.Cleanup(func() { payload = original })
	reader := tar.NewReader(bytes.NewReader(original))
	var buffer bytes.Buffer
	writer := tar.NewWriter(&buffer)
	changed := false
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		raw := make([]byte, header.Size)
		if _, err := io.ReadFull(reader, raw); err != nil {
			t.Fatal(err)
		}
		if !changed && header.Name != "census.json" {
			changed = true
			switch mode {
			case "traversal":
				header.Name = "../escape"
			case "symlink":
				header.Typeflag, header.Linkname, header.Size = tar.TypeSymlink, "/outside", 0
				raw = nil
			case "tamper":
				if len(raw) == 0 {
					t.Fatal("fixture cannot tamper empty member")
				}
				raw[0] ^= 1
			}
		}
		if err := writer.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write(raw); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	payload = buffer.Bytes()
}

func TestExclusiveExtraction(t *testing.T) {
	root := filepath.Join(t.TempDir(), "capsule")
	if _, err := extract(root); err != nil {
		t.Fatal(err)
	}
	if _, err := extract(root); err == nil {
		t.Fatal("existing workspace accepted")
	}
	if _, err := os.Stat(filepath.Join(root, "app", "entry.py")); err != nil {
		t.Fatal(err)
	}
}

func TestTraversalRejected(t *testing.T) {
	alter(t, "traversal")
	if _, err := extract(filepath.Join(t.TempDir(), "capsule")); err == nil ||
		!strings.Contains(err.Error(), "CAPSULE_ARCHIVE_CONTRACT") {
		t.Fatalf("unexpected traversal result: %v", err)
	}
}

func TestSymlinkRejected(t *testing.T) {
	alter(t, "symlink")
	if _, err := extract(filepath.Join(t.TempDir(), "capsule")); err == nil ||
		!strings.Contains(err.Error(), "CAPSULE_ARCHIVE_CONTRACT") {
		t.Fatalf("unexpected symlink result: %v", err)
	}
}

func TestTamperRejected(t *testing.T) {
	alter(t, "tamper")
	if _, err := extract(filepath.Join(t.TempDir(), "capsule")); err == nil ||
		!strings.Contains(err.Error(), "CAPSULE_MEMBER_SHA_SIZE_MODE") {
		t.Fatalf("unexpected hash result: %v", err)
	}
}

func TestTransactionDisabled(t *testing.T) {
	root := filepath.Join(t.TempDir(), "never-created")
	if err := run([]string{"--transaction", root}); err == nil ||
		!strings.Contains(err.Error(), "PRODUCTION_TRANSACTION_DISABLED") {
		t.Fatalf("unexpected transaction entrypoint result: %v", err)
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatal("disabled transaction created workspace")
	}
}

func TestNames(t *testing.T) {
	for _, name := range []string{"", "/", "../a", "a/../b", "a\\b", "a//b", "./a"} {
		if safe(name) {
			t.Fatalf("unsafe path accepted: %s", name)
		}
	}
	if !safe("app/entry.py") {
		t.Fatal("bound relative name rejected")
	}
}
