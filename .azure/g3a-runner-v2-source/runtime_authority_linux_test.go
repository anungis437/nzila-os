//go:build linux && amd64

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type boundarySpy struct {
	events []string
	failAt string
}

func (b *boundarySpy) prepare(verifiedProduction) error {
	b.events = append(b.events, "prepare")
	if b.failAt == "prepare" {
		return errors.New("prepare")
	}
	return nil
}
func (b *boundarySpy) consume(verifiedProduction) error {
	b.events = append(b.events, "consume")
	if b.failAt == "consume" {
		return errors.New("consume")
	}
	return nil
}
func (b *boundarySpy) launch(verifiedProduction) error {
	b.events = append(b.events, "launch")
	return nil
}

func fixture(t *testing.T) (executionAuthority, []byte, string) {
	t.Helper()
	self, err := runnerSelfIdentity()
	if err != nil {
		t.Fatal(err)
	}
	tx := "SYNTHETIC_LOCAL_TEST_SOURCE"
	a := authorityFixture(self, tx, filepath.Join(localFixture(t), ".g3a-transaction-"+tx),
		"SYNTHETIC_LOCAL_TEST_AUTHORITY", time.Now().UTC().Add(-time.Second))
	raw, _ := json.Marshal(a)
	return a, raw, shaBytes(raw)
}

func TestRuntimeAuthorityDenialMatrix(t *testing.T) {
	fields := []string{"schema", "mission", "gate", "transactionId", "operation", "runnerSha256",
		"runnerSourceSha256", "authorityPolicySha256", "inputRootSha256", "inputCensusSha256", "expectedManifestSha256",
		"buildRootBytes", "buildRootInodes", "tmpBytes", "tmpInodes", "issuedAt", "notBefore", "expiresAt",
		"singleUse", "syntheticOnly", "targetRegistry", "targetRepository", "evidenceRoot", "inputRoot", "receiptRoot",
		"payloadSha256", "authorityKind"}
	for _, field := range fields {
		for _, mutation := range []string{"missing", "null", "wrong-type", "wrong-value"} {
			t.Run(field+"/"+mutation, func(t *testing.T) {
				a, raw, _ := fixture(t)
				var m map[string]interface{}
				_ = json.Unmarshal(raw, &m)
				switch mutation {
				case "missing":
					delete(m, field)
				case "null":
					m[field] = nil
				case "wrong-type":
					if _, ok := m[field].(string); ok {
						m[field] = true
					} else {
						m[field] = "wrong"
					}
				case "wrong-value":
					switch v := m[field].(type) {
					case string:
						m[field] = "wrong"
					case bool:
						m[field] = !v
					case float64:
						m[field] = v + 1
					}
				}
				raw, _ = json.Marshal(m)
				if _, err := decodeRuntimeAuthority(raw, shaBytes(raw), a.RunnerSHA256, time.Now()); err == nil {
					t.Fatal("denial accepted")
				}
			})
		}
	}
	for _, name := range []string{"empty", "malformed", "digest", "duplicate", "trailing", "unknown-command",
		"future", "expired", "duration", "issued-future", "zero-clock", "lower-capacity", "cross-transaction"} {
		t.Run(name, func(t *testing.T) {
			a, raw, pin := fixture(t)
			now := time.Now()
			switch name {
			case "empty":
				raw = nil
			case "malformed":
				raw = []byte("{")
			case "digest":
				pin = strings.Repeat("0", 64)
			case "duplicate":
				raw = append([]byte(`{"schema":"g3a-execution-authority-v1",`), raw[1:]...)
			case "trailing":
				raw = append(raw, []byte("{}")...)
			case "unknown-command":
				raw = append(raw[:len(raw)-1], []byte(`,"command":"/bin/sh"}`)...)
			case "future":
				a.NotBefore = now.Add(time.Minute).Format(time.RFC3339Nano)
			case "expired":
				a.ExpiresAt = now.Add(-time.Minute).Format(time.RFC3339Nano)
			case "duration":
				a.ExpiresAt = now.Add(5 * time.Hour).Format(time.RFC3339Nano)
			case "issued-future":
				a.IssuedAt = now.Add(time.Minute).Format(time.RFC3339Nano)
			case "zero-clock":
				now = time.Time{}
			case "lower-capacity":
				a.TmpBytes -= 4096
			case "cross-transaction":
				a.TransactionID = "SYNTHETIC_LOCAL_TEST_OTHER"
			}
			if name == "future" || name == "expired" || name == "duration" || name == "issued-future" || name == "lower-capacity" || name == "cross-transaction" {
				raw, _ = json.Marshal(a)
			}
			if name != "digest" {
				pin = shaBytes(raw)
			}
			if _, err := decodeRuntimeAuthority(raw, pin, a.RunnerSHA256, now); err == nil {
				t.Fatal("denial accepted")
			}
		})
	}
}

