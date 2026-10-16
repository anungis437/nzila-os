//go:build linux && amd64

package main

import (
	"archive/tar"
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
	"sort"
	"strings"
	"syscall"
	"time"
)

const outputLimit = 64 * 1024 * 1024
const pipeLimit = outputLimit + 1024*1024

type consumedReceipt struct {
	Pin       string `json:"authoritySha256"`
	ParentPID int    `json:"parentPID"`
}

func secureRoot(path string) error {
	value, err := os.Lstat(path)
	if err != nil || !value.IsDir() || value.Mode()&os.ModeSymlink != 0 || value.Mode().Perm()&0077 != 0 {
		return errors.New("PRIVATE_ROOT_REQUIRED")
	}
	canonical, err := filepath.EvalSymlinks(path)
	if err != nil || canonical != path {
		return errors.New("ROOT_SYMLINK_DENIED")
	}
	stat, ok := value.Sys().(*syscall.Stat_t)
	if !ok || int(stat.Uid) != os.Geteuid() {
		return errors.New("ROOT_OWNER_MISMATCH")
	}
	return nil
}

func validateInputFiles(root string) error {
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != len(frozenInputs) {
		return errors.New("FROZEN_INPUT_EXACT_CENSUS")
	}
	for _, entry := range entries {
		name := entry.Name()
		expected, ok := frozenInputs[name]
		if !ok || !safe(name) || strings.ContainsAny(name, "/\\\\") {
			return errors.New("FROZEN_INPUT_UNEXPECTED_ENTRY")
		}
		path := filepath.Join(root, name)
		stat, err := os.Lstat(path)
		if err != nil || !stat.Mode().IsRegular() || stat.Size() != expected.Bytes ||
			stat.Mode()&(os.ModeSetuid|os.ModeSetgid) != 0 || stat.Mode().Perm()&0004 == 0 {
			return errors.New("FROZEN_INPUT_TYPE_SIZE_MODE_" + name)
		}
		if (name == "portable-assembler" || name == "compressor-go1256") && stat.Mode().Perm()&0001 == 0 {
			return errors.New("FROZEN_INPUT_NONROOT_EXEC_" + name)
		}
		file, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
		if err != nil {
			return err
		}
		opened, err := file.Stat()
		if err != nil || !os.SameFile(stat, opened) || !opened.Mode().IsRegular() || opened.Size() != expected.Bytes {
			file.Close()
			return errors.New("FROZEN_INPUT_CHANGED_" + name)
		}
		h := sha256.New()
		count, hashErr := io.CopyN(h, file, expected.Bytes)
		var extra [1]byte
		tail, tailErr := file.Read(extra[:])
		after, statErr := file.Stat()
		closeErr := file.Close()
		if hashErr != nil || count != expected.Bytes || tail != 0 || tailErr != io.EOF ||
			statErr != nil || after.Size() != expected.Bytes || closeErr != nil ||
			hex.EncodeToString(h.Sum(nil)) != expected.SHA {
			return errors.New("FROZEN_INPUT_HASH_" + name)
		}
	}
	return nil
}

func readonlyInputRoot(root string) error {
	stat, err := os.Lstat(root)
	canonical, canonicalErr := filepath.EvalSymlinks(root)
	if err != nil || !stat.IsDir() || stat.Mode()&os.ModeSymlink != 0 ||
		canonicalErr != nil || canonical != root || stat.Mode().Perm()&0005 != 0005 {
		return errors.New("CANONICAL_NONROOT_READABLE_INPUT_ROOT_REQUIRED")
	}
	observed, err := filesystemObservation(root)
	if err != nil || observed.Flags&syscall.MS_RDONLY == 0 {
		return errors.New("OUTER_INPUT_ROOT_NOT_KERNEL_READONLY")
	}
	return validateInputFiles(root)
}

