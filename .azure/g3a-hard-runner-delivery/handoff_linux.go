//go:build linux && amd64

package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const base = "/var/lib/waagent/custom-script/download/0"
const transaction = ".g3a-transaction-HARD_BOUND_STATIC_PROOF"
const evidence = ".g3a-isolation-proof-hard-bound-static"
const deliveryEvidence = ".g3a-hard-delivery-evidence"
const marker = "G3A_HARD_DELIVERY_V1 "

type fileSpec struct {
	Name  string
	Bytes int64
	SHA   string
	Mode  uint32
}

func deny(code string) error { return errors.New(code) }
func allZero(raw []byte) bool {
	for _, b := range raw {
		if b != 0 {
			return false
		}
	}
	return true
}
func field(raw []byte) (string, error) {
	i := bytes.IndexByte(raw, 0)
	if i < 0 || !allZero(raw[i:]) {
		return "", deny("CANONICAL_TAR_FIELD")
	}
	return string(raw[:i]), nil
}
func octal(raw []byte) (int64, error) {
	if len(raw) < 2 || raw[len(raw)-1] != 0 {
		return 0, deny("CANONICAL_TAR_OCTAL")
	}
	for _, c := range raw[:len(raw)-1] {
		if c < '0' || c > '7' {
			return 0, deny("CANONICAL_TAR_OCTAL")
		}
	}
	n, err := strconv.ParseInt(string(raw[:len(raw)-1]), 8, 64)
	return n, err
}

// Fixed USTAR, not archive/tar's implicit PAX/GNU extension interpretation.
func validateTar(reader io.Reader, specs []fileSpec, sink func(fileSpec, io.Reader) error) error {
	for _, spec := range specs {
		h := make([]byte, 512)
		if _, err := io.ReadFull(reader, h); err != nil {
			return deny("TAR_HEADER_TRUNCATED")
		}
		name, err := field(h[:100])
		if err != nil || name != spec.Name || strings.ContainsAny(name, "/\\") ||
			name == "." || name == ".." || h[156] != '0' ||
			!allZero(h[157:257]) || string(h[257:263]) != "ustar\x00" ||
			string(h[263:265]) != "00" || !allZero(h[265:]) {
			return deny("STRICT_FIXED_TAR_HEADER")
		}
		mode, em := octal(h[100:108])
		uid, eu := octal(h[108:116])
		gid, eg := octal(h[116:124])
		size, es := octal(h[124:136])
		stamp, et := octal(h[136:148])
		if em != nil || eu != nil || eg != nil || es != nil || et != nil ||
			mode != int64(spec.Mode) || uid != 0 || gid != 0 || size != spec.Bytes || stamp != 0 {
			return deny("STRICT_FIXED_TAR_METADATA")
		}
		if h[154] != 0 || h[155] != ' ' {
			return deny("CANONICAL_TAR_CHECKSUM")
		}
		var sum int64
		for i, c := range h {
			if i >= 148 && i < 156 {
				sum += 32
			} else {
				sum += int64(c)
			}
		}
		expected, e := strconv.ParseInt(string(h[148:154]), 8, 64)
		if e != nil || sum != expected {
			return deny("TAR_CHECKSUM")
		}
		hash := sha256.New()
		limited := &io.LimitedReader{R: io.TeeReader(reader, hash), N: spec.Bytes}
		if sink == nil {
			_, err = io.Copy(io.Discard, limited)
		} else {
			err = sink(spec, limited)
		}
		if err != nil || limited.N != 0 || hex.EncodeToString(hash.Sum(nil)) != spec.SHA {
			return deny("FIXED_MEMBER_HASH_OR_SIZE_" + name)
		}
		padding := make([]byte, (512-spec.Bytes%512)%512)
		if _, err = io.ReadFull(reader, padding); err != nil || !allZero(padding) {
			return deny("TAR_PADDING")
		}
	}
	tail := make([]byte, 1024)
	if _, err := io.ReadFull(reader, tail); err != nil || !allZero(tail) {
		return deny("TAR_END_MARKERS")
	}
	buffer := make([]byte, 32768)
	for {
		n, err := reader.Read(buffer)
		if !allZero(buffer[:n]) {
			return deny("EXTRA_TAR_DATA_OR_MEMBERS")
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}
	return nil
}

type counted struct {
	R io.Reader
	N int64
}

func (c *counted) Read(b []byte) (int, error) { n, e := c.R.Read(b); c.N += int64(n); return n, e }
func validateBundle(f *os.File, sink func(fileSpec, io.Reader) error) error {
	if _, err := f.Seek(0, 0); err != nil {
		return err
	}
	hash := sha256.New()
	c := &counted{R: io.TeeReader(io.LimitReader(f, bundleBytes+1), hash)}
	if err := validateTar(c, boundFiles, sink); err != nil {
		return err
	}
	if c.N != bundleBytes || hex.EncodeToString(hash.Sum(nil)) != bundleSHA {
		return deny("WHOLE_BUNDLE_HASH_OR_SIZE")
	}
	return nil
}
func private(path string) error {
	s, err := os.Lstat(path)
	if err != nil || !s.IsDir() || s.Mode().Perm() != 0700 {
		return deny("PRIVATE_OWNED_ROOT_REQUIRED")
	}
	canonical, err := filepath.EvalSymlinks(path)
	st, ok := s.Sys().(*syscall.Stat_t)
	if err != nil || canonical != path || !ok || st.Uid != 0 {
		return deny("CANONICAL_ROOT_OWNER")
	}
	return nil
}
func openRegular(path string) (*os.File, error) {
	fd, err := syscall.Open(path, syscall.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), path)
	s, err := f.Stat()
	if err != nil || !s.Mode().IsRegular() || s.Sys().(*syscall.Stat_t).Uid != 0 ||
		s.Sys().(*syscall.Stat_t).Nlink != 1 {
		f.Close()
		return nil, deny("REGULAR_OWNED_SINGLE_LINK_REQUIRED")
	}
	return f, nil
}
func identity(path string) (string, int64, error) {
	f, e := openRegular(path)
	if e != nil {
		return "", 0, e
	}
	defer f.Close()
	h := sha256.New()
	n, e := io.Copy(h, f)
	return hex.EncodeToString(h.Sum(nil)), n, e
}
func same(path string, original os.FileInfo) bool {
	now, e := os.Lstat(path)
	return e == nil && os.SameFile(now, original)
}

