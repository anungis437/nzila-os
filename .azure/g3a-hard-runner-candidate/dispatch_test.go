package main

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

type boundarySpy struct {
	events   []string
	consumed bool
	failAt   string
}

func (s *boundarySpy) prepare(verifiedProduction) error {
	s.events = append(s.events, "prepare")
	if s.failAt == "prepare" {
		return errors.New("INPUT_PREPARATION_FAILED")
	}
	return nil
}
func (s *boundarySpy) consume(verifiedProduction) error {
	s.events = append(s.events, "consume")
	if s.consumed || s.failAt == "consume" {
		return errors.New("AUTHORITY_CONSUMED")
	}
	s.consumed = true
	return nil
}
func (s *boundarySpy) launch(verifiedProduction) error {
	s.events = append(s.events, "launch")
	if s.failAt == "launch" {
		return errors.New("LAUNCH_FAILED")
	}
	return nil
}

func fixture(t *testing.T) (map[string]interface{}, string) {
	t.Helper()
	root, err := filepath.Abs(".")
	if err != nil {
		t.Fatal(err)
	}
	authority := map[string]interface{}{
		"schema": "g3a-execution-authority/v2", "mission": "NZ-20261008-INFRA-001",
		"transaction": "SOURCE_ONLY_TEST", "payloadSha256": payloadIdentity(),
		"capacity": limitsMap(maxima), "inputRoot": filepath.Join(root, ".g3a-transaction-SOURCE_ONLY_TEST", "inputs"),
		"receiptRoot": filepath.Join(root, ".g3a-transaction-SOURCE_ONLY_TEST", "receipts"), "consumed": false,
	}
	raw, _ := json.Marshal(authority)
	pin, err := authorityDigest(raw)
	if err != nil {
		t.Fatal(err)
	}
	return map[string]interface{}{
		"schema": "g3a-production-request/v1", "transaction": authority["transaction"],
		"payloadSha256": authority["payloadSha256"], "capacity": limitsMap(maxima),
		"inputRoot": authority["inputRoot"], "receiptRoot": authority["receiptRoot"],
		"authority": authority,
	}, pin
}

func limitsMap(c limits) map[string]interface{} {
	return map[string]interface{}{"buildRootBytes": c.BuildBytes, "buildRootInodes": c.BuildInodes,
		"tmpBytes": c.TmpBytes, "tmpInodes": c.TmpInodes}
}

func encode(t *testing.T, value interface{}) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestProductionBoundaryAuthorityDenials(t *testing.T) {
	for _, name := range []string{"missing", "malformed", "wrongdigest", "consumed",
		"wrongtransaction", "wrongpayload", "wrongcapacity", "wrongmission", "wrongroots",
		"unknown-authority-field", "omitted-consumed", "null-authority", "bool-consumed-as-number",
		"missing-future-pin", "malformed-future-pin", "caller-supplied-pin"} {
		t.Run(name, func(t *testing.T) {
			request, pin := fixture(t)
			auth := request["authority"].(map[string]interface{})
			switch name {
			case "missing":
				delete(request, "authority")
			case "malformed":
				request["authority"] = "invalid"
			case "wrongdigest":
				pin = strings.Repeat("0", 64)
			case "consumed":
				auth["consumed"] = true
			case "wrongtransaction":
				auth["transaction"] = "OTHER"
			case "wrongpayload":
				auth["payloadSha256"] = strings.Repeat("b", 64)
			case "wrongcapacity":
				auth["capacity"].(map[string]interface{})["tmpInodes"] = uint64(1)
			case "wrongmission":
				auth["mission"] = "OTHER"
			case "wrongroots":
				auth["receiptRoot"] = request["inputRoot"]
			case "unknown-authority-field":
				auth["trustedDigest"] = pin
			case "omitted-consumed":
				delete(auth, "consumed")
			case "null-authority":
				request["authority"] = nil
			case "bool-consumed-as-number":
				auth["consumed"] = 0
			case "missing-future-pin":
				pin = ""
			case "malformed-future-pin":
				pin = "bad"
			case "caller-supplied-pin":
				request["trustedDigest"] = pin
			}
			backend := &boundarySpy{}
			if err := dispatchProduction(encode(t, request), pin, backend); err == nil {
				t.Fatal("invalid authority crossed production boundary")
			}
			if len(backend.events) != 0 {
				t.Fatalf("denial reached backend: %v", backend.events)
			}
		})
	}
}

