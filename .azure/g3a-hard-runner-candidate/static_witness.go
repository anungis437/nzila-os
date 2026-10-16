//go:build ignore

package main

import "syscall"

func main() {
	syscall.Write(1, []byte("G3A_HARMLESS_STATIC_EXEC_WITNESS_V1\n"))
}
