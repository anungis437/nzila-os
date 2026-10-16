package main

import (
	"archive/tar"
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

//go:embed payload.tar
var payload []byte

type entry struct {
	SHA   string `json:"sha256"`
	Bytes int64  `json:"bytes"`
	Mode  int64  `json:"mode"`
}

type config struct {
	Python    string   `json:"python"`
	Loader    string   `json:"loader"`
	Home      string   `json:"pythonHome"`
	Libraries []string `json:"libraryDirectories"`
	Candidate bool     `json:"candidateOnly"`
}

func safe(name string) bool {
	if name == "" || strings.HasPrefix(name, "/") || strings.Contains(name, "\\") {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}
	return true
}

func extract(root string) (config, error) {
	var c config
	rawFiles := map[string][]byte{}
	modes := map[string]int64{}
	reader := tar.NewReader(bytes.NewReader(payload))
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return c, err
		}
		if !safe(header.Name) || header.Typeflag != tar.TypeReg ||
			header.Size < 0 || header.Size > 64*1024*1024 ||
			(header.Mode != 0400 && header.Mode != 0500) {
			return c, errors.New("CAPSULE_ARCHIVE_CONTRACT")
		}
		if _, exists := rawFiles[header.Name]; exists {
			return c, errors.New("CAPSULE_ARCHIVE_DUPLICATE")
		}
		raw, err := io.ReadAll(io.LimitReader(reader, header.Size+1))
		if err != nil || int64(len(raw)) != header.Size {
			return c, errors.New("CAPSULE_ARCHIVE_SIZE")
		}
		rawFiles[header.Name], modes[header.Name] = raw, header.Mode
	}
	var census map[string]entry
	if err := json.Unmarshal(rawFiles["census.json"], &census); err != nil {
		return c, err
	}
	if len(rawFiles) != len(census)+1 {
		return c, errors.New("CAPSULE_MEMBER_CENSUS")
	}
	for name, expected := range census {
		raw, ok := rawFiles[name]
		hash := sha256.Sum256(raw)
		if !ok || hex.EncodeToString(hash[:]) != expected.SHA ||
			int64(len(raw)) != expected.Bytes || modes[name] != expected.Mode {
			return c, errors.New("CAPSULE_MEMBER_SHA_SIZE_MODE")
		}
	}
	if err := json.Unmarshal(rawFiles["runtime.json"], &c); err != nil {
		return c, err
	}
	if !c.Candidate || !safe(c.Python) || !safe(c.Loader) || !safe(c.Home) {
		return c, errors.New("CAPSULE_RUNTIME_CONFIG")
	}
	for _, dir := range c.Libraries {
		if !safe(dir) {
			return c, errors.New("CAPSULE_LIBRARY_PATH")
		}
	}
	if err := os.Mkdir(root, 0700); err != nil {
		return c, err
	}
	for name, raw := range rawFiles {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			return c, err
		}
		file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, os.FileMode(modes[name]))
		if err != nil {
			return c, err
		}
		_, writeErr := file.Write(raw)
		closeErr := file.Close()
		if writeErr != nil {
			return c, writeErr
		}
		if closeErr != nil {
			return c, closeErr
		}
	}
	return c, nil
}

func run(args []string) error {
	if len(args) != 2 || args[0] != "--self-test" {
		return errors.New("PRODUCTION_TRANSACTION_DISABLED_ISOLATION_AND_HANDOFF_UNQUALIFIED")
	}
	root, err := filepath.Abs(args[1])
	if err != nil {
		return err
	}
	c, err := extract(root)
	if err != nil {
		return err
	}
	// Only the directory just exclusively created by this candidate is removed.
	defer os.RemoveAll(root)
	dirs := make([]string, len(c.Libraries))
	for index, dir := range c.Libraries {
		dirs[index] = filepath.Join(root, filepath.FromSlash(dir))
	}
	command := exec.Command(filepath.Join(root, c.Loader), "--library-path", strings.Join(dirs, ":"),
		filepath.Join(root, c.Python), "-B", "-S", filepath.Join(root, "app", "entry.py"), root)
	command.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C",
		"PYTHONHOME=" + filepath.Join(root, c.Home), "PYTHONSAFEPATH=1", "PYTHONNOUSERSITE=1"}
	command.Dir = root
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	return command.Run()
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