func TestProductionBoundaryStrictCapacityDenials(t *testing.T) {
	for field, maximum := range limitsMap(maxima) {
		for _, kind := range []string{"missing", "zero", "negative", "above-max", "float",
			"bool", "string", "null", "overflow", "fractional", "unknown-field"} {
			t.Run(field+"/"+kind, func(t *testing.T) {
				request, _ := fixture(t)
				c := request["capacity"].(map[string]interface{})
				switch kind {
				case "missing":
					delete(c, field)
				case "zero":
					c[field] = 0
				case "negative":
					c[field] = -1
				case "above-max":
					c[field] = maximum.(uint64) + 1
				case "float":
					c[field] = json.Number("1.0")
				case "bool":
					c[field] = true
				case "string":
					c[field] = "4096"
				case "null":
					c[field] = nil
				case "overflow":
					c[field] = json.Number("18446744073709551616")
				case "fractional":
					c[field] = 1.5
				case "unknown-field":
					c["unlimited"] = true
				}
				auth := request["authority"].(map[string]interface{})
				auth["capacity"] = c
				pin, _ := authorityDigest(encode(t, auth))
				backend := &boundarySpy{}
				if dispatchProduction(encode(t, request), pin, backend) == nil || len(backend.events) != 0 {
					t.Fatalf("bad capacity dispatched: %v", backend.events)
				}
			})
		}
	}
}

func TestProductionBoundaryDuplicateTrailingAndOversizedJSON(t *testing.T) {
	request, pin := fixture(t)
	raw := encode(t, request)
	for _, value := range [][]byte{
		append(append([]byte(nil), raw...), []byte(` {}`)...),
		[]byte(strings.Replace(string(raw), `"consumed":false`, `"consumed":false,"consumed":false`, 1)),
		[]byte(strings.Replace(string(raw), `"tmpInodes":4096`, `"tmpInodes":4096,"tmpInodes":4096`, 1)),
		[]byte(strings.Repeat(" ", 16385)),
		[]byte(`[]`), []byte(`null`), []byte(`{`),
	} {
		s := &boundarySpy{}
		if dispatchProduction(value, pin, s) == nil || len(s.events) != 0 {
			t.Fatal("malformed JSON dispatched")
		}
	}
}

func TestProductionDefaultPinCannotDispatchEvenValidFixture(t *testing.T) {
	request, _ := fixture(t)
	s := &boundarySpy{}
	err := dispatchProduction(encode(t, request), trustedExecutionAuthoritySHA256, s)
	if err == nil || err.Error() != "FUTURE_EXECUTION_AUTHORITY_DIGEST_REQUIRED" || len(s.events) != 0 {
		t.Fatal("production default enabled")
	}
}

func TestProductionRoutePrepareConsumeLaunchExactlyOnce(t *testing.T) {
	request, pin := fixture(t)
	s := &boundarySpy{}
	if err := dispatchProduction(encode(t, request), pin, s); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(s.events, []string{"prepare", "consume", "launch"}) {
		t.Fatal(s.events)
	}
	s.events = nil
	if err := dispatchProduction(encode(t, request), pin, s); err == nil ||
		!reflect.DeepEqual(s.events, []string{"prepare", "consume"}) {
		t.Fatal("consumed state relaunched", s.events)
	}
}

func TestProductionFailureNoRetryAndConsumptionNeverRolledBack(t *testing.T) {
	request, pin := fixture(t)
	for _, stage := range []string{"prepare", "consume", "launch"} {
		s := &boundarySpy{failAt: stage}
		if dispatchProduction(encode(t, request), pin, s) == nil {
			t.Fatal("failure accepted", stage)
		}
		want := map[string][]string{"prepare": {"prepare"}, "consume": {"prepare", "consume"},
			"launch": {"prepare", "consume", "launch"}}[stage]
		if !reflect.DeepEqual(s.events, want) {
			t.Fatal("retry or wrong ordering", s.events)
		}
		if stage == "launch" && !s.consumed {
			t.Fatal("consumption rolled back")
		}
	}
}

func observations(c limits) map[string]filesystemLimit {
	return map[string]filesystemLimit{
		"build": {0x01021994, c.BuildBytes, c.BuildBytes - 4096, c.BuildInodes, c.BuildInodes - 1, 6},
		"tmp":   {0x01021994, c.TmpBytes, c.TmpBytes - 4096, c.TmpInodes, c.TmpInodes - 1, 6},
	}
}