type owned struct {
	path string
	info os.FileInfo
}
type stage struct {
	roots   []owned
	files   []owned
	mounted bool
}

func (s *stage) directory(path string, mode os.FileMode) error {
	if e := os.Mkdir(path, mode); e != nil {
		return e
	}
	info, e := os.Lstat(path)
	if e != nil {
		return e
	}
	s.roots = append(s.roots, owned{path, info})
	return os.Chmod(path, mode)
}
func (s *stage) write(spec fileSpec, reader io.Reader) error {
	path := filepath.Join(base, transaction, "inputs", spec.Name)
	if spec.Name == "g3a-final-runner" {
		path = filepath.Join(base, spec.Name)
	}
	fd, e := syscall.Open(path, syscall.O_WRONLY|syscall.O_CREAT|syscall.O_EXCL|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0600)
	if e != nil {
		return e
	}
	f := os.NewFile(uintptr(fd), path)
	info, e := f.Stat()
	if e != nil {
		f.Close()
		return e
	}
	s.files = append(s.files, owned{path, info})
	n, e := io.Copy(f, reader)
	if e == nil && n != spec.Bytes {
		e = deny("STAGED_SIZE")
	}
	if e == nil {
		e = f.Sync()
	}
	if e == nil {
		e = f.Chmod(os.FileMode(spec.Mode))
	}
	closeErr := f.Close()
	if e == nil {
		e = closeErr
	}
	return e
}
func (s *stage) cleanup(keepRunner bool) error {
	input := filepath.Join(base, transaction, "inputs")
	if s.mounted {
		var target os.FileInfo
		for _, root := range s.roots {
			if root.path == input {
				target = root.info
			}
		}
		if target == nil || !same(input, target) {
			return deny("OWNED_MOUNT_BOUNDARY_CHANGED")
		}
		if e := syscall.Unmount(input, 0); e != nil {
			return e
		}
		s.mounted = false
	}
	for _, root := range s.roots {
		if !same(root.path, root.info) {
			return deny("OWNED_ROOT_REPLACED")
		}
	}
	for _, file := range s.files {
		if keepRunner && file.path == filepath.Join(base, "g3a-final-runner") {
			continue
		}
		if !same(file.path, file.info) {
			return deny("OWNED_FILE_REPLACED")
		}
		if e := os.Remove(file.path); e != nil {
			return e
		}
	}
	for i := len(s.roots) - 1; i >= 0; i-- {
		if e := os.Remove(s.roots[i].path); e != nil {
			return e
		}
	}
	return nil
}

type capBuffer struct {
	bytes.Buffer
	limit    int
	overflow bool
}

