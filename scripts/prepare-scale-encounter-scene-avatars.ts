import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import {
  type Accessor,
  type Animation,
  type AnimationSampler,
  type Document,
  NodeIO,
  type Node,
  type TypedArray,
} from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'

type Gender = 'boy' | 'girl'
type SceneProfile =
  | 'land-explorer'
  | 'snow-expedition'
  | 'air-wingsuit'
  | 'water-diver'
type SourceAction =
  | 'character'
  | 'run'
  | 'swim-forward'
  | 'swim-idle'
  | 'walk'

interface PackageConfig {
  readonly gender: Gender
  readonly genderLabel: '男孩' | '女孩'
  readonly profile: SceneProfile
  readonly sceneLabel: '森林' | '雪地' | '天空' | '海洋'
  readonly multiviewVersion: `v0${1 | 2 | 3}`
  readonly clips: readonly {
    readonly action: SourceAction
    readonly name: string
    readonly inPlace: boolean
  }[]
  readonly rejectedActions: Readonly<Partial<Record<SourceAction, string>>>
}

const PROJECT_ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_OUTPUT_ROOT = join(
  PROJECT_ROOT,
  'assets/candidates/scale-encounter-child-avatar',
)
const RAW_ARCHIVE_ROOT = 'meshy-scene-models-2026-08-18'
const MULTIVIEW_ROOT = 'meshy-scene-multiview-2026-08-18'
const AUTHORED_HEIGHT_METERS = 1.15
const RAW_SCENE_HEIGHT_UNITS = 0.0115
const NORMALIZATION_SCALE =
  AUTHORED_HEIGHT_METERS / RAW_SCENE_HEIGHT_UNITS

// Owner attestation supplied by Leon on 2026-08-19 for all eight packages in
// this intake. Meshy did not expose a task ID in the owner's web workspace, so
// the immutable ZIP/raw-file hashes remain the per-asset identity evidence.
const MESHY_PRIVATE_LICENSE_ATTESTATION = {
  status: 'owner-attested',
  provider: 'Meshy',
  planAtGeneration: 'Pro',
  licenseType: 'Private',
  generatedOrExportedOn: '2026-08-19',
  assetVisibility: 'private',
  publishedToCommunity: false,
  referenceInputRightsAttested: true,
  projectAuthorization: [
    'use',
    'modify',
    'distribute-with-application',
  ],
  taskIdStatus: 'not-found-in-meshy-web-workspace',
  attestedBy: 'Leon',
  attestedOn: '2026-08-19',
  termsEvidence: [
    'https://www.meshy.ai/terms-of-use',
    'https://help.meshy.ai/en/articles/9992001-can-i-use-meshy-assets-commercially-license-copyright-explained',
    'https://docs.meshy.ai/en/webapp/pricing',
  ],
} as const

const SCENES: readonly Omit<
  PackageConfig,
  'gender' | 'genderLabel' | 'multiviewVersion'
>[] = [
  {
    profile: 'land-explorer',
    sceneLabel: '森林',
    clips: [
      { action: 'character', name: 'Idle_Forest', inPlace: true },
      { action: 'walk', name: 'Walk_Forest', inPlace: true },
      { action: 'run', name: 'Run_Forest', inPlace: true },
    ],
    rejectedActions: {},
  },
  {
    profile: 'snow-expedition',
    sceneLabel: '雪地',
    clips: [
      { action: 'character', name: 'Idle_Snow', inPlace: true },
      { action: 'walk', name: 'Walk_Snow', inPlace: true },
    ],
    rejectedActions: {
      run: 'Reserved: the current cold-grassland rail has no fast mode and defaults to a stable walk.',
    },
  },
  {
    profile: 'air-wingsuit',
    sceneLabel: '天空',
    clips: [
      { action: 'character', name: 'Glide_Static', inPlace: true },
    ],
    rejectedActions: {
      run: 'A ground-running cycle is incompatible with prone wingsuit flight.',
      walk: 'A ground-walking cycle is incompatible with prone wingsuit flight.',
    },
  },
  {
    profile: 'water-diver',
    sceneLabel: '海洋',
    clips: [
      { action: 'character', name: 'Scuba_Trim_Static', inPlace: true },
    ],
    rejectedActions: {
      run: 'A ground-running cycle is incompatible with scuba trim.',
      'swim-forward':
        'Rejected for runtime: 1.50–1.52 m root travel, a loop jump, arm paddling, and an upward body angle conflict with the reviewed horizontal quiet-hands scuba contract.',
      'swim-idle':
        'Rejected for runtime: the source is an approximately 60° upright tread-water pose, not horizontal neutral-buoyancy scuba trim.',
      walk: 'A ground-walking cycle is incompatible with scuba trim.',
    },
  },
]

