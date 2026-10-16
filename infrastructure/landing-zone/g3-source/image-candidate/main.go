package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	if r.URL.Path != "/health/readiness" && r.URL.Path != "/health/liveness" {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func main() {
	port := 3000
	if configured := os.Getenv("PORT"); configured != "" {
		parsed, err := strconv.Atoi(configured)
		if err != nil || parsed < 1 || parsed > 65535 {
			log.Fatal("PORT must be an integer between 1 and 65535")
		}
		port = parsed
	}

	if err := http.ListenAndServe(":"+strconv.Itoa(port), http.HandlerFunc(healthHandler)); err != nil {
		log.Fatal("Synthetic health server failed to start: ", err)
	}
}