func TestValidRuntimeAuthorityDispatchOrderingAndRawBytes(t *testing.T) {
	a, raw, _ := fixture(t)
	var pretty bytes.Buffer
	_ = json.Indent(&pretty, raw, "", "  ")
	raw = pretty.Bytes()
	request, err := encodeProductionRequest(requestFromAuthority(a, raw))
	if err != nil {
		t.Fatal(err)
	}
	for _, failAt := range []string{"", "prepare", "consume"} {
		spy := &boundarySpy{failAt: failAt}
		err := dispatchProduction(request, shaBytes(raw), spy)
		want := map[string]string{"": "prepare,consume,launch", "prepare": "prepare", "consume": "prepare,consume"}[failAt]
		if strings.Join(spy.events, ",") != want || (err == nil) != (failAt == "") {
			t.Fatal(spy.events, err)
		}
	}
}

func TestActualOneShotReceiptAndChildBindings(t *testing.T) {
	a, raw, pin := fixture(t)
	if err := os.MkdirAll(a.ReceiptRoot, 0700); err != nil {
		t.Fatal(err)
	}
	request, _ := encodeProductionRequest(requestFromAuthority(a, raw))
	verified, err := validateRequest(request, pin)
	if err != nil {
		t.Fatal(err)
	}
	if err = writeConsumedReceipt(verified); err != nil {
		t.Fatal(err)
	}
	first, _ := os.ReadFile(receiptPath(verified))
	if writeConsumedReceipt(verified) == nil {
		t.Fatal("replay")
	}
	verified.Pin = strings.Repeat("b", 64)
	if writeConsumedReceipt(verified) == nil {
		t.Fatal("reissued-authority replay")
	}
	second, _ := os.ReadFile(receiptPath(verified))
	if !bytes.Equal(first, second) {
		t.Fatal("receipt overwritten")
	}
	for _, plan := range []map[string]string{nil, {"production": string(request), "authoritySha256": pin},
		{"production": string(request), "authoritySha256": pin, "mode": "--production-dispatch-proof"}} {
		if _, err := validatedChildPlan(plan); err == nil {
			t.Fatal("child binding bypass")
		}
	}
}

func TestAuthorityFileAndStrictProofMode(t *testing.T) {
	a, raw, pin := fixture(t)
	root := localFixture(t)
	path := filepath.Join(root, "authority.json")
	if err := os.WriteFile(path, raw, 0400); err != nil {
		t.Fatal(err)
	}
	if got, err := readAuthorityFile(path, pin); err != nil || !bytes.Equal(got, raw) {
		t.Fatal(err)
	}
	for _, name := range []string{"missing", "relative", "writable", "symlink", "empty", "digest"} {
		t.Run(name, func(t *testing.T) {
			p := filepath.Join(localFixture(t), "authority.json")
			_ = os.WriteFile(p, raw, 0400)
			d := pin
			switch name {
			case "missing":
				_ = os.Remove(p)
			case "relative":
				p = "authority.json"
			case "writable":
				_ = os.Chmod(p, 0600)
			case "symlink":
				_ = os.Remove(p)
				_ = os.Symlink(path, p)
			case "empty":
				_ = os.Chmod(p, 0600)
				_ = os.WriteFile(p, nil, 0400)
				_ = os.Chmod(p, 0400)
			case "digest":
				d = strings.Repeat("0", 64)
			}
			if _, err := readAuthorityFile(p, d); err == nil {
				t.Fatal("file denial accepted")
			}
		})
	}
	if validateAuthorityMode(raw, "--production-dispatch-proof") == nil {
		t.Fatal("production substituted into proof")
	}
	a.AuthorityKind = "SYNTHETIC_DISPATCH_PROOF_AUTHORITY"
	a.TransactionID = "SYNTHETIC_DISPATCH_PROOF_SOURCE"
	a.InputRoot = filepath.Join(root, ".g3a-transaction-"+a.TransactionID, "inputs")
	a.ReceiptRoot = filepath.Join(filepath.Dir(a.InputRoot), "receipts")
	a.EvidenceRoot = a.ReceiptRoot
	raw, _ = json.Marshal(a)
	if validateAuthorityMode(raw, "--production") == nil {
		t.Fatal("proof substituted into production")
	}
	if _, err := decodeRuntimeAuthority(raw, shaBytes(raw), a.RunnerSHA256, time.Now()); err != nil {
		t.Fatal(err)
	}
	if validateAuthorityMode(raw, "--production-dispatch-proof") != nil {
		t.Fatal("valid proof denied")
	}
}
