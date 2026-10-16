package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func fakeMaterial(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatal("local random material generation failed")
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func request(h http.Handler, method, route, body, contentType string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, route, strings.NewReader(body))
	r.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func proof(t *testing.T, secret, nonce string) string {
	t.Helper()
	w := request(handler(func() string { return secret }), "POST", "/proof/secret", `{"nonce":"`+nonce+`"}`, "application/json")
	if w.Code != 200 {
		t.Fatal("proof request failed")
	}
	var result proofResponse
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal("invalid proof JSON")
	}
	if result.Protocol != protocol || result.Algorithm != "HMAC-SHA256" || len(result.Proof) != 64 {
		t.Fatal("invalid proof response shape")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(nonce))
	if !hmac.Equal([]byte(result.Proof), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		t.Fatal("proof does not match independent HMAC")
	}
	return result.Proof
}

func TestProofSemantics(t *testing.T) {
	secret, other, nonce, second := fakeMaterial(t), fakeMaterial(t), fakeMaterial(t), fakeMaterial(t)
	a := proof(t, secret, nonce)
	if a != proof(t, secret, nonce) || a == proof(t, secret, second) || a == proof(t, other, nonce) {
		t.Fatal("HMAC determinism or challenge/key separation failed")
	}
}

func TestHealthAndRoutes(t *testing.T) {
	h := handler(func() string { t.Fatal("health or invalid route accessed secret"); return "" })
	for _, c := range []struct {
		method, route string
		status        int
	}{
		{"GET", "/healthz", 200}, {"POST", "/healthz", 405},
		{"GET", "/proof/secret", 405}, {"GET", "/unknown", 404},
		{"GET", "/health/readiness", 404}, {"GET", "/health/liveness", 404},
	} {
		t.Run(c.method+c.route, func(t *testing.T) {
			w := request(h, c.method, c.route, "", "")
			if w.Code != c.status {
				t.Fatal("unexpected route status")
			}
			if c.status == 200 && w.Body.String() != "{\"status\":\"ok\"}\n" {
				t.Fatal("health output is not minimal deterministic status")
			}
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("response is cacheable")
			}
		})
	}
}

func TestInvalidNonceAndBody(t *testing.T) {
	nonce := fakeMaterial(t)
	cases := []struct{ name, body, contentType string }{
		{"empty", `{"nonce":""}`, "application/json"},
		{"short", `{"nonce":"abc"}`, "application/json"},
		{"noncanonical", `{"nonce":"` + strings.Repeat("!", 43) + `"}`, "application/json"},
		{"wrongtype", `{"nonce":10}`, "application/json"},
		{"null", `{"nonce":null}`, "application/json"},
		{"missing", `{}`, "application/json"},
		{"unknown", `{"nonce":"` + nonce + `","extra":true}`, "application/json"},
		{"duplicate", `{"nonce":"` + nonce + `","nonce":"` + nonce + `"}`, "application/json"},
		{"trailing", `{"nonce":"` + nonce + `"} {}`, "application/json"},
		{"malformed", `{"nonce":`, "application/json"},
		{"oversize", `{"nonce":"` + strings.Repeat("A", 1000) + `"}`, "application/json"},
		{"oversizewhitespace", strings.Repeat(" ", 300) + `{"nonce":"` + nonce + `"}`, "application/json"},
		{"wrongcontent", `{"nonce":"` + nonce + `"}`, "text/plain"},
		{"missingcontent", `{"nonce":"` + nonce + `"}`, ""},
		{"wrongcharset", `{"nonce":"` + nonce + `"}`, "application/json;charset=latin1"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := handler(func() string { t.Fatal("invalid request accessed secret"); return "" })
			w := request(h, "POST", "/proof/secret", c.body, c.contentType)
			if w.Code != 400 || w.Body.String() != "{\"status\":\"invalid_request\"}\n" {
				t.Fatal("invalid input did not fail closed generically")
			}
		})
	}
}

func TestMissingSecret(t *testing.T) {
	w := request(handler(func() string { return "" }), "POST", "/proof/secret", `{"nonce":"`+fakeMaterial(t)+`"}`, "application/json")
	if w.Code != 503 || w.Body.String() != "{\"status\":\"unavailable\"}\n" {
		t.Fatal("missing secret did not fail closed generically")
	}
}

type failingWriter struct{ header http.Header }

func (w failingWriter) Header() http.Header { return w.header }
func (w failingWriter) WriteHeader(int)     {}
func (w failingWriter) Write([]byte) (int, error) {
	return 0, errors.New("private write details must not reach logs")
}

func TestNonDisclosureIncludingErrors(t *testing.T) {
	secret, nonce := fakeMaterial(t), fakeMaterial(t)
	var logs bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(previous)
	h := handler(func() string { return secret })
	w := request(h, "POST", "/proof/secret", `{"nonce":"`+nonce+`"}`, "application/json")
	r := httptest.NewRequest("POST", "/proof/secret", strings.NewReader(`{"nonce":"`+nonce+`"}`))
	r.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(failingWriter{make(http.Header)}, r)
	_, _ = (sanitizedHTTPLog{}).Write([]byte(secret + nonce))
	for _, output := range []string{w.Body.String(), logs.String()} {
		for _, forbidden := range []string{secret, nonce, "G3_PROOF_SECRET", "private write details", "vault.azure.net"} {
			if strings.Contains(output, forbidden) {
				t.Fatal("sensitive input or private error detail disclosed")
			}
		}
	}
	if !strings.Contains(logs.String(), "response_write_failed") || !strings.Contains(logs.String(), "http_server_error") {
		t.Fatal("errors were not surfaced as sanitized events")
	}
}
