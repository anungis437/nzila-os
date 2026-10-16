//go:build linux && amd64

package main

import (
	"bytes"
	"crypto/sha256"
	"debug/elf"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"unsafe"
)

const marker = "G3A_ISOLATION_PROOF_V1 "
const mechanism = "clone(CLONE_NEWNS|CLONE_NEWNET)+private-bind-readonly+chroot(no-proc)"

type baseline struct {
	Architecture string            `json:"architecture"`
	Kernel       string            `json:"kernel"`
	CWD          string            `json:"cwd"`
	Status       map[string]string `json:"status"`
	Namespaces   map[string]string `json:"namespaces"`
	Mounts       []string          `json:"relevantMountState"`
}

type proofResult struct {
	Schema          string                 `json:"schema"`
	Mode            string                 `json:"mode"`
	SHA256          string                 `json:"candidateSha256"`
	Bytes           int64                  `json:"candidateBytes"`
	Outcome         string                 `json:"outcome"`
	FailedPrimitive string                 `json:"failedPrimitive,omitempty"`
	FailedOperation string                 `json:"failedOperation,omitempty"`
	ErrorCode       string                 `json:"errorCode,omitempty"`
	Baseline        *baseline              `json:"baseline,omitempty"`
	Checks          map[string]string      `json:"checks"`
	Details         map[string]interface{} `json:"details,omitempty"`
	BaselineSHA256  string                 `json:"baselineSha256,omitempty"`
	EvidenceSHA256  string                 `json:"evidenceSha256,omitempty"`
	EvidenceFile    string                 `json:"evidenceFile,omitempty"`
	CensusSHA256    string                 `json:"embeddedCensusSha256,omitempty"`
	EmbeddedCount   int                    `json:"embeddedFileCount"`
	RuntimeSHA256   string                 `json:"runtimeEvidenceSha256,omitempty"`
	RuntimeCount    int                    `json:"runtimeCensusCount,omitempty"`
}

func newResult() proofResult {
	r := proofResult{Schema: "g3a-isolation-proof/v1", Mode: "--guest-isolation-proof",
		Outcome: "FAIL", Checks: map[string]string{}, Details: map[string]interface{}{}}
	for _, key := range []string{"baseline", "mountNamespace", "rootIsolation", "hostFSNegative",
		"networkIsolation", "networkNegative", "noNewPrivs", "privilegeDrop",
		"privilegeRegainNegative", "selfContained"} {
		r.Checks[key] = "NOT_RUN"
	}
	return r
}

