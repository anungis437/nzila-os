# Hard-runner source-bound stop

This is an exclusive investigation/evidence lane, not a production runner.
Historical source and sealed artifacts are read-only references.

The qualified constructor `isolatedProofChild` is a parameterless monolithic
function. It creates only writable `/work` and `/output`, seals the root
read-only, chroots, drops every privilege, and executes an import-only self-test.
There is no privileged pre-seal mount callback or post-isolation core-dispatch
callback. The qualified parent also has a fixed proof-only command/plan.

Adding hard-bounded `/build`, executable bounded `/tmp`, and the exact null-only
device delta would require editing that bound constructor before its root seal.
Dispatching the frozen core would require another edit after its privilege checks.
The AST tool demonstrates that each insertion changes the constructor identity.
Separate privilege/network helpers can remain identical, but that does not
establish whole-function equivalence of a new constructor.

Under this task's unchanged-qualified-implementation constraint, integration
stops at that boundary. No duplicate child, monkey patch, alternate Python
constructor, environment opt-in, or new production CLI is supplied. Production
remains denied, including absent future execution authority.

`binding_tool.go` uses only the Go standard library and parses source without
compiling or invoking the capsule/core. `inspect_source.py` rebaselines both
worktrees before each evidence write, verifies historical hashes, runs the AST
tool with caches contained in this lane, and reruns the historical helper tests
with Python bytecode disabled. Those tests are not production integration or
offline runtime qualification. Its report separates those statuses explicitly.

Reproduction from this lane (requires the already installed Windows Go tool):

```powershell
python -B .\inspect_source.py
```

Reports use exclusive creation. A second invocation refuses to overwrite
existing evidence. No commit, candidate build, frozen-core rerun, cloud access,
registry access, or product/foreign source edit is performed.