func TestChildDispatchDeniesEveryEffectiveMismatchBeforeCore(t *testing.T) {
	request, pin := fixture(t)
	plan, err := validateRequest(encode(t, request), pin)
	if err != nil {
		t.Fatal(err)
	}
	for _, resource := range []string{"build", "tmp"} {
		for _, mismatch := range []string{"absent", "fstype", "bytes", "inodes", "readonly",
			"noexec", "suid", "device", "available-bytes", "available-inodes", "empty-bytes", "empty-inodes"} {
			t.Run(resource+"/"+mismatch, func(t *testing.T) {
				observed := observations(maxima)
				v := observed[resource]
				switch mismatch {
				case "fstype":
					v.Type = 0xef53
				case "bytes":
					v.TotalBytes++
				case "inodes":
					v.TotalInodes++
				case "readonly":
					v.Flags |= 1
				case "noexec":
					v.Flags |= 8
				case "suid":
					v.Flags &^= 2
				case "device":
					v.Flags &^= 4
				case "available-bytes":
					v.AvailableBytes = v.TotalBytes + 1
				case "available-inodes":
					v.AvailableInodes = v.TotalInodes + 1
				case "empty-bytes":
					v.AvailableBytes = 0
				case "empty-inodes":
					v.AvailableInodes = 0
				}
				observed[resource] = v
				if mismatch == "absent" {
					delete(observed, resource)
				}
				deviceCalls, coreCalls := 0, 0
				err := childDispatchBoundary(plan, observed, func() error { deviceCalls++; return nil },
					func() error { coreCalls++; return nil })
				if err == nil || deviceCalls != 0 || coreCalls != 0 {
					t.Fatal("effective mismatch reached device/core")
				}
			})
		}
	}
}

func TestChildDispatchDeviceDenialAndCoreFailureNeverRetry(t *testing.T) {
	request, pin := fixture(t)
	plan, _ := validateRequest(encode(t, request), pin)
	calls := 0
	err := childDispatchBoundary(plan, observations(maxima), func() error { return errors.New("UNEXPECTED_DEVICE") },
		func() error { calls++; return nil })
	if err == nil || calls != 0 {
		t.Fatal("device denial crossed core boundary")
	}
	err = childDispatchBoundary(plan, observations(maxima), func() error { return nil },
		func() error { calls++; return errors.New("ENOSPC") })
	if err == nil || calls != 1 {
		t.Fatal("core failure retried")
	}
}

func TestLowerPageAlignedCapacityUsedWithoutExpansion(t *testing.T) {
	request, _ := fixture(t)
	c := limits{8192, 2, 8192, 2}
	request["capacity"] = limitsMap(c)
	auth := request["authority"].(map[string]interface{})
	auth["capacity"] = limitsMap(c)
	pin, _ := authorityDigest(encode(t, auth))
	plan, err := validateRequest(encode(t, request), pin)
	if err != nil || plan.Request.Capacity != c {
		t.Fatal("lower capacity silently enlarged", err)
	}

	calls := 0
	if childDispatchBoundary(plan, observations(maxima), func() error { return nil },
		func() error { calls++; return nil }) == nil || calls != 0 {
		t.Fatal("maxima accepted instead of requested lower limits")
	}
	if err = childDispatchBoundary(plan, observations(c), func() error { return nil },
		func() error { calls++; return nil }); err != nil || calls != 1 {
		t.Fatal(err, calls)
	}
	c.BuildBytes = 4097
	if validateLimits(c) == nil {
		t.Fatal("non-page-aligned limit accepted")
	}
}

func TestGovernedCeilingsCannotBeExpandedThroughMutableFixtureDefaults(t *testing.T) {
	original := maxima
	defer func() { maxima = original }()
	maxima = limits{^uint64(0), ^uint64(0), ^uint64(0), ^uint64(0)}
	for _, value := range []limits{
		{1073745920, 32768, 268435456, 4096},
		{1073741824, 32769, 268435456, 4096},
		{1073741824, 32768, 268439552, 4096},
		{1073741824, 32768, 268435456, 4097},
	} {
		if validateLimits(value) == nil {
			t.Fatal("governed ceiling silently expanded")
		}
	}
}
