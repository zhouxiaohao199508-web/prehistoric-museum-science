const QWEN_PACKAGE = 'qwen-tts'
const QWEN_PACKAGE_VERSION = '0.1.1'
const QWEN_MODEL = 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice'
const QWEN_MODEL_REVISION = '85e237c12c027371202489a0ec509ded67b5e4b5'
const QWEN_SPEAKER = 'Serena'
const QWEN_LANGUAGE = 'Chinese'
const QWEN_SEED = 20_260_726

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function qwenNarrationEvidencePass(input: {
  readonly metrics: unknown
  readonly script: string
  readonly scriptSha256: string
  readonly artifact: {
    readonly bytes: number
    readonly sha256: string
  }
  readonly expected: {
    readonly locale: 'zh-CN' | 'en'
    readonly speaker: string
    readonly language: 'Chinese' | 'English'
  }
}): boolean {
  const metrics = record(input.metrics)
  const engine = record(metrics.engine)
  const generation = record(metrics.generation)
  const artifact = record(metrics.artifact)
  const acceptance = record(metrics.automaticAcceptance)
  const rawRuns = Array.isArray(generation.rawRuns)
    ? generation.rawRuns.map(record)
    : []
  const rawHashes = rawRuns.map((run) => run.sha256)
  const seededRunsPass =
    generation.runsByteIdentical === true &&
    rawRuns.length === 2 &&
    rawHashes.every(
      (hash) => typeof hash === 'string' && hash.trim().length === 64,
    ) &&
    rawHashes[0] === rawHashes[1]
  const localeLanguagePass =
    (input.expected.locale === 'zh-CN' &&
      input.expected.language === 'Chinese') ||
    (input.expected.locale === 'en' && input.expected.language === 'English')

  return (
    localeLanguagePass &&
    input.expected.speaker === QWEN_SPEAKER &&
    metrics.script === input.script &&
    metrics.scriptUtf8Sha256 === input.scriptSha256 &&
    engine.package === QWEN_PACKAGE &&
    engine.packageVersion === QWEN_PACKAGE_VERSION &&
    engine.model === QWEN_MODEL &&
    engine.modelRevision === QWEN_MODEL_REVISION &&
    engine.speaker === input.expected.speaker &&
    engine.language === input.expected.language &&
    engine.seed === QWEN_SEED &&
    seededRunsPass &&
    artifact.bytes === input.artifact.bytes &&
    artifact.sha256 === input.artifact.sha256 &&
    artifact.codec === 'mp3' &&
    artifact.sampleRateHz === 48_000 &&
    artifact.channels === 1 &&
    typeof artifact.durationSeconds === 'number' &&
    artifact.durationSeconds >= 8 &&
    artifact.durationSeconds <= 18 &&
    acceptance.allPassed === true &&
    metrics.humanListeningReview === 'pending' &&
    metrics.publicDistributionDecision === 'pending'
  )
}

export function qwenSerenaNarrationEvidencePass(input: {
  readonly metrics: unknown
  readonly script: string
  readonly scriptSha256: string
  readonly artifact: {
    readonly bytes: number
    readonly sha256: string
  }
}): boolean {
  return qwenNarrationEvidencePass({
    ...input,
    expected: {
      locale: 'zh-CN',
      speaker: QWEN_SPEAKER,
      language: QWEN_LANGUAGE,
    },
  })
}

export interface MotionVisibilityEvidence {
  readonly motionProfile:
    | 'land-breathe-tail'
    | 'marine-tail'
    | 'flipper-swim'
    | 'flying-wing'
    | 'flying-insect'
    | 'static-breathe'
  readonly firstFrameMatchesLast: boolean
  readonly rootTranslation: number
  readonly maximumVertexDisplacementFraction: number
  readonly changedPixelFractionOfModel: number
  readonly motionRenderCount: number
}

