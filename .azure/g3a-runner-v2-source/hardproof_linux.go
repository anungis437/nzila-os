//go:build linux && amd64

package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const hardProofSchema = "g3a-final-hard-bound-static-proof/v1"
const hardProofMarker = "G3A_FINAL_STATIC_PROOF_V1 "
const hardProofTransaction = "HARD_BOUND_STATIC_PROOF"
const hardProofEvidenceRoot = ".g3a-isolation-proof-hard-bound-static"
const hardProofOutputBound = 262144
const hardProofDiagnosticBound = 3800

//go:embed proof_contract.json
var hardProofContract []byte

//go:embed static-witness
var hardProofExecutable []byte

func fixedProofLimits() limits {
	return limits{1073741824, 32768, 268435456, 4096}
}

func validateHardProofArguments(args []string) error {
	if len(args) != 2 || (args[0] != "--hard-bound-static-proof" && args[0] != "--_hard-bound-static-proof-child") ||
		args[1] != hardProofContractSHA256 || shaBytes(hardProofContract) != hardProofContractSHA256 ||
		shaBytes(payload) != qualifiedRuntimePayloadSHA256 ||
		shaBytes(hardProofExecutable) != hardProofExecutableSHA256 {
		return errors.New("FIXED_SOURCE_BOUND_STATIC_PROOF_CONTRACT_REQUIRED")
	}
	return nil
}

func hardBoundProofCLI(args []string) int {
	if err := validateHardProofArguments(args); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if args[0] == "--_hard-bound-static-proof-child" {
		return hardBoundStaticProofChild()
	}
	return hardBoundStaticProof()
}

func proofRequest(base string) productionRequest {
	boundary := filepath.Join(base, ".g3a-transaction-"+hardProofTransaction)
	return productionRequest{Transaction: hardProofTransaction, Capacity: fixedProofLimits(),
		InputRoot: filepath.Join(boundary, "inputs"), ReceiptRoot: filepath.Join(boundary, "receipts")}
}

func validatedHardProofPlan(plan map[string]string) (verifiedProduction, error) {
	var result verifiedProduction
	cwd, err := os.Getwd()
	if err != nil || len(plan) != 4 || plan["contract"] != hardProofContractSHA256 ||
		plan["parentPID"] != strconv.Itoa(os.Getppid()) ||
		plan["evidence"] != cwd || cwd != filepath.Join(plan["cwd"], hardProofEvidenceRoot) ||
		filepath.Clean(plan["cwd"]) != plan["cwd"] || !filepath.IsAbs(plan["cwd"]) {
		return result, errors.New("FIXED_STATIC_PROOF_PLAN_REQUIRED")
	}
	if err = secureRoot(plan["cwd"]); err != nil {
		return result, err
	}
	if err = secureRoot(cwd); err != nil {
		return result, err
	}
	result.Request = proofRequest(plan["cwd"])
	// No authority is generated, read, pinned, consumed or placed into this static-only plan.
	return result, checkTransactionInputs(result.Request)
}

func proofReadDenied() error {
	return runProduction(strings.NewReader(`{"authority":"not-an-authority","capacity":{"buildRootBytes":1073741824}}`))
}

