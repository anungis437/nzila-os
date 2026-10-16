//go:build linux && amd64

package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
)

//go:embed authority-policy.json
var authorityPolicy []byte

type executionAuthority struct {
	Schema                 string `json:"schema"`
	Mission                string `json:"mission"`
	Gate                   string `json:"gate"`
	TransactionID          string `json:"transactionId"`
	Operation              string `json:"operation"`
	RunnerSHA256           string `json:"runnerSha256"`
	RunnerSourceSHA256     string `json:"runnerSourceSha256"`
	AuthorityPolicySHA256  string `json:"authorityPolicySha256"`
	InputRootSHA256        string `json:"inputRootSha256"`
	InputCensusSHA256      string `json:"inputCensusSha256"`
	ExpectedManifestSHA256 string `json:"expectedManifestSha256"`
	BuildRootBytes         uint64 `json:"buildRootBytes"`
	BuildRootInodes        uint64 `json:"buildRootInodes"`
	TmpBytes               uint64 `json:"tmpBytes"`
	TmpInodes              uint64 `json:"tmpInodes"`
	IssuedAt               string `json:"issuedAt"`
	NotBefore              string `json:"notBefore"`
	ExpiresAt              string `json:"expiresAt"`
	SingleUse              bool   `json:"singleUse"`
	SyntheticOnly          bool   `json:"syntheticOnly"`
	TargetRegistry         string `json:"targetRegistry"`
	TargetRepository       string `json:"targetRepository"`
	EvidenceRoot           string `json:"evidenceRoot"`
	InputRoot              string `json:"inputRoot"`
	ReceiptRoot            string `json:"receiptRoot"`
	PayloadSHA256          string `json:"payloadSha256"`
	AuthorityKind          string `json:"authorityKind"`
}

func frozenCensusIdentity() string {
	census := map[string]entry{}
	for name, item := range frozenInputs {
		census[name] = entry{SHA: item.SHA, Bytes: item.Bytes, Mode: 0}
	}
	raw, _ := json.Marshal(census)
	return shaBytes(raw)
}

func frozenRootIdentity() string {
	names := make([]string, 0, len(frozenInputs))
	for name := range frozenInputs {
		names = append(names, name)
	}
	sort.Strings(names)
	var rows []string
	for _, name := range names {
		item := frozenInputs[name]
		rows = append(rows, fmt.Sprintf("%s\x00%d\x00%s\n", name, item.Bytes, item.SHA))
	}
	return shaBytes([]byte(strings.Join(rows, "")))
}

func runnerSelfIdentity() (string, error) {
	sha, _, err := hashFile("/proc/self/exe")
	if err != nil || !shaPattern.MatchString(sha) {
		return "", errors.New("RUNNER_SELF_IDENTITY_UNAVAILABLE")
	}
	return sha, nil
}

