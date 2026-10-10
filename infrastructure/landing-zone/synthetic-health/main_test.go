package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpointsReturnNonCacheableHealthyResponse(t *testing.T) {
	for _, path := range []string{"/health/readiness", "/health/liveness"} {
		t.Run(path, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path+"?probe=1", nil)

			healthHandler(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
			}
			if got := response.Header().Get("Cache-Control"); got != "no-store" {
				t.Fatalf("Cache-Control = %q, want %q", got, "no-store")
			}
			if got := response.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
				t.Fatalf("Content-Type = %q", got)
			}
			if got := response.Body.String(); got != `{"status":"ok"}` {
				t.Fatalf("body = %q, want %q", got, `{"status":"ok"}`)
			}
		})
	}
}

func TestUnknownPathsReturnNotFound(t *testing.T) {
	for _, path := range []string{"/", "/api/health/readiness", "/health/readiness/"} {
		t.Run(path, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path, nil)

			healthHandler(response, request)

			if response.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
			}
			if response.Body.Len() != 0 {
				t.Fatalf("unexpected response body: %q", response.Body.String())
			}
		})
	}
}

func TestOnlyGetIsAllowed(t *testing.T) {
	for _, method := range []string{http.MethodHead, http.MethodPost, http.MethodPut, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(method, "/health/readiness", nil)

			healthHandler(response, request)

			if response.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
			}
			if got := response.Header().Get("Allow"); got != http.MethodGet {
				t.Fatalf("Allow = %q, want %q", got, http.MethodGet)
			}
			if response.Body.Len() != 0 {
				t.Fatalf("unexpected response body: %q", response.Body.String())
			}
		})
	}
}

func TestUnknownPathRejectsNonGetBeforePathLookup(t *testing.T) {
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/unknown", nil)

	healthHandler(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
}
