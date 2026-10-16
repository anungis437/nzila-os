//go:build ignore

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
	"unicode"
)

func normalized(node ast.Node) string {
	var buffer bytes.Buffer
	if err := format.Node(&buffer, token.NewFileSet(), node); err != nil {
		panic(err)
	}
	return buffer.String()
}

func digest(raw string) string {
	value := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(value[:])
}

func functions(path string) map[string]*ast.FuncDecl {
	file, err := parser.ParseFile(token.NewFileSet(), path, nil, 0)
	if err != nil {
		panic(err)
	}
	result := map[string]*ast.FuncDecl{}
	for _, declaration := range file.Decls {
		if function, ok := declaration.(*ast.FuncDecl); ok {
			result[function.Name.Name] = function
		}
	}
	return result
}

func require(ok bool, reason string) {
	if !ok {
		panic(reason)
	}
}

func statements(function *ast.FuncDecl) []string {
	require(function != nil, "MISSING_FUNCTION")
	var result []string
	for _, statement := range function.Body.List {
		result = append(result, normalized(statement))
	}
	return result
}

func first(values []string, pattern string) int {
	compact := func(raw string) string {
		return strings.Map(func(char rune) rune {
			if unicode.IsSpace(char) {
				return -1
			}
			return char
		}, raw)
	}
	for index, value := range values {
		if strings.Contains(compact(value), compact(pattern)) {
			return index
		}
	}
	panic("MISSING_PRIMITIVE_" + pattern)
}

func attrExpressions(function *ast.FuncDecl) map[string]string {
	result := map[string]string{}
	ast.Inspect(function, func(node ast.Node) bool {
		literal, ok := node.(*ast.CompositeLit)
		if !ok || normalized(literal.Type) != "syscall.SysProcAttr" {
			return true
		}
		for _, element := range literal.Elts {
			pair := element.(*ast.KeyValueExpr)
			result[normalized(pair.Key)] = normalized(pair.Value)
		}
		return true
	})
	return result
}

