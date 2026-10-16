//go:build linux && amd64

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
)

var expectedSHA string
var expectedBytes string

func fileIdentity(path string) (string, int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	return hex.EncodeToString(h.Sum(nil)), n, err
}

func main() {
	sha, size, err := fileIdentity("/proc/self/exe")
	r := map[string]interface{}{"schema": "g3a-handoff/v1", "shimSha256": sha, "shimBytes": size,
		"mode": "--guest-isolation-proof", "outcome": "FAIL"}
	exit := 1
	defer func() {
		raw, _ := json.Marshal(r)
		os.Stdout.Write(append(append([]byte("G3A_HANDOFF_V1 "), raw...), '\n'))
		os.Exit(exit)
	}()
	if err != nil || len(os.Args) != 2 {
		r["errorCode"] = "HANDOFF_ARGUMENT_OR_SELF_HASH"
		return
	}
	path, err := filepath.Abs(os.Args[1])
	if err != nil {
		r["errorCode"] = "CAPSULE_PATH"
		return
	}
	st, err := os.Lstat(path)
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0111 == 0 {
		r["errorCode"] = "CAPSULE_STAT"
		return
	}
	actual, bytes, err := fileIdentity(path)
	r["candidateSha256"], r["candidateBytes"] = actual, bytes
	actualSize, _ := json.Marshal(bytes)
	if err != nil || string(actualSize) != expectedBytes || actual != expectedSHA {
		r["errorCode"] = "CAPSULE_SHA_SIZE_MISMATCH"
		return
	}
	cmd := exec.Command(path, "--guest-isolation-proof")
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	if err = cmd.Run(); err != nil {
		if e, ok := err.(*exec.ExitError); ok {
			exit = e.ExitCode()
		}
		r["errorCode"], r["capsuleExit"] = "CAPSULE_PROOF_FAILED", exit
		return
	}
	r["outcome"], r["capsuleExit"], exit = "PASS", 0, 0
}