func checkTransactionInputs(request productionRequest) error {
	if err := validateTransactionRoots(request); err != nil {
		return err
	}
	if err := secureRoot(filepath.Dir(request.InputRoot)); err != nil {
		return err
	}
	if err := secureRoot(request.ReceiptRoot); err != nil {
		return err
	}
	stat, err := os.Lstat(request.InputRoot)
	if err != nil {
		return err
	}
	owner, ok := stat.Sys().(*syscall.Stat_t)
	if !ok || int(owner.Uid) != os.Geteuid() {
		return errors.New("INPUT_ROOT_OWNER_MISMATCH")
	}
	return readonlyInputRoot(request.InputRoot)
}

type linuxProductionBackend struct{}

func (linuxProductionBackend) prepare(plan verifiedProduction) error {
	if shaBytes(payload) != qualifiedRuntimePayloadSHA256 {
		return errors.New("QUALIFIED_RUNTIME_PAYLOAD_MISMATCH")
	}
	if err := secureRoot(plan.Request.ReceiptRoot); err != nil {
		return err
	}
	return checkTransactionInputs(plan.Request)
}

func receiptPath(plan verifiedProduction) string {
	return filepath.Join(plan.Request.ReceiptRoot, "transaction.consumed.json")
}

func writeConsumedReceipt(plan verifiedProduction) error {
	if err := secureRoot(plan.Request.ReceiptRoot); err != nil {
		return err
	}
	file, err := os.OpenFile(receiptPath(plan), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return errors.New("AUTHORITY_CONSUMED_OR_RECEIPT_UNAVAILABLE")
	}
	// An incomplete receipt remains consumed. No error path removes it.
	defer file.Close()
	raw, err := json.Marshal(consumedReceipt{plan.Pin, os.Getpid()})
	if err != nil {
		return err
	}
	if _, err = file.Write(raw); err != nil {
		return err
	}
	if err = file.Sync(); err != nil {
		return err
	}
	dir, err := os.Open(plan.Request.ReceiptRoot)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func (linuxProductionBackend) consume(plan verifiedProduction) error {
	return writeConsumedReceipt(plan)
}

func runProduction(input io.Reader) error {
	if trustedExecutionAuthoritySHA256 == "" {
		return errors.New("FUTURE_EXECUTION_AUTHORITY_DIGEST_REQUIRED")
	}
	raw, err := io.ReadAll(io.LimitReader(input, 16385))
	if err != nil {
		return err
	}
	return dispatchProduction(raw, trustedExecutionAuthoritySHA256, linuxProductionBackend{})
}

func validatedChildPlan(plan map[string]string) (verifiedProduction, error) {
	verified, err := validateRequest([]byte(plan["production"]), trustedExecutionAuthoritySHA256)
	if err != nil {
		return verified, err
	}
	if err = secureRoot(verified.Request.ReceiptRoot); err != nil {
		return verified, err
	}
	path := receiptPath(verified)
	stat, err := os.Lstat(path)
	if err != nil || !stat.Mode().IsRegular() || stat.Mode().Perm() != 0600 || stat.Size() > 1024 {
		return verified, errors.New("CHILD_RECEIPT_INVALID")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return verified, err
	}
	var receipt consumedReceipt
	if strictJSON(raw, &receipt) != nil || receipt.Pin != verified.Pin || receipt.ParentPID != os.Getppid() {
		return verified, errors.New("CHILD_RECEIPT_PARENT_BINDING")
	}
	return verified, nil
}

type cappedBuffer struct {
	bytes.Buffer
	limit int
}

func (b *cappedBuffer) Write(raw []byte) (int, error) {
	if len(raw) > b.limit-b.Len() {
		return 0, errors.New("PIPE_EVIDENCE_BOUND")
	}
	return b.Buffer.Write(raw)
}

func (linuxProductionBackend) launch(verified verifiedProduction) (returnErr error) {
	b, err := captureBaseline()
	if err != nil {
		return err
	}
	if err = secureRoot(b.CWD); err != nil {
		return err
	}
	evidence, err := os.MkdirTemp(b.CWD, ".g3a-isolation-proof-")
	if err != nil {
		return err
	}
	// Mounts exist only in the child's private namespace. Keep result files, remove the empty root.
	defer func() {
		if err := os.Remove(filepath.Join(evidence, "root")); err != nil && !os.IsNotExist(err) {
			returnErr = errors.New("PARENT_ROOT_CLEANUP_FAILED")
		}
	}()
	planRaw, _ := json.Marshal(map[string]string{
		"evidence": evidence, "cwd": b.CWD, "production": string(verified.Raw),
	})
	baselineRaw, _ := json.Marshal(b)
	if err = os.WriteFile(filepath.Join(evidence, "baseline.json"), baselineRaw, 0600); err != nil {
		return err
	}
	planRead, planWrite, err := os.Pipe()
	if err != nil {
		return err
	}
	defer planRead.Close()
	defer planWrite.Close()
	evidenceRead, evidenceWrite, err := os.Pipe()
	if err != nil {
		return err
	}
	defer evidenceRead.Close()
	defer evidenceWrite.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 970*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/proc/self/exe", "--_isolated-production-child")
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C"}
	cmd.Dir = evidence
	cmd.ExtraFiles = []*os.File{planRead, evidenceWrite}
	cmd.SysProcAttr = &syscall.SysProcAttr{Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWNET,
		Pdeathsig: syscall.SIGKILL, Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	cmd.WaitDelay = 2 * time.Second
	stdout, stderr, archive := &cappedBuffer{limit: 1024 * 1024},
		&cappedBuffer{limit: 1024 * 1024}, &cappedBuffer{limit: pipeLimit}
	cmd.Stdout, cmd.Stderr, cmd.Stdin = stdout, stderr, bytes.NewReader(nil)
	if err = cmd.Start(); err != nil {
		return err
	}
	planRead.Close()
	evidenceWrite.Close()
	defer func() {
		err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if err != nil && !errors.Is(err, syscall.ESRCH) {
			returnErr = errors.New("PROCESS_GROUP_CLEANUP_FAILED")
		}
	}()
	evidenceDone := make(chan error, 1)
	go func() {
		_, err := io.Copy(archive, evidenceRead)
		if err != nil {
			cancel()
		}
		evidenceDone <- err
	}()
	_, planErr := planWrite.Write(planRaw)
	planWrite.Close()
	err = cmd.Wait()
	// Close inherited capabilities even if a descendant outlives the direct child.
	groupErr := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	if groupErr != nil && !errors.Is(groupErr, syscall.ESRCH) {
		return errors.New("PROCESS_GROUP_CLEANUP_FAILED")
	}
	evidenceErr := <-evidenceDone
	resultRaw, _ := json.Marshal(map[string]interface{}{
		"authoritySha256": verified.Pin, "transaction": verified.Request.Transaction,
		"childStdout": stdout.String(), "childStderr": stderr.String(),
		"archiveSha256": shaBytes(archive.Bytes()), "archiveBytes": archive.Len(),
		"commandError": fmt.Sprint(err), "planError": fmt.Sprint(planErr),
		"inputLayout": "outer-readonly-inputRoot-bound-at-/inputs", "evidenceStreamError": fmt.Sprint(evidenceErr),
		"automaticRetry": false, "authorityConsumed": true,
	})
	if writeErr := os.WriteFile(filepath.Join(evidence, "production-result.json"), resultRaw, 0600); writeErr != nil {
		return writeErr
	}
	if archive.Len() != 0 {
		if writeErr := os.WriteFile(filepath.Join(evidence, "outputs.tar"), archive.Bytes(), 0600); writeErr != nil {
			return writeErr
		}
	}
	if err != nil || planErr != nil || evidenceErr != nil {
		return errors.New("PRODUCTION_CHILD_FAILED_NO_RETRY")
	}
	var child proofResult
	if json.Unmarshal(stdout.Bytes(), &child) != nil || child.Schema != newResult().Schema ||
		child.Mode != "--production" || child.Checks == nil {
		return errors.New("PRODUCTION_EVIDENCE_INCOMPLETE")
	}
	child.Checks["baseline"] = "PASS"
	if child.Outcome != "PASS" || !allPass(child.Checks) ||
		child.Details["outputArchiveSha256"] != shaBytes(archive.Bytes()) ||
		child.Details["buildTmpEmptied"] != true {
		return errors.New("PRODUCTION_EVIDENCE_INCOMPLETE")
	}
	return nil
}

type mountSpec struct {
	Name    string
	Flags   uintptr
	Options string
}

func boundedSpecs(capacity limits) ([]mountSpec, error) {
	if err := validateLimits(capacity); err != nil {
		return nil, err
	}
	return []mountSpec{
		{"build", syscall.MS_NOSUID | syscall.MS_NODEV,
			fmt.Sprintf("size=%d,nr_inodes=%d,mode=0700,uid=65532,gid=65532", capacity.BuildBytes, capacity.BuildInodes)},
		{"tmp", syscall.MS_NOSUID | syscall.MS_NODEV,
			fmt.Sprintf("size=%d,nr_inodes=%d,mode=0700,uid=65532,gid=65532", capacity.TmpBytes, capacity.TmpInodes)},
	}, nil
}

func mountBoundedRoots(root string, capacity limits, mount func(string, string, string, uintptr, string) error) error {
	specs, err := boundedSpecs(capacity)
	if err != nil {
		return err
	}
	for _, spec := range specs {
		if err = mount("none", filepath.Join(root, spec.Name), "tmpfs", spec.Flags, spec.Options); err != nil {
			return err
		}
	}
	return nil
}

func bindTransactionInputs(root string, request productionRequest) error {
	if err := checkTransactionInputs(request); err != nil {
		return err
	}
	destination := filepath.Join(root, "inputs")
	if err := syscall.Mount(request.InputRoot, destination, "", syscall.MS_BIND, ""); err != nil {
		return err
	}
	if err := syscall.Mount("", destination, "", syscall.MS_BIND|syscall.MS_REMOUNT|
		syscall.MS_RDONLY|syscall.MS_NOSUID|syscall.MS_NODEV, ""); err != nil {
		return err
	}
	return readonlyInputRoot(destination)
}

func filesystemObservation(path string) (filesystemLimit, error) {
	var fs syscall.Statfs_t
	if err := syscall.Statfs(path, &fs); err != nil {
		return filesystemLimit{}, err
	}
	if fs.Bsize <= 0 {
		return filesystemLimit{}, errors.New("INVALID_BLOCK_SIZE")
	}
	bsize := uint64(fs.Bsize)
	if fs.Blocks > ^uint64(0)/bsize || fs.Bavail > ^uint64(0)/bsize {
		return filesystemLimit{}, errors.New("STATFS_OVERFLOW")
	}
	return filesystemLimit{fs.Type, fs.Blocks * bsize, fs.Bavail * bsize, fs.Files, fs.Ffree, fs.Flags}, nil
}

func effectiveAt(root string, capacity limits) (map[string]filesystemLimit, error) {
	observed := map[string]filesystemLimit{}
	for _, name := range []string{"build", "tmp"} {
		value, err := filesystemObservation(filepath.Join(root, name))
		if err != nil {
			return nil, err
		}
		observed[name] = value
	}
	return observed, verifyEffective(capacity, observed)
}

func stageProductionMounts(root string, plan verifiedProduction) error {
	for _, name := range []string{"build", "tmp", "inputs", "dev"} {
		if err := os.Mkdir(filepath.Join(root, name), 0700); err != nil {
			return err
		}
	}
	if err := mountBoundedRoots(root, plan.Request.Capacity, syscall.Mount); err != nil {
		return err
	}
	if _, err := effectiveAt(root, plan.Request.Capacity); err != nil {
		return err
	}
	// Output capacity is a fixed evidence-plumbing ceiling, never executable.
	if err := syscall.Mount("none", filepath.Join(root, "output"), "tmpfs",
		syscall.MS_REMOUNT|syscall.MS_NOEXEC|syscall.MS_NOSUID|syscall.MS_NODEV,
		"size=67108864,nr_inodes=4096"); err != nil {
		return err
	}
	if err := bindTransactionInputs(root, plan.Request); err != nil {
		return err
	}
	dev := filepath.Join(root, "dev")
	if err := syscall.Mount("none", dev, "tmpfs", syscall.MS_NOSUID|syscall.MS_NOEXEC,
		"size=1048576,nr_inodes=8,mode=0755"); err != nil {
		return err
	}
	path := filepath.Join(dev, "null")
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	file.Close()
	if err = syscall.Mount("/dev/null", path, "", syscall.MS_BIND, ""); err != nil {
		return err
	}
	return syscall.Mount("", path, "", syscall.MS_BIND|syscall.MS_REMOUNT|syscall.MS_NOSUID|syscall.MS_NOEXEC, "")
}

func nullOnlyDeviceCheck() error {
	if _, err := os.Lstat("/proc"); !os.IsNotExist(err) {
		return errors.New("PROCFS_PRESENT")
	}
	names, err := os.ReadDir("/dev")
	if err != nil || len(names) != 1 || names[0].Name() != "null" {
		return errors.New("EXACT_NULL_ONLY_CENSUS_REQUIRED")
	}
	var stat syscall.Stat_t
	if syscall.Lstat("/dev/null", &stat) != nil || stat.Mode&syscall.S_IFMT != syscall.S_IFCHR || stat.Rdev != 0x103 {
		return errors.New("NULL_CHAR_1_3_REQUIRED")
	}
	value, err := filesystemObservation("/dev")
	if err != nil || value.Type != 0x01021994 || value.Flags&10 != 10 || value.Flags&4 != 0 {
		return errors.New("MINIMAL_DEV_FLAGS")
	}
	null, err := os.OpenFile("/dev/null", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	defer null.Close()
	raw := make([]byte, 1)
	n, readErr := null.Read(raw)
	if n != 0 || readErr != io.EOF {
		return errors.New("NULL_READ_NOT_EOF")
	}
	if n, err = null.Write([]byte("discard")); err != nil || n != 7 {
		return errors.New("NULL_WRITE_NOT_DISCARDED")
	}
	if err = syscall.Mknod("/build/unauthorized-device", syscall.S_IFCHR|0600, 0x103); !errors.Is(err, syscall.EPERM) {
		return errors.New("DEVICE_CREATION_NOT_DENIED")
	}
	return nil
}

func exportOutputArchive(writer io.Writer, directory string) (string, error) {
	var names []string
	var size int64
	err := filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		name, err := filepath.Rel(directory, path)
		if err != nil || !safe(filepath.ToSlash(name)) || !info.Mode().IsRegular() {
			return errors.New("OUTPUT_ARCHIVE_REGULAR_SAFE_ONLY")
		}
		size += info.Size()
		if size > outputLimit || len(names) >= 4096 {
			return errors.New("OUTPUT_ARCHIVE_BOUND")
		}
		names = append(names, path)
		return nil
	})
	if err != nil {
		return "", err
	}
	sort.Strings(names)
	buffer := &cappedBuffer{limit: pipeLimit}
	tw := tar.NewWriter(buffer)
	for _, path := range names {
		file, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
		if err != nil {
			return "", err
		}
		stat, err := file.Stat()
		if err != nil || !stat.Mode().IsRegular() {
			file.Close()
			return "", errors.New("OUTPUT_TYPE_CHANGED")
		}
		name, _ := filepath.Rel(directory, path)
		err = tw.WriteHeader(&tar.Header{Name: filepath.ToSlash(name), Size: stat.Size(), Mode: 0600, Typeflag: tar.TypeReg})
		if err == nil {
			_, err = io.CopyN(tw, file, stat.Size())
		}
		file.Close()
		if err != nil {
			return "", err
		}
	}
	if err = tw.Close(); err != nil {
		return "", err
	}
	if _, err = io.Copy(writer, bytes.NewReader(buffer.Bytes())); err != nil {
		return "", err
	}
	return shaBytes(buffer.Bytes()), nil
}

func executeFrozenCore(r *proofResult, output io.Writer) (returnErr error) {
	if _, err := os.Lstat("/build/transaction"); !os.IsNotExist(err) {
		return errors.New("FROZEN_WORK_ALREADY_EXISTS")
	}
	if err := os.Mkdir("/output/transaction", 0700); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 900*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/inputs/portable-assembler", "/inputs", "/build/transaction", "/output/transaction")
	cmd.Env = []string{"PATH=/unavailable", "DOCKER_HOST="}
	cmd.Stdin = bytes.NewReader(nil)
	stdout, stderr := &cappedBuffer{limit: 1024 * 1024}, &cappedBuffer{limit: 1024 * 1024}
	cmd.Stdout, cmd.Stderr = stdout, stderr
	cmd.WaitDelay = 2 * time.Second
	err := cmd.Run()
	r.Details["coreInvocations"] = 1
	r.Details["coreStdout"], r.Details["coreStderr"] = stdout.String(), stderr.String()
	if err != nil {
		return errors.New("FROZEN_CORE_FAILED_NO_RETRY_OR_EXPANSION")
	}
	gates := map[string]string{}
	for name, expected := range exactOutputs {
		actual, _, err := hashFile(filepath.Join("/output/transaction", name))
		if err != nil || actual != expected {
			return errors.New("FROZEN_EXACT_OUTPUT_MISMATCH_" + name)
		}
		gates[name] = "YES"
	}
	r.Details["exactImageGates"] = gates
	outputSHA, err := exportOutputArchive(output, "/output")
	if err != nil {
		return err
	}
	r.Details["outputArchiveSha256"] = outputSHA
	return nil
}

func emptyBuildTmp() error {
	return emptyRoots("/build", "/tmp")
}

func emptyRoots(build, temporary string) error {
	for _, root := range []string{build, temporary} {
		entries, err := os.ReadDir(root)
		if err != nil {
			return err
		}
		for _, name := range entries {
			if err = os.RemoveAll(filepath.Join(root, name.Name())); err != nil {
				return err
			}
		}
		entries, err = os.ReadDir(root)
		if err != nil || len(entries) != 0 {
			return errors.New("BUILD_TMP_EMPTY_CLEANUP_FAILED")
		}
	}
	return nil
}

func dispatchConstructedCore(plan verifiedProduction, r *proofResult, core func() error) (returnErr error) {
	observed, err := effectiveAt("/", plan.Request.Capacity)
	if err != nil {
		return err
	}
	r.Details["effectiveLimitsBeforeCore"] = observed
	defer func() {
		if err := emptyBuildTmp(); err != nil {
			returnErr = err
		} else {
			r.Details["buildTmpEmptied"] = true
		}
	}()
	if _, err := os.Lstat("/build/transaction"); !os.IsNotExist(err) {
		return errors.New("FROZEN_WORK_ALREADY_EXISTS")
	}
	if err := readonlyInputRoot("/inputs"); err != nil {
		return err
	}
	return childDispatchBoundary(plan, observed, nullOnlyDeviceCheck, core)
}

func invokeProductionCore(plan verifiedProduction, r *proofResult, output io.Writer) error {
	return dispatchConstructedCore(plan, r, func() error { return executeFrozenCore(r, output) })
}