func (b *capBuffer) Write(raw []byte) (int, error) {
	n := len(raw)
	space := b.limit - b.Len()
	if len(raw) > space {
		raw = raw[:space]
		b.overflow = true
	}
	b.Buffer.Write(raw)
	return n, nil
}
func runCandidate() (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, filepath.Join(base, "g3a-final-runner"), "--hard-bound-static-proof", contractSHA)
	cmd.Dir = base
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C"}
	cmd.Stdin = bytes.NewReader(nil)
	out, stderr := &capBuffer{limit: 3800}, &capBuffer{limit: 4096}
	cmd.Stdout, cmd.Stderr = out, stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGKILL, Setpgid: true}
	cmd.WaitDelay = 2 * time.Second
	if e := cmd.Start(); e != nil {
		return -1, e
	}
	e := cmd.Wait()
	syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	code := cmd.ProcessState.ExitCode()
	if e != nil || out.overflow || stderr.overflow || code != 0 {
		return code, deny("UNCHANGED_CANDIDATE_PROOF_FAILED")
	}
	return code, nil
}
func readEvidence(name string) ([]byte, error) {
	root := filepath.Join(base, evidence)
	if e := private(root); e != nil {
		return nil, e
	}
	f, e := openRegular(filepath.Join(root, name))
	if e != nil {
		return nil, e
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || info.Mode().Perm() != 0600 || info.Size() > 262144 {
		return nil, deny("EVIDENCE_BOUND")
	}
	raw, e := io.ReadAll(io.LimitReader(f, 262145))
	if e != nil || int64(len(raw)) != info.Size() {
		return nil, deny("EVIDENCE_READ")
	}
	return raw, nil
}
func checkProof() (map[string]interface{}, error) {
	raw, e := readEvidence("proof.json")
	if e != nil {
		return nil, e
	}
	baseline, e := readEvidence("baseline.json")
	if e != nil {
		return nil, e
	}
	var p struct {
		Schema         string                 `json:"schema"`
		Mode           string                 `json:"mode"`
		Outcome        string                 `json:"outcome"`
		CandidateSHA   string                 `json:"candidateSha256"`
		CandidateBytes int64                  `json:"candidateBytes"`
		BaselineSHA    string                 `json:"baselineSha256"`
		RuntimeSHA     string                 `json:"runtimeEvidenceSha256"`
		Checks         map[string]string      `json:"checks"`
		Details        map[string]interface{} `json:"details"`
	}
	if json.Unmarshal(raw, &p) != nil || p.Schema != "g3a-final-hard-bound-static-proof/v1" ||
		p.Mode != "--hard-bound-static-proof" || p.Outcome != "PASS" || p.CandidateSHA != candidateSHA || p.CandidateBytes != candidateBytes ||
		p.Details["coreInvocations"] != float64(0) || p.Details["staticWitnessInvocations"] != float64(1) ||
		p.Details["productionExecutionAuthorityDigest"] != "" || p.Details["proofContractSha256"] != contractSHA {
		return nil, deny("EXACT_SUCCESS_PROOF_REQUIRED")
	}
	required := []string{"baseline", "buildLimitEffective", "executableMounts", "hardBoundCleanup", "hostFSNegative", "minimalNull", "mountNamespace", "namespaceCleanup",
		"networkIsolation", "networkNegative", "noNewPrivs", "privilegeDrop", "privilegeRegainNegative", "productionDispatch", "productionFailClosed", "productionMounts",
		"readonlyInputs", "rootIsolation", "selfContained", "tmpLimitEffective"}
	if len(p.Checks) != len(required) {
		return nil, deny("CHECK_CENSUS")
	}
	for _, name := range required {
		if p.Checks[name] != "PASS" {
			return nil, deny("CHECK_NOT_PASS_" + name)
		}
	}
	bhash := sha256.Sum256(baseline)
	if hex.EncodeToString(bhash[:]) != p.BaselineSHA {
		return nil, deny("BASELINE_HASH")
	}
	phash := sha256.Sum256(raw)
	return map[string]interface{}{"proofSha256": hex.EncodeToString(phash[:]), "baselineSha256": p.BaselineSHA, "runtimeSha256": p.RuntimeSHA}, nil
}
func deliver(f *os.File, shimSHA string, shimBytes int64) (result error) {
	for _, path := range []string{transaction, evidence, deliveryEvidence, "g3a-final-runner"} {
		if _, e := os.Lstat(filepath.Join(base, path)); !os.IsNotExist(e) {
			return deny("EXCLUSIVE_DELIVERY_PATH_REQUIRED_" + path)
		}
	}
	if e := validateBundle(f, nil); e != nil {
		return e
	}
	var outer syscall.Statfs_t
	if e := syscall.Statfs(base, &outer); e != nil || outer.Type == 16914836 {
		return deny("EXTERNAL_DISK_STAGING_REQUIRED_NO_TMPFS_COPY")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	if e := syscall.Unshare(syscall.CLONE_NEWNS); e != nil {
		return e
	}
	if e := syscall.Mount("", "/", "", syscall.MS_PRIVATE|syscall.MS_REC, ""); e != nil {
		return e
	}
	s := &stage{}
	success := false
	candidateReady := false
	defer func() {
		if !success {
			result = errors.Join(result, s.cleanup(candidateReady))
		}
	}()
	if e := s.directory(filepath.Join(base, transaction), 0700); e != nil {
		return e
	}
	if e := s.directory(filepath.Join(base, transaction, "receipts"), 0700); e != nil {
		return e
	}
	if e := s.directory(filepath.Join(base, transaction, "inputs"), 0555); e != nil {
		return e
	}
	if e := validateBundle(f, s.write); e != nil {
		return e
	}
	candidateReady = true
	input := filepath.Join(base, transaction, "inputs")
	if e := syscall.Mount(input, input, "", syscall.MS_BIND, ""); e != nil {
		return e
	}
	s.mounted = true
	if e := syscall.Mount("", input, "", syscall.MS_REMOUNT|syscall.MS_BIND|syscall.MS_RDONLY|syscall.MS_NOSUID|syscall.MS_NODEV, ""); e != nil {
		return e
	}
	var fs syscall.Statfs_t
	if e := syscall.Statfs(input, &fs); e != nil || fs.Flags&syscall.MS_RDONLY == 0 {
		return deny("INPUTS_NOT_READONLY")
	}
	code, e := runCandidate()
	proof, proofErr := checkProof()
	if e != nil {
		return e
	}
	if proofErr != nil {
		return proofErr
	}
	if e = s.cleanup(true); e != nil {
		return e
	}
	success = true
	proof["schema"] = "g3a-hard-delivery-handoff/v1"
	proof["outcome"] = "PASS"
	proof["shimSha256"] = shimSHA
	proof["shimBytes"] = shimBytes
	proof["bundleSha256"] = bundleSHA
	proof["bundleBytes"] = bundleBytes
	proof["candidateSha256"] = candidateSHA
	proof["candidateBytes"] = candidateBytes
	proof["proofContractSha256"] = contractSHA
	proof["candidateExitCode"] = code
	proof["inputCount"] = 15
	proof["inputBytes"] = 265077049
	proof["inputRoot"] = input
	proof["candidatePath"] = filepath.Join(base, "g3a-final-runner")
	proof["evidenceRoot"] = filepath.Join(base, evidence)
	proof["inputBuildChargeBytes"] = 0
	proof["inputStagingFilesystem"] = "EXTERNAL_DISK_NO_TMPFS_COPY"
	proof["readonlyInputBind"] = "PASS"
	proof["ownedStagingCleanup"] = "PASS"
	proof["candidateAndExactEvidenceRetained"] = true
	proof["frozenCoreInvocations"] = 0
	proof["futureAuthorityIssued"] = false
	proof["productionAuthorityDigest"] = ""
	if e = os.Mkdir(filepath.Join(base, deliveryEvidence), 0700); e != nil {
		return e
	}
	raw, e := json.Marshal(proof)
	if e != nil {
		return e
	}
	path := filepath.Join(base, deliveryEvidence, "handoff.json")
	fd, e := syscall.Open(path, syscall.O_WRONLY|syscall.O_CREAT|syscall.O_EXCL|syscall.O_NOFOLLOW, 0600)
	if e != nil {
		return e
	}
	output := os.NewFile(uintptr(fd), path)
	_, e = output.Write(raw)
	if e == nil {
		e = output.Sync()
	}
	ce := output.Close()
	if e == nil {
		e = ce
	}
	if e != nil {
		return e
	}
	fmt.Println(marker + string(raw))
	return nil
}
func run(args []string) error {
	if len(args) != 2 || args[1] != bundleSHA || (args[0] != "--deliver-bound-static-proof" && args[0] != "--verify-bound-bundle") {
		return deny("FIXED_DELIVERY_CONTRACT_REQUIRED")
	}
	if os.Geteuid() != 0 {
		return deny("ROOT_REQUIRED")
	}
	cwd, e := os.Getwd()
	if e != nil || cwd != base {
		return deny("FIXED_CSE_WORKING_DIRECTORY_REQUIRED")
	}
	if e = private(base); e != nil {
		return e
	}
	f, e := openRegular(filepath.Join(base, "g3a-proof-capsule"))
	if e != nil {
		return e
	}
	defer f.Close()
	if args[0] == "--verify-bound-bundle" {
		return validateBundle(f, nil)
	}
	self, e := os.Open("/proc/self/exe")
	if e != nil {
		return e
	}
	h := sha256.New()
	shimBytes, e := io.Copy(h, self)
	self.Close()
	shimSHA := hex.EncodeToString(h.Sum(nil))
	if e != nil {
		return e
	}
	published, publishedBytes, e := identity(filepath.Join(base, "g3a-handoff"))
	if e != nil || published != shimSHA || publishedBytes != shimBytes {
		return deny("PUBLISHED_SHIM_IDENTITY")
	}
	if e = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); e != nil {
		return deny("EXCLUSIVE_BUNDLE_LOCK_REQUIRED")
	}
	return deliver(f, shimSHA, shimBytes)
}
func main() {
	if e := run(os.Args[1:]); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
