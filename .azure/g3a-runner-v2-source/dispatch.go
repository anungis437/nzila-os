package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"path/filepath"
	"regexp"
)

const qualifiedRuntimePayloadSHA256 = "ec402cd1cb35b522418355d36cabce2115a45d39d1bc24a8fc290f36266ca068"

type limits struct {
	BuildBytes  uint64 `json:"buildRootBytes"`
	BuildInodes uint64 `json:"buildRootInodes"`
	TmpBytes    uint64 `json:"tmpBytes"`
	TmpInodes   uint64 `json:"tmpInodes"`
}

var maxima = limits{1073741824, 32768, 268435456, 4096}
var transactionPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var shaPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type productionRequest struct {
	Schema      string          `json:"schema"`
	Transaction string          `json:"transaction"`
	PayloadSHA  string          `json:"payloadSha256"`
	Capacity    limits          `json:"capacity"`
	InputRoot   string          `json:"inputRoot"`
	ReceiptRoot string          `json:"receiptRoot"`
	Authority   json.RawMessage `json:"authority"`
}

type verifiedProduction struct {
	Request productionRequest
	Raw     []byte
	Pin     string
}

type productionBackend interface {
	prepare(verifiedProduction) error
	consume(verifiedProduction) error
	launch(verifiedProduction) error
}

func shaBytes(raw []byte) string {
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

func payloadIdentity() string {
	raw, _ := json.Marshal(map[string]string{
		"inputsSha256":  frozenInputSpecSHA256,
		"runtimeSha256": qualifiedRuntimePayloadSHA256,
	})
	return shaBytes(raw)
}

func validateLimits(value limits) error {
	if value.BuildBytes == 0 || value.BuildBytes > 1073741824 ||
		value.BuildInodes == 0 || value.BuildInodes > 32768 ||
		value.TmpBytes == 0 || value.TmpBytes > 268435456 ||
		value.TmpInodes == 0 || value.TmpInodes > 4096 ||
		value.BuildBytes%4096 != 0 || value.TmpBytes%4096 != 0 {
		return errors.New("INVALID_CAPACITY")
	}
	return nil
}

func noDuplicateJSON(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	delim, ok := tok.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		for dec.More() {
			key, err := dec.Token()
			name, ok := key.(string)
			if err != nil || !ok || seen[name] {
				return errors.New("DUPLICATE_OR_INVALID_JSON_KEY")
			}
			seen[name] = true
			if err := noDuplicateJSON(dec); err != nil {
				return err
			}
		}
	case '[':
		for dec.More() {
			if err := noDuplicateJSON(dec); err != nil {
				return err
			}
		}
	default:
		return errors.New("INVALID_JSON_DELIMITER")
	}
	_, err = dec.Token()
	return err
}

func strictJSON(raw []byte, dst interface{}) error {
	if len(raw) == 0 || len(raw) > 16384 {
		return errors.New("JSON_SIZE_BOUND")
	}
	check := json.NewDecoder(bytes.NewReader(raw))
	check.UseNumber()
	if err := noDuplicateJSON(check); err != nil {
		return err
	}
	if _, err := check.Token(); err != io.EOF {
		return errors.New("TRAILING_JSON")
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

func exactKeys(raw []byte, keys ...string) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil || len(object) != len(keys) {
		return errors.New("EXACT_FIELDS_REQUIRED")
	}
	for _, key := range keys {
		value, ok := object[key]
		if !ok || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return errors.New("MISSING_OR_NULL_" + key)
		}
	}
	return nil
}

func authorityDigest(raw []byte) (string, error) {
	var value interface{}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&value); err != nil {
		return "", err
	}
	normalized, err := json.Marshal(value)
	return shaBytes(normalized), err
}

func dispatchProduction(raw []byte, pin string, backend productionBackend) error {
	verified, err := validateRequest(raw, pin)
	if err != nil {
		return err
	}
	if err = backend.prepare(verified); err != nil {
		return err
	}
	if err = backend.consume(verified); err != nil {
		return err
	}
	// Consumption is durable before launch, and is never rolled back on failure.
	return backend.launch(verified)
}

type filesystemLimit struct {
	Type            int64  `json:"filesystemType"`
	TotalBytes      uint64 `json:"totalBytes"`
	AvailableBytes  uint64 `json:"availableBytes"`
	TotalInodes     uint64 `json:"totalInodes"`
	AvailableInodes uint64 `json:"availableInodes"`
	Flags           int64  `json:"mountFlags"`
}

func verifyEffective(capacity limits, observed map[string]filesystemLimit) error {
	if err := validateLimits(capacity); err != nil {
		return err
	}
	if len(observed) != 2 {
		return errors.New("EXACT_EFFECTIVE_CENSUS_REQUIRED")
	}
	for _, item := range []struct {
		name   string
		bytes  uint64
		inodes uint64
	}{{"build", capacity.BuildBytes, capacity.BuildInodes}, {"tmp", capacity.TmpBytes, capacity.TmpInodes}} {
		value, ok := observed[item.name]
		if !ok || value.Type != 0x01021994 || value.TotalBytes != item.bytes ||
			value.TotalInodes != item.inodes || value.AvailableBytes > value.TotalBytes ||
			value.AvailableInodes > value.TotalInodes || value.AvailableBytes == 0 ||
			value.AvailableInodes == 0 || value.Flags&6 != 6 || value.Flags&9 != 0 {
			return errors.New("EFFECTIVE_LIMIT_MISMATCH_" + item.name)
		}
	}
	return nil
}

func childDispatchBoundary(plan verifiedProduction, observed map[string]filesystemLimit,
	deviceCheck func() error, core func() error) error {
	if err := verifyEffective(plan.Request.Capacity, observed); err != nil {
		return err
	}
	if err := deviceCheck(); err != nil {
		return err
	}
	return core()
}

func validateTransactionRoots(request productionRequest) error {
	if !transactionPattern.MatchString(request.Transaction) {
		return errors.New("WRONG_TRANSACTION_IDENTITY")
	}
	for _, path := range []string{request.InputRoot, request.ReceiptRoot} {
		if !filepath.IsAbs(path) || filepath.Clean(path) != path {
			return errors.New("ABSOLUTE_CANONICAL_ROOT_REQUIRED")
		}
	}
	boundary := filepath.Dir(request.InputRoot)
	if filepath.Base(request.InputRoot) != "inputs" ||
		filepath.Base(request.ReceiptRoot) != "receipts" ||
		filepath.Dir(request.ReceiptRoot) != boundary ||
		filepath.Base(boundary) != ".g3a-transaction-"+request.Transaction {
		return errors.New("EXCLUSIVE_TRANSACTION_ROOT_BINDING_REQUIRED")
	}
	return nil
}
