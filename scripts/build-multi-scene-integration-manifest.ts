import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const handoffDirectory = path.resolve(
  '.handoff/scale-encounter-multi-scene-integration-2026-08-16',
)
const evidenceDirectory = path.join(handoffDirectory, 'evidence')

const avatarPackageFiles = [
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-boy-land-explorer-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-girl-land-explorer-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-boy-snow-expedition-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-girl-snow-expedition-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-boy-air-wingsuit-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-girl-air-wingsuit-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-boy-water-diver-review-v01.glb',
  'assets/candidates/scale-encounter-child-avatar/child-avatar-v4-girl-water-diver-review-v01.glb',
] as const

const avatarPackageManifest =
  'assets/candidates/scale-encounter-child-avatar/meshy-scene-avatar-packages.manifest.json'

const runtimeFiles = [
  ...avatarPackageFiles,
  'src/App.tsx',
  'src/content/animals/mammoth/model/model.glb',
  'src/content/animals/mosasaurus/model/model.glb',
  'src/content/animals/pteranodon/model/model.glb',
  'src/content/animals/tyrannosaurus-rex/model/model.glb',
  'src/i18n/messages.ts',
  'src/scale-encounter/DirectScaleEncounter.tsx',
  'src/scale-encounter/avatar-scene-presentation.ts',
  'src/scale-encounter/avatar-review-candidate.ts',
  'src/scale-encounter/content.ts',
  'src/scale-encounter/environments/glacier/index.ts',
  'src/scale-encounter/environments/glacier/mammoth-overview-fit.ts',
  'src/scale-encounter/environments/glacier/mammoth-palaeoenvironment-candidate.ts',
  'src/scale-encounter/environments/glacier/scientific-anchor.ts',
  'src/scale-encounter/environments/ocean/index.ts',
  'src/scale-encounter/environments/ocean/ocean-environment-candidate.ts',
  'src/scale-encounter/environments/ocean/ocean-spatial-contract.ts',
  'src/scale-encounter/environments/scene-candidate.ts',
  'src/scale-encounter/environments/sky/index.ts',
  'src/scale-encounter/environments/sky/prototype-flight-approximation.ts',
  'src/scale-encounter/environments/sky/sky-contract.ts',
  'src/scale-encounter/environments/sky/sky-diagnostics.ts',
  'src/scale-encounter/environments/sky/sky-environment-candidate.ts',
  'src/scale-encounter/types.ts',
  'src/viewer/ViewerController.ts',
  'src/viewer/dispose.ts',
  'src/viewer/scale-encounter-environment.ts',
  'src/viewer/scale-encounter-performance.ts',
  'src/viewer/scale-encounter.ts',
] as const

const sceneManifests = [
  'assets/candidates/scale-encounter-environments/glacier/mammoth-palaeoenvironment.manifest.fragment.json',
  'assets/candidates/scale-encounter-environments/ocean/ocean-environment-candidate.manifest.fragment.json',
  'assets/candidates/scale-encounter-environments/sky/sky-review-candidate.manifest.json',
] as const

interface FileIdentity {
  readonly bytes: number
  readonly file: string
  readonly sha256: string
}

async function identity(file: string): Promise<FileIdentity> {
  const data = await readFile(file)
  return {
    bytes: data.byteLength,
    file,
    sha256: createHash('sha256').update(data).digest('hex'),
  }
}

function aggregateIdentities(identities: readonly FileIdentity[]): string {
  const aggregate = createHash('sha256')
  for (const entry of [...identities].sort((left, right) =>
    left.file < right.file ? -1 : left.file > right.file ? 1 : 0,
  )) {
    aggregate.update(entry.file)
    aggregate.update('\0')
    aggregate.update(entry.sha256)
    aggregate.update('\n')
  }
  return aggregate.digest('hex')
}

async function filesRecursively(
  directory: string,
  base = directory,
): Promise<readonly string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await filesRecursively(absolute, base)))
    } else if (entry.isFile()) {
      files.push(path.relative(base, absolute))
    }
  }
  return files.sort()
}

const runtimeIdentities = await Promise.all(runtimeFiles.map(identity))
const avatarPackageFileSet = new Set<string>(avatarPackageFiles)
const avatarPackageIdentities = runtimeIdentities.filter(({ file }) =>
  avatarPackageFileSet.has(file),
)
const avatarPackageManifestIdentity = await identity(avatarPackageManifest)
const runtimeAggregateSha256 = aggregateIdentities(runtimeIdentities)
const buildId = `multi-scene-main-${runtimeAggregateSha256.slice(0, 12)}`
if (buildId !== 'multi-scene-main-85b1d82995e6') {
  throw new Error(`runtime-build-identity-changed:${buildId}`)
}