func main() {
	args := os.Args[1:]
	if len(args) > 0 && args[0] == "--" {
		args = args[1:]
	}
	require(len(args) == 5, "FIVE_SOURCE_ARGUMENTS_REQUIRED")
	qualified, candidate := functions(args[0]), functions(args[1])
	launcher, revisedLauncher := functions(args[2]), functions(args[3])
	backend := functions(args[4])
	var rows []map[string]interface{}
	for _, name := range []string{"namespaceBoundary", "disconnectedRoutes", "prctl", "capabilities", "dropPrivileges", "networkNegative"} {
		before, after := normalized(qualified[name]), normalized(candidate[name])
		require(before == after, "HELPER_DRIFT_"+name)
		rows = append(rows, map[string]interface{}{"primitive": name, "identityType": "whole unchanged FuncDecl",
			"qualifiedSha256": digest(before), "productionSha256": digest(after), "equivalent": true})
	}
	original, production := statements(qualified["isolatedProofChild"]), statements(candidate["productionChild"])
	// Every original top-level statement must survive identically and in order.
	// Only the plan byte bound changes; it is authorized input/evidence plumbing, not isolation.
	for index, value := range original {
		original[index] = strings.ReplaceAll(value, "io.LimitReader(f, 8192)", "io.LimitReader(f, 32768)")
	}
	cursor := 0
	var matched []int
	for _, expected := range original {
		for cursor < len(production) && production[cursor] != expected {
			cursor++
		}
		require(cursor < len(production), "ORIGINAL_STATEMENT_DRIFT_"+digest(expected))
		matched = append(matched, cursor)
		cursor++
	}
	primitivePatterns := []string{"runtime.LockOSThread()", "defer runtime.UnlockOSThread()",
		"namespaceBoundary()", "isolatedNamespaces := ", `[]string{"mnt", "net"}`,
		"syscall.MS_REC | syscall.MS_PRIVATE", "size=128m", "syscall.MS_BIND",
		"syscall.MS_BIND|syscall.MS_REMOUNT|syscall.MS_RDONLY",
		`syscall.Mount("", root, "tmpfs"`,
		"syscall.Chroot(root)", `os.Chdir("/work")`, "dropPrivileges(&r)",
		"HOST_PATH_NOT_ABSENT", "READONLY_NOT_VERIFIED", "WORK_OUTPUT_MOUNT_FLAGS", "networkNegative(&r)"}
	for _, pattern := range primitivePatterns {
		index := first(original, pattern)
		before, after := original[index], production[matched[index]]
		rows = append(rows, map[string]interface{}{"primitive": pattern, "identityType": "normalized top-level subtree including error handling",
			"qualifiedSha256": digest(before), "productionSha256": digest(after),
			"qualifiedStatementIndex": index, "productionStatementIndex": matched[index], "equivalent": before == after})
	}
	start, end := first(original, "net.Interfaces()"), first(original, "syscall.Chroot(root)")
	before := strings.Join(original[start:end], "\n")
	var sequence []string
	for index := start; index < end; index++ {
		sequence = append(sequence, production[matched[index]])
	}
	after := strings.Join(sequence, "\n")
	require(before == after, "NETWORK_INTERFACE_ROUTE_SEQUENCE_DRIFT")
	rows = append(rows, map[string]interface{}{"primitive": "ordered disconnected interface and route census",
		"identityType":    "statement sequence including census loops and all failure branches",
		"qualifiedSha256": digest(before), "productionSha256": digest(after), "equivalent": true})
	dropBefore, dropAfter := statements(qualified["dropPrivileges"]), statements(candidate["dropPrivileges"])
	nnpStart := first(dropBefore, "syscall.SYS_PRCTL, 38")
	boundingStart := first(dropBefore, "for cap := uintptr")
	stateStart := first(dropBefore, "caps, err := capabilities()")
	regainStart := first(dropBefore, "syscall.Setresuid(0, 0, 0)")
	regainEnd := first(dropBefore, `r.Checks["privilegeRegainNegative"] = "PASS"`) + 1
	for _, group := range []struct {
		name       string
		start, end int
	}{
		{"no-new-privileges all-thread set, readback and failure branches", nnpStart, boundingStart},
		{"ordered bounding/ambient drops, saved IDs/groups drop and cap clearing", boundingStart, stateStart},
		{"ordered nonroot IDs/groups and zero-capability verification", stateStart, regainStart},
		{"ordered root UID/GID and capability regain EPERM negatives", regainStart, regainEnd},
	} {
		before, after := strings.Join(dropBefore[group.start:group.end], "\n"), strings.Join(dropAfter[group.start:group.end], "\n")
		require(before == after, "PRIVILEGE_SUBTREE_DRIFT_"+group.name)
		rows = append(rows, map[string]interface{}{"primitive": group.name, "identityType": "ordered complete normalized dropPrivileges subtrees",
			"qualifiedSha256": digest(before), "productionSha256": digest(after), "startStatement": group.start,
			"endStatementExclusive": group.end, "equivalent": true})
	}
	beforeAttrs, afterAttrs := attrExpressions(qualified["guestProof"]), attrExpressions(backend["launch"])
	for _, field := range []string{"Cloneflags", "Pdeathsig"} {
		require(beforeAttrs[field] != "" && beforeAttrs[field] == afterAttrs[field], "PARENT_NAMESPACE_LAUNCH_DRIFT_"+field)
		rows = append(rows, map[string]interface{}{"primitive": "parent SysProcAttr." + field,
			"qualifiedSha256": digest(beforeAttrs[field]), "productionSha256": digest(afterAttrs[field]), "equivalent": true})
	}
	require(afterAttrs["Setpgid"] == "true", "MISSING_GROUP_CLEANUP")
	require(first(statements(backend["launch"]), "cmd.SysProcAttr") < first(statements(backend["launch"]), "cmd.Start()"),
		"NAMESPACE_FLAGS_AFTER_PROCESS_START")
	require(normalized(launcher["run"]) == normalized(revisedLauncher["run"]), "HISTORICAL_SELFTEST_RUN_DRIFT")
	mainSource := normalized(revisedLauncher["main"])
	require(strings.Contains(mainSource, `os.Args[1] == "--production"`) &&
		strings.Contains(mainSource, "runProduction(os.Stdin)") &&
		strings.Contains(mainSource, "os.Exit(productionChild())"), "ACTUAL_CLI_NOT_WIRED")
	require(first(production, "validatedChildPlan(plan)") < first(production, "syscall.MS_REC | syscall.MS_PRIVATE"), "AUTHORITY_AFTER_ISOLATION")
	require(first(production, "syscall.CloseOnExec(4)") < first(production, "stageProductionMounts(root, productionPlan)"), "EVIDENCE_FD_LEAK")
	require(first(production, "stageProductionMounts(root, productionPlan)") < first(production, "remount-root-readonly"), "MOUNTS_AFTER_READONLY_SEAL")
	require(first(production, "invokeProductionCore(productionPlan, &r, evidenceFD)") > first(production, "networkNegative(&r)"), "CORE_BEFORE_NEGATIVES")
	require(first(production, "invokeProductionCore(productionPlan, &r, evidenceFD)") < first(production, `r.Checks["selfContained"], r.Outcome`), "SUCCESS_BEFORE_CORE")
	require(strings.Contains(normalized(backend["dispatchConstructedCore"]), "childDispatchBoundary("), "CHILD_GATE_NOT_CALLED")
	require(strings.Contains(normalized(backend["invokeProductionCore"]), "executeFrozenCore(r, output)"), "FROZEN_CORE_NOT_WIRED")
	raw, err := json.MarshalIndent(map[string]interface{}{
		"status": "PASS_PRIMITIVE_EQUIVALENCE_AND_SOURCE_WIRING", "primitiveMatrix": rows,
		"originalStatementsPreservedInOrder": len(original), "productionStatementIndices": matched,
		"productionOrchestrationIdentityChangedAsAuthorized": digest(normalized(qualified["isolatedProofChild"])) != digest(normalized(candidate["productionChild"])),
		"qualifiedOrchestrationSha256":                       digest(normalized(qualified["isolatedProofChild"])),
		"productionOrchestrationSha256":                      digest(normalized(candidate["productionChild"])),
		"wholeOrchestrationEquivalenceRequired":              false,
	}, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(raw))
}