export function motionVisibilityEvidencePass(
  evidence: MotionVisibilityEvidence,
): boolean {
  const minimumDisplacement = {
    'land-breathe-tail': 0.06,
    'marine-tail': 0.09,
    'flipper-swim': 0.05,
    'flying-wing': 0.06,
    'flying-insect': 0.08,
    'static-breathe': 0.015,
  }[evidence.motionProfile]
  return (
    evidence.firstFrameMatchesLast &&
    Math.abs(evidence.rootTranslation) <= 1e-9 &&
    evidence.maximumVertexDisplacementFraction >= minimumDisplacement &&
    evidence.changedPixelFractionOfModel >= 0.03 &&
    evidence.motionRenderCount >= 3
  )
}

export function browserMotionEvidencePass(evidence: {
  readonly changedPixelFractionOfModel: number
  readonly frameCount: number
  readonly startState?: {
    readonly paused: boolean
    readonly requestedTime: number
    readonly time: number
    readonly timeScale: number
  }
  readonly quarterState?: {
    readonly paused: boolean
    readonly requestedTime: number
    readonly time: number
    readonly timeScale: number
  }
}): boolean {
  const start = evidence.startState
  const quarter = evidence.quarterState
  return (
    evidence.frameCount >= 2 &&
    evidence.changedPixelFractionOfModel >= 0.03 &&
    start?.paused === true &&
    Math.abs(start.requestedTime) <= 0.01 &&
    Math.abs(start.time) <= 0.01 &&
    Math.abs(start.timeScale) <= 0.01 &&
    quarter?.paused === true &&
    Math.abs(quarter.requestedTime - 2) <= 0.01 &&
    Math.abs(quarter.time - 2) <= 0.01 &&
    Math.abs(quarter.timeScale) <= 0.01
  )
}

export function mouthMotionEvidencePass(evidence: {
  readonly changedPixels: number
  readonly changedPixelFractionOfModel: number
  readonly frameCount: number
  readonly loopChangedPixels?: number
  readonly openState?: {
    readonly paused: boolean
    readonly requestedTime: number
    readonly time: number
    readonly timeScale: number
    readonly maximumMorphWeight: number
  }
  readonly closeState?: {
    readonly paused: boolean
    readonly requestedTime: number
    readonly time: number
    readonly timeScale: number
    readonly maximumMorphWeight: number
  }
}): boolean {
  const open = evidence.openState
  const close = evidence.closeState
  return (
    evidence.frameCount >= 2 &&
    evidence.changedPixels >= 24 &&
    evidence.changedPixelFractionOfModel >= 0.0005 &&
    (evidence.loopChangedPixels === undefined ||
      evidence.loopChangedPixels <= 4) &&
    open?.paused === true &&
    Math.abs(open.requestedTime) <= 0.01 &&
    Math.abs(open.time) <= 0.01 &&
    Math.abs(open.timeScale) <= 0.01 &&
    Math.abs(open.maximumMorphWeight) <= 0.01 &&
    close?.paused === true &&
    Math.abs(close.requestedTime - 4) <= 0.01 &&
    Math.abs(close.time - 4) <= 0.01 &&
    Math.abs(close.timeScale) <= 0.01 &&
    close.maximumMorphWeight >= 0.95
  )
}

interface GroundPresentation {
  readonly initialYawDegrees: number
  readonly shadowOpacity?: number
  readonly shadowScale?: number
  readonly shadowDepthScale?: number
  readonly shadowHorizontalOffset?: number
}

function vector3(value: unknown): readonly [number, number, number] | null {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
    ? (value as [number, number, number])
    : null
}