func digest(raw []byte) string {
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

func hashFile(path string) (string, int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	return hex.EncodeToString(h.Sum(nil)), n, err
}

func chars(raw []int8) string {
	var b []byte
	for _, c := range raw {
		if c == 0 {
			break
		}
		b = append(b, byte(c))
	}
	return string(b)
}

func captureBaseline() (baseline, error) {
	b := baseline{Architecture: runtime.GOOS + "/" + runtime.GOARCH,
		Status: map[string]string{}, Namespaces: map[string]string{}}
	var u syscall.Utsname
	if err := syscall.Uname(&u); err != nil {
		return b, err
	}
	b.Kernel = chars(u.Release[:])
	var err error
	if b.CWD, err = os.Getwd(); err != nil {
		return b, err
	}
	raw, err := os.ReadFile("/proc/self/status")
	if err != nil {
		return b, err
	}
	for _, line := range strings.Split(string(raw), "\n") {
		key, value, found := strings.Cut(line, ":")
		if found && (key == "Uid" || key == "Gid" || key == "Groups" ||
			strings.HasPrefix(key, "Cap") || key == "NoNewPrivs" ||
			key == "Seccomp" || key == "Seccomp_filters") {
			b.Status[key] = strings.TrimSpace(value)
		}
	}
	for _, key := range []string{"Uid", "Gid", "CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb", "NoNewPrivs", "Seccomp"} {
		if _, ok := b.Status[key]; !ok {
			return b, errors.New("BASELINE_REQUIRED_FIELD")
		}
	}
	for _, name := range []string{"mnt", "net", "pid", "user", "uts", "ipc", "cgroup"} {
		if b.Namespaces[name], err = os.Readlink("/proc/self/ns/" + name); err != nil {
			return b, err
		}
	}
	raw, err = os.ReadFile("/proc/self/mountinfo")
	if err != nil {
		return b, err
	}
	// Record options/propagation only for the boundary, not host mount sources or user paths.
	for _, line := range strings.Split(string(raw), "\n") {
		fields := strings.Fields(line)
		if len(fields) > 6 && (fields[4] == "/" || fields[4] == "/proc" || fields[4] == b.CWD) {
			i := 6
			for i < len(fields) && fields[i] != "-" {
				i++
			}
			b.Mounts = append(b.Mounts, fields[4]+" "+fields[5]+" "+strings.Join(fields[6:i], " "))
		}
	}
	if len(b.Mounts) == 0 {
		return b, errors.New("BASELINE_MOUNT_STATE")
	}
	return b, nil
}

func fail(r *proofResult, primitive, code string) {
	r.Outcome, r.FailedPrimitive, r.ErrorCode = "FAIL", primitive, code
	if op, ok := r.Details["operation"].(string); ok {
		r.FailedOperation = op
	}
	if _, ok := r.Checks[primitive]; ok {
		r.Checks[primitive] = "FAIL"
	}
}

func errnoCode(err error) string {
	if errors.Is(err, syscall.EPERM) || errors.Is(err, syscall.EACCES) {
		return "EPERM_OR_EACCES"
	}
	if errors.Is(err, syscall.ENOSYS) {
		return "ENOSYS"
	}
	if errors.Is(err, syscall.EINVAL) {
		return "EINVAL"
	}
	return "PROOF_OPERATION_FAILED"
}

func census() (int, string, error) {
	// Reuse the historical extractor as the archive/census authority, without extracting here.
	raw, err := embeddedCensus()
	if err != nil {
		return 0, "", err
	}
	var c map[string]entry
	if err = json.Unmarshal(raw, &c); err != nil {
		return 0, "", err
	}
	return len(c), digest(raw), nil
}

func guestProof() int {
	r := newResult()
	r.SHA256, r.Bytes, _ = hashFile("/proc/self/exe")
	b, err := captureBaseline()
	if err != nil {
		fail(&r, "baseline", errnoCode(err))
		emit(r)
		return 1
	}
	r.Baseline, r.Checks["baseline"] = &b, "PASS"
	baseRaw, _ := json.Marshal(b)
	r.BaselineSHA256 = digest(baseRaw)
	r.EmbeddedCount, r.CensusSHA256, err = census()
	if err != nil || r.EmbeddedCount != 141 || r.SHA256 == "" {
		fail(&r, "baseline", "ARTIFACT_IDENTITY_OR_CENSUS")
		emit(r)
		return 1
	}
	// Evidence is exclusively created beneath the inherited working directory, never /tmp.
	evidence, err := os.MkdirTemp(b.CWD, ".g3a-isolation-proof-")
	if err != nil {
		fail(&r, "evidence", errnoCode(err))
		emit(r)
		return 1
	}
	if err = os.WriteFile(filepath.Join(evidence, "baseline.json"), baseRaw, 0600); err != nil {
		fail(&r, "evidence", errnoCode(err))
		return finish(r, evidence)
	}
	input, output, err := os.Pipe()
	if err != nil {
		fail(&r, "child", errnoCode(err))
		return finish(r, evidence)
	}
	plan, _ := json.Marshal(map[string]string{"evidence": evidence, "cwd": b.CWD})
	cmd := exec.Command("/proc/self/exe", "--_isolated-proof-child")
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C"}
	cmd.Dir = evidence
	cmd.ExtraFiles = []*os.File{input}
	// clone(2) creates the namespaces before the Go child runtime starts any threads.
	// Thread-local unshare after Go runtime startup would leave host namespaces on other threads.
	cmd.SysProcAttr = &syscall.SysProcAttr{Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWNET,
		Pdeathsig: syscall.SIGKILL}
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	err = cmd.Start()
	input.Close()
	if err != nil {
		output.Close()
		r.Checks["mountNamespace"] = "UNSUPPORTED"
		fail(&r, "namespaceClone", errnoCode(err))
		return finish(r, evidence)
	}
	_, writeErr := output.Write(plan)
	output.Close()
	err = cmd.Wait()
	var child proofResult
	if writeErr != nil || json.Unmarshal(stdout.Bytes(), &child) != nil ||
		child.Schema != r.Schema || child.Mode != r.Mode || child.Checks == nil {
		fail(&r, "child", "STRUCTURED_CHILD_OUTPUT_MISSING")
	} else {
		for k, v := range child.Checks {
			if k != "baseline" {
				r.Checks[k] = v
			}
		}
		r.Details, r.RuntimeSHA256, r.RuntimeCount = child.Details, child.RuntimeSHA256, child.RuntimeCount
		r.Outcome, r.FailedPrimitive, r.ErrorCode = child.Outcome, child.FailedPrimitive, child.ErrorCode
		r.FailedOperation = child.FailedOperation
		if err != nil && child.Outcome == "PASS" {
			fail(&r, "child", "CHILD_EXIT_INCONSISTENT")
		}
		if child.Outcome == "PASS" && !allPass(r.Checks) {
			fail(&r, "child", "INCOMPLETE_PASS")
		}
	}
	return finish(r, evidence)
}

func allPass(checks map[string]string) bool {
	expected := newResult().Checks
	if len(checks) != len(expected) {
		return false
	}
	for k := range expected {
		if checks[k] != "PASS" {
			return false
		}
	}
	return true
}

func emit(r proofResult) {
	raw, _ := json.Marshal(r)
	fmt.Println(marker + string(raw))
}

func finish(r proofResult, dir string) int {
	r.EvidenceFile = filepath.Base(dir) + "/proof.json"
	raw, err := json.Marshal(r)
	if err == nil {
		err = os.WriteFile(filepath.Join(dir, "proof.json"), raw, 0600)
	}
	if err != nil {
		fail(&r, "evidence", errnoCode(err))
	} else {
		r.EvidenceSHA256 = digest(raw)
	}
	r.Baseline, r.Details = nil, nil
	emit(r)
	if r.Outcome == "PASS" && allPass(r.Checks) && err == nil {
		return 0
	}
	return 1
}

func prctl(op, a, b uintptr) (uintptr, error) {
	value, _, errno := syscall.RawSyscall6(syscall.SYS_PRCTL, op, a, b, 0, 0, 0)
	if errno != 0 {
		return value, errno
	}
	return value, nil
}

func namespaceBoundary() error {
	for _, name := range []string{"mnt", "net"} {
		child, err := os.Readlink("/proc/self/ns/" + name)
		if err != nil {
			return err
		}
		parent, err := os.Readlink("/proc/" + strconv.Itoa(os.Getppid()) + "/ns/" + name)
		if err != nil {
			return err
		}
		if parent == child {
			return errors.New("CHILD_NAMESPACE_NOT_SEPARATE")
		}
	}
	return nil
}

func isolatedProofChild() (code int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	r := newResult()
	code = 1
	defer func() {
		if recover() != nil {
			fail(&r, "child", "CHILD_PANIC")
		}
		raw, _ := json.Marshal(r)
		fmt.Println(string(raw))
	}()
	if err := namespaceBoundary(); err != nil {
		fail(&r, "mountNamespace", "CHILD_NAMESPACE_NOT_SEPARATE")
		return
	}
	isolatedNamespaces := map[string]string{}
	for _, name := range []string{"mnt", "net"} {
		id, err := os.Readlink("/proc/self/ns/" + name)
		if err != nil {
			fail(&r, "mountNamespace", "ISOLATED_NAMESPACE_ID")
			return
		}
		isolatedNamespaces[name] = id
	}
	r.Details["isolatedNamespaces"] = isolatedNamespaces
	f := os.NewFile(3, "proof-plan")
	if f == nil {
		fail(&r, "child", "PLAN_PIPE_MISSING")
		return
	}
	st, err := f.Stat()
	if err != nil || st.Mode()&os.ModeNamedPipe == 0 {
		fail(&r, "child", "PLAN_NOT_PIPE")
		return
	}
	var plan map[string]string
	if json.NewDecoder(io.LimitReader(f, 8192)).Decode(&plan) != nil {
		fail(&r, "child", "PLAN_INVALID")
		return
	}
	f.Close()
	cwd, err := os.Getwd()
	if err != nil || plan["evidence"] != cwd || !strings.HasPrefix(filepath.Base(cwd), ".g3a-isolation-proof-") {
		fail(&r, "child", "PLAN_ROOT_INVALID")
		return
	}
	if os.Geteuid() != 0 {
		fail(&r, "privilegeDrop", "ROOT_INHERITANCE_REQUIRED")
		return
	}
	r.Details["operation"] = "mount-recursive-private"
	if err = syscall.Mount("", "/", "", syscall.MS_REC|syscall.MS_PRIVATE, ""); err != nil {
		fail(&r, "mountNamespace", errnoCode(err))
		return
	}
	r.Checks["mountNamespace"] = "PASS"
	r.Details["isolationMechanism"] = mechanism
	root := filepath.Join(cwd, "root")
	r.Details["operation"] = "create-exclusive-root"
	if err = os.Mkdir(root, 0700); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	// A fresh tmpfs root prevents inherited mounts/proc from appearing under the boundary.
	r.Details["operation"] = "mount-fresh-root-tmpfs"
	if err = syscall.Mount("none", root, "tmpfs", syscall.MS_NOSUID|syscall.MS_NODEV, "mode=0755,size=128m"); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	c, err := extract(filepath.Join(root, "runtime"))
	if err != nil {
		fail(&r, "selfContained", "HISTORICAL_EXTRACTION_FAILED")
		return
	}
	r.Details["operation"] = "stage-embedded-soname-aliases"
	aliases, err := stageSONAMEAliases(filepath.Join(root, "runtime"))
	if err != nil {
		fail(&r, "selfContained", "EMBEDDED_SONAME_STAGING_FAILED")
		return
	}
	r.Details["runtimeSONAMEAliases"] = aliases
	r.Details["operation"] = "runtime-nonroot-permissions"
	err = filepath.Walk(filepath.Join(root, "runtime"), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if err = os.Chown(path, 65532, 65532); err != nil {
			return err
		}
		if info.IsDir() {
			return os.Chmod(path, 0500)
		}
		return nil
	})
	if err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	probe := filepath.Join(root, "readonly-probe")
	if os.WriteFile(probe, []byte("proof-only"), 0600) != nil || os.Chown(probe, 65532, 65532) != nil {
		fail(&r, "rootIsolation", "READONLY_PROBE_SETUP")
		return
	}
	for _, name := range []string{"work", "output"} {
		r.Details["operation"] = "mount-rw-" + name
		path := filepath.Join(root, name)
		if err = os.Mkdir(path, 0700); err != nil {
			fail(&r, "rootIsolation", errnoCode(err))
			return
		}
		if err = syscall.Mount("none", path, "tmpfs", syscall.MS_NOSUID|syscall.MS_NODEV|syscall.MS_NOEXEC,
			"mode=0700,uid=65532,gid=65532,size=16m"); err != nil {
			fail(&r, "rootIsolation", errnoCode(err))
			return
		}
	}
	ro := filepath.Join(root, "runtime")
	r.Details["operation"] = "bind-runtime-readonly"
	if err = syscall.Mount(ro, ro, "", syscall.MS_BIND, ""); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	if err = syscall.Mount("", ro, "", syscall.MS_BIND|syscall.MS_REMOUNT|syscall.MS_RDONLY|syscall.MS_NOSUID|syscall.MS_NODEV, ""); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	r.Details["operation"] = "remount-root-readonly"
	if err = syscall.Mount("", root, "tmpfs", syscall.MS_REMOUNT|syscall.MS_RDONLY|syscall.MS_NOSUID|syscall.MS_NODEV, ""); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		fail(&r, "networkIsolation", errnoCode(err))
		return
	}
	var interfaceEvidence []map[string]interface{}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil || iface.Name != "lo" || iface.Flags&net.FlagUp != 0 || len(addrs) != 0 {
			fail(&r, "networkIsolation", "CONNECTED_INTERFACE")
			return
		}
		interfaceEvidence = append(interfaceEvidence, map[string]interface{}{"name": iface.Name, "flags": uint(iface.Flags), "addressCount": len(addrs)})
	}
	if len(ifaces) != 1 {
		fail(&r, "networkIsolation", "EXPECTED_DOWN_LOOPBACK_ONLY")
		return
	}
	r.Details["interfaces"] = interfaceEvidence
	for _, path := range []string{"/proc/net/route", "/proc/net/ipv6_route"} {
		r.Details["operation"] = "disconnected-route-census-" + filepath.Base(path)
		raw, err := os.ReadFile(path)
		if err != nil {
			fail(&r, "networkIsolation", errnoCode(err))
			return
		}
		r.Details["isolatedNamespaceRouteTable_"+filepath.Base(path)] = string(raw)
		rejects, routeErr := disconnectedRoutes(raw, path == "/proc/net/ipv6_route")
		if routeErr != nil {
			fail(&r, "networkIsolation", "ROUTE_PRESENT")
			return
		}
		if rejects > 0 {
			r.Details["ipv6KernelNullRejectRoutes"] = rejects
		}
	}
	r.Details["routeCount"] = 0
	r.Checks["networkIsolation"] = "PASS"
	r.Details["operation"] = "chroot-and-chdir"
	if err = syscall.Chroot(root); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	if err = os.Chdir("/work"); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	r.Checks["rootIsolation"] = "PASS"
	// No descriptors referring to the host are inherited by the embedded runtime.
	// fd3 is already closed; only bounded stdio pipes remain.
	r.Details["operation"] = "drop-and-verify-privileges"
	if err = dropPrivileges(&r); err != nil {
		return
	}
	for _, path := range []string{"/var/lib/waagent", "/etc/shadow", plan["cwd"], "/root", "/home", "/proc", "/sys"} {
		r.Details["operation"] = "host-filesystem-accessibility-negatives"
		if path == "/" || path == "/work" || path == "/output" || strings.HasPrefix(path, "/runtime") {
			fail(&r, "hostFSNegative", "HOST_PATH_COLLIDES_WITH_BOUNDARY")
			return
		}
		if _, err = os.Stat(path); !os.IsNotExist(err) {
			fail(&r, "hostFSNegative", "HOST_PATH_NOT_ABSENT")
			return
		}
	}
	r.Details["hostAccessibilityOnly"] = "waagent,shadow,originalCWD,root,home,proc,sys:ENOENT"
	r.Checks["hostFSNegative"] = "PASS"
	var fs syscall.Statfs_t
	r.Details["operation"] = "verify-readonly-root-and-runtime"
	mountFlags := map[string]int64{}
	for _, path := range []string{"/", "/runtime"} {
		if syscall.Statfs(path, &fs) != nil || fs.Flags&syscall.MS_RDONLY == 0 {
			fail(&r, "rootIsolation", "READONLY_NOT_VERIFIED")
			return
		}
		mountFlags[path] = fs.Flags
	}
	if err = os.WriteFile("/readonly-probe", []byte("x"), 0600); !errors.Is(err, syscall.EROFS) {
		fail(&r, "rootIsolation", "RUNTIME_NOT_READONLY")
		return
	}
	for _, path := range []string{"/work/write-probe", "/output/write-probe"} {
		r.Details["operation"] = "verify-rw-work-and-output"
		directory := filepath.Dir(path)
		required := int64(syscall.MS_NOEXEC | syscall.MS_NOSUID | syscall.MS_NODEV)
		if syscall.Statfs(directory, &fs) != nil || fs.Flags&syscall.MS_RDONLY != 0 || fs.Flags&required != required {
			fail(&r, "rootIsolation", "WORK_OUTPUT_MOUNT_FLAGS")
			return
		}
		mountFlags[directory] = fs.Flags
		if err = os.WriteFile(path, []byte("proof-only"), 0600); err != nil {
			fail(&r, "rootIsolation", "WORK_OUTPUT_NOT_WRITABLE")
			return
		}
		r.Details["isolatedMountFlags"] = mountFlags
		if err = os.Remove(path); err != nil {
			fail(&r, "rootIsolation", "WORK_OUTPUT_PROBE_CLEANUP")
			return
		}
	}
	r.Details["operation"] = "disconnected-tcp-negatives"
	if err = networkNegative(&r); err != nil {
		return
	}
	dirs := make([]string, len(c.Libraries))
	for i, dir := range c.Libraries {
		dirs[i] = filepath.Join("/runtime", dir)
	}
	cmd := exec.Command(filepath.Join("/runtime", c.Loader), "--library-path", strings.Join(dirs, ":"),
		filepath.Join("/runtime", c.Python), "-B", "-S", "/runtime/app/entry.py", "/runtime")
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C",
		"PYTHONHOME=" + filepath.Join("/runtime", c.Home), "PYTHONSAFEPATH=1", "PYTHONNOUSERSITE=1"}
	cmd.Dir = "/work"
	native := exec.Command(filepath.Join("/runtime", c.Loader), "--library-path", strings.Join(dirs, ":"),
		filepath.Join("/runtime", c.Python), "-B", "-S", "-c", "import _hashlib, _ssl, _bz2, _lzma")
	native.Env, native.Dir, native.Stdin = cmd.Env, cmd.Dir, bytes.NewReader(nil)
	var nativeStderr bytes.Buffer
	native.Stderr = &nativeStderr
	r.Details["operation"] = "embedded-native-dependency-probe"
	if _, err := native.Output(); err != nil {
		if nativeStderr.Len() <= 4096 {
			r.Details["isolatedNativeStderr"] = nativeStderr.String()
		}
		fail(&r, "selfContained", "EMBEDDED_NATIVE_IMPORT_FAILED")
		return
	}
	// Explicit pipes avoid os/exec's otherwise implicit host /dev/null dependency.
	var runtimeStderr bytes.Buffer
	cmd.Stdin, cmd.Stderr = bytes.NewReader(nil), &runtimeStderr
	r.Details["operation"] = "historical-embedded-runtime-selftest"
	raw, err := cmd.Output()
	if err != nil {
		r.Details["runtimeStderrSha256"] = digest(runtimeStderr.Bytes())
		if runtimeStderr.Len() <= 4096 {
			r.Details["isolatedRuntimeStderr"] = runtimeStderr.String()
		}
		r.Details["runtimeErrorClass"] = fmt.Sprintf("%T", err)
		if exit, ok := err.(*exec.ExitError); ok {
			r.Details["runtimeExitCode"] = exit.ExitCode()
		}
		fail(&r, "selfContained", "EMBEDDED_SELFTEST_FAILED_"+errnoCode(err))
		return
	}
	var selftest struct {
		Status    string            `json:"status"`
		Census    []json.RawMessage `json:"importedRuntimeCensus"`
		Live      string            `json:"liveExecution"`
		Network   int               `json:"networkRequests"`
		Qualified bool              `json:"transactionQualified"`
	}
	if json.Unmarshal(raw, &selftest) != nil || selftest.Status != "PASS_OFFLINE_IMPORT_ONLY" ||
		selftest.Live != "DISABLED" || selftest.Network != 0 || selftest.Qualified || len(selftest.Census) == 0 {
		fail(&r, "selfContained", "EMBEDDED_SELFTEST_CONTRACT")
		return
	}
	r.RuntimeSHA256, r.RuntimeCount = digest(raw), len(selftest.Census)
	r.Details["runtimeSelfTest"] = json.RawMessage(raw)
	r.Details["dependencyClasses"] = []string{"CAPSULE_EMBEDDED", "PINNED_KERNEL_ABI"}
	r.Checks["selfContained"], r.Outcome = "PASS", "PASS"
	delete(r.Details, "operation")
	code = 0
	return
}

