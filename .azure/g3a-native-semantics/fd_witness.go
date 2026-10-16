package main

import (
	"encoding/json"
	"os"
	"syscall"
)

func main() {
	_, _, unrelatedErr := syscall.Syscall(syscall.SYS_FCNTL, 19, syscall.F_GETFD, 0)
	data := make([]byte, 1)
	n, stdinErr := syscall.Read(0, data)
	_, _, stdoutErr := syscall.Syscall(syscall.SYS_FCNTL, 1, syscall.F_GETFD, 0)
	_, _, stderrErr := syscall.Syscall(syscall.SYS_FCNTL, 2, syscall.F_GETFD, 0)
	procMissing := false
	if _, err := os.Stat("/proc/self/fd"); os.IsNotExist(err) {
		procMissing = true
	}
	pass := unrelatedErr == syscall.EBADF && n == 0 && stdinErr == nil &&
		stdoutErr == 0 && stderrErr == 0 && procMissing
	if err := json.NewEncoder(os.Stdout).Encode(map[string]interface{}{
		"pass": pass, "unrelatedFd19Errno": int(unrelatedErr),
		"stdinEOF": n == 0 && stdinErr == nil, "stdoutValid": stdoutErr == 0,
		"stderrValid": stderrErr == 0, "procAbsent": procMissing,
	}); err != nil {
		panic(err)
	}
	if !pass {
		os.Exit(1)
	}
}