const MULTIVIEW_VERSION: Readonly<
  Record<`${Gender}-${SceneProfile}`, PackageConfig['multiviewVersion']>
> = {
  'boy-land-explorer': 'v02',
  'girl-land-explorer': 'v02',
  'boy-snow-expedition': 'v01',
  'girl-snow-expedition': 'v01',
  'boy-air-wingsuit': 'v02',
  'girl-air-wingsuit': 'v02',
  'boy-water-diver': 'v02',
  'girl-water-diver': 'v03',
}

const PACKAGES: readonly PackageConfig[] = (
  [
    ['boy', '男孩'],
    ['girl', '女孩'],
  ] as const
).flatMap(([gender, genderLabel]) =>
  SCENES.map((scene) => ({
    ...scene,
    gender,
    genderLabel,
    multiviewVersion: MULTIVIEW_VERSION[`${gender}-${scene.profile}`],
  })),
)

const SOURCE_SUFFIX: Readonly<Record<SourceAction, string>> = {
  character: 'Character_output.glb',
  run: 'Animation_Running_withSkin.glb',
  'swim-forward': 'Animation_Swim_Forward_withSkin.glb',
  'swim-idle': 'Animation_Swim_Idle_withSkin.glb',
  walk: 'Animation_Walking_withSkin.glb',
}

const SOURCE_ACTIONS: Readonly<
  Record<PackageConfig['sceneLabel'], readonly SourceAction[]>
> = {
  '森林': ['character', 'walk', 'run'],
  '雪地': ['character', 'walk', 'run'],
  '天空': ['character', 'walk', 'run'],
  '海洋': [
    'character',
    'walk',
    'run',
    'swim-idle',
    'swim-forward',
  ],
}

function argument(name: string): string | null {
  const prefix = `--${name}=`
  const value = process.argv.find((entry) => entry.startsWith(prefix))
  return value ? value.slice(prefix.length) : null
}

const sourceRootArgument = argument('source-dir')
if (!sourceRootArgument) {
  throw new Error(
    'Missing --source-dir=/absolute/path/to/extracted-avatar-directory',
  )
}
const SOURCE_ROOT = resolve(sourceRootArgument)
const OUTPUT_ROOT = resolve(argument('output-root') ?? DEFAULT_OUTPUT_ROOT)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

function packageId(config: PackageConfig): `${Gender}-${SceneProfile}` {
  return `${config.gender}-${config.profile}`
}

function sourceStem(config: PackageConfig): string {
  return `Meshy_AI_${config.genderLabel}_${config.sceneLabel}_biped`
}

function sourcePath(config: PackageConfig, action: SourceAction): string {
  const stem = sourceStem(config)
  return join(SOURCE_ROOT, stem, stem, `${stem}_${SOURCE_SUFFIX[action]}`)
}

function rawFilename(
  config: PackageConfig,
  action: SourceAction,
): string {
  return [
    'meshy',
    config.gender,
    config.profile,
    `mv-${config.multiviewVersion}`,
    'r01',
    action,
  ].join('-') + '.glb'
}