func disconnectedRoutes(raw []byte, ipv6 bool) (int, error) {
	lines := strings.FieldsFunc(strings.TrimSpace(string(raw)), func(c rune) bool { return c == '\n' })
	if !ipv6 {
		if len(lines) == 0 || (len(lines) == 1 && strings.HasPrefix(lines[0], "Iface")) {
			return 0, nil
		}

		return 0, errors.New("IPV4_ROUTE_PRESENT")
	}
	rejects := 0
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) != 10 {
			return 0, errors.New("IPV6_ROUTE_INVALID")
		}
		flags, err := strconv.ParseUint(fields[8], 16, 32)
		// Linux initializes unreachable ::/0 null-route sentinels even in a fresh netns.
		// Accept only all-zero destination/source/gateway, /0, lo, and RTF_REJECT.
		zero := strings.Repeat("0", 32)
		if err != nil || flags&0x200 == 0 || fields[0] != zero || fields[1] != "00" ||
			fields[2] != zero || fields[3] != "00" || fields[4] != zero || fields[9] != "lo" {
			return 0, errors.New("IPV6_USABLE_ROUTE_PRESENT")
		}
		rejects++
	}
	return rejects, nil
}

func stageSONAMEAliases(root string) ([]map[string]string, error) {
	var aliases []map[string]string
	var files []string
	if err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Mode().IsRegular() && strings.Contains(info.Name(), ".so") {
			files = append(files, path)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	for _, path := range files {
		f, err := elf.Open(path)
		if err != nil {
			return nil, err
		}
		names, err := f.DynString(elf.DT_SONAME)
		f.Close()
		if err != nil {
			return nil, err
		}
		if len(names) == 0 {
			continue
		}
		if len(names) != 1 || !safe(names[0]) || strings.Contains(names[0], "/") {
			return nil, errors.New("SONAME_ALIAS_CONTRACT")
		}
		if names[0] == filepath.Base(path) {
			continue
		}
		alias := filepath.Join(filepath.Dir(path), names[0])
		// Hard links use exclusively the already census-verified embedded bytes; no host lookup.
		if err = os.Link(path, alias); err != nil {
			return nil, err
		}
		sourceSHA, _, err := hashFile(path)
		if err != nil {
			return nil, err
		}
		aliasSHA, _, err := hashFile(alias)
		if err != nil || sourceSHA != aliasSHA {
			return nil, errors.New("SONAME_ALIAS_IDENTITY")
		}
		source, _ := filepath.Rel(root, path)
		target, _ := filepath.Rel(root, alias)
		aliases = append(aliases, map[string]string{"source": source, "alias": target,
			"sha256": sourceSHA, "classification": "CAPSULE_EMBEDDED"})
	}
	return aliases, nil
}

type capHeader struct {
	Version uint32
	PID     int32
}
type capData struct{ Effective, Permitted, Inheritable uint32 }

func capabilities() ([2]capData, error) {
	header := capHeader{Version: 0x20080522}
	var data [2]capData
	_, _, errno := syscall.RawSyscall(syscall.SYS_CAPGET, uintptr(unsafe.Pointer(&header)), uintptr(unsafe.Pointer(&data[0])), 0)
	if errno != 0 {
		return data, errno
	}
	return data, nil
}

func dropPrivileges(r *proofResult) error {
	failDrop := func(code string) error { fail(r, "privilegeDrop", code); return errors.New(code) }
	// Apply process-wide using Go's all-thread syscall coordination, then verify the executing thread.
	_, _, errno := syscall.AllThreadsSyscall6(syscall.SYS_PRCTL, 38, 1, 0, 0, 0, 0)
	nnp, err := prctl(39, 0, 0)
	if errno != 0 || err != nil || nnp != 1 {
		fail(r, "noNewPrivs", "NNP_NOT_VERIFIED")
		return errors.New("NNP_NOT_VERIFIED")
	}
	r.Checks["noNewPrivs"] = "PASS"
	for cap := uintptr(0); cap < 64; cap++ {
		_, err := prctl(23, cap, 0)
		if errors.Is(err, syscall.EINVAL) {
			break
		}
		if err != nil {
			return failDrop("CAP_BOUNDING_READ_FAILED")
		}
		_, _, errno = syscall.AllThreadsSyscall6(syscall.SYS_PRCTL, 24, cap, 0, 0, 0, 0)
		if errno != 0 {
			return failDrop("CAP_BOUNDING_DROP_FAILED")
		}
	}
	_, _, errno = syscall.AllThreadsSyscall6(syscall.SYS_PRCTL, 47, 4, 0, 0, 0, 0)
	if errno != 0 {
		return failDrop("CAP_AMBIENT_CLEAR_FAILED")
	}
	if syscall.Setgroups([]int{}) != nil || syscall.Setresgid(65532, 65532, 65532) != nil ||
		syscall.Setresuid(65532, 65532, 65532) != nil {
		return failDrop("SETRESIDS_FAILED")
	}
	header := capHeader{Version: 0x20080522}
	var zero [2]capData
	_, _, errno = syscall.RawSyscall(syscall.SYS_CAPSET, uintptr(unsafe.Pointer(&header)), uintptr(unsafe.Pointer(&zero[0])), 0)
	if errno != 0 {
		return failDrop("CAP_CLEAR_FAILED")
	}
	caps, err := capabilities()
	groups, groupErr := syscall.Getgroups()
	var ru, eu, su, rg, eg, sg uint32
	_, _, uidErr := syscall.RawSyscall(syscall.SYS_GETRESUID, uintptr(unsafe.Pointer(&ru)), uintptr(unsafe.Pointer(&eu)), uintptr(unsafe.Pointer(&su)))
	_, _, gidErr := syscall.RawSyscall(syscall.SYS_GETRESGID, uintptr(unsafe.Pointer(&rg)), uintptr(unsafe.Pointer(&eg)), uintptr(unsafe.Pointer(&sg)))
	if err != nil || caps != zero || groupErr != nil || len(groups) != 0 || uidErr != 0 || gidErr != 0 ||
		ru != 65532 || eu != 65532 || su != 65532 || rg != 65532 || eg != 65532 || sg != 65532 {
		return failDrop("DROPPED_STATE_NOT_VERIFIED")
	}
	for cap := uintptr(0); cap < 64; cap++ {
		bnd, err := prctl(23, cap, 0)
		if errors.Is(err, syscall.EINVAL) {
			break
		}
		amb, ambErr := prctl(47, 1, cap)
		if err != nil || bnd != 0 || ambErr != nil || amb != 0 {
			return failDrop("CAP_BOUNDING_AMBIENT_NOT_ZERO")
		}
	}
	r.Details["privilegeState"] = map[string]interface{}{"uidRealEffectiveSaved": []uint32{ru, eu, su},
		"gidRealEffectiveSaved": []uint32{rg, eg, sg}, "supplementaryGroups": []int{},
		"capEffectivePermittedInheritable": caps, "capBoundingAmbient": "ZERO", "noNewPrivs": 1}
	r.Checks["privilegeDrop"] = "PASS"
	if !errors.Is(syscall.Setresuid(0, 0, 0), syscall.EPERM) ||
		!errors.Is(syscall.Setresgid(0, 0, 0), syscall.EPERM) {
		fail(r, "privilegeRegainNegative", "ROOT_REGAIN_NOT_DENIED")
		return errors.New("ROOT_REGAIN_NOT_DENIED")
	}
	regain := [2]capData{{Effective: 1, Permitted: 1}}
	_, _, errno = syscall.RawSyscall(syscall.SYS_CAPSET, uintptr(unsafe.Pointer(&header)), uintptr(unsafe.Pointer(&regain[0])), 0)
	if errno != syscall.EPERM {
		fail(r, "privilegeRegainNegative", "CAP_REGAIN_NOT_DENIED")
		return errors.New("CAP_REGAIN_NOT_DENIED")
	}
	r.Checks["privilegeRegainNegative"] = "PASS"
	return nil
}

func networkNegative(r *proofResult) error {
	var attempts []map[string]string
	for _, target := range []struct {
		name string
		ip   [4]byte
		port int
	}{
		{"loopback", [4]byte{127, 0, 0, 1}, 9},
		{"private", [4]byte{10, 0, 0, 1}, 443},
		{"linklocal", [4]byte{169, 254, 169, 254}, 80},
	} {
		fd, err := syscall.Socket(syscall.AF_INET, syscall.SOCK_STREAM|syscall.SOCK_NONBLOCK|syscall.SOCK_CLOEXEC, 0)
		if err != nil {
			fail(r, "networkNegative", "TCP_SOCKET_FAILED")
			return err
		}
		err = syscall.Connect(fd, &syscall.SockaddrInet4{Addr: target.ip, Port: target.port})
		syscall.Close(fd)
		if !errors.Is(err, syscall.ENETUNREACH) && !errors.Is(err, syscall.EHOSTUNREACH) {
			fail(r, "networkNegative", "TCP_NOT_DISCONNECTED")
			return errors.New("TCP_NOT_DISCONNECTED")
		}
		attempts = append(attempts, map[string]string{"targetClass": target.name, "state": "UNREACHABLE"})
	}
	r.Details["tcpNegatives"], r.Checks["networkNegative"] = attempts, "PASS"
	return nil
}

func productionChild() (code int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	r := newResult()
	r.Mode = "--production"
	code = 1
	defer func() {
		if recover() != nil {
			fail(&r, "child", "CHILD_PANIC")
		}
		raw, _ := json.Marshal(r)
		fmt.Println(string(raw))
	}()
	if err := namespaceBoundary(); err != nil {
		fail(&r, "mountNamespace", "CHILD_NAMESPACE_NOT_SEPARATE")
		return
	}
	isolatedNamespaces := map[string]string{}
	for _, name := range []string{"mnt", "net"} {
		id, err := os.Readlink("/proc/self/ns/" + name)
		if err != nil {
			fail(&r, "mountNamespace", "ISOLATED_NAMESPACE_ID")
			return
		}
		isolatedNamespaces[name] = id
	}
	r.Details["isolatedNamespaces"] = isolatedNamespaces
	f := os.NewFile(3, "proof-plan")
	if f == nil {
		fail(&r, "child", "PLAN_PIPE_MISSING")
		return
	}
	st, err := f.Stat()
	if err != nil || st.Mode()&os.ModeNamedPipe == 0 {
		fail(&r, "child", "PLAN_NOT_PIPE")
		return
	}
	var plan map[string]string
	if json.NewDecoder(io.LimitReader(f, 32768)).Decode(&plan) != nil {
		fail(&r, "child", "PLAN_INVALID")
		return
	}
	f.Close()
	cwd, err := os.Getwd()
	if err != nil || plan["evidence"] != cwd || !strings.HasPrefix(filepath.Base(cwd), ".g3a-isolation-proof-") {
		fail(&r, "child", "PLAN_ROOT_INVALID")
		return
	}
	productionPlan, productionErr := validatedChildPlan(plan)
	if productionErr != nil {
		fail(&r, "productionAuthority", productionErr.Error())
		return
	}
	evidenceFD := os.NewFile(4, "bounded-evidence-pipe")
	if evidenceFD == nil {
		fail(&r, "productionEvidence", "EVIDENCE_PIPE_MISSING")
		return
	}
	defer evidenceFD.Close()
	evidenceStat, evidenceErr := evidenceFD.Stat()
	if evidenceErr != nil || evidenceStat.Mode()&os.ModeNamedPipe == 0 {
		fail(&r, "productionEvidence", "EVIDENCE_NOT_PIPE")
		return
	}
	syscall.CloseOnExec(4)
	if os.Geteuid() != 0 {
		fail(&r, "privilegeDrop", "ROOT_INHERITANCE_REQUIRED")
		return
	}
	r.Details["operation"] = "mount-recursive-private"
	if err = syscall.Mount("", "/", "", syscall.MS_REC|syscall.MS_PRIVATE, ""); err != nil {
		fail(&r, "mountNamespace", errnoCode(err))
		return
	}
	r.Checks["mountNamespace"] = "PASS"
	r.Details["isolationMechanism"] = mechanism
	root := filepath.Join(cwd, "root")
	r.Details["operation"] = "create-exclusive-root"
	if err = os.Mkdir(root, 0700); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	// A fresh tmpfs root prevents inherited mounts/proc from appearing under the boundary.
	r.Details["operation"] = "mount-fresh-root-tmpfs"
	if err = syscall.Mount("none", root, "tmpfs", syscall.MS_NOSUID|syscall.MS_NODEV, "mode=0755,size=128m"); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	c, err := extract(filepath.Join(root, "runtime"))
	if err != nil {
		fail(&r, "selfContained", "HISTORICAL_EXTRACTION_FAILED")
		return
	}
	r.Details["operation"] = "stage-embedded-soname-aliases"
	aliases, err := stageSONAMEAliases(filepath.Join(root, "runtime"))
	if err != nil {
		fail(&r, "selfContained", "EMBEDDED_SONAME_STAGING_FAILED")
		return
	}
	r.Details["runtimeSONAMEAliases"] = aliases
	r.Details["operation"] = "runtime-nonroot-permissions"
	err = filepath.Walk(filepath.Join(root, "runtime"), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if err = os.Chown(path, 65532, 65532); err != nil {
			return err
		}
		if info.IsDir() {
			return os.Chmod(path, 0500)
		}
		return nil
	})
	if err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	probe := filepath.Join(root, "readonly-probe")
	if os.WriteFile(probe, []byte("proof-only"), 0600) != nil || os.Chown(probe, 65532, 65532) != nil {
		fail(&r, "rootIsolation", "READONLY_PROBE_SETUP")
		return
	}
	for _, name := range []string{"work", "output"} {
		r.Details["operation"] = "mount-rw-" + name
		path := filepath.Join(root, name)
		if err = os.Mkdir(path, 0700); err != nil {
			fail(&r, "rootIsolation", errnoCode(err))
			return
		}
		if err = syscall.Mount("none", path, "tmpfs", syscall.MS_NOSUID|syscall.MS_NODEV|syscall.MS_NOEXEC,
			"mode=0700,uid=65532,gid=65532,size=16m"); err != nil {
			fail(&r, "rootIsolation", errnoCode(err))
			return
		}
	}
	if err = stageProductionMounts(root, productionPlan); err != nil {
		fail(&r, "productionMounts", err.Error())
		return
	}
	ro := filepath.Join(root, "runtime")
	r.Details["operation"] = "bind-runtime-readonly"
	if err = syscall.Mount(ro, ro, "", syscall.MS_BIND, ""); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	if err = syscall.Mount("", ro, "", syscall.MS_BIND|syscall.MS_REMOUNT|syscall.MS_RDONLY|syscall.MS_NOSUID|syscall.MS_NODEV, ""); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	r.Details["operation"] = "remount-root-readonly"
	if err = syscall.Mount("", root, "tmpfs", syscall.MS_REMOUNT|syscall.MS_RDONLY|syscall.MS_NOSUID|syscall.MS_NODEV, ""); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		fail(&r, "networkIsolation", errnoCode(err))
		return
	}
	var interfaceEvidence []map[string]interface{}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil || iface.Name != "lo" || iface.Flags&net.FlagUp != 0 || len(addrs) != 0 {
			fail(&r, "networkIsolation", "CONNECTED_INTERFACE")
			return
		}
		interfaceEvidence = append(interfaceEvidence, map[string]interface{}{"name": iface.Name, "flags": uint(iface.Flags), "addressCount": len(addrs)})
	}
	if len(ifaces) != 1 {
		fail(&r, "networkIsolation", "EXPECTED_DOWN_LOOPBACK_ONLY")
		return
	}
	r.Details["interfaces"] = interfaceEvidence
	for _, path := range []string{"/proc/net/route", "/proc/net/ipv6_route"} {
		r.Details["operation"] = "disconnected-route-census-" + filepath.Base(path)
		raw, err := os.ReadFile(path)
		if err != nil {
			fail(&r, "networkIsolation", errnoCode(err))
			return
		}
		r.Details["isolatedNamespaceRouteTable_"+filepath.Base(path)] = string(raw)
		rejects, routeErr := disconnectedRoutes(raw, path == "/proc/net/ipv6_route")
		if routeErr != nil {
			fail(&r, "networkIsolation", "ROUTE_PRESENT")
			return
		}
		if rejects > 0 {
			r.Details["ipv6KernelNullRejectRoutes"] = rejects
		}
	}
	r.Details["routeCount"] = 0
	r.Checks["networkIsolation"] = "PASS"
	r.Details["operation"] = "chroot-and-chdir"
	if err = syscall.Chroot(root); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	if err = os.Chdir("/work"); err != nil {
		fail(&r, "rootIsolation", errnoCode(err))
		return
	}
	r.Checks["rootIsolation"] = "PASS"
	// No descriptors referring to the host are inherited by the embedded runtime.
	// fd3 is already closed; only bounded stdio pipes remain.
	r.Details["operation"] = "drop-and-verify-privileges"
	if err = dropPrivileges(&r); err != nil {
		return
	}
	for _, path := range []string{"/var/lib/waagent", "/etc/shadow", plan["cwd"], "/root", "/home", "/proc", "/sys"} {
		r.Details["operation"] = "host-filesystem-accessibility-negatives"
		if path == "/" || path == "/work" || path == "/output" || strings.HasPrefix(path, "/runtime") {
			fail(&r, "hostFSNegative", "HOST_PATH_COLLIDES_WITH_BOUNDARY")
			return
		}
		if _, err = os.Stat(path); !os.IsNotExist(err) {
			fail(&r, "hostFSNegative", "HOST_PATH_NOT_ABSENT")
			return
		}
	}
	r.Details["hostAccessibilityOnly"] = "waagent,shadow,originalCWD,root,home,proc,sys:ENOENT"
	r.Checks["hostFSNegative"] = "PASS"
	var fs syscall.Statfs_t
	r.Details["operation"] = "verify-readonly-root-and-runtime"
	mountFlags := map[string]int64{}
	for _, path := range []string{"/", "/runtime"} {
		if syscall.Statfs(path, &fs) != nil || fs.Flags&syscall.MS_RDONLY == 0 {
			fail(&r, "rootIsolation", "READONLY_NOT_VERIFIED")
			return
		}
		mountFlags[path] = fs.Flags
	}
	if err = os.WriteFile("/readonly-probe", []byte("x"), 0600); !errors.Is(err, syscall.EROFS) {
		fail(&r, "rootIsolation", "RUNTIME_NOT_READONLY")
		return
	}
	for _, path := range []string{"/work/write-probe", "/output/write-probe"} {
		r.Details["operation"] = "verify-rw-work-and-output"
		directory := filepath.Dir(path)
		required := int64(syscall.MS_NOEXEC | syscall.MS_NOSUID | syscall.MS_NODEV)
		if syscall.Statfs(directory, &fs) != nil || fs.Flags&syscall.MS_RDONLY != 0 || fs.Flags&required != required {
			fail(&r, "rootIsolation", "WORK_OUTPUT_MOUNT_FLAGS")
			return
		}
		mountFlags[directory] = fs.Flags
		if err = os.WriteFile(path, []byte("proof-only"), 0600); err != nil {
			fail(&r, "rootIsolation", "WORK_OUTPUT_NOT_WRITABLE")
			return
		}
		r.Details["isolatedMountFlags"] = mountFlags
		if err = os.Remove(path); err != nil {
			fail(&r, "rootIsolation", "WORK_OUTPUT_PROBE_CLEANUP")
			return
		}
	}
	r.Details["operation"] = "disconnected-tcp-negatives"
	if err = networkNegative(&r); err != nil {
		return
	}
	dirs := make([]string, len(c.Libraries))
	for i, dir := range c.Libraries {
		dirs[i] = filepath.Join("/runtime", dir)
	}
	cmd := exec.Command(filepath.Join("/runtime", c.Loader), "--library-path", strings.Join(dirs, ":"),
		filepath.Join("/runtime", c.Python), "-B", "-S", "/runtime/app/entry.py", "/runtime")
	cmd.Env = []string{"PATH=/unavailable", "HOME=/unavailable", "LC_ALL=C",
		"PYTHONHOME=" + filepath.Join("/runtime", c.Home), "PYTHONSAFEPATH=1", "PYTHONNOUSERSITE=1"}
	cmd.Dir = "/work"
	native := exec.Command(filepath.Join("/runtime", c.Loader), "--library-path", strings.Join(dirs, ":"),
		filepath.Join("/runtime", c.Python), "-B", "-S", "-c", "import _hashlib, _ssl, _bz2, _lzma")
	native.Env, native.Dir, native.Stdin = cmd.Env, cmd.Dir, bytes.NewReader(nil)
	var nativeStderr bytes.Buffer
	native.Stderr = &nativeStderr
	r.Details["operation"] = "embedded-native-dependency-probe"
	if _, err := native.Output(); err != nil {
		if nativeStderr.Len() <= 4096 {
			r.Details["isolatedNativeStderr"] = nativeStderr.String()
		}
		fail(&r, "selfContained", "EMBEDDED_NATIVE_IMPORT_FAILED")
		return
	}
	// Explicit pipes avoid os/exec's otherwise implicit host /dev/null dependency.
	var runtimeStderr bytes.Buffer
	cmd.Stdin, cmd.Stderr = bytes.NewReader(nil), &runtimeStderr
	r.Details["operation"] = "historical-embedded-runtime-selftest"
	raw, err := cmd.Output()
	if err != nil {
		r.Details["runtimeStderrSha256"] = digest(runtimeStderr.Bytes())
		if runtimeStderr.Len() <= 4096 {
			r.Details["isolatedRuntimeStderr"] = runtimeStderr.String()
		}
		r.Details["runtimeErrorClass"] = fmt.Sprintf("%T", err)
		if exit, ok := err.(*exec.ExitError); ok {
			r.Details["runtimeExitCode"] = exit.ExitCode()
		}
		fail(&r, "selfContained", "EMBEDDED_SELFTEST_FAILED_"+errnoCode(err))
		return
	}
	var selftest struct {
		Status    string            `json:"status"`
		Census    []json.RawMessage `json:"importedRuntimeCensus"`
		Live      string            `json:"liveExecution"`
		Network   int               `json:"networkRequests"`
		Qualified bool              `json:"transactionQualified"`
	}
	if json.Unmarshal(raw, &selftest) != nil || selftest.Status != "PASS_OFFLINE_IMPORT_ONLY" ||
		selftest.Live != "DISABLED" || selftest.Network != 0 || selftest.Qualified || len(selftest.Census) == 0 {
		fail(&r, "selfContained", "EMBEDDED_SELFTEST_CONTRACT")
		return
	}
	r.RuntimeSHA256, r.RuntimeCount = digest(raw), len(selftest.Census)
	r.Details["runtimeSelfTest"] = json.RawMessage(raw)
	r.Details["dependencyClasses"] = []string{"CAPSULE_EMBEDDED", "PINNED_KERNEL_ABI"}
	if err = invokeProductionCore(productionPlan, &r, evidenceFD); err != nil {
		fail(&r, "productionDispatch", err.Error())
		return
	}
	r.Checks["selfContained"], r.Outcome = "PASS", "PASS"
	delete(r.Details, "operation")
	code = 0
	return
}
