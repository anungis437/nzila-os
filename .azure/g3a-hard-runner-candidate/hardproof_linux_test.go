//go:build linux && amd64

package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCandidateProofArguments(t *testing.T) {
	for _, args := range [][]string{
		nil, {"--hard-bound-static-proof"}, {"--hard-bound-static-proof", ""},
		{"--hard-bound-static-proof", strings.Repeat("0", 64)},
		{"--hard-bound-static-proof", strings.ToUpper(hardProofContractSHA256)},
		{"--hard-bound-static-proof", hardProofContractSHA256, "extra"},
		{"--hard-bound-static-proof", hardProofContractSHA256, `{"buildRootBytes":2147483648}`},
		{"--hard-bound-static-proof", hardProofContractSHA256, "/alternate/inputs"},
		{"--hard-bound-static-proof", hardProofContractSHA256, "--production"},
		{"--_hard-bound-static-proof-child", ""},
		{"--_hard-bound-static-proof-child", hardProofContractSHA256, "--core"},
		{"--production", hardProofContractSHA256},
		{"arbitrary", hardProofContractSHA256},
	} {
		t.Run(strings.Join(args, "_"), func(t *testing.T) {
			if validateHardProofArguments(args) == nil {
				t.Fatal("arbitrary proof configuration accepted", args)
			}
		})
	}
	for _, mode := range []string{"--hard-bound-static-proof", "--_hard-bound-static-proof-child"} {
		if err := validateHardProofArguments([]string{mode, hardProofContractSHA256}); err != nil {
			t.Fatal("fixed proof identity rejected", err)
		}
	}
	if trustedExecutionAuthoritySHA256 != "" || proofReadDenied() == nil {
		t.Fatal("static proof populated or bypassed public production authority")
	}
}

func TestCandidateProofFixedPlan(t *testing.T) {
	for _, plan := range []map[string]string{
		nil, {}, {"contract": hardProofContractSHA256},
		{"contract": hardProofContractSHA256, "cwd": "/", "evidence": "/other", "parentPID": "0"},
		{"contract": hardProofContractSHA256, "cwd": "/proof", "evidence": "/proof/" + hardProofEvidenceRoot,
			"parentPID": "0", "buildRootBytes": "2147483648"},
		{"contract": hardProofContractSHA256, "cwd": "/proof", "evidence": "/proof/" + hardProofEvidenceRoot,
			"parentPID": "0", "authority": "future-authority"},
	} {
		if _, err := validatedHardProofPlan(plan); err == nil {
			t.Fatal("arbitrary internal static plan accepted", plan)
		}
	}
	request := proofRequest("/private")
	if request.Capacity != fixedProofLimits() || request.Transaction != hardProofTransaction ||
		request.InputRoot != "/private/.g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs" ||
		request.ReceiptRoot != "/private/.g3a-transaction-HARD_BOUND_STATIC_PROOF/receipts" ||
		len(request.Authority) != 0 || validateTransactionRoots(request) != nil {
		t.Fatal("governed plan contract changed", request)
	}
	var contract map[string]interface{}
	if json.Unmarshal(hardProofContract, &contract) != nil ||
		contract["futureExecutionAuthorityDigest"] != "" || contract["frozenCoreInvocations"] != float64(0) {
		t.Fatal("governed proof is not static-only")
	}
}

func TestCandidateProofCompleteGate(t *testing.T) {
	checks := newResult().Checks
	for name := range checks {
		checks[name] = "PASS"
	}
	if hardProofAllPass(checks) {
		t.Fatal("historical import/isolation-only proof accepted as final hard-bound proof")
	}
	for _, name := range []string{"productionFailClosed", "productionMounts", "productionDispatch",
		"buildLimitEffective", "tmpLimitEffective", "minimalNull", "executableMounts",
		"readonlyInputs", "hardBoundCleanup", "namespaceCleanup"} {
		checks[name] = "PASS"
	}
	if !hardProofAllPass(checks) {
		t.Fatal("complete static gate rejected")
	}
	for name := range checks {
		checks[name] = "NOT_RUN"
		if hardProofAllPass(checks) {
			t.Fatal("incomplete final delta proof accepted", name)
		}
		checks[name] = "PASS"
	}
	checks["unexpected"] = "PASS"
	if hardProofAllPass(checks) {
		t.Fatal("unexpected check census accepted")
	}
}