func decodeRuntimeAuthority(raw []byte, pin, self string, now time.Time) (executionAuthority, error) {
	var a executionAuthority
	if len(raw) == 0 || len(raw) > 16384 || !shaPattern.MatchString(pin) || shaBytes(raw) != pin {
		return a, errors.New("AUTHORITY_DIGEST_MISMATCH")
	}
	if err := strictJSON(raw, &a); err != nil {
		return a, err
	}
	if err := exactKeys(raw, "schema", "mission", "gate", "transactionId", "operation",
		"runnerSha256", "runnerSourceSha256", "authorityPolicySha256", "inputRootSha256",
		"inputCensusSha256", "expectedManifestSha256", "buildRootBytes", "buildRootInodes",
		"tmpBytes", "tmpInodes", "issuedAt", "notBefore", "expiresAt", "singleUse",
		"syntheticOnly", "targetRegistry", "targetRepository", "evidenceRoot", "inputRoot",
		"receiptRoot", "payloadSha256", "authorityKind"); err != nil {
		return a, err
	}
	if a.Schema != "g3a-execution-authority-v1" || a.Mission != "NZ-20261008-INFRA-001" ||
		a.Gate != "G3_PRIVATE_APPLICATION_SUBSTRATE" || a.Operation != "G3A_SYNTHETIC_RUNTIME_IMAGE_BUILD" {
		return a, errors.New("AUTHORITY_SCOPE_MISMATCH")
	}
	if !shaPattern.MatchString(self) || a.RunnerSHA256 != self || a.RunnerSourceSHA256 != boundRunnerSourceSHA256 ||
		a.AuthorityPolicySHA256 != boundAuthorityPolicySHA256 || shaBytes(authorityPolicy) != boundAuthorityPolicySHA256 {
		return a, errors.New("RUNNER_SOURCE_POLICY_BINDING_MISMATCH")
	}
	if a.InputRootSHA256 != frozenRootIdentity() || a.InputCensusSHA256 != frozenCensusIdentity() ||
		a.ExpectedManifestSHA256 != exactOutputs["manifest.json"] || a.PayloadSHA256 != payloadIdentity() {
		return a, errors.New("FROZEN_INPUT_MANIFEST_BINDING_MISMATCH")
	}
	if (limits{a.BuildRootBytes, a.BuildRootInodes, a.TmpBytes, a.TmpInodes}) != maxima {
		return a, errors.New("EXACT_AUTHORITY_CAPACITY_REQUIRED")
	}
	if !a.SingleUse || !a.SyntheticOnly {
		return a, errors.New("SYNTHETIC_SINGLE_USE_REQUIRED")
	}
	if a.TargetRegistry != "nzilag2tzo75uuozprbo.azurecr.io" || a.TargetRepository != "g3-synthetic-runtime" {
		return a, errors.New("EXACT_GOVERNED_REGISTRY_REPOSITORY_REQUIRED")
	}
	issued, e1 := time.Parse(time.RFC3339Nano, a.IssuedAt)
	before, e2 := time.Parse(time.RFC3339Nano, a.NotBefore)
	expires, e3 := time.Parse(time.RFC3339Nano, a.ExpiresAt)
	if e1 != nil || e2 != nil || e3 != nil || now.IsZero() || issued.After(before) || issued.After(now) ||
		before.After(now) || !now.Before(expires) || !before.Before(expires) ||
		expires.Sub(issued) <= 0 || expires.Sub(issued) > 4*time.Hour {
		return a, errors.New("AUTHORITY_TEMPORAL_BOUND")
	}
	request := requestFromAuthority(a, raw)
	if err := validateTransactionRoots(request); err != nil {
		return a, err
	}
	if a.EvidenceRoot != a.ReceiptRoot {
		return a, errors.New("TRANSACTION_EVIDENCE_ROOT_BINDING")
	}
	switch a.AuthorityKind {
	case "PRODUCTION_EXECUTION_AUTHORITY":
		if strings.HasPrefix(a.TransactionID, "SYNTHETIC_") {
			return a, errors.New("PRODUCTION_TRANSACTION_CLASS")
		}
	case "SYNTHETIC_LOCAL_TEST_AUTHORITY":
		if !strings.HasPrefix(a.TransactionID, "SYNTHETIC_LOCAL_TEST_") {
			return a, errors.New("LOCAL_TEST_TRANSACTION_CLASS")
		}
	case "SYNTHETIC_DISPATCH_PROOF_AUTHORITY":
		if !strings.HasPrefix(a.TransactionID, "SYNTHETIC_DISPATCH_PROOF_") {
			return a, errors.New("PROOF_TRANSACTION_CLASS")
		}
	default:
		return a, errors.New("AUTHORITY_KIND_DENIED")
	}
	return a, nil
}

func requestFromAuthority(a executionAuthority, raw []byte) productionRequest {
	return productionRequest{
		Schema: "g3a-production-request/v1", Transaction: a.TransactionID, PayloadSHA: a.PayloadSHA256,
		Capacity:  limits{a.BuildRootBytes, a.BuildRootInodes, a.TmpBytes, a.TmpInodes},
		InputRoot: a.InputRoot, ReceiptRoot: a.ReceiptRoot, Authority: append([]byte(nil), raw...),
	}
}

func validateRequest(raw []byte, pin string) (verifiedProduction, error) {
	var result verifiedProduction
	var request productionRequest
	if err := strictJSON(raw, &request); err != nil {
		return result, err
	}
	if err := exactKeys(raw, "schema", "transaction", "payloadSha256", "capacity", "inputRoot", "receiptRoot", "authority"); err != nil {
		return result, err
	}
	self, err := runnerSelfIdentity()
	if err != nil {
		return result, err
	}
	a, err := decodeRuntimeAuthority(request.Authority, pin, self, time.Now().UTC())
	if err != nil {
		return result, err
	}
	expected := requestFromAuthority(a, request.Authority)
	if request.Schema != expected.Schema || request.Transaction != expected.Transaction || request.PayloadSHA != expected.PayloadSHA ||
		request.Capacity != expected.Capacity || request.InputRoot != expected.InputRoot || request.ReceiptRoot != expected.ReceiptRoot {
		return result, errors.New("REQUEST_AUTHORITY_EXACT_BINDING")
	}
	return verifiedProduction{Request: request, Raw: append([]byte(nil), raw...), Pin: pin}, nil
}

func authorityMode(raw []byte) string {
	var a executionAuthority
	if strictJSON(raw, &a) != nil {
		return ""
	}
	if a.AuthorityKind == "SYNTHETIC_DISPATCH_PROOF_AUTHORITY" {
		return "--production-dispatch-proof"
	}
	return "--production"
}

func validateAuthorityMode(raw []byte, mode string) error {
	if authorityMode(raw) != mode {
		return errors.New("PROOF_PRODUCTION_AUTHORITY_SUBSTITUTION_DENIED")
	}
	return nil
}

