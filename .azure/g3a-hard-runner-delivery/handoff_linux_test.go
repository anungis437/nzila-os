//go:build linux && amd64

package main

import (
	"archive/tar"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func fixture(t *testing.T, headers []*tar.Header, bodies [][]byte) []byte {
	t.Helper()
	var raw bytes.Buffer
	writer := tar.NewWriter(&raw)
	for i, h := range headers {
		if e := writer.WriteHeader(h); e != nil {
			t.Fatal(e)
		}
		if _, e := writer.Write(bodies[i]); e != nil {
			t.Fatal(e)
		}
	}
	if e := writer.Close(); e != nil {
		t.Fatal(e)
	}
	result := raw.Bytes()
	pos := 0
	for _, body := range bodies {
		header := result[pos : pos+512]
		clear(header[265:])
		for i := 148; i < 156; i++ {
			header[i] = ' '
		}
		sum := 0
		for _, value := range header {
			sum += int(value)
		}
		copy(header[148:156], []byte(fmt.Sprintf("%06o\x00 ", sum)))
		pos += 512 + (len(body)+511)/512*512
	}
	return result
}
func fixtureSpec() fileSpec {
	h := sha256.Sum256([]byte("ok"))
	return fileSpec{"fixed", 2, hex.EncodeToString(h[:]), 0444}
}
func TestStrictTar(t *testing.T) {
	spec := fixtureSpec()
	baseHeader := func() *tar.Header {
		return &tar.Header{Name: "fixed", Size: 2, Mode: 0444, Typeflag: tar.TypeReg, Format: tar.FormatUSTAR}
	}
	valid := fixture(t, []*tar.Header{baseHeader()}, [][]byte{[]byte("ok")})
	// Go's writer uses an octal checksum followed by NUL/space and zero mtime.
	if e := validateTar(bytes.NewReader(valid), []fileSpec{spec}, nil); e != nil {
		t.Fatal(e)
	}
	cases := []struct {
		name   string
		change func(*tar.Header)
		body   []byte
	}{
		{"traversal", func(h *tar.Header) { h.Name = "../fixed" }, []byte("ok")},
		{"absolute", func(h *tar.Header) { h.Name = "/fixed" }, []byte("ok")},
		{"wrongname", func(h *tar.Header) { h.Name = "different" }, []byte("ok")},
		{"symlink", func(h *tar.Header) { h.Typeflag = tar.TypeSymlink; h.Linkname = "target"; h.Size = 0 }, nil},
		{"hardlink", func(h *tar.Header) { h.Typeflag = tar.TypeLink; h.Linkname = "target"; h.Size = 0 }, nil},
		{"directory", func(h *tar.Header) { h.Typeflag = tar.TypeDir; h.Size = 0 }, nil},
		{"fifo", func(h *tar.Header) { h.Typeflag = tar.TypeFifo; h.Size = 0 }, nil},
		{"mode", func(h *tar.Header) { h.Mode = 0777 }, []byte("ok")},
		{"owner", func(h *tar.Header) { h.Uid = 1 }, []byte("ok")},
		{"group", func(h *tar.Header) { h.Gid = 1 }, []byte("ok")},
		{"size", func(h *tar.Header) { h.Size = 3 }, []byte("bad")},
		{"digest", func(h *tar.Header) {}, []byte("no")},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := baseHeader()
			c.change(h)
			raw := fixture(t, []*tar.Header{h}, [][]byte{c.body})
			if validateTar(bytes.NewReader(raw), []fileSpec{spec}, nil) == nil {
				t.Fatal("accepted")
			}
		})
	}
	for _, n := range []int{0, 1, 511, 512, 513, len(valid) - 1} {
		t.Run("truncated_"+string(rune(n+65)), func(t *testing.T) {
			if validateTar(bytes.NewReader(valid[:n]), []fileSpec{spec}, nil) == nil {
				t.Fatal("accepted")
			}
		})
	}
	t.Run("duplicate", func(t *testing.T) {
		raw := fixture(t, []*tar.Header{baseHeader(), baseHeader()}, [][]byte{[]byte("ok"), []byte("ok")})
		if validateTar(bytes.NewReader(raw), []fileSpec{spec}, nil) == nil {
			t.Fatal("accepted")
		}
	})
	t.Run("trailing", func(t *testing.T) {
		if validateTar(bytes.NewReader(append(valid, 'x')), []fileSpec{spec}, nil) == nil {
			t.Fatal("accepted")
		}
	})
	t.Run("padding", func(t *testing.T) {
		raw := append([]byte{}, valid...)
		raw[514] = 1
		if validateTar(bytes.NewReader(raw), []fileSpec{spec}, nil) == nil {
			t.Fatal("accepted")
		}
	})
	t.Run("sinkError", func(t *testing.T) {
		if validateTar(bytes.NewReader(valid), []fileSpec{spec}, func(fileSpec, io.Reader) error { return deny("sink") }) == nil {
			t.Fatal("accepted")
		}
	})
	t.Run("shortSink", func(t *testing.T) {
		if validateTar(bytes.NewReader(valid), []fileSpec{spec}, func(fileSpec, io.Reader) error { return nil }) == nil {
			t.Fatal("accepted")
		}
	})
}
func TestPublicArgumentsDenyBeforeFilesystem(t *testing.T) {
	for _, args := range [][]string{
		nil, {"--deliver-bound-static-proof"}, {"--deliver-bound-static-proof", ""},
		{"--deliver-bound-static-proof", strings.Repeat("0", 64)}, {"--deliver-bound-static-proof", strings.ToUpper(bundleSHA)},
		{"--deliver-bound-static-proof", bundleSHA, "extra"}, {"--production", bundleSHA},
		{"--verify-bound-bundle", bundleSHA, "alternate"},
	} {
		if e := run(args); e == nil || e.Error() != "FIXED_DELIVERY_CONTRACT_REQUIRED" {
			t.Fatalf("%v: %v", args, e)
		}
	}
}
func TestOwnedCleanupDoesNotRemoveReplacement(t *testing.T) {
	path := filepath.Join(".checks", "owned-cleanup-fixture")
	if e := os.Mkdir(path, 0700); e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(path)
	file := filepath.Join(path, "owned")
	if e := os.WriteFile(file, []byte("owned"), 0600); e != nil {
		t.Fatal(e)
	}
	info, _ := os.Lstat(file)
	s := &stage{files: []owned{{file, info}}}
	if e := os.Rename(file, file+".original"); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(file, []byte("foreign"), 0600); e != nil {
		t.Fatal(e)
	}
	if s.cleanup(false) == nil {
		t.Fatal("replacement removed")
	}
	raw, _ := os.ReadFile(file)
	if string(raw) != "foreign" {
		t.Fatal("foreign file changed")
	}
}
