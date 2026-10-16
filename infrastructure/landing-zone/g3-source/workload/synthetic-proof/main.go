package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const protocol = "g3-secret-proof-v1"
const maximumBodyBytes = 256

type proofResponse struct {
	Protocol  string `json:"protocol"`
	Algorithm string `json:"algorithm"`
	Proof     string `json:"proof"`
}

func respond(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Print(`{"event":"response_write_failed"}`)
	}
}

func statusResponse(w http.ResponseWriter, status int, value string) {
	respond(w, status, struct {
		Status string `json:"status"`
	}{value})
}

func nonceFromRequest(w http.ResponseWriter, r *http.Request) (string, bool) {
	mediaType, parameters, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" || len(parameters) > 1 ||
		(len(parameters) == 1 && parameters["charset"] != "utf-8") {
		return "", false
	}
	r.Body = http.MaxBytesReader(w, r.Body, maximumBodyBytes)
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	start, err := decoder.Token()
	if err != nil || start != json.Delim('{') {
		return "", false
	}
	key, err := decoder.Token()
	if err != nil || key != "nonce" {
		return "", false
	}
	var nonce string
	if err := decoder.Decode(&nonce); err != nil {
		return "", false
	}
	end, err := decoder.Token()
	if err != nil || end != json.Delim('}') {
		return "", false
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return "", false
	}
	decoded, err := base64.RawURLEncoding.Strict().DecodeString(nonce)
	if err != nil || len(decoded) != 32 || len(nonce) != 43 ||
		base64.RawURLEncoding.EncodeToString(decoded) != nonce {
		return "", false
	}
	return nonce, true
}

func handler(secret func() string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/healthz":
			if r.Method != http.MethodGet {
				w.Header().Set("Allow", http.MethodGet)
				statusResponse(w, http.StatusMethodNotAllowed, "method_not_allowed")
				return
			}
			statusResponse(w, http.StatusOK, "ok")
		case "/proof/secret":
			if r.Method != http.MethodPost {
				w.Header().Set("Allow", http.MethodPost)
				statusResponse(w, http.StatusMethodNotAllowed, "method_not_allowed")
				return
			}
			nonce, valid := nonceFromRequest(w, r)
			if !valid {
				statusResponse(w, http.StatusBadRequest, "invalid_request")
				return
			}
			value := secret()
			if value == "" {
				statusResponse(w, http.StatusServiceUnavailable, "unavailable")
				return
			}
			mac := hmac.New(sha256.New, []byte(value))
			_, _ = mac.Write([]byte(nonce))
			respond(w, http.StatusOK, proofResponse{protocol, "HMAC-SHA256", hex.EncodeToString(mac.Sum(nil))})
		default:
			statusResponse(w, http.StatusNotFound, "not_found")
		}
	})
}

type sanitizedHTTPLog struct{}

func (sanitizedHTTPLog) Write(p []byte) (int, error) {
	log.Print(`{"event":"http_server_error"}`)
	return len(p), nil
}

func run() error {
	server := &http.Server{
		Handler:           handler(func() string { return os.Getenv("G3_PROOF_SECRET") }),
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       15 * time.Second,
		MaxHeaderBytes:    4096,
		ErrorLog:          log.New(sanitizedHTTPLog{}, "", 0),
	}
	listener, err := net.Listen("tcp", ":3000")
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	log.Print(`{"event":"runtime_start"}`)
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			_ = server.Close()
			return err
		}
		err := <-done
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func main() {
	log.SetFlags(0)
	if err := run(); err != nil {
		log.Print(`{"event":"runtime_failed"}`)
		os.Exit(1)
	}
}
