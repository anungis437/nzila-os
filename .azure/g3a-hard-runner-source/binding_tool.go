package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"strings"
)

type identity struct {
	File       string `json:"file"`
	Function   string `json:"function"`
	StartLine  int    `json:"startLine"`
	EndLine    int    `json:"endLine"`
	SHA256     string `json:"normalizedASTSourceSha256"`
	Normalized string `json:"normalizedSource"`
}

type primitive struct {
	Name      string `json:"primitive"`
	Owner     string `json:"owningFunction"`
	StartLine int    `json:"startLine"`
	EndLine   int    `json:"endLine"`
	SHA256    string `json:"normalizedASTSourceSha256"`
	Source    string `json:"normalizedSource"`
}

type finding struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

func require(ok bool, why string) {
	if !ok {
		panic(why)
	}
}

func sum(raw []byte) string {
	value := sha256.Sum256(raw)
	return hex.EncodeToString(value[:])
}

func normalized(node ast.Node) string {
	var out bytes.Buffer
	require(format.Node(&out, token.NewFileSet(), node) == nil, "AST_FORMAT_FAILED")
	return out.String()
}

func functions(raw []byte, file string) (*token.FileSet, map[string]*ast.FuncDecl) {
	fset := token.NewFileSet()
	tree, err := parser.ParseFile(fset, file, raw, 0)
	require(err == nil, "GO_PARSE_FAILED")
	funcs := map[string]*ast.FuncDecl{}
	for _, decl := range tree.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok {
			funcs[fn.Name.Name] = fn
		}
	}
	return fset, funcs
}

func selectors(node ast.Node) []string {
	var result []string
	ast.Inspect(node, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		result = append(result, normalized(call.Fun))
		return true
	})
	return result
}

func hasCall(node ast.Node, name string) bool {
	for _, value := range selectors(node) {
		if value == name {
			return true
		}
	}
	return false
}

