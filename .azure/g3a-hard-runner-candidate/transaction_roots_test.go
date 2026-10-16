package main

import (
	"path/filepath"
	"testing"
)

func TestDispatchRejectsEvenDigestMatchedUnboundedTransactionRoots(t *testing.T) {
	for _, name := range []string{"wrong-transaction-directory", "separate-ledger", "host-tree", "nested-inputs", "relative", "unclean"} {
		t.Run(name, func(t *testing.T) {
			request, _ := fixture(t)
			root := filepath.Dir(request["inputRoot"].(string))
			switch name {
			case "wrong-transaction-directory":
				request["inputRoot"] = filepath.Join(filepath.Dir(root), ".g3a-transaction-OTHER", "inputs")
			case "separate-ledger":
				request["receiptRoot"] = filepath.Join(filepath.Dir(root), "receipts")
			case "host-tree":
				request["inputRoot"] = filepath.Dir(root)
			case "nested-inputs":
				request["inputRoot"] = filepath.Join(root, "inputs", "nested")
			case "relative":
				request["inputRoot"] = "inputs"
			case "unclean":
				request["inputRoot"] = root + string(filepath.Separator) + "." + string(filepath.Separator) + "inputs"
			}
			auth := request["authority"].(map[string]interface{})
			auth["inputRoot"], auth["receiptRoot"] = request["inputRoot"], request["receiptRoot"]
			pin, err := authorityDigest(encode(t, auth))
			if err != nil {
				t.Fatal(err)
			}
			spy := &boundarySpy{}
			if dispatchProduction(encode(t, request), pin, spy) == nil || len(spy.events) != 0 {
				t.Fatal("invalid, signed transaction paths reached prepare/consume/launch", spy.events)
			}
		})
	}
}
