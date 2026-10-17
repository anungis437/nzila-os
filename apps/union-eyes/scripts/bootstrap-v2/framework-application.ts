import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { currentBackendSourceFiles, root, hash } from './source'

export interface FrameworkApplicationTarget {
  containerId: string
  wheelhouse: string
  database: string
  password: string
  users: { runtime: string; auth: string; request: string; worker: string }
}

export function proveFrameworkApplication(target: FrameworkApplicationTarget) {
  const standalone =
    target.database === 'postgres' &&
    Object.values(target.users).every((user) => /^ue_framework_proof_[a-z_]+$/.test(user))
  const integrated =
    target.database === 'ue_v2_clean_reference' &&
    target.users.runtime === 'ue_v2_fixture_actor' &&
    target.users.auth === 'ue_v2_fixture_auth' &&
    target.users.request === 'ue_v2_fixture_framework_request' &&
    target.users.worker === 'ue_v2_fixture_framework_worker'
  if (!path.isAbsolute(target.wheelhouse) || (!standalone && !integrated))
    throw new Error('UE_FRAMEWORK_APPLICATION_SYNTHETIC_TARGET_REQUIRED')
  const label = execFileSync(
    'docker',
    ['inspect', '--format', '{{index .Config.Labels "nzila.mission"}}', target.containerId],
    { encoding: 'utf8' },
  ).trim()
  if (label !== (standalone ? 'UE_BOOTSTRAP_V2_FRAMEWORK' : 'UE_BOOTSTRAP_V2_CLEANROOM'))
    throw new Error('UE_FRAMEWORK_APPLICATION_MISSION_TARGET_REQUIRED')
  const name = `ue-v2-framework-application-${randomUUID()}`
  const invoke = (args: string[]) =>
    execFileSync('docker', args, {
      encoding: 'utf8',
      timeout: 600000,
      maxBuffer: 32 * 1024 * 1024,
    })
  let started = false
  try {
    invoke([
      'run',
      '-d',
      '--pull',
      'never',
      '--name',
      name,
      '--read-only',
      '--user',
      '65534:65534',
      '--label',
      'nzila.mission=UE_BOOTSTRAP_V2_FRAMEWORK_APPLICATION',
      '--network',
      `container:${target.containerId}`,
      '--tmpfs',
      '/workspace:rw,exec,size=768m',
      '--memory',
      '1536m',
      '--cpus',
      '2',
      '-e',
      'TMPDIR=/workspace/tmp',
      '-e',
      'TMP=/workspace/tmp',
      '-e',
      'TEMP=/workspace/tmp',
      'python:3.11-slim@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce',
      'python',
      '-B',
      '-c',
      'import time;time.sleep(900)',
    ])
    started = true
    const wheels = Object.fromEntries(
      readdirSync(target.wheelhouse)
        .filter((file) => file.endsWith('.whl'))
        .map((file) => [file, readFileSync(path.join(target.wheelhouse, file)).toString('base64')]),
    )
    if (!Object.keys(wheels).length) throw new Error('UE_FRAMEWORK_OFFLINE_WHEELHOUSE_EMPTY')
    const files = [
      ...currentBackendSourceFiles(),
      path.join(root, 'apps', 'union-eyes', 'backend', 'requirements.lock'),
      path.join(root, 'apps', 'union-eyes', 'scripts', 'bootstrap-v2', 'framework_application.py'),
    ]
    const repo = Object.fromEntries(
      files.map((file) => [
        path.relative(root, file).replaceAll('\\', '/'),
        readFileSync(file).toString('base64'),
      ]),
    )
    const sourceDigests = Object.fromEntries(
      files.map((file) => [
        path.relative(root, file).replaceAll('\\', '/'),
        hash(readFileSync(file, 'utf8')),
      ]),
    )
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        name,
        'python',
        '-B',
        '-c',
        'import json,sys,pathlib,base64; pathlib.Path("/workspace/tmp").mkdir(parents=True,exist_ok=True); data=json.load(sys.stdin); [(pathlib.Path("/workspace",scope,name).parent.mkdir(parents=True,exist_ok=True),pathlib.Path("/workspace",scope,name).write_bytes(base64.b64decode(value))) for scope,files in data["files"].items() for name,value in files.items()]; pathlib.Path("/workspace/target.json").write_text(json.dumps(data["target"]))',
      ],
      {
        input: JSON.stringify({
          files: { wheels, repo },
          target: { ...target, password: target.password },
        }),
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 32 * 1024 * 1024,
      },
    )
    const result = invoke([
      'exec',
      name,
      'python',
      '-B',
      '-c',
      'import os,pathlib,subprocess,sys; pathlib.Path("/workspace/tmp").mkdir(parents=True,exist_ok=True); os.environ.update({"TMPDIR":"/workspace/tmp","TMP":"/workspace/tmp","TEMP":"/workspace/tmp"}); subprocess.run([sys.executable,"-m","pip","install","--quiet","--no-compile","--no-cache-dir","--disable-pip-version-check","--no-index","--require-hashes","--find-links","/workspace/wheels","--target","/workspace/deps","-r","/workspace/repo/apps/union-eyes/backend/requirements.lock"],check=True,stdout=sys.stderr); sys.path.insert(0,"/workspace/deps"); exec(compile(open("/workspace/repo/apps/union-eyes/scripts/bootstrap-v2/framework_application.py").read(),"framework_application.py","exec"))',
    ])
    const parsed: unknown = JSON.parse(result)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('result' in parsed) ||
      parsed.result !== 'PASS' ||
      !('cases' in parsed) ||
      !Array.isArray(parsed.cases) ||
      !parsed.cases.every((entry: unknown) => typeof entry === 'string') ||
      !('currentSettings' in parsed) ||
      parsed.currentSettings !== 'config.settings' ||
      !('externalDatabaseConnections' in parsed) ||
      parsed.externalDatabaseConnections !== 0
    )
      throw new Error('UE_FRAMEWORK_APPLICATION_REQUIRED_PROOF_SHAPE')
    for (const [file, digest] of Object.entries(sourceDigests))
      if (hash(readFileSync(path.join(root, ...file.split('/')), 'utf8')) !== digest)
        throw new Error(`UE_FRAMEWORK_APPLICATION_SOURCE_CHANGED_DURING_PROOF:${file}`)
    return {
      result: 'PASS' as const,
      cases: parsed.cases.filter((entry: unknown): entry is string => typeof entry === 'string'),
      currentSettings: parsed.currentSettings,
      externalDatabaseConnections: parsed.externalDatabaseConnections,
      sourceDigests,
    }
  } finally {
    if (started) {
      const actual = invoke([
        'inspect',
        '--format',
        '{{index .Config.Labels "nzila.mission"}}',
        name,
      ]).trim()
      if (actual !== 'UE_BOOTSTRAP_V2_FRAMEWORK_APPLICATION')
        throw new Error('UE_FRAMEWORK_APPLICATION_CLEANUP_LABEL_MISMATCH')
      invoke(['rm', '-f', name])
    }
  }
}
