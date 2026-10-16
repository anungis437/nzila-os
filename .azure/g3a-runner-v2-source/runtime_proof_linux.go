//go:build linux && amd64

package main

import (
	"bytes"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func invokeRuntimeProofWitness(plan verifiedProduction, r *proofResult, output io.Writer) error {
	if validateAuthorityMode(plan.Request.Authority, "--production-dispatch-proof") != nil ||
		shaBytes(hardProofExecutable) != hardProofExecutableSHA256 {
		return errors.New("GOVERNED_RUNTIME_STATIC_PROOF_REQUIRED")
	}
	return dispatchConstructedCore(plan, r, func() error {
		witnesses := map[string]string{}
		for _, root := range []string{"/build", "/tmp", "/work", "/output"} {
			path := filepath.Join(root, "source-bound-static-witness")
			if err := os.WriteFile(path, hardProofExecutable, 0500); err != nil {
				return err
			}
			cmd := exec.Command(path)
			cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable"}
			result := &cappedBuffer{limit: 4096}
			cmd.Stdin, cmd.Stdout, cmd.Stderr = bytes.NewReader(nil), result, result
			err := cmd.Run()
			if root == "/work" || root == "/output" {
				if !errors.Is(err, syscall.EACCES) {
					return errors.New("STATIC_NOEXEC_WITNESS_FAILED")
				}
				witnesses[root] = "EACCES"
			} else {
				if err != nil || result.String() != "G3A_HARMLESS_STATIC_EXEC_WITNESS_V1\n" {
					return errors.New("STATIC_EXEC_WITNESS_FAILED")
				}
				witnesses[root] = result.String()
			}
			if err = os.Remove(path); err != nil {
				return err
			}
		}
		r.Details["coreInvocations"], r.Details["staticWitnessInvocations"] = 0, 1
		r.Details["runtimeProofAuthoritySha256"] = plan.Pin
		r.Details["authorityPolicySha256"], r.Details["runnerSourceSha256"] = boundAuthorityPolicySHA256, boundRunnerSourceSHA256
		r.Details["executableMountWitness"] = witnesses
		sha, err := exportOutputArchive(output, "/output")
		r.Details["outputArchiveSha256"] = sha
		return err
	})
}
