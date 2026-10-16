//go:build linux && amd64

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

func hardBoundStaticProofChild() (code int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	r := newResult()
	r.Schema, r.Mode = hardProofSchema, "--hard-bound-static-proof"
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
	productionPlan, productionErr := validatedHardProofPlan(plan)
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
	if err = invokeHardProofWitness(productionPlan, &r, evidenceFD); err != nil {
		fail(&r, "productionDispatch", err.Error())
		return
	}
	r.Checks["selfContained"], r.Outcome = "PASS", "PASS"
	delete(r.Details, "operation")
	code = 0
	return
}