func hardBoundStaticProof() int {
	r := newResult()
	r.Schema, r.Mode = hardProofSchema, "--hard-bound-static-proof"
	r.SHA256, r.Bytes, _ = hashFile("/proc/self/exe")
	r.Details["scope"] = "ACTUAL_CONSTRUCTOR_STATIC_WITNESS_NOT_FROZEN_CORE_OR_LIVE_QUALIFICATION"
	r.Details["proofContractSha256"] = hardProofContractSHA256
	r.Details["productionExecutionAuthorityDigest"] = ""
	r.Details["coreInvocations"] = 0
	r.Details["staticWitnessInvocations"] = 0
	base, err := os.Getwd()
	if err != nil || os.Geteuid() != 0 || secureRoot(base) != nil {
		fail(&r, "baseline", "ROOT_OWNED_PRIVATE_WORKING_DIRECTORY_REQUIRED")
		return finishHardProof(r, "")
	}
	if proofReadDenied() == nil {
		fail(&r, "productionAuthority", "PUBLIC_PRODUCTION_NOT_FAILCLOSED")
		return finishHardProof(r, "")
	}
	r.Checks["productionFailClosed"] = "PASS"
	b, err := captureBaseline()
	if err != nil {
		fail(&r, "baseline", errnoCode(err))
		return finishHardProof(r, "")
	}
	r.Baseline, r.Checks["baseline"] = &b, "PASS"
	baseRaw, _ := json.Marshal(b)
	r.BaselineSHA256 = shaBytes(baseRaw)
	r.EmbeddedCount, r.CensusSHA256, err = census()
	if err != nil || r.EmbeddedCount != 141 || r.SHA256 == "" {
		fail(&r, "baseline", "CANDIDATE_IDENTITY_OR_CENSUS")
		return finishHardProof(r, "")
	}
	request := proofRequest(base)
	if err = checkTransactionInputs(request); err != nil {
		fail(&r, "staticProofInputs", err.Error())
		return finishHardProof(r, "")
	}
	inputBefore, err := os.Stat(request.InputRoot)
	if err != nil {
		fail(&r, "staticProofInputs", errnoCode(err))
		return finishHardProof(r, "")
	}
	mountBefore, err := os.ReadFile("/proc/self/mountinfo")
	if err != nil {
		fail(&r, "baseline", errnoCode(err))
		return finishHardProof(r, "")
	}
	evidence := filepath.Join(base, hardProofEvidenceRoot)
	if err = os.Mkdir(evidence, 0700); err != nil {
		fail(&r, "evidence", "EXCLUSIVE_FIXED_PROOF_ROOT_REQUIRED")
		return finishHardProof(r, "")
	}
	if err = os.WriteFile(filepath.Join(evidence, "baseline.json"), baseRaw, 0600); err != nil {
		fail(&r, "evidence", errnoCode(err))
		return finishHardProof(r, evidence)
	}
	input, writer, err := os.Pipe()
	if err != nil {
		fail(&r, "child", errnoCode(err))
		return finishHardProof(r, evidence)
	}
	defer input.Close()
	defer writer.Close()
	pipe, childEvidence, err := os.Pipe()
	if err != nil {
		fail(&r, "child", errnoCode(err))
		return finishHardProof(r, evidence)
	}
	defer pipe.Close()
	defer childEvidence.Close()
	plan, _ := json.Marshal(map[string]string{"evidence": evidence, "cwd": base,
		"contract": hardProofContractSHA256, "parentPID": strconv.Itoa(os.Getpid())})
	ctx, cancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/proc/self/exe", "--_hard-bound-static-proof-child", hardProofContractSHA256)
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C"}
	cmd.Dir = evidence
	cmd.ExtraFiles = []*os.File{input, childEvidence}
	cmd.SysProcAttr = &syscall.SysProcAttr{Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWNET,
		Pdeathsig: syscall.SIGKILL, Setpgid: true}
	stdout, stderr := &cappedBuffer{limit: hardProofOutputBound}, &cappedBuffer{limit: 4096}
	cmd.Stdout, cmd.Stderr, cmd.Stdin = stdout, stderr, bytes.NewReader(nil)
	cmd.WaitDelay = 2 * time.Second
	err = cmd.Start()
	input.Close()
	childEvidence.Close()
	if err != nil {
		fail(&r, "namespaceClone", errnoCode(err))
		return finishHardProof(r, evidence)
	}
	drained := make(chan struct {
		raw []byte
		err error
	}, 1)
	go func() {
		raw, err := io.ReadAll(io.LimitReader(pipe, 4097))
		drained <- struct {
			raw []byte
			err error
		}{raw, err}
	}()
	_, writeErr := writer.Write(plan)
	writer.Close()
	waitErr := cmd.Wait()
	syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	var witness []byte
	var witnessErr error
	select {
	case value := <-drained:
		witness, witnessErr = value.raw, value.err
	case <-time.After(2 * time.Second):
		witnessErr = errors.New("PROOF_EVIDENCE_PIPE_TIMEOUT")
		pipe.Close()
	}
	var child proofResult
	if writeErr != nil || witnessErr != nil || len(witness) > 4096 ||
		json.Unmarshal(stdout.Bytes(), &child) != nil || child.Schema != r.Schema ||
		child.Mode != r.Mode || child.Checks == nil || child.Details == nil {
		fail(&r, "child", "BOUNDED_STRUCTURED_CHILD_OUTPUT_REQUIRED")
		r.Details["childStdout"] = stdout.String()
		r.Details["childStderr"] = stderr.String()
	} else {
		for k, v := range child.Checks {
			if k != "baseline" {
				r.Checks[k] = v
			}
		}
		child.Details["scope"] = r.Details["scope"]
		child.Details["proofContractSha256"] = hardProofContractSHA256
		r.Details, r.RuntimeSHA256, r.RuntimeCount = child.Details, child.RuntimeSHA256, child.RuntimeCount
		r.Outcome, r.FailedPrimitive, r.ErrorCode = child.Outcome, child.FailedPrimitive, child.ErrorCode
		r.FailedOperation = child.FailedOperation
		if waitErr != nil && child.Outcome == "PASS" {
			fail(&r, "child", "PROOF_CHILD_EXIT_INCONSISTENT")
		}
		if child.Outcome == "PASS" && string(witness) != "G3A_HARMLESS_STATIC_DISPATCH_V1\n" {
			fail(&r, "productionDispatch", "STATIC_DISPATCH_WITNESS_PIPE_REQUIRED")
		}
	}
	inputAfter, inputErr := os.Stat(request.InputRoot)
	mountAfter, mountErr := os.ReadFile("/proc/self/mountinfo")
	root := filepath.Join(evidence, "root")
	entries, rootErr := os.ReadDir(root)
	rootAbsent := os.IsNotExist(rootErr)
	rootEmpty := rootErr == nil && len(entries) == 0
	removeErr := error(nil)
	if rootEmpty {
		removeErr = os.Remove(root)
	}
	pidErr := syscall.Kill(cmd.Process.Pid, 0)
	if inputErr != nil || !os.SameFile(inputBefore, inputAfter) || checkTransactionInputs(request) != nil ||
		mountErr != nil || !bytes.Equal(mountBefore, mountAfter) || (!rootAbsent && !rootEmpty) ||
		removeErr != nil || !errors.Is(pidErr, syscall.ESRCH) {
		fail(&r, "namespaceCleanup", "PROOF_CHILD_INPUT_OR_MOUNT_RESIDUAL")
	} else {
		r.Checks["namespaceCleanup"] = "PASS"
		r.Details["namespaceCleanup"] = map[string]interface{}{"childPid": cmd.Process.Pid, "childGone": true,
			"parentMountinfoUnchanged": true, "outerInputsUnchanged": true, "isolatedUnderlyingRootEmpty": true,
			"isolatedRootRemoved": true, "parentMountinfoSha256": shaBytes(mountAfter)}
	}
	return finishHardProof(r, evidence)
}

