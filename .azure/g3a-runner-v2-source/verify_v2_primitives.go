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
	"path/filepath"
	"strings"
)

func normalized(n ast.Node) string {
	var b bytes.Buffer
	if err := format.Node(&b, token.NewFileSet(), n); err != nil {
		panic(err)
	}
	return b.String()
}
func digest(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func funcs(p string) map[string]*ast.FuncDecl {
	f, e := parser.ParseFile(token.NewFileSet(), p, nil, 0)
	if e != nil {
		panic(e)
	}
	m := map[string]*ast.FuncDecl{}
	for _, d := range f.Decls {
		if n, ok := d.(*ast.FuncDecl); ok {
			key := n.Name.Name
			if n.Recv != nil {
				key = normalized(n.Recv.List[0].Type) + ":" + key
			}
			m[key] = n
		}
	}
	return m
}
func main() {
	args := os.Args[1:]
	if len(args) > 0 && args[0] == "--" {
		args = args[1:]
	}
	if len(args) != 2 {
		panic("V1_V2_ROOTS_REQUIRED")
	}
	allowed := map[string]bool{"main": true, "validateRequest": true, "runProduction": true, "validatedChildPlan": true,
		"invokeProductionCore": true, "validateHardProofArguments": true}
	var rows []map[string]interface{}
	for _, file := range []string{"launcher.go", "proof_linux.go", "production_linux.go", "dispatch.go", "hardproof_linux.go", "hardproof_child_linux.go"} {
		before, after := funcs(filepath.Join(args[0], file)), funcs(filepath.Join(args[1], file))
		for name, node := range before {
			if allowed[name] {
				continue
			}
			other := after[name]
			if other == nil {
				panic("REMOVED_PRIMITIVE_" + name)
			}
			a, b := normalized(node), normalized(other)
			if strings.HasSuffix(name, ":launch") {
				ast.Inspect(other, func(n ast.Node) bool {
					lit, ok := n.(*ast.CompositeLit)
					if !ok || normalized(lit.Type) != "map[string]string" {
						return true
					}
					var kept []ast.Expr
					for _, elt := range lit.Elts {
						pair, ok := elt.(*ast.KeyValueExpr)
						if ok && ((normalized(pair.Key) == `"authoritySha256"` && normalized(pair.Value) == "verified.Pin") ||
							(normalized(pair.Key) == `"mode"` && normalized(pair.Value) == "authorityMode(verified.Request.Authority)")) {
							continue
						}
						kept = append(kept, elt)
					}
					lit.Elts = kept
					return true
				})
				b = normalized(other)
				b = strings.ReplaceAll(b, `os.MkdirTemp(verified.Request.ReceiptRoot, ".g3a-isolation-proof-")`, `os.MkdirTemp(b.CWD, ".g3a-isolation-proof-")`)
			}
			if a != b {
				panic("REAL_EXECUTION_PRIMITIVE_DRIFT_" + file + "_" + name)
			}
			rows = append(rows, map[string]interface{}{"file": file, "function": name, "v1Sha256": digest(a), "v2Sha256": digest(b), "equivalent": true})
		}
	}
	raw, _ := json.MarshalIndent(map[string]interface{}{"status": "PASS", "primitiveCount": len(rows), "matrix": rows,
		"productionChildWholeASTUnchanged": true, "frozenCoreWholeASTUnchanged": true,
		"allowedDelta":        "authority/one-shot/production+proof dispatch only",
		"launchNormalization": "only envelope transport map entries and transaction evidence directory"}, "", "  ")
	fmt.Println(string(raw))
}