function outputFilename(config: PackageConfig): string {
  return `child-avatar-v4-${config.gender}-${config.profile}-review-v01.glb`
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

function uniqueNodesByName(document: Document): Map<string, Node> {
  const nodes = new Map<string, Node>()
  for (const node of document.getRoot().listNodes()) {
    const name = node.getName()
    if (!name) continue
    if (nodes.has(name)) {
      throw new Error(`Duplicate animation target node: ${name}`)
    }
    nodes.set(name, node)
  }
  return nodes
}

/**
 * Animation files are only safe to merge when they were authored against the
 * exact same rest skeleton. Equal bone names alone are insufficient: a
 * different hierarchy, rest transform, joint order or inverse-bind matrix can
 * produce plausible-looking but incorrect deformation.
 */
function rigCompatibilitySignature(document: Document): string {
  const hash = createHash('sha256')
  const nodes = document
    .getRoot()
    .listNodes()
    .map((node) => ({
      name: node.getName(),
      parent: node.getParentNode()?.getName() ?? null,
      rotation: node.getRotation(),
      scale: node.getScale(),
      translation: node.getTranslation(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
  hash.update(JSON.stringify(nodes))

  const skins = document.getRoot().listSkins()
  for (const skin of skins) {
    hash.update(
      JSON.stringify({
        joints: skin.listJoints().map((joint) => joint.getName()),
        name: skin.getName(),
        skeleton: skin.getSkeleton()?.getName() ?? null,
      }),
    )
    const inverseBindMatrices = skin.getInverseBindMatrices()?.getArray()
    if (inverseBindMatrices) {
      hash.update(
        Buffer.from(
          inverseBindMatrices.buffer,
          inverseBindMatrices.byteOffset,
          inverseBindMatrices.byteLength,
        ),
      )
    }
  }
  return hash.digest('hex')
}

function cloneTypedArray(array: TypedArray): TypedArray {
  return array.slice()
}

function cloneAccessor(
  source: Accessor,
  targetDocument: Document,
  targetBuffer: ReturnType<Document['createBuffer']>,
): Accessor {
  const array = source.getArray()
  if (!array) throw new Error(`Animation accessor has no array: ${source.getName()}`)
  return targetDocument
    .createAccessor(source.getName(), targetBuffer)
    .setType(source.getType())
    .setArray(cloneTypedArray(array))
    .setNormalized(source.getNormalized())
    .setSparse(source.getSparse())
    .setExtras({ ...source.getExtras() })
}

function copyAnimation(
  source: Animation,
  targetDocument: Document,
  targetName: string,
  makeInPlace: boolean,
): Animation {
  const targetNodes = uniqueNodesByName(targetDocument)
  const targetBuffer =
    targetDocument.getRoot().listBuffers()[0] ??
    targetDocument.createBuffer('scale-encounter-avatar-buffer')
  const target = targetDocument.createAnimation(targetName)
  const copiedSamplers = new Map<AnimationSampler, AnimationSampler>()

  for (const sourceChannel of source.listChannels()) {
    const sourceNode = sourceChannel.getTargetNode()
    const targetPath = sourceChannel.getTargetPath()
    const sourceSampler = sourceChannel.getSampler()
    if (!sourceNode || !targetPath || !sourceSampler) {
      throw new Error(`Incomplete animation channel in ${source.getName()}`)
    }
    const targetNode = targetNodes.get(sourceNode.getName())
    if (!targetNode) {
      throw new Error(
        `Animation target is absent from base package: ${sourceNode.getName()}`,
      )
    }

    let targetSampler = copiedSamplers.get(sourceSampler)
    if (!targetSampler) {
      const input = sourceSampler.getInput()
      const output = sourceSampler.getOutput()
      if (!input || !output) {
        throw new Error(`Incomplete animation sampler in ${source.getName()}`)
      }
      targetSampler = targetDocument
        .createAnimationSampler(sourceSampler.getName())
        .setInput(cloneAccessor(input, targetDocument, targetBuffer))
        .setOutput(cloneAccessor(output, targetDocument, targetBuffer))
        .setInterpolation(sourceSampler.getInterpolation())
      copiedSamplers.set(sourceSampler, targetSampler)
      target.addSampler(targetSampler)
    }

    const channel = targetDocument
      .createAnimationChannel(sourceChannel.getName())
      .setTargetNode(targetNode)
      .setTargetPath(targetPath)
      .setSampler(targetSampler)
    target.addChannel(channel)

    if (
      makeInPlace &&
      sourceNode.getName() === 'Hips' &&
      targetPath === 'translation'
    ) {
      const output = targetSampler.getOutput()
      if (!output || output.getType() !== 'VEC3') {
        throw new Error(`Unexpected Hips translation output in ${source.getName()}`)
      }
      const first = output.getElement(0, [] as number[])
      for (let index = 0; index < output.getCount(); index += 1) {
        const value = output.getElement(index, [] as number[])
        output.setElement(index, [first[0], value[1], first[2]])
      }
    }
  }
  return target
}

function makeStaticAnimationLoopable(animation: Animation): void {
  for (const sampler of animation.listSamplers()) {
    const input = sampler.getInput()
    const output = sampler.getOutput()
    if (!input || !output || input.getCount() !== 1 || output.getCount() !== 1) {
      continue
    }
    const sourceOutput = output.getArray()
    if (!(sourceOutput instanceof Float32Array)) {
      throw new Error('Static animation output is not Float32Array')
    }
    const repeated = new Float32Array(sourceOutput.length * 2)
    repeated.set(sourceOutput, 0)
    repeated.set(sourceOutput, sourceOutput.length)
    input.setArray(new Float32Array([0, 1]))
    output.setArray(repeated)
  }
}

function normalizeScene(document: Document, config: PackageConfig): void {
  const scenes = document.getRoot().listScenes()
  if (scenes.length !== 1) {
    throw new Error(`${packageId(config)} expected one scene; found ${scenes.length}`)
  }
  const scene = scenes[0]
  scene.setName('ChildAvatarV4Root')

  const wrapper = document
    .createNode('ChildAvatarV4Root')
    .setScale([NORMALIZATION_SCALE, NORMALIZATION_SCALE, NORMALIZATION_SCALE])
  for (const child of [...scene.listChildren()]) {
    scene.removeChild(child)
    wrapper.addChild(child)
  }
  scene.addChild(wrapper)
  scene.setExtras({
    scaleEncounterAvatar: {
      authoredHeightMeters: AUTHORED_HEIGHT_METERS,
      forwardAxis: '+Z',
      packageId: packageId(config),
      productionApproved: false,
      upAxis: '+Y',
    },
  })

  for (const material of document.getRoot().listMaterials()) {
    material
      .setEmissiveFactor([0, 0, 0])
      .setEmissiveTexture(null)
      .setMetallicFactor(0)
      .setRoughnessFactor(0.76)
      .setExtension('KHR_materials_specular', null)
      .setExtension('KHR_materials_ior', null)
  }
}

async function readSingleAnimation(
  path: string,
  expectedRigSignature: string,
): Promise<Animation> {
  const document = await io.read(path)
  if (rigCompatibilitySignature(document) !== expectedRigSignature) {
    throw new Error(`Animation rest rig does not match package base: ${path}`)
  }
  const animations = document.getRoot().listAnimations()
  if (animations.length !== 1) {
    throw new Error(`${path} expected one animation; found ${animations.length}`)
  }
  return animations[0]
}

async function buildPackage(config: PackageConfig) {
  const id = packageId(config)
  const versionDirectory = `mv-${config.multiviewVersion}`
  const runRoot = join(
    OUTPUT_ROOT,
    RAW_ARCHIVE_ROOT,
    id,
    versionDirectory,
    'run-01',
  )
  const rawRoot = join(runRoot, 'raw')
  const normalizedRoot = join(runRoot, 'normalized')
  const validationRoot = join(runRoot, 'validation')
  await Promise.all([
    mkdir(rawRoot, { recursive: true }),
    mkdir(normalizedRoot, { recursive: true }),
    mkdir(validationRoot, { recursive: true }),
  ])

  const rawOutputs = []
  for (const action of SOURCE_ACTIONS[config.sceneLabel]) {
    const source = sourcePath(config, action)
    const destination = join(rawRoot, rawFilename(config, action))
    await copyFile(source, destination)
    const fileStat = await stat(destination)
    rawOutputs.push({
      action,
      bytes: fileStat.size,
      file: `raw/${basename(destination)}`,
      sha256: await sha256(destination),
    })
  }

  const baseDocument = await io.read(sourcePath(config, 'character'))
  const baseRigSignature = rigCompatibilitySignature(baseDocument)
  normalizeScene(baseDocument, config)
  for (const animation of [...baseDocument.getRoot().listAnimations()]) {
    animation.dispose()
  }

  for (const clip of config.clips) {
    const sourceAnimation = await readSingleAnimation(
      sourcePath(config, clip.action),
      baseRigSignature,
    )
    const copied = copyAnimation(
      sourceAnimation,
      baseDocument,
      clip.name,
      clip.inPlace,
    )
    if (clip.action === 'character') makeStaticAnimationLoopable(copied)
  }

  await baseDocument.transform(
    textureCompress({
      encoder: sharp,
      effort: 80,
      quality: 80,
      targetFormat: 'webp',
    }),
    prune(),
  )

  // Add the semantic socket after prune(). An empty glTF node is exactly what
  // EyeAnchor must be, but prune correctly removes unreferenced empty nodes.
  // Adding it last keeps the runtime contract without weakening asset cleanup.
  const normalizedSceneRootNode = baseDocument
    .getRoot()
    .listNodes()
    .find((node) => node.getName() === 'ChildAvatarV4Root')
  if (!normalizedSceneRootNode) {
    throw new Error(`${id} missing normalized scene root`)
  }
  normalizedSceneRootNode.addChild(
    baseDocument
      .createNode('EyeAnchor')
      .setTranslation([0, RAW_SCENE_HEIGHT_UNITS * 0.91, 0.0004]),
  )

  const runtimeFilename = outputFilename(config)
  const normalizedPath = join(normalizedRoot, runtimeFilename)
  const runtimePath = join(OUTPUT_ROOT, runtimeFilename)
  await io.write(normalizedPath, baseDocument)
  await copyFile(normalizedPath, runtimePath)
  const normalizedStat = await stat(normalizedPath)
  const normalizedSha256 = await sha256(normalizedPath)

  const multiviewManifest = JSON.parse(
    await readFile(join(OUTPUT_ROOT, MULTIVIEW_ROOT, 'manifest.json'), 'utf8'),
  ) as {
    readonly sets: readonly {
      readonly id: string
      readonly views: Readonly<Record<string, { file: string; sha256: string }>>
    }[]
  }
  const multiviewSet = multiviewManifest.sets.find((entry) => entry.id === id)
  if (!multiviewSet) throw new Error(`Missing Multi-View source set: ${id}`)

  const runRecord = {
    schemaVersion: 1,
    status: 'review-package-built',
    productionApproved: false,
    setId: id,
    multiviewVersion: config.multiviewVersion,
    runId: 'run-01',
    meshy: {
      taskId: null,
      taskIdStatus: MESHY_PRIVATE_LICENSE_ATTESTATION.taskIdStatus,
      modelVersion: null,
      submittedAt: null,
      completedAt: null,
      parameters: {},
      failureReason: null,
      note: 'The owner supplied the completed private-license ZIP on 2026-08-19. Meshy task IDs were not visible in the owner\'s web workspace; immutable ZIP and raw-output hashes identify the intake.',
    },
    licenseEvidence: MESHY_PRIVATE_LICENSE_ATTESTATION,
    inputs: multiviewSet.views,
    rawOutputs,
    selectedRawOutput: rawOutputs.find((entry) => entry.action === 'character')
      ?.file,
    normalization: {
      status: 'review-package-built',
      toolchain: [
        '@gltf-transform/core 4.4.2',
        '@gltf-transform/functions 4.4.2',
        'sharp 0.34.5',
        'scripts/prepare-scale-encounter-scene-avatars.ts',
      ],
      authoredHeightMeters: AUTHORED_HEIGHT_METERS,
      upAxis: '+Y',
      forwardAxis: '+Z',
      sceneRootName: 'ChildAvatarV4Root',
      eyeAnchorName: 'EyeAnchor',
      humanHeightExcludes: [
        'parachute-container',
        'scuba-cylinder',
        'fins',
      ],
      rigPolicy: 'per-package-24-joint-no-cross-package-retargeting',
      outputFiles: [
        {
          bytes: normalizedStat.size,
          clips: config.clips.map((clip) => clip.name),
          file: `normalized/${runtimeFilename}`,
          sha256: normalizedSha256,
        },
      ],
      rejectedActions: config.rejectedActions,
    },
    validation: {
      meshAndTexture: 'automatic-structure-passed',
      equipmentTopology: 'pending-human-review',
      rigAndDeformation: 'pending-human-review',
      poseAndMotion: 'pending-headed-browser-review',
      boundsAndCamera: 'pending-headed-browser-review',
      ownerVisualApproval: false,
    },
  }
  await writeFile(
    join(runRoot, 'meshy-run.json'),
    `${JSON.stringify(runRecord, null, 2)}\n`,
  )
  await writeFile(
    join(validationRoot, 'package-summary.json'),
    `${JSON.stringify(
      {
        id,
        output: runRecord.normalization.outputFiles[0],
        productionApproved: false,
        rawOutputs,
        rejectedActions: config.rejectedActions,
      },
      null,
      2,
    )}\n`,
  )

  return {
    authoredHeightMeters: AUTHORED_HEIGHT_METERS,
    clips: config.clips.map((clip) => clip.name),
    filename: runtimeFilename,
    gender: config.gender,
    id,
    multiviewVersion: config.multiviewVersion,
    productionApproved: false,
    profile: config.profile,
    rejectedActions: config.rejectedActions,
    sha256: normalizedSha256,
    sourceRun: `${RAW_ARCHIVE_ROOT}/${id}/${versionDirectory}/run-01`,
  }
}

const builtPackages = []
for (const config of PACKAGES) builtPackages.push(await buildPackage(config))

await writeFile(
  join(OUTPUT_ROOT, 'meshy-scene-avatar-packages.manifest.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: 'local-review-only',
      productionApproved: false,
      generatedAt: new Date().toISOString(),
      sourceDirectory: SOURCE_ROOT,
      licenseEvidence: MESHY_PRIVATE_LICENSE_ATTESTATION,
      packages: builtPackages,
      runtimePolicy: {
        cache: 'one GLB per selected scene and gender',
        clipSharing: 'within one package only',
        worldMotion: 'outer runtime root owns translation and heading',
        ocean:
          'Use the static package plus the reviewed runtime scuba-trim controller; raw Meshy swim clips remain excluded.',
      },
    },
    null,
    2,
  )}\n`,
)

console.log(
  JSON.stringify(
    builtPackages.map(({ filename, id, sha256: hash, clips }) => ({
      clips,
      filename,
      id,
      sha256: hash,
    })),
    null,
    2,
  ),
)