func hardProofAllPass(checks map[string]string) bool {
	expected := newResult().Checks
	for _, name := range []string{"productionFailClosed", "productionMounts", "productionDispatch",
		"buildLimitEffective", "tmpLimitEffective", "minimalNull", "executableMounts",
		"readonlyInputs", "hardBoundCleanup", "namespaceCleanup"} {
		expected[name] = "NOT_RUN"
	}
	if len(checks) != len(expected) {
		return false
	}
	for name := range expected {
		if checks[name] != "PASS" {
			return false
		}
	}
	return true
}

func finishHardProof(r proofResult, directory string) int {
	if r.Outcome == "PASS" && !hardProofAllPass(r.Checks) {
		fail(&r, "child", "INCOMPLETE_HARD_BOUND_PROOF")
	}
	if directory != "" {
		r.EvidenceFile = hardProofEvidenceRoot + "/proof.json"
		raw, err := json.Marshal(r)
		if err != nil || len(raw) > hardProofOutputBound {
			fail(&r, "evidence", "COMPLETE_PROOF_EVIDENCE_SIZE_BOUND")
		} else {
			f, err := os.OpenFile(filepath.Join(directory, "proof.json"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
			if err == nil {
				_, err = f.Write(raw)
				if closeErr := f.Close(); closeErr != nil {
					err = closeErr
				}
			}
			if err != nil {
				fail(&r, "evidence", errnoCode(err))
			} else {
				r.EvidenceSHA256 = shaBytes(raw)
			}
		}
	}
	r.Baseline, r.Details = nil, nil
	raw, err := json.Marshal(r)
	if err != nil || len(raw)+len(hardProofMarker) > hardProofDiagnosticBound {
		fmt.Fprintln(os.Stderr, "BOUNDED_PROOF_DIAGNOSTIC_REQUIRED")
		return 1
	}
	fmt.Println(hardProofMarker + string(raw))
	if r.Outcome == "PASS" && hardProofAllPass(r.Checks) && r.EvidenceSHA256 != "" {
		return 0
	}
	return 1
}

func invokeHardProofWitness(plan verifiedProduction, r *proofResult, evidence io.Writer) error {
	if plan.Pin != "" || len(plan.Raw) != 0 || len(plan.Request.Authority) != 0 ||
		plan.Request.Capacity != fixedProofLimits() || plan.Request.Transaction != hardProofTransaction ||
		proofReadDenied() == nil {
		return errors.New("STATIC_SCOPE_NO_PRODUCTION_AUTHORITY")
	}
	r.Checks["productionFailClosed"] = "PASS"
	initial, err := effectiveAt("/", fixedProofLimits())
	if err != nil {
		return err
	}
	for _, item := range []struct {
		name          string
		bytes, inodes uint64
	}{{"build", 1073741824, 32768}, {"tmp", 268435456, 4096}} {
		value := initial[item.name]
		entries, readErr := os.ReadDir("/" + item.name)
		if readErr != nil || len(entries) != 0 || value.AvailableBytes != item.bytes ||
			value.AvailableInodes != item.inodes-1 {
			return errors.New("EMPTY_FULL_CAPACITY_WITH_ZERO_INPUT_CHARGE_REQUIRED")
		}
	}
	r.Details["initialLimits"] = initial
	mounts := map[string]filesystemLimit{}
	for _, path := range []string{"/", "/runtime", "/inputs", "/build", "/tmp", "/work", "/output", "/dev"} {
		value, err := filesystemObservation(path)
		if err != nil {
			return err
		}
		mounts[path] = value
	}
	r.Details["actualMounts"] = mounts
	if err = os.WriteFile("/inputs/forbidden", nil, 0600); !errors.Is(err, syscall.EROFS) {
		return errors.New("ISOLATED_INPUT_WRITE_NOT_EROFS")
	}
	if err = readonlyInputRoot("/inputs"); err != nil {
		return err
	}
	r.Checks["readonlyInputs"] = "PASS"
	calls := 0
	bad := plan
	bad.Request.Capacity.BuildBytes -= 4096
	if dispatchConstructedCore(bad, r, func() error { calls++; return nil }) == nil || calls != 0 {
		return errors.New("ACTUAL_CAPACITY_DENIAL_REACHED_STATIC_BOUNDARY")
	}
	if err = os.Mkdir("/build/transaction", 0700); err != nil {
		return err
	}
	if dispatchConstructedCore(plan, r, func() error { calls++; return nil }) == nil || calls != 0 {
		return errors.New("DIRTY_BUILD_DENIAL_REACHED_STATIC_BOUNDARY")
	}
	r.Details["actualDispatchNegatives"] = map[string]string{
		"effectiveCapacityMismatch":   "DENIED_BEFORE_STATIC_CALLBACK",
		"preexistingBuildTransaction": "DENIED_BEFORE_STATIC_CALLBACK"}
	execWitness := map[string]string{}
	err = dispatchConstructedCore(plan, r, func() error {
		calls++
		for _, path := range []string{"/build", "/tmp", "/work", "/output"} {
			executable := filepath.Join(path, "source-bound-static-witness")
			if err := os.WriteFile(executable, hardProofExecutable, 0500); err != nil {
				return err
			}
			cmd := exec.Command(executable)
			cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable"}
			out := &cappedBuffer{limit: 4096}
			cmd.Stdin, cmd.Stdout, cmd.Stderr = bytes.NewReader(nil), out, out
			runErr := cmd.Run()
			if path == "/work" || path == "/output" {
				if !errors.Is(runErr, syscall.EACCES) {
					return errors.New("ACTUAL_NOEXEC_NEGATIVE_FAILED_" + path)
				}
				execWitness[path] = "EACCES"
			} else {
				if runErr != nil || out.String() != "G3A_HARMLESS_STATIC_EXEC_WITNESS_V1\n" {
					return errors.New("ACTUAL_EXEC_STATIC_WITNESS_FAILED_" + path)
				}
				execWitness[path] = out.String()
			}
			if err := os.Remove(executable); err != nil {
				return err
			}
		}
		if os.Mkdir("/build/transaction", 0700) != nil ||
			os.WriteFile("/build/transaction/static-cleanup", []byte("static-only"), 0600) != nil ||
			os.WriteFile("/tmp/static-cleanup", []byte("static-only"), 0600) != nil {
			return errors.New("STATIC_CLEANUP_WITNESS_SETUP")
		}
		_, err := io.WriteString(evidence, "G3A_HARMLESS_STATIC_DISPATCH_V1\n")
		return err
	})
	if err != nil || calls != 1 {
		return errors.New("ACTUAL_CONSTRUCTOR_STATIC_DISPATCH_FAILED")
	}
	final, err := effectiveAt("/", fixedProofLimits())
	if err != nil || final["build"] != initial["build"] || final["tmp"] != initial["tmp"] {
		return errors.New("EXACT_AVAILABLE_CAPACITY_CLEANUP_FAILED")
	}
	for _, name := range []string{"build", "tmp"} {
		entries, err := os.ReadDir("/" + name)
		if err != nil || len(entries) != 0 {
			return errors.New("ACTUAL_BUILD_TMP_CLEANUP_FAILED")
		}
	}
	if err = readonlyInputRoot("/inputs"); err != nil {
		return err
	}
	r.Details["finalLimits"], r.Details["executableMountWitness"] = final, execWitness
	r.Details["coreInvocations"], r.Details["staticWitnessInvocations"] = 0, calls
	r.Details["inputSpecSha256"], r.Details["inputCount"] = frozenInputSpecSHA256, len(frozenInputs)
	r.Details["inputLayout"], r.Details["inputBuildChargeBytes"] = "direct readonly /inputs external bind", 0
	r.Details["productionExecutionAuthorityDigest"] = ""
	r.Details["staticExecutableSha256"] = hardProofExecutableSHA256
	for _, name := range []string{"productionMounts", "productionDispatch", "buildLimitEffective",
		"tmpLimitEffective", "minimalNull", "executableMounts", "hardBoundCleanup"} {
		r.Checks[name] = "PASS"
	}
	return nil
}