function rotateGroundPoint(
  position: readonly [number, number, number],
  initialYawDegrees: number,
): readonly [number, number] {
  const radians = (initialYawDegrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return [
    position[0] * cosine - position[1] * sine,
    position[0] * sine + position[1] * cosine,
  ]
}

export function initialHeadSideEvidence(
  landmarksValue: unknown,
  presentation: {
    readonly initialYawDegrees: number
    readonly initialHeadSide: 'left' | 'right'
  },
): {
  readonly pass: boolean
  readonly expectedSide: 'left' | 'right'
  readonly measuredSide: 'left' | 'right' | 'ambiguous'
  readonly projectedHeadX: number
  readonly projectedTailX: number
  readonly separationFraction: number
  readonly minimumSeparationFraction: number
} {
  const minimumSeparationFraction = 0.35
  const landmarks = record(landmarksValue)
  const bounds = record(landmarks.bounds)
  const minimum = vector3(bounds.min)
  const maximum = vector3(bounds.max)
  const head = vector3(record(landmarks.head).position)
  const tail = vector3(record(landmarks.tailTip).position)
  if (minimum === null || maximum === null || head === null || tail === null) {
    return {
      pass: false,
      expectedSide: presentation.initialHeadSide,
      measuredSide: 'ambiguous',
      projectedHeadX: 0,
      projectedTailX: 0,
      separationFraction: 0,
      minimumSeparationFraction,
    }
  }

  const [projectedHeadX] = rotateGroundPoint(
    head,
    presentation.initialYawDegrees,
  )
  const [projectedTailX] = rotateGroundPoint(
    tail,
    presentation.initialYawDegrees,
  )
  const length = Math.max(maximum[0] - minimum[0], 1e-9)
  const separationFraction =
    Math.abs(projectedHeadX - projectedTailX) / length
  const measuredSide =
    separationFraction < minimumSeparationFraction
      ? 'ambiguous'
      : projectedHeadX < projectedTailX
        ? 'left'
        : 'right'
  return {
    pass:
      measuredSide === presentation.initialHeadSide &&
      separationFraction >= minimumSeparationFraction,
    expectedSide: presentation.initialHeadSide,
    measuredSide,
    projectedHeadX,
    projectedTailX,
    separationFraction,
    minimumSeparationFraction,
  }
}

export function groundContactShadowEvidence(
  landmarksValue: unknown,
  presentation: GroundPresentation,
): {
  readonly pass: boolean
  readonly measuredContactCount: number
  readonly coveredContactCount: number
  readonly opacityPass: boolean
  readonly shadowRadii: {
    readonly horizontal: number
    readonly depth: number
  }
} {
  const landmarks = record(landmarksValue)
  const bounds = record(landmarks.bounds)
  const minimum = vector3(bounds.min)
  const maximum = vector3(bounds.max)
  const allContacts = Array.isArray(landmarks.contacts)
    ? landmarks.contacts.map(record)
    : []
  const measuredContacts = allContacts.filter(
    (contact) =>
      contact.method === 'lowest-vertex-quadrant' &&
      vector3(contact.position) !== null,
  )
  const contacts =
    measuredContacts.length >= 2
      ? measuredContacts
      : allContacts.filter(
          (contact) => vector3(contact.position) !== null,
        )
  const shadowScale = presentation.shadowScale ?? 0
  const opacityPass = (presentation.shadowOpacity ?? 0) >= 0.3
  if (minimum === null || maximum === null || shadowScale <= 0) {
    return {
      pass: false,
      measuredContactCount: contacts.length,
      coveredContactCount: 0,
      opacityPass,
      shadowRadii: { horizontal: 0, depth: 0 },
    }
  }

  const length = Math.max(maximum[0] - minimum[0], 0)
  const depth = Math.max(maximum[1] - minimum[1], 0)
  const horizontalRadius = Math.max(length * shadowScale, 0.1) * 0.5
  const depthDiameter =
    presentation.shadowDepthScale === undefined
      ? Math.max(
          depth * shadowScale * 1.25,
          length * shadowScale * 0.22,
          0.1,
        )
      : Math.max(depth * presentation.shadowDepthScale, 0.1)
  const depthRadius = depthDiameter * 0.5
  const centerX = presentation.shadowHorizontalOffset ?? 0
  const coveredContactCount = contacts.filter((contact) => {
    const position = vector3(contact.position)!
    const [rotatedX, rotatedDepth] = rotateGroundPoint(
      position,
      presentation.initialYawDegrees,
    )
    const normalizedX = (rotatedX - centerX) / horizontalRadius
    const normalizedDepth = rotatedDepth / depthRadius
    return normalizedX ** 2 + normalizedDepth ** 2 <= 1
  }).length
  return {
    pass:
      opacityPass &&
      contacts.length >= 2 &&
      coveredContactCount === contacts.length,
    measuredContactCount: contacts.length,
    coveredContactCount,
    opacityPass,
    shadowRadii: {
      horizontal: horizontalRadius,
      depth: depthRadius,
    },
  }
}