const evidenceRelativeFiles = await filesRecursively(evidenceDirectory)
const evidenceIdentities = await Promise.all(
  evidenceRelativeFiles.map(async (relativeFile) => {
    const absolute = path.join(evidenceDirectory, relativeFile)
    const value = await identity(absolute)
    return { ...value, file: `evidence/${relativeFile}` }
  }),
)
const evidenceAggregateSha256 = aggregateIdentities(evidenceIdentities)
const evidenceManifest = {
  schemaVersion: 1,
  buildId,
  aggregateSha256: evidenceAggregateSha256,
  fileCount: evidenceIdentities.length,
  files: evidenceIdentities,
}
await writeFile(
  path.join(handoffDirectory, 'evidence-manifest.json'),
  `${JSON.stringify(evidenceManifest, null, 2)}\n`,
)

const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()
const branch = execFileSync('git', ['branch', '--show-current'], {
  encoding: 'utf8',
}).trim()
const dirtyWorktree =
  execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim().length > 0
const sceneManifestIdentities = await Promise.all(sceneManifests.map(identity))
const gpuProbeIdentity = await identity(
  path.join(handoffDirectory, 'gpu-probe-chrome.json'),
)
const rollbackIdentity = await identity(
  path.join(handoffDirectory, 'rollback-baseline.json'),
)

const buildManifest = {
  schemaVersion: 1,
  buildId,
  generatedAt: new Date().toISOString(),
  git: {
    baseRevision: revision,
    branch,
    dirtyWorktree,
  },
  availability: {
    selector: 'scene-variant=A|B|C',
    absentOrInvalid: 'off',
    defaultCandidate: false,
    productionApproved: false,
    published: false,
    deployed: false,
  },
  prototypeSources: {
    mammoth: 'glacier-a2379fcc5325',
    ocean: 'ocean-vs2-4fb623630b22',
    oceanBrightnessReference: 'ocean-vs2-616d77d9c288',
    sky: 'sky-p2-8efb61bb682a',
    forestRegression: 'scale-encounter-ecology-density-final-v46-2026-08-15',
  },
  runtime: {
    aggregateSha256: runtimeAggregateSha256,
    files: runtimeIdentities,
  },
  sceneManifests: sceneManifestIdentities,
  evidence: {
    aggregateSha256: evidenceAggregateSha256,
    fileCount: evidenceIdentities.length,
    manifest: 'evidence-manifest.json',
  },
  hardwareProbe: {
    ...gpuProbeIdentity,
    file: path.relative(process.cwd(), gpuProbeIdentity.file),
  },
  rollbackBaseline: {
    ...rollbackIdentity,
    file: path.relative(process.cwd(), rollbackIdentity.file),
  },
  frozenAvatar: {
    packagePolicy: 'one-complete-review-glb-per-scene-and-gender',
    rigPolicy: 'meshy-v4-per-package-24-joint',
    clipSharing: 'within-one-package-only',
    worldMotion: 'outer-runtime-root-owns-translation-and-heading',
    packageManifest: avatarPackageManifestIdentity,
    runtimePackages: avatarPackageIdentities,
    runtimePresentationLayer:
      'src/scale-encounter/avatar-scene-presentation.ts',
    presentationProfiles: [
      'land-explorer',
      'snow-expedition',
      'air-wingsuit',
      'water-diver',
    ],
    motionPolicy: {
      landExplorer: ['Idle_Forest', 'Walk_Forest', 'Run_Forest'],
      snowExpedition: ['Idle_Snow', 'Walk_Snow'],
      airWingsuit: ['Glide_Static'],
      waterDiver: ['Scuba_Trim_Static'],
    },
    rejectedSourceActions: {
      airWingsuit: ['walk', 'run'],
      waterDiver: ['walk', 'run', 'swim-forward', 'swim-idle'],
    },
    cameraEvidenceRequiresRegeneration: true,
  },
}
await writeFile(
  path.join(handoffDirectory, 'build-manifest.json'),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
)

console.log(
  `Wrote ${buildId}, ${runtimeIdentities.length} runtime identities and ${evidenceIdentities.length} evidence identities.`,
)