func main() {
	args := os.Args[1:]
	if len(args) != 0 && args[0] == "--" {
		args = args[1:]
	}
	require(len(args) == 2, "PROOF_AND_LAUNCHER_PATH_REQUIRED")
	proof, err := os.ReadFile(args[0])
	require(err == nil, "PROOF_READ_FAILED")
	launcher, err := os.ReadFile(args[1])
	require(err == nil, "LAUNCHER_READ_FAILED")
	pf, p := functions(proof, "proof_linux.go")
	lf, l := functions(launcher, "launcher.go")
	var ids []identity
	for _, name := range []string{"guestProof", "namespaceBoundary", "isolatedProofChild",
		"disconnectedRoutes", "prctl", "capabilities", "dropPrivileges", "networkNegative"} {
		fn := p[name]
		require(fn != nil, "QUALIFIED_FUNCTION_MISSING:"+name)
		value := normalized(fn)
		ids = append(ids, identity{"proof_linux.go", name,
			pf.Position(fn.Pos()).Line, pf.Position(fn.End()).Line, sum([]byte(value)), value})
	}
	for _, name := range []string{"run", "main"} {
		fn := l[name]
		require(fn != nil, "LAUNCHER_FUNCTION_MISSING:"+name)
		value := normalized(fn)
		ids = append(ids, identity{"launcher.go", name,
			lf.Position(fn.Pos()).Line, lf.Position(fn.End()).Line, sum([]byte(value)), value})
	}
	var primitives []primitive
	add := func(name, owner string, node ast.Node) {
		value := normalized(node)
		primitives = append(primitives, primitive{name, owner,
			pf.Position(node.Pos()).Line, pf.Position(node.End()).Line, sum([]byte(value)), value})
	}
	for _, stmt := range p["guestProof"].Body.List {
		text := normalized(stmt)
		if strings.Contains(text, "cmd.SysProcAttr") {
			require(strings.Contains(text, "syscall.CLONE_NEWNS | syscall.CLONE_NEWNET") &&
				strings.Contains(text, "Pdeathsig: syscall.SIGKILL"), "QUALIFIED_CLONE_CHANGED")
			add("namespace-clone-before-child-runtime", "guestProof", stmt)
		}
	}
	child := p["isolatedProofChild"]
	private, seal, chroot, drop, negative, dispatch := -1, -1, -1, -1, -1, -1
	for i, stmt := range child.Body.List {
		text := normalized(stmt)
		if hasCall(stmt, "syscall.Mount") && strings.Contains(text, "syscall.MS_PRIVATE") {
			private = i
			add("recursive-private-mount-propagation", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "syscall.Mount") && strings.Contains(text, `root, "tmpfs", syscall.MS_REMOUNT`) {
			seal = i
			add("root-readonly-seal", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "syscall.Chroot") {
			chroot = i
			add("chroot", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "os.Chdir") {
			add("chdir-after-chroot", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "dropPrivileges") {
			drop = i
			add("privilege-drop-call", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "networkNegative") {
			negative = i
			add("network-negative-call", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "net.Interfaces") || hasCall(stmt, "disconnectedRoutes") ||
			strings.Contains(text, "for _, iface := range ifaces") ||
			strings.Contains(text, "if len(ifaces) != 1") {
			add("disconnected-network-statement", "isolatedProofChild", stmt)
		}
		if hasCall(stmt, "exec.Command") && strings.Contains(text, "app/entry.py") {
			dispatch = i
			add("import-only-runtime-command", "isolatedProofChild", stmt)
		}
	}
	for _, stmt := range p["dropPrivileges"].Body.List {
		text := normalized(stmt)
		if strings.Contains(text, "syscall.SYS_PRCTL, 38") ||
			strings.Contains(text, "prctl(39") || strings.Contains(text, `NNP_NOT_VERIFIED`) {
			add("no-new-privileges-statement", "dropPrivileges", stmt)
		}
		if strings.Contains(text, "syscall.Setresuid(0") ||
			strings.Contains(text, "regain :=") || strings.Contains(text, "&regain[0]") ||
			strings.Contains(text, "if errno != syscall.EPERM") {
			add("regain-negative-statement", "dropPrivileges", stmt)
		}
	}
	var checks []finding
	check := func(name string, ok bool) {
		require(ok, "BINDING_CHECK_FAILED:"+name)
		checks = append(checks, finding{name, "PASS_SOURCE_ONLY"})
	}
	check("isolation-child-has-no-parameters-or-callback", child.Type.Params.NumFields() == 0)
	check("qualified-sequence-private-seal-chroot-drop-negative-import-only",
		private >= 0 && private < seal && seal < chroot && chroot < drop &&
			drop < negative && negative < dispatch)
	check("no-core-invocation-or-build-tmp-device-mount-path-in-qualified-child",
		!bytes.Contains(proof, []byte(`"/build"`)) &&
			!bytes.Contains(proof, []byte(`"/tmp"`)) &&
			!bytes.Contains(proof, []byte(`"/dev/null"`)) &&
			!bytes.Contains(proof, []byte("portable-assembler")))
	check("work-output-only-qualified-writable-root-loop",
		bytes.Contains(proof, []byte(`for _, name := range []string{"work", "output"}`)))
	check("import-only-dispatch-contract-rejects-qualified-transaction",
		bytes.Contains(proof, []byte(`selftest.Status != "PASS_OFFLINE_IMPORT_ONLY"`)) &&
			bytes.Contains(proof, []byte(`selftest.Qualified ||`)))
	guard := normalized(l["run"].Body.List[0])
	check("launcher-first-statement-is-unconditional-production-denial",
		guard == "if len(args) != 2 || args[0] != \"--self-test\" {\n\treturn errors.New(\"PRODUCTION_TRANSACTION_DISABLED_ISOLATION_AND_HANDOFF_UNQUALIFIED\")\n}")
	current := sum([]byte(normalized(child)))
	_, whitespace := functions(append([]byte("// ignored comment\n\n"), proof...), "cosmetic.go")
	check("normalized-child-identity-ignores-comments-and-position-shift",
		sum([]byte(normalized(whitespace["isolatedProofChild"]))) == current)
	deltas := map[string]string{
		"new-build-and-tmp-mount-hook": "boundedRedirectedMounts(root)\n\t",
		"new-null-only-device-hook":   "stageExactNullOnly(root)\n\t",
	}
	for name, inserted := range deltas {
		needle := []byte(`r.Details["operation"] = "remount-root-readonly"`)
		require(bytes.Count(proof, needle) == 1, "MOUNT_INSERTION_ANCHOR_MISSING")
		mutated := bytes.Replace(proof, needle, append([]byte(inserted), needle...), 1)
		_, variant := functions(mutated, name+".go")
		check(name+"-changes-bound-child-AST",
			sum([]byte(normalized(variant["isolatedProofChild"]))) != current)
	}
	needle := []byte(`r.Details["operation"] = "historical-embedded-runtime-selftest"`)
	require(bytes.Count(proof, needle) == 1, "DISPATCH_ANCHOR_MISSING")
	mutated := bytes.Replace(proof, needle, append([]byte("dispatchAuthorizedFrozenCore()\n\t"), needle...), 1)
	_, variant := functions(mutated, "dispatch.go")
	check("new-core-dispatch-hook-changes-bound-child-AST",
		sum([]byte(normalized(variant["isolatedProofChild"]))) != current)
	result := map[string]interface{}{
		"schema": "g3a-hard-runner-source-ast/v1",
		"normalization": "Go parser.ParseFile(mode=0); go/format.Node(new FileSet, whole FuncDecl or identified statement); SHA256 UTF8; no comments/positions",
		"functions": ids, "primitiveStatements": primitives, "sourceOnlyChecks": checks,
		"qualifiedChildStatementIndices": map[string]int{
			"private": private, "readonlyRootSeal": seal, "chroot": chroot,
			"dropPrivileges": drop, "networkNegative": negative, "importOnlyCommand": dispatch},
		"prohibitedExecution": map[string]int{"candidateBuilds": 0, "coreRuns": 0, "isolationRuns": 0},
	}
	require(json.NewEncoder(os.Stdout).Encode(result) == nil, "BINDING_OUTPUT_FAILED")
	fmt.Fprintln(os.Stderr, "SOURCE_BINDING_CHECKS_PASS_NO_RUNNER_OR_CORE_EXECUTED")
}
