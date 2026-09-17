import { constants } from 'node:fs'
import {
  access,
  lstat,
  readFile,
  readdir,
  realpath,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { spawn } from 'node:child_process'

export type DoctorStatus = 'pass' | 'warn' | 'fail'

export interface DoctorCheck {
  readonly id: string
  readonly status: DoctorStatus
  readonly summary: string
  readonly evidence?: readonly string[]
  readonly measured?: Readonly<Record<string, string | number | boolean>>
  readonly remediation?: string
}

export interface DoctorReport {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly invocationDirectory: string
  readonly repositoryRoot: string | null
  readonly ready: boolean
  readonly exitCode: 0 | 4
  readonly counts: {
    readonly pass: number
    readonly warn: number
    readonly fail: number
  }
  readonly checks: readonly DoctorCheck[]
}

export interface DoctorOptions {
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly platform?: NodeJS.Platform
  readonly nodeExecutable?: string
  readonly nodeVersion?: string
  readonly blenderExecutable?: string
  readonly now?: () => Date
}

interface CommandResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

const expectedRepositoryName = 'prehistoric-animal-museum'
const skillRelativePath =
  '.agents/skills/prehistoric-animal-onboarding/SKILL.md'
const toolRelativeRoot = 'tools/animal-onboarding'
const requiredTrackedToolFiles = [
  'tools/animal-onboarding/package.json',
  'tools/animal-onboarding/src/cli.ts',
  'tools/animal-onboarding/src/derive-assets.mjs',
  'tools/animal-onboarding/src/doctor.ts',
  'tools/animal-onboarding/src/validate-glb.mjs',
  'tools/animal-onboarding/blender/normalize_animal.py',
] as const

const writeBoundaries = [
  {
    id: 'candidate-write-boundary',
    relativePath: 'assets/candidates',
    label: 'Candidate workspace',
  },
  {
    id: 'run-write-boundary',
    relativePath: '.handoff/animal-onboarding-runs',
    label: 'Run evidence workspace',
  },
] as const

async function pathKind(path: string): Promise<'directory' | 'file' | 'other' | null> {
  return lstat(path)
    .then((entry) => {
      if (entry.isDirectory()) return 'directory' as const
      if (entry.isFile()) return 'file' as const
      return 'other' as const
    })
    .catch(() => null)
}

async function regularFile(path: string): Promise<boolean> {
  return (await pathKind(path)) === 'file'
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return (
    path === '' ||
    (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
  )
}

function gitPath(path: string): string {
  return path.split(sep).join('/')
}

async function runCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  env?: Readonly<Record<string, string | undefined>>,
): Promise<CommandResult> {
  return new Promise((complete) => {
    const child = spawn(command, [...args], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => {
      complete({ code: null, stdout: '', stderr: error.message })
    })
    child.on('close', (code) => {
      complete({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

export async function findRepositoryRoot(
  invocationDirectory: string,
): Promise<string | null> {
  let current = resolve(invocationDirectory)
  const kind = await pathKind(current)
  if (kind !== 'directory') current = dirname(current)
  while (true) {
    if ((await pathKind(resolve(current, '.git'))) !== null) return current
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

async function repositoryCheck(root: string | null): Promise<DoctorCheck> {
  if (!root) {
    return {
      id: 'repository-root',
      status: 'fail',
      summary: 'No Git worktree root was found above the invocation directory.',
      remediation:
        'Run animal onboarding from this repository or one of its linked worktrees.',
    }
  }
  const packagePath = resolve(root, 'package.json')
  try {
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
      readonly name?: unknown
    }
    if (packageJson.name !== expectedRepositoryName) {
      return {
        id: 'repository-root',
        status: 'fail',
        summary: `The discovered Git root is not ${expectedRepositoryName}.`,
        evidence: [root, packagePath],
        measured: {
          packageName:
            typeof packageJson.name === 'string'
              ? packageJson.name
              : '(missing)',
        },
        remediation: 'Run the command inside a prehistoric-animal-museum worktree.',
      }
    }
    return {
      id: 'repository-root',
      status: 'pass',
      summary: 'The prehistoric-animal-museum worktree root was discovered.',
      evidence: [root],
    }
  } catch (error) {
    return {
      id: 'repository-root',
      status: 'fail',
      summary: 'The discovered Git root has no readable project package.json.',
      evidence: [root, packagePath],
      remediation: error instanceof Error ? error.message : String(error),
    }
  }
}

async function gitTrackedFiles(root: string): Promise<Set<string> | null> {
  const result = await runCommand(
    'git',
    ['-C', root, 'ls-files', '--cached', '--', toolRelativeRoot, skillRelativePath],
    root,
  )
  if (result.code !== 0) return null
  return new Set(
    result.stdout
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
}

async function skillCheck(
  root: string | null,
  trackedFiles: Set<string> | null,
): Promise<DoctorCheck> {
  if (!root) {
    return {
      id: 'skill-entry',
      status: 'fail',
      summary: 'The Skill entry cannot be resolved without a repository root.',
    }
  }
  const path = resolve(root, skillRelativePath)
  const source = await readFile(path, 'utf8').catch(() => '')
  const namedCorrectly =
    /^name:\s*prehistoric-animal-onboarding\s*$/mu.test(source)
  const tracked = trackedFiles?.has(skillRelativePath) ?? false
  if (source.length === 0 || !namedCorrectly || !tracked) {
    return {
      id: 'skill-entry',
      status: 'fail',
      summary:
        'The onboarding Skill entry is missing, malformed, or unavailable to fresh worktrees.',
      evidence: [path],
      measured: {
        exists: source.length > 0,
        expectedName: namedCorrectly,
        tracked,
      },
      remediation:
        'Restore and track .agents/skills/prehistoric-animal-onboarding/SKILL.md.',
    }
  }
  return {
    id: 'skill-entry',
    status: 'pass',
    summary: 'The tracked prehistoric-animal-onboarding Skill entry is available.',
    evidence: [path],
  }
}

async function collectRuntimeToolFiles(root: string): Promise<string[]> {
  const relativeFiles: string[] = []
  const roots = ['src', 'blender', 'audio']
  const acceptedExtensions = /\.(?:[cm]?[jt]s|d\.ts|py)$/u

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '__pycache__' || entry.name === 'node_modules') continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else if (entry.isFile() && acceptedExtensions.test(entry.name)) {
        relativeFiles.push(gitPath(relative(root, path)))
      }
    }
  }

  for (const directory of roots) {
    await visit(resolve(root, toolRelativeRoot, directory))
  }
  return [...new Set(relativeFiles)].sort()
}

async function trackedToolCheck(
  root: string | null,
  trackedFiles: Set<string> | null,
): Promise<DoctorCheck> {
  if (!root || !trackedFiles) {
    return {
      id: 'tracked-onboarding-tool',
      status: 'fail',
      summary: 'Git could not verify that the onboarding tool is tracked.',
      remediation:
        'Ensure Git is available and the complete tools/animal-onboarding runtime is tracked.',
    }
  }
  const missingRequired = (
    await Promise.all(
      requiredTrackedToolFiles.map(async (path) => ({
        path,
        exists: await regularFile(resolve(root, path)),
      })),
    )
  )
    .filter(({ path, exists }) => !exists || !trackedFiles.has(path))
    .map(({ path }) => path)
  const runtimeFiles = await collectRuntimeToolFiles(root)
  const untrackedRuntime = runtimeFiles.filter((path) => !trackedFiles.has(path))
  const failures = [...new Set([...missingRequired, ...untrackedRuntime])].sort()
  if (failures.length > 0) {
    return {
      id: 'tracked-onboarding-tool',
      status: 'fail',
      summary:
        'The onboarding runtime is incomplete or contains files unavailable to fresh worktrees.',
      evidence: failures.map((path) => resolve(root, path)),
      measured: {
        requiredFiles: requiredTrackedToolFiles.length,
        runtimeFiles: runtimeFiles.length,
        unavailableFiles: failures.length,
      },
      remediation:
        'Track every onboarding runtime source; keep caches and generated evidence ignored.',
    }
  }
  return {
    id: 'tracked-onboarding-tool',
    status: 'pass',
    summary: 'The complete local onboarding runtime is tracked for every worktree.',
    evidence: [resolve(root, toolRelativeRoot)],
    measured: { runtimeFiles: runtimeFiles.length },
  }
}

function parseVersion(value: string): readonly [number, number, number] | null {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/u)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersions(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index]
    if (difference !== 0) return difference
  }
  return 0
}

async function nodeCheck(
  root: string | null,
  executable: string,
  version: string,
  platform: NodeJS.Platform,
): Promise<DoctorCheck> {
  const accessMode = platform === 'win32' ? constants.F_OK : constants.X_OK
  const executableReady = await access(executable, accessMode)
    .then(() => true)
    .catch(() => false)
  let minimumText: string | null = null
  if (root) {
    const packageJson = await readFile(resolve(root, 'package.json'), 'utf8')
      .then((source) => JSON.parse(source) as { engines?: { node?: unknown } })
      .catch(() => null)
    minimumText =
      typeof packageJson?.engines?.node === 'string'
        ? packageJson.engines.node
        : null
  }
  const actual = parseVersion(version)
  const minimumMatch = minimumText?.match(
    /^\s*>=\s*v?(\d+)\.(\d+)\.(\d+)\s*$/u,
  )
  const minimum = minimumMatch
    ? ([
        Number(minimumMatch[1]),
        Number(minimumMatch[2]),
        Number(minimumMatch[3]),
      ] as const)
    : null
  if (!executableReady || !actual || (minimum && compareVersions(actual, minimum) < 0)) {
    return {
      id: 'node-runtime',
      status: 'fail',
      summary: 'The Node.js runtime does not satisfy the project contract.',
      evidence: [executable],
      measured: {
        executable: executableReady,
        version,
        minimum: minimumText ?? '(unknown)',
      },
      remediation: `Install the Node.js version declared by ${expectedRepositoryName}/package.json.`,
    }
  }
  if (!minimum) {
    return {
      id: 'node-runtime',
      status: 'warn',
      summary: 'Node.js is executable, but the project minimum version is not readable.',
      evidence: [executable],
      measured: { version },
    }
  }
  return {
    id: 'node-runtime',
    status: 'pass',
    summary: `Node.js ${version} satisfies ${minimumText}.`,
    evidence: [executable],
    measured: { version, minimum: minimumText! },
  }
}

async function tsxCheck(root: string | null): Promise<DoctorCheck> {
  if (!root) {
    return {
      id: 'tsx-runtime',
      status: 'fail',
      summary: 'tsx cannot be resolved without a repository root.',
    }
  }
  try {
    const requireFromProject = createRequire(resolve(root, 'package.json'))
    const modulePath = requireFromProject.resolve('tsx')
    const packagePath = requireFromProject.resolve('tsx/package.json')
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
      readonly version?: unknown
    }
    if (typeof packageJson.version !== 'string') {
      throw new Error('tsx/package.json has no version.')
    }
    return {
      id: 'tsx-runtime',
      status: 'pass',
      summary: `tsx ${packageJson.version} resolves from this worktree.`,
      evidence: [modulePath, packagePath],
      measured: { version: packageJson.version },
    }
  } catch (error) {
    return {
      id: 'tsx-runtime',
      status: 'fail',
      summary: 'tsx does not resolve from this worktree.',
      remediation:
        error instanceof Error
          ? `${error.message} Install the pinned project dependencies.`
          : 'Install the pinned project dependencies.',
    }
  }
}

async function executable(path: string, platform: NodeJS.Platform): Promise<boolean> {
  return access(path, platform === 'win32' ? constants.F_OK : constants.X_OK)
    .then(() => true)
    .catch(() => false)
}

async function locateBlender(
  options: DoctorOptions,
  invocationDirectory: string,
): Promise<{ path: string | null; source: string }> {
  const environment = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const explicit =
    options.blenderExecutable ?? environment.BLENDER_BIN ?? environment.BLENDER_PATH
  if (explicit) {
    const path = isAbsolute(explicit)
      ? explicit
      : resolve(invocationDirectory, explicit)
    return {
      path: (await executable(path, platform)) ? path : null,
      source: options.blenderExecutable
        ? 'option'
        : environment.BLENDER_BIN
          ? 'BLENDER_BIN'
          : 'BLENDER_PATH',
    }
  }

  const names = platform === 'win32' ? ['blender.exe', 'blender'] : ['blender']
  for (const directory of (environment.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const path = join(directory, name)
      if (await executable(path, platform)) return { path, source: 'PATH' }
    }
  }

  const knownPaths =
    platform === 'darwin'
      ? [
          '/opt/homebrew/bin/blender',
          '/usr/local/bin/blender',
          '/Applications/Blender.app/Contents/MacOS/Blender',
        ]
      : ['/usr/bin/blender', '/usr/local/bin/blender']
  for (const path of knownPaths) {
    if (await executable(path, platform)) return { path, source: 'known-location' }
  }
  return { path: null, source: 'search' }
}

async function blenderCheck(
  options: DoctorOptions,
  invocationDirectory: string,
): Promise<DoctorCheck> {
  const located = await locateBlender(options, invocationDirectory)
  if (!located.path) {
    return {
      id: 'blender-executable',
      status: 'fail',
      summary: 'No executable Blender installation was found.',
      measured: { searchSource: located.source },
      remediation:
        'Install Blender or set BLENDER_BIN to its executable before candidate normalization.',
    }
  }
  return {
    id: 'blender-executable',
    status: 'pass',
    summary: 'An executable Blender installation is available.',
    evidence: [located.path],
    measured: { source: located.source },
  }
}

interface BrowserPolicyViolation {
  readonly path: string
  readonly line: number
  readonly reason: string
}

function lineForOffset(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length
}

async function headedBrowserCheck(root: string | null): Promise<DoctorCheck> {
  if (!root) {
    return {
      id: 'headed-browser-policy',
      status: 'fail',
      summary: 'Browser-policy compatibility cannot be inspected without a repository root.',
    }
  }
  const sourceRoot = resolve(root, toolRelativeRoot, 'src')
  const files = (await collectRuntimeToolFiles(root)).filter(
    (path) =>
      path.startsWith(`${toolRelativeRoot}/src/`) &&
      !path.endsWith('/doctor.ts'),
  )
  const violations: BrowserPolicyViolation[] = []
  for (const relativePath of files) {
    const path = resolve(root, relativePath)
    const source = await readFile(path, 'utf8')
    const patterns = [
      {
        expression: /\bheadless\s*:\s*true\b/gu,
        reason: 'explicit headless browser launch',
      },
      {
        expression:
          /\b(?:chromium|firefox|webkit|puppeteer)\.launch\s*\(\s*(?:\)|\{\s*\})/gu,
        reason: 'browser launch defaults to headless mode',
      },
      {
        expression: /['"`]--headless(?:=[^'"`\s]+)?['"`]/gu,
        reason: 'headless browser command-line flag',
      },
    ]
    for (const { expression, reason } of patterns) {
      for (const match of source.matchAll(expression)) {
        violations.push({
          path,
          line: lineForOffset(source, match.index ?? 0),
          reason,
        })
      }
    }
  }
  if (violations.length > 0) {
    return {
      id: 'headed-browser-policy',
      status: 'fail',
      summary:
        'The onboarding runtime still contains a prohibited headless-browser path.',
      evidence: violations.map(
        ({ path, line, reason }) => `${path}:${line} (${reason})`,
      ),
      measured: { violations: violations.length },
      remediation:
        'Use the already-open headed Browser or Chrome control path for visual evidence.',
    }
  }
  return {
    id: 'headed-browser-policy',
    status: 'pass',
    summary: 'No prohibited headless-browser launch exists in the onboarding runtime.',
    evidence: [sourceRoot],
  }
}

async function prospectiveRealPath(path: string): Promise<{
  readonly path: string
  readonly writableAncestor: string
}> {
  let current = path
  const missing: string[] = []
  while ((await pathKind(current)) === null) {
    const parent = dirname(current)
    if (parent === current) break
    missing.push(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)))
    current = parent
  }
  const canonicalAncestor = await realpath(current)
  return {
    path: resolve(canonicalAncestor, ...missing.reverse()),
    writableAncestor: current,
  }
}

async function ignoredByGit(root: string, relativePath: string): Promise<boolean> {
  const probe = `${relativePath}/.doctor-write-probe`
  const result = await runCommand(
    'git',
    ['-C', root, 'check-ignore', '--quiet', '--no-index', '--', probe],
    root,
  )
  return result.code === 0
}

async function writeBoundaryCheck(
  root: string | null,
  boundary: (typeof writeBoundaries)[number],
): Promise<DoctorCheck> {
  if (!root) {
    return {
      id: boundary.id,
      status: 'fail',
      summary: `${boundary.label} cannot be verified without a repository root.`,
    }
  }
  const canonicalRoot = await realpath(root).catch(() => resolve(root))
  const configuredPath = resolve(root, boundary.relativePath)
  const existingKind = await pathKind(configuredPath)
  const prospective = await prospectiveRealPath(configuredPath).catch(() => null)
  const contained = prospective
    ? isWithin(canonicalRoot, prospective.path) && prospective.path !== canonicalRoot
    : false
  const writable = prospective
    ? await access(prospective.writableAncestor, constants.W_OK)
        .then(() => true)
        .catch(() => false)
    : false
  const ignored = await ignoredByGit(root, boundary.relativePath)
  const directoryCompatible = existingKind === null || existingKind === 'directory'
  if (!contained || !writable || !ignored || !directoryCompatible) {
    return {
      id: boundary.id,
      status: 'fail',
      summary: `${boundary.label} is not a safe private write boundary.`,
      evidence: [configuredPath, ...(prospective ? [prospective.path] : [])],
      measured: {
        contained,
        writable,
        gitIgnored: ignored,
        directoryCompatible,
      },
      remediation:
        `Keep ${boundary.relativePath}/ inside the repository, writable and Git-ignored; remove any escaping symlink.`,
    }
  }
  return {
    id: boundary.id,
    status: 'pass',
    summary: `${boundary.label} is contained, writable and Git-ignored.`,
    evidence: [configuredPath],
    measured: {
      contained,
      writable,
      gitIgnored: ignored,
      exists: existingKind === 'directory',
    },
  }
}

function finalizeReport(
  checks: readonly DoctorCheck[],
  invocationDirectory: string,
  repositoryRoot: string | null,
  now: () => Date,
): DoctorReport {
  const counts = {
    pass: checks.filter(({ status }) => status === 'pass').length,
    warn: checks.filter(({ status }) => status === 'warn').length,
    fail: checks.filter(({ status }) => status === 'fail').length,
  }
  const ready = counts.fail === 0
  return {
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    invocationDirectory,
    repositoryRoot,
    ready,
    exitCode: ready ? 0 : 4,
    counts,
    checks,
  }
}

export function doctorExitCode(report: DoctorReport): 0 | 4 {
  return report.counts.fail === 0 ? 0 : 4
}

export async function runDoctor(
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const invocationDirectory = resolve(options.cwd ?? process.cwd())
  const repositoryRoot = await findRepositoryRoot(invocationDirectory)
  const trackedFiles = repositoryRoot
    ? await gitTrackedFiles(repositoryRoot)
    : null
  const platform = options.platform ?? process.platform
  const nodeExecutable = options.nodeExecutable ?? process.execPath
  const nodeVersion = options.nodeVersion ?? process.versions.node

  const checks = await Promise.all([
    repositoryCheck(repositoryRoot),
    skillCheck(repositoryRoot, trackedFiles),
    trackedToolCheck(repositoryRoot, trackedFiles),
    blenderCheck(options, invocationDirectory),
    nodeCheck(repositoryRoot, nodeExecutable, nodeVersion, platform),
    tsxCheck(repositoryRoot),
    headedBrowserCheck(repositoryRoot),
    ...writeBoundaries.map((boundary) =>
      writeBoundaryCheck(repositoryRoot, boundary),
    ),
  ])
  return finalizeReport(
    checks,
    invocationDirectory,
    repositoryRoot,
    options.now ?? (() => new Date()),
  )
}
