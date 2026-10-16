package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"
)

func hasString(node ast.Node, literal string) bool {
	found := false
	ast.Inspect(node, func(node ast.Node) bool {
		if value, ok := node.(*ast.BasicLit); ok && value.Kind == token.STRING && value.Value == literal {
			found = true
		}
		return true
	})
	return found
}

func callCount(node ast.Node, name string) int {
	count := 0
	ast.Inspect(node, func(node ast.Node) bool {
		if call, ok := node.(*ast.CallExpr); ok {
			if ident, ok := call.Fun.(*ast.Ident); ok && ident.Name == name {
				count++
			}
		}
		return true
	})
	return count
}

func TestManifestSingleWriteControlFlow(t *testing.T) {
	path := os.Getenv("REGRESSION_TARGET")
	if path == "" {
		path = "main.go"
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	file, err := parser.ParseFile(token.NewFileSet(), path, raw, 0)
	if err != nil {
		t.Fatal(err)
	}
	var execute, exclusive *ast.FuncDecl
	for _, decl := range file.Decls {
		if function, ok := decl.(*ast.FuncDecl); ok {
			switch function.Name.Name {
			case "execute":
				execute = function
			case "exclusive":
				exclusive = function
			}
		}
	}
	if execute == nil || exclusive == nil {
		t.Fatal("controller functions required")
	}
	loopPosition, writePosition, gatePosition, indexPosition, layoutPosition := -1, -1, -1, -1, -1
	for index, statement := range execute.Body.List {
		if loop, ok := statement.(*ast.RangeStmt); ok && callCount(loop.Body, "replaceDescriptor") == 1 {
			values, ok := loop.X.(*ast.CompositeLit)
			if !ok || len(values.Elts) != 2 {
				t.Fatal("exactly two layer descriptors required")
			}
			for number, name := range []string{"first", "second"} {
				value, ok := values.Elts[number].(*ast.Ident)
				if !ok || value.Name != name {
					t.Fatal("application then certificate descriptors required")
				}
			}
			if callCount(loop.Body, "exclusive") != 0 {
				t.Fatal("MANIFEST_WRITE_INSIDE_DESCRIPTOR_LOOP")
			}
			loopPosition = index
		}
		if condition, ok := statement.(*ast.IfStmt); ok &&
			condition.Init != nil && hasString(condition.Init, `"manifest.json"`) {
			if writePosition != -1 || callCount(condition.Init, "exclusive") != 1 ||
				len(condition.Body.List) != 1 {
				t.Fatal("one exclusive manifest write with immediate failure return required")
			}
			if _, ok := condition.Body.List[0].(*ast.ReturnStmt); !ok {
				t.Fatal("manifest write failure must stop")
			}
			writePosition = index
		}
		if condition, ok := statement.(*ast.IfStmt); ok &&
			hasString(condition, `"EXACT_FROZEN_MANIFEST_MISMATCH_STOP"`) {
			if gatePosition != -1 || len(condition.Body.List) != 1 {
				t.Fatal("one exact manifest gate required")
			}
			if _, ok := condition.Body.List[0].(*ast.ReturnStmt); !ok {
				t.Fatal("manifest digest failure must stop")
			}
			gatePosition = index
		}
		if assignment, ok := statement.(*ast.AssignStmt); ok &&
			hasString(assignment, `"index-template.json"`) {
			indexPosition = index
		}
		if assignment, ok := statement.(*ast.AssignStmt); ok &&
			hasString(assignment, `"oci"`) {
			layoutPosition = index
		}
	}
	if !(loopPosition >= 0 && writePosition == loopPosition+1 && gatePosition == writePosition+1 &&
		indexPosition > gatePosition && layoutPosition > indexPosition) {
		t.Fatal("descriptors, single write, manifest gate, index and layout must be ordered at top level")
	}
	if !strings.Contains(string(raw), "os.O_CREATE|os.O_EXCL|os.O_WRONLY") {
		t.Fatal("exclusive file flags changed")
	}
	flags := false
	ast.Inspect(exclusive, func(node ast.Node) bool {
		if call, ok := node.(*ast.CallExpr); ok {
			if selector, ok := call.Fun.(*ast.SelectorExpr); ok && selector.Sel.Name == "OpenFile" &&
				len(call.Args) == 3 {
				flags = true
			}
		}
		return true
	})
	if !flags {
		t.Fatal("exclusive helper must use OpenFile")
	}
}