func readAuthorityFile(path, pin string) ([]byte, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || !shaPattern.MatchString(pin) {
		return nil, errors.New("ABSOLUTE_AUTHORITY_AND_EXPLICIT_DIGEST_REQUIRED")
	}
	canonical, err := filepath.EvalSymlinks(path)
	if err != nil || canonical != path {
		return nil, errors.New("AUTHORITY_SYMLINK_DENIED")
	}
	stat, err := os.Lstat(path)
	if err != nil || !stat.Mode().IsRegular() || stat.Mode().Perm()&0222 != 0 ||
		stat.Mode()&(os.ModeSetuid|os.ModeSetgid) != 0 || stat.Size() < 1 || stat.Size() > 16384 {
		return nil, errors.New("READONLY_REGULAR_BOUNDED_AUTHORITY_REQUIRED")
	}
	owner, ok := stat.Sys().(*syscall.Stat_t)
	if !ok || int(owner.Uid) != os.Geteuid() {
		return nil, errors.New("AUTHORITY_OWNER_MISMATCH")
	}
	file, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	opened, err := file.Stat()
	if err != nil || !os.SameFile(stat, opened) || opened.Mode() != stat.Mode() || opened.Size() != stat.Size() {
		return nil, errors.New("AUTHORITY_CHANGED")
	}
	raw, err := io.ReadAll(io.LimitReader(file, 16385))
	after, statErr := file.Stat()
	if err != nil || statErr != nil || len(raw) != int(stat.Size()) || after.Size() != stat.Size() ||
		after.Mode() != stat.Mode() || !after.ModTime().Equal(stat.ModTime()) || shaBytes(raw) != pin {
		return nil, errors.New("AUTHORITY_BYTES_DIGEST_CHANGED")
	}
	return raw, nil
}

func runRuntimeProduction(args []string) error {
	if len(args) != 5 || (args[0] != "--production" && args[0] != "--production-dispatch-proof") ||
		args[1] != "--execution-authority" || args[3] != "--execution-authority-sha256" {
		return errors.New("EXACT_RUNTIME_AUTHORITY_ARGUMENTS_REQUIRED")
	}
	raw, err := readAuthorityFile(args[2], args[4])
	if err != nil {
		return err
	}
	self, err := runnerSelfIdentity()
	if err != nil {
		return err
	}
	a, err := decodeRuntimeAuthority(raw, args[4], self, time.Now().UTC())
	if err != nil {
		return err
	}
	if err = validateAuthorityMode(raw, args[0]); err != nil {
		return err
	}
	boundary := filepath.Dir(a.InputRoot)
	if args[2] != filepath.Join(boundary, "execution-authority.json") || secureRoot(boundary) != nil {
		return errors.New("TRANSACTION_OWNED_AUTHORITY_LOCATION_REQUIRED")
	}
	request, err := encodeProductionRequest(requestFromAuthority(a, raw))
	if err != nil {
		return err
	}
	return dispatchProduction(request, args[4], linuxProductionBackend{})
}

func authorityFixture(self, transaction, boundary, kind string, now time.Time) executionAuthority {
	return executionAuthority{
		Schema: "g3a-execution-authority-v1", Mission: "NZ-20261008-INFRA-001", Gate: "G3_PRIVATE_APPLICATION_SUBSTRATE",
		TransactionID: transaction, Operation: "G3A_SYNTHETIC_RUNTIME_IMAGE_BUILD", RunnerSHA256: self,
		RunnerSourceSHA256: boundRunnerSourceSHA256, AuthorityPolicySHA256: boundAuthorityPolicySHA256,
		InputRootSHA256: frozenRootIdentity(), InputCensusSHA256: frozenCensusIdentity(), ExpectedManifestSHA256: exactOutputs["manifest.json"],
		BuildRootBytes: maxima.BuildBytes, BuildRootInodes: maxima.BuildInodes, TmpBytes: maxima.TmpBytes, TmpInodes: maxima.TmpInodes,
		IssuedAt: now.Format(time.RFC3339Nano), NotBefore: now.Format(time.RFC3339Nano), ExpiresAt: now.Add(time.Hour).Format(time.RFC3339Nano),
		SingleUse: true, SyntheticOnly: true, TargetRegistry: "nzilag2tzo75uuozprbo.azurecr.io", TargetRepository: "g3-synthetic-runtime",
		EvidenceRoot: filepath.Join(boundary, "receipts"), InputRoot: filepath.Join(boundary, "inputs"),
		ReceiptRoot: filepath.Join(boundary, "receipts"), PayloadSHA256: payloadIdentity(), AuthorityKind: kind,
	}
}

func encodeProductionRequest(request productionRequest) ([]byte, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, request.Authority); err != nil {
		return nil, err
	}
	return bytes.Replace(raw, compact.Bytes(), request.Authority, 1), nil
}
