import { lstat, readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import sharp from 'sharp'

import { fileDigest, sha256, writeJson } from './io'

export const browserCaptureSchemaVersion = 1 as const
export const browserCaptureCollectorAttestation =
  'I collected these artifacts from the declared already-open headed Browser or Chrome control surface and recorded the observed page state without synthetic replacement.' as const
export const browserCaptureProvenanceWarning =
  'The local tool verifies hashes, metadata, state effects and evidence completeness, but the collector identity and headed-control origin are self-attested rather than cryptographically signed by the Browser/Chrome control surface.' as const

export const requiredBrowserCaptureViewports = [
  { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  {
    id: 'tablet-portrait',
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
  },
  {
    id: 'phone-portrait',
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
  },
  {
    id: 'phone-compact',
    width: 360,
    height: 640,
    deviceScaleFactor: 1,
  },
  {
    id: 'phone-landscape',
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
  },
] as const satisfies readonly BrowserCaptureViewport[]

export const requiredFullLoopSampleTimesSeconds = [0, 2, 4, 6, 8] as const
export const maximumFullLoopSampleCount = 257 as const

const SAFE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

export interface BrowserCaptureViewport {
  readonly id: string
  readonly width: number
  readonly height: number
  readonly deviceScaleFactor: number
}

export interface BrowserCaptureCameraAngle {
  readonly id: string
  readonly yawDegrees: number
  readonly pitchDegrees: number
  readonly distance: number
  readonly target: readonly [number, number, number]
}

export type BrowserCaptureStateAction =
  | { readonly command: 'reset-view' }
  | {
      readonly command: 'orbit'
      readonly yawDeltaDegrees: number
      readonly pitchDeltaDegrees: number
    }
  | { readonly command: 'zoom'; readonly delta: number }
  | {
      readonly command: 'pan'
      readonly xPixels: number
      readonly yPixels: number
    }
  | {
      readonly command: 'custom'
      readonly name: string
      readonly payload?: Readonly<Record<string, unknown>>
    }

export interface BrowserCaptureStateInput {
  readonly id: string
  readonly kind: 'initial' | 'interaction'
  readonly actions: readonly BrowserCaptureStateAction[]
  /** Initial state defaults to a full loop; interaction states default to t=0. */
  readonly captureFullLoop?: boolean
  readonly captureTimesSeconds?: readonly number[]
}

export interface BrowserCaptureAnimationInput {
  readonly clipName?: string
  readonly durationSeconds: number
  readonly sampleIntervalSeconds?: number
  readonly sampleTimesSeconds?: readonly number[]
  readonly actualTimeToleranceSeconds?: number
}

export interface BrowserCapturePageContract {
  readonly animalSelectorTemplate: string
  readonly readySelector: string
  readonly readyAnimalAttribute: string
  readonly canvasSelector: string
  readonly loadedGlbShaAttribute: string
}

export interface BrowserCapturePlanInput {
  readonly animalId: string
  readonly finalGlbPath: string
  readonly reviewUrl: string
  readonly viewports: readonly BrowserCaptureViewport[]
  readonly cameraAngles: readonly BrowserCaptureCameraAngle[]
  readonly animation: BrowserCaptureAnimationInput
  readonly stateSequence?: readonly BrowserCaptureStateInput[]
  /**
   * review-efficient avoids a viewport × angle × frame Cartesian product.
   * exhaustive remains available for a targeted investigation.
   */
  readonly captureMode?: 'review-efficient' | 'exhaustive'
  readonly primaryViewportId?: string
  readonly primaryCameraAngleId?: string
  /** review-efficient mode accepts one or two auxiliary angles. */
  readonly auxiliaryCameraAngleIds?: readonly string[]
  readonly pageContract?: Partial<BrowserCapturePageContract>
  readonly generatedAt?: string
  readonly globalBaseline: {
    readonly id: string
    readonly required: true
    /** Machine-produced baseline report that already exists when planning. */
    readonly reportPath: string
  }
}

export type BrowserCaptureInstruction =
  | {
      readonly command: 'set-viewport'
      readonly viewport: BrowserCaptureViewport
    }
  | { readonly command: 'navigate'; readonly url: string }
  | {
      readonly command: 'select-animal'
      readonly animalId: string
      readonly selector: string
    }
  | {
      readonly command: 'wait-for-animal-ready'
      readonly selector: string
      readonly attribute: string
      readonly value: string
    }
  | {
      readonly command: 'wait-for-loaded-glb-sha'
      readonly selector: string
      readonly attribute: string
      readonly sha256: string
    }
  | {
      readonly command: 'apply-state'
      readonly stateId: string
      readonly stateKind: 'initial' | 'interaction'
      readonly sequenceIndex: number
      readonly actions: readonly BrowserCaptureStateAction[]
    }
  | {
      readonly command: 'set-camera-angle'
      readonly cameraAngle: BrowserCaptureCameraAngle
    }
  | {
      readonly command: 'set-animation-time'
      readonly clipName: string
      readonly requestedTimeSeconds: number
    }
  | { readonly command: 'assert-animation-paused'; readonly expected: true }
  | {
      readonly command: 'capture-screenshot'
      readonly relativePath: string
      readonly mediaType: 'image/png'
    }
  | {
      readonly command: 'record-capture-metadata'
      readonly requestId: string
    }

export interface BrowserCaptureStatePlan {
  readonly id: string
  readonly kind: 'initial' | 'interaction'
  readonly sequenceIndex: number
  readonly actions: readonly BrowserCaptureStateAction[]
  readonly captureTimesSeconds: readonly number[]
  readonly fullLoop: boolean
}

export interface BrowserCaptureRequest {
  readonly id: string
  readonly animalId: string
  readonly viewport: BrowserCaptureViewport
  readonly cameraAngle: BrowserCaptureCameraAngle
  readonly state: {
    readonly id: string
    readonly kind: 'initial' | 'interaction'
    readonly sequenceIndex: number
  }
  readonly animation: {
    readonly clipName: string
    readonly requestedTimeSeconds: number
    readonly expectedPaused: true
  }
  readonly purposes: readonly (
    | 'viewport-initial'
    | 'full-loop'
    | 'auxiliary-angle'
    | 'interaction'
    | 'exhaustive'
  )[]
  readonly screenshotRelativePath: string
  readonly instructions: readonly BrowserCaptureInstruction[]
}

export interface BrowserCapturePlan {
  readonly schemaVersion: 1
  readonly kind: 'headed-browser-capture-plan'
  readonly planId: string
  /** SHA-256 of the canonical plan body, excluding planId and this field. */
  readonly planSha256: string
  readonly generatedAt: string
  readonly execution: {
    readonly driver: 'Browser-or-Chrome-control'
    readonly headedRequired: true
    readonly launchesBrowser: false
  }
  readonly animalId: string
  readonly reviewUrl: string
  readonly pageContract: BrowserCapturePageContract
  readonly finalGlb: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly animation: {
    readonly clipName: string
    readonly durationSeconds: number
    readonly fullLoopSampleTimesSeconds: readonly number[]
    readonly maximumSampleGapSeconds: number
    readonly actualTimeToleranceSeconds: number
  }
  readonly coverage: {
    readonly mode: 'review-efficient' | 'exhaustive'
    readonly primaryViewportId: string
    readonly primaryCameraAngleId: string
    readonly auxiliaryCameraAngleIds: readonly string[]
  }
  readonly viewports: readonly BrowserCaptureViewport[]
  readonly cameraAngles: readonly BrowserCaptureCameraAngle[]
  readonly stateSequence: readonly BrowserCaptureStatePlan[]
  readonly requests: readonly BrowserCaptureRequest[]
  readonly globalBaseline: {
    readonly id: string
    readonly required: true
    readonly report: {
      readonly path: string
      readonly bytes: number
      readonly sha256: string
    }
  }
}

export interface BrowserCaptureEvidenceState {
  readonly id: string
  readonly kind: 'initial' | 'interaction'
  readonly sequenceIndex: number
  readonly actionsApplied: readonly BrowserCaptureStateAction[]
}

export interface BrowserCaptureEvidenceArtifact {
  readonly requestId: string
  readonly actualLoadedGlbSha256: string
  readonly viewport: BrowserCaptureViewport
  readonly cameraAngle: BrowserCaptureCameraAngle
  readonly state: {
    readonly id: string
    readonly kind: 'initial' | 'interaction'
    readonly sequenceIndex: number
  }
  readonly animation: {
    readonly clipName: string
    readonly requestedTimeSeconds: number
    readonly actualTimeSeconds: number
    readonly paused: boolean
  }
  readonly screenshot: {
    readonly relativePath: string
    readonly mediaType: 'image/png'
    readonly bytes: number
    readonly sha256: string
    readonly pixelWidth: number
    readonly pixelHeight: number
  }
}

export interface BrowserCaptureEvidence {
  readonly schemaVersion: 1
  readonly kind: 'headed-browser-capture-evidence'
  readonly planId: string
  readonly planSha256: string
  readonly animalId: string
  readonly capturedAt: string
  readonly browser: {
    readonly controlSurface: 'Browser' | 'Chrome'
    readonly headed: true
    /** Human-readable collector identity; this remains an attestation, not a signature. */
    readonly collector: string
    /** Codex task identity used to enforce separation from the visual reviewer. */
    readonly collectorTaskId: string
    readonly attestation: typeof browserCaptureCollectorAttestation
    readonly userAgent?: string
  }
  readonly finalGlbSha256: string
  readonly page: {
    readonly url: string
    readonly actualLoadedGlbSha256: string
  }
  readonly stateSequence: readonly BrowserCaptureEvidenceState[]
  readonly captures: readonly BrowserCaptureEvidenceArtifact[]
  readonly globalBaseline: {
    readonly id: string
    readonly reportSha256: string
  }
}

export interface VerifiedBrowserCaptureArtifact {
  readonly requestId: string
  /** Canonical capture semantics retained from the verified plan/evidence pair. */
  readonly viewportId: string
  readonly cameraAngleId: string
  readonly cameraAngleRole: 'primary' | 'auxiliary'
  readonly stateId: string
  readonly stateKind: 'initial' | 'interaction'
  readonly stateSequenceIndex: number
  readonly requestedTimeSeconds: number
  readonly actualTimeSeconds: number
  readonly animationDurationSeconds: number
  readonly actualTimeToleranceSeconds: number
  readonly purposes: BrowserCaptureRequest['purposes']
  readonly actualCameraAngle: BrowserCaptureCameraAngle
  readonly relativePath: string
  readonly absolutePath: string
  readonly bytes: number
  readonly sha256: string
  readonly pixelWidth: number
  readonly pixelHeight: number
}

export interface BrowserCaptureValidationReport {
  readonly schemaVersion: 1
  readonly kind: 'headed-browser-capture-validation'
  readonly planId: string
  readonly planSha256: string
  readonly animalId: string
  readonly candidate: {
    readonly pass: boolean
    readonly errors: readonly string[]
    readonly expectedCaptureCount: number
    readonly verifiedCaptureCount: number
    readonly artifacts: readonly VerifiedBrowserCaptureArtifact[]
  }
  readonly globalBaseline: {
    readonly id: string | null
    readonly required: boolean
    readonly provided: boolean
    readonly pass: boolean
    readonly errors: readonly string[]
    readonly report: {
      readonly path: string
      readonly bytes: number
      readonly sha256: string
    } | null
  }
  readonly pass: boolean
  readonly provenance: {
    readonly assurance: 'collector-attested'
    readonly cryptographicallyVerified: false
    readonly collector: string | null
    readonly collectorTaskId: string | null
    readonly warning: string
  }
  readonly sourceMetadata?: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly sourcePlan?: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
}

const defaultPageContract: BrowserCapturePageContract = {
  animalSelectorTemplate: '[data-animal-id="{animalId}"]',
  readySelector: '#museum-experience',
  readyAnimalAttribute: 'data-ready-animal-id',
  canvasSelector: '.viewer-canvas',
  loadedGlbShaAttribute: 'data-loaded-glb-sha256',
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase filesystem-safe ID`)
  }
}

function roundTime(value: number): number {
  return Number(value.toFixed(6))
}

function uniqueSortedTimes(values: readonly number[]): number[] {
  return [...new Set(values.map(roundTime))].sort((left, right) => left - right)
}

function orderedUniqueTimes(
  values: readonly number[],
  label: string,
): number[] {
  if (values.length > maximumFullLoopSampleCount) {
    throw new Error(
      `${label} may contain at most ${maximumFullLoopSampleCount} samples`,
    )
  }
  const times = values.map((value, index) => {
    assertFiniteNumber(value, `${label}[${index}]`)
    return roundTime(value)
  })
  if (new Set(times).size !== times.length) {
    throw new Error(`${label} must not contain duplicate sample times`)
  }
  if (times.some((time, index) => index > 0 && time <= times[index - 1])) {
    throw new Error(`${label} must be in strictly increasing order`)
  }
  return times
}

function maximumSampleGap(times: readonly number[]): number {
  return roundTime(
    Math.max(...times.slice(1).map((time, index) => time - times[index])),
  )
}

function fullLoopSampleTimes(animation: BrowserCaptureAnimationInput): {
  readonly times: readonly number[]
  readonly maximumGap: number
} {
  assertFiniteNumber(animation.durationSeconds, 'animation.durationSeconds')
  if (animation.durationSeconds <= 0) {
    throw new Error('animation.durationSeconds must be greater than zero')
  }
  let times: number[]
  if (animation.sampleTimesSeconds !== undefined) {
    times = orderedUniqueTimes(
      animation.sampleTimesSeconds,
      'animation.sampleTimesSeconds',
    )
  } else {
    const interval =
      animation.sampleIntervalSeconds ?? animation.durationSeconds / 4
    assertFiniteNumber(interval, 'animation.sampleIntervalSeconds')
    if (interval <= 0) {
      throw new Error('animation.sampleIntervalSeconds must be greater than zero')
    }
    times = []
    for (let time = 0; time < animation.durationSeconds; time += interval) {
      times.push(roundTime(time))
      if (times.length >= maximumFullLoopSampleCount) {
        throw new Error('animation sample interval produced too many captures')
      }
    }
    times.push(roundTime(animation.durationSeconds))
    times = orderedUniqueTimes(times, 'generated animation sample times')
  }
  validateRequiredFullLoop(animation.durationSeconds, times)
  return { times, maximumGap: maximumSampleGap(times) }
}

function validateViewport(
  viewport: BrowserCaptureViewport,
  index: number,
): void {
  assertSafeId(viewport.id, `viewports[${index}].id`)
  assertPositiveInteger(viewport.width, `viewports[${index}].width`)
  assertPositiveInteger(viewport.height, `viewports[${index}].height`)
  assertFiniteNumber(
    viewport.deviceScaleFactor,
    `viewports[${index}].deviceScaleFactor`,
  )
  if (viewport.deviceScaleFactor <= 0 || viewport.deviceScaleFactor > 4) {
    throw new Error(
      `viewports[${index}].deviceScaleFactor must be greater than 0 and no more than 4`,
    )
  }
}

function validateRequiredViewportCoverage(
  viewports: readonly BrowserCaptureViewport[],
): void {
  if (viewports.length !== requiredBrowserCaptureViewports.length) {
    throw new Error(
      `viewports must contain exactly the ${requiredBrowserCaptureViewports.length} project review viewports`,
    )
  }
  for (const expected of requiredBrowserCaptureViewports) {
    const actual = viewports.find(({ id }) => id === expected.id)
    if (
      actual === undefined ||
      actual.width !== expected.width ||
      actual.height !== expected.height ||
      actual.deviceScaleFactor !== expected.deviceScaleFactor
    ) {
      throw new Error(
        `viewport ${expected.id} must be ${expected.width}x${expected.height} at deviceScaleFactor ${expected.deviceScaleFactor}`,
      )
    }
  }
}

function validateRequiredFullLoop(
  durationSeconds: number,
  times: readonly number[],
): void {
  if (durationSeconds !== 8) {
    throw new Error(
      'The onboarding review loop must be exactly 8 seconds.',
    )
  }
  if (times.length < 5 || times.length > maximumFullLoopSampleCount) {
    throw new Error(
      `The onboarding review loop must contain 5-${maximumFullLoopSampleCount} samples.`,
    )
  }
  times.forEach((time, index) => {
    assertFiniteNumber(time, `full-loop sampleTimes[${index}]`)
    if (time < 0 || time > durationSeconds) {
      throw new Error('animation sample times must stay inside the full loop')
    }
    if (index > 0 && time <= times[index - 1]) {
      throw new Error(
        'The onboarding review loop sample times must be unique and strictly increasing.',
      )
    }
  })
  if (times[0] !== 0 || times.at(-1) !== durationSeconds) {
    throw new Error(
      'The onboarding review loop samples must start at 0 and end at exactly 8 seconds.',
    )
  }
  if (
    requiredFullLoopSampleTimesSeconds.some(
      (required) => !times.includes(required),
    )
  ) {
    throw new Error(
      'The onboarding review loop samples must include the mandatory 0/2/4/6/8-second checkpoints.',
    )
  }
  if (maximumSampleGap(times) > durationSeconds / 4 + 0.000001) {
    throw new Error(
      'full-loop samples may not leave a gap larger than one quarter of the clip',
    )
  }
}

function validateCameraAngle(
  camera: BrowserCaptureCameraAngle,
  index: number,
): void {
  assertSafeId(camera.id, `cameraAngles[${index}].id`)
  assertFiniteNumber(camera.yawDegrees, `cameraAngles[${index}].yawDegrees`)
  assertFiniteNumber(
    camera.pitchDegrees,
    `cameraAngles[${index}].pitchDegrees`,
  )
  assertFiniteNumber(camera.distance, `cameraAngles[${index}].distance`)
  if (camera.distance <= 0) {
    throw new Error(`cameraAngles[${index}].distance must be greater than zero`)
  }
  if (!Array.isArray(camera.target) || camera.target.length !== 3) {
    throw new Error(`cameraAngles[${index}].target must have three numbers`)
  }
  camera.target.forEach((value, targetIndex) =>
    assertFiniteNumber(
      value,
      `cameraAngles[${index}].target[${targetIndex}]`,
    ),
  )
}

function validateStateSequence(
  inputs: readonly BrowserCaptureStateInput[],
  fullLoopTimes: readonly number[],
  durationSeconds: number,
): BrowserCaptureStatePlan[] {
  if (inputs.length === 0) {
    throw new Error('stateSequence must include an initial state')
  }
  if (inputs[0]?.kind !== 'initial') {
    throw new Error('stateSequence[0] must be the initial state')
  }
  if (inputs.filter(({ kind }) => kind === 'initial').length !== 1) {
    throw new Error('stateSequence must contain exactly one initial state')
  }
  if (
    inputs[0].actions.length !== 1 ||
    inputs[0].actions[0]?.command !== 'reset-view'
  ) {
    throw new Error(
      'stateSequence initial state must contain exactly one reset-view action',
    )
  }
  const seen = new Set<string>()
  return inputs.map((state, sequenceIndex) => {
    assertSafeId(state.id, `stateSequence[${sequenceIndex}].id`)
    if (seen.has(state.id)) {
      throw new Error(`stateSequence contains duplicate state ID ${state.id}`)
    }
    seen.add(state.id)
    if (state.kind === 'interaction' && state.actions.length === 0) {
      throw new Error(
        `interaction state ${state.id} must declare at least one action`,
      )
    }
    if (
      state.kind === 'interaction' &&
      state.actions.some(({ command }) => command === 'reset-view')
    ) {
      throw new Error(
        `interaction state ${state.id} may not reset the base camera`,
      )
    }
    const fullLoop =
      state.captureFullLoop ?? (state.kind === 'initial')
    const times = state.captureTimesSeconds
      ? uniqueSortedTimes(state.captureTimesSeconds)
      : fullLoop
        ? [...fullLoopTimes]
        : [0]
    if (times.length === 0) {
      throw new Error(`state ${state.id} has no capture times`)
    }
    if (sequenceIndex === 0 && !fullLoop) {
      throw new Error('The initial state must capture the complete animation loop')
    }
    for (const time of times) {
      assertFiniteNumber(time, `state ${state.id} capture time`)
      if (time < 0 || time > durationSeconds) {
        throw new Error(`state ${state.id} capture time is outside the clip`)
      }
      if (state.kind === 'interaction' && !fullLoopTimes.includes(time)) {
        throw new Error(
          `interaction state ${state.id} capture times must also exist in the initial full-loop samples`,
        )
      }
    }
    if (
      fullLoop &&
      JSON.stringify(times) !== JSON.stringify(fullLoopTimes)
    ) {
      throw new Error(
        `full-loop state ${state.id} must use the plan's complete sample sequence`,
      )
    }
    return {
      id: state.id,
      kind: state.kind,
      sequenceIndex,
      actions: [...state.actions],
      captureTimesSeconds: times,
      fullLoop,
    }
  })
}

function assertUniqueIds(
  values: readonly { readonly id: string }[],
  label: string,
): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value.id)) throw new Error(`${label} contains duplicate ${value.id}`)
    seen.add(value.id)
  }
}

function timeToken(timeSeconds: number): string {
  return `${Math.round(timeSeconds * 1_000)
    .toString()
    .padStart(6, '0')}ms`
}

function selectorForAnimal(template: string, animalId: string): string {
  if (!template.includes('{animalId}')) {
    throw new Error(
      'pageContract.animalSelectorTemplate must contain {animalId}',
    )
  }
  return template.replaceAll('{animalId}', animalId)
}

type CapturePurpose = BrowserCaptureRequest['purposes'][number]

interface RequestedCapture {
  readonly viewport: BrowserCaptureViewport
  readonly cameraAngle: BrowserCaptureCameraAngle
  readonly state: BrowserCaptureStatePlan
  readonly requestedTimeSeconds: number
  readonly purposes: Set<CapturePurpose>
}

function requestedCaptureKey(
  viewport: BrowserCaptureViewport,
  cameraAngle: BrowserCaptureCameraAngle,
  state: BrowserCaptureStatePlan,
  requestedTimeSeconds: number,
): string {
  return [
    viewport.id,
    cameraAngle.id,
    state.id,
    timeToken(requestedTimeSeconds),
  ].join('--')
}

function addRequestedCapture(
  requests: Map<string, RequestedCapture>,
  viewport: BrowserCaptureViewport,
  cameraAngle: BrowserCaptureCameraAngle,
  state: BrowserCaptureStatePlan,
  requestedTimeSeconds: number,
  purpose: CapturePurpose,
): void {
  const key = requestedCaptureKey(
    viewport,
    cameraAngle,
    state,
    requestedTimeSeconds,
  )
  const existing = requests.get(key)
  if (existing) {
    existing.purposes.add(purpose)
    return
  }
  requests.set(key, {
    viewport,
    cameraAngle,
    state,
    requestedTimeSeconds,
    purposes: new Set([purpose]),
  })
}

function selectById<T extends { readonly id: string }>(
  values: readonly T[],
  requestedId: string | undefined,
  label: string,
): T {
  const selected = requestedId
    ? values.find(({ id }) => id === requestedId)
    : values[0]
  if (!selected) {
    throw new Error(`${label} ${requestedId ?? ''} is not defined in the plan`)
  }
  return selected
}

function selectAuxiliaryCameraAngles(
  cameraAngles: readonly BrowserCaptureCameraAngle[],
  primary: BrowserCaptureCameraAngle,
  requestedIds: readonly string[] | undefined,
): BrowserCaptureCameraAngle[] {
  const available = cameraAngles.filter(({ id }) => id !== primary.id)
  if (requestedIds !== undefined) {
    if (requestedIds.length !== available.length) {
      throw new Error(
        'review-efficient mode must declare every non-primary camera angle as auxiliary',
      )
    }
    const uniqueIds = new Set(requestedIds)
    if (uniqueIds.size !== requestedIds.length || uniqueIds.has(primary.id)) {
      throw new Error(
        'auxiliaryCameraAngleIds must be unique and exclude the primary angle',
      )
    }
    if (available.some(({ id }) => !uniqueIds.has(id))) {
      throw new Error(
        'auxiliaryCameraAngleIds must cover every non-primary camera angle',
      )
    }
    return requestedIds.map((id) =>
      selectById(cameraAngles, id, 'auxiliaryCameraAngleId'),
    )
  }
  return available
}

function selectRequestedCaptures(
  mode: 'review-efficient' | 'exhaustive',
  viewports: readonly BrowserCaptureViewport[],
  cameraAngles: readonly BrowserCaptureCameraAngle[],
  states: readonly BrowserCaptureStatePlan[],
  primaryViewport: BrowserCaptureViewport,
  primaryCameraAngle: BrowserCaptureCameraAngle,
  auxiliaryCameraAngles: readonly BrowserCaptureCameraAngle[],
): RequestedCapture[] {
  const selected = new Map<string, RequestedCapture>()
  if (mode === 'exhaustive') {
    for (const viewport of viewports) {
      for (const cameraAngle of cameraAngles) {
        for (const state of states) {
          for (const requestedTimeSeconds of state.captureTimesSeconds) {
            addRequestedCapture(
              selected,
              viewport,
              cameraAngle,
              state,
              requestedTimeSeconds,
              'exhaustive',
            )
          }
        }
      }
    }
    return [...selected.values()]
  }

  const initialState = states[0]
  // One initial frame per viewport proves layout and default presentation
  // without multiplying every viewport by every angle and animation sample.
  for (const viewport of viewports) {
    addRequestedCapture(
      selected,
      viewport,
      primaryCameraAngle,
      initialState,
      0,
      'viewport-initial',
    )
  }
  // Every declared review angle carries the complete Idle loop. This stays
  // review-efficient because the additional samples use only the primary
  // viewport rather than multiplying angles by all five viewports.
  for (const requestedTimeSeconds of initialState.captureTimesSeconds) {
    addRequestedCapture(
      selected,
      primaryViewport,
      primaryCameraAngle,
      initialState,
      requestedTimeSeconds,
      'full-loop',
    )
  }
  // One or two extra angles expose the opposite side and rear silhouette at
  // every loop sample. A single instant must not hide transient clipping,
  // transparency flicker, or appendage deformation on an auxiliary side.
  for (const cameraAngle of auxiliaryCameraAngles) {
    for (const requestedTimeSeconds of initialState.captureTimesSeconds) {
      addRequestedCapture(
        selected,
        primaryViewport,
        cameraAngle,
        initialState,
        requestedTimeSeconds,
        'auxiliary-angle',
      )
      addRequestedCapture(
        selected,
        primaryViewport,
        cameraAngle,
        initialState,
        requestedTimeSeconds,
        'full-loop',
      )
    }
  }
  // Interaction states run only in the primary evidence view unless an
  // investigator explicitly switches the whole plan to exhaustive mode.
  for (const state of states.slice(1)) {
    for (const requestedTimeSeconds of state.captureTimesSeconds) {
      addRequestedCapture(
        selected,
        primaryViewport,
        primaryCameraAngle,
        state,
        requestedTimeSeconds,
        'interaction',
      )
    }
  }
  return [...selected.values()]
}

function buildCaptureRequests(input: {
  readonly animalId: string
  readonly reviewUrl: string
  readonly pageContract: BrowserCapturePageContract
  readonly finalGlbSha256: string
  readonly clipName: string
  readonly states: readonly BrowserCaptureStatePlan[]
  readonly selectedCaptures: readonly RequestedCapture[]
}): BrowserCaptureRequest[] {
  const animalSelector = selectorForAnimal(
    input.pageContract.animalSelectorTemplate,
    input.animalId,
  )
  return input.selectedCaptures.map((selected) => {
    const {
      viewport,
      cameraAngle,
      state,
      requestedTimeSeconds,
      purposes,
    } = selected
    const id = [
      viewport.id,
      cameraAngle.id,
      state.id,
      timeToken(requestedTimeSeconds),
    ].join('--')
    const screenshotRelativePath = posix.join(
      'candidate',
      input.animalId,
      viewport.id,
      cameraAngle.id,
      state.id,
      `${timeToken(requestedTimeSeconds)}.png`,
    )
    const interactionActions = input.states
      .slice(1, state.sequenceIndex + 1)
      .flatMap(({ actions }) => actions)
    const baseState = input.states[0]
    return {
      id,
      animalId: input.animalId,
      viewport,
      cameraAngle,
      state: {
        id: state.id,
        kind: state.kind,
        sequenceIndex: state.sequenceIndex,
      },
      animation: {
        clipName: input.clipName,
        requestedTimeSeconds,
        expectedPaused: true,
      },
      purposes: [...purposes],
      screenshotRelativePath,
      instructions: [
        { command: 'set-viewport', viewport },
        { command: 'navigate', url: input.reviewUrl },
        {
          command: 'select-animal',
          animalId: input.animalId,
          selector: animalSelector,
        },
        {
          command: 'wait-for-animal-ready',
          selector: input.pageContract.readySelector,
          attribute: input.pageContract.readyAnimalAttribute,
          value: input.animalId,
        },
        {
          command: 'wait-for-loaded-glb-sha',
          selector: input.pageContract.canvasSelector,
          attribute: input.pageContract.loadedGlbShaAttribute,
          sha256: input.finalGlbSha256,
        },
        {
          command: 'apply-state',
          stateId: baseState.id,
          stateKind: baseState.kind,
          sequenceIndex: baseState.sequenceIndex,
          actions: baseState.actions,
        },
        { command: 'set-camera-angle', cameraAngle },
        ...(state.kind === 'interaction'
          ? ([
              {
                command: 'apply-state',
                stateId: state.id,
                stateKind: state.kind,
                sequenceIndex: state.sequenceIndex,
                actions: interactionActions,
              },
            ] satisfies BrowserCaptureInstruction[])
          : []),
        {
          command: 'set-animation-time',
          clipName: input.clipName,
          requestedTimeSeconds,
        },
        { command: 'assert-animation-paused', expected: true },
        {
          command: 'capture-screenshot',
          relativePath: screenshotRelativePath,
          mediaType: 'image/png',
        },
        { command: 'record-capture-metadata', requestId: id },
      ],
    }
  })
}

export async function createBrowserCapturePlan(
  input: BrowserCapturePlanInput,
): Promise<BrowserCapturePlan> {
  assertSafeId(input.animalId, 'animalId')
  if (input.cameraAngles.length < 2 || input.cameraAngles.length > 3) {
    throw new Error(
      'Multi-view evidence requires one primary and one or two auxiliary camera angles',
    )
  }
  input.viewports.forEach(validateViewport)
  input.cameraAngles.forEach(validateCameraAngle)
  assertUniqueIds(input.viewports, 'viewports')
  assertUniqueIds(input.cameraAngles, 'cameraAngles')
  validateRequiredViewportCoverage(input.viewports)
  const reviewUrl = new URL(input.reviewUrl)
  if (!['http:', 'https:'].includes(reviewUrl.protocol)) {
    throw new Error('reviewUrl must use http or https')
  }
  const finalGlbPath = resolve(input.finalGlbPath)
  const finalGlb = await fileDigest(finalGlbPath)
  const { times, maximumGap } = fullLoopSampleTimes(input.animation)
  validateRequiredFullLoop(input.animation.durationSeconds, times)
  const actualTimeToleranceSeconds =
    input.animation.actualTimeToleranceSeconds ?? 0.02
  assertFiniteNumber(
    actualTimeToleranceSeconds,
    'animation.actualTimeToleranceSeconds',
  )
  if (
    actualTimeToleranceSeconds < 0 ||
    actualTimeToleranceSeconds > maximumGap / 2
  ) {
    throw new Error(
      'animation.actualTimeToleranceSeconds must be non-negative and smaller than half a sample gap',
    )
  }
  const states = validateStateSequence(
    input.stateSequence ?? [
      {
        id: 'initial',
        kind: 'initial',
        actions: [{ command: 'reset-view' }],
        captureFullLoop: true,
      },
    ],
    times,
    input.animation.durationSeconds,
  )
  if (!states.some(({ kind }) => kind === 'interaction')) {
    throw new Error(
      'stateSequence must declare at least one interaction state for responsive framing review',
    )
  }
  const pageContract = { ...defaultPageContract, ...input.pageContract }
  const clipName = input.animation.clipName ?? 'Idle'
  const captureMode = input.captureMode ?? 'review-efficient'
  const primaryViewport = selectById(
    input.viewports,
    input.primaryViewportId ??
      input.viewports.find(({ id }) => id === 'desktop')?.id,
    'primaryViewportId',
  )
  if (primaryViewport.id !== 'desktop') {
    throw new Error('primaryViewportId must be desktop')
  }
  const primaryCameraAngle = selectById(
    input.cameraAngles,
    input.primaryCameraAngleId,
    'primaryCameraAngleId',
  )
  const auxiliaryCameraAngles =
    captureMode === 'review-efficient'
      ? selectAuxiliaryCameraAngles(
          input.cameraAngles,
          primaryCameraAngle,
          input.auxiliaryCameraAngleIds,
        )
      : input.cameraAngles.filter(({ id }) => id !== primaryCameraAngle.id)
  const selectedCaptures = selectRequestedCaptures(
    captureMode,
    input.viewports,
    input.cameraAngles,
    states,
    primaryViewport,
    primaryCameraAngle,
    auxiliaryCameraAngles,
  )
  const requests = buildCaptureRequests({
    animalId: input.animalId,
    reviewUrl: reviewUrl.toString(),
    pageContract,
    finalGlbSha256: finalGlb.sha256,
    clipName,
    states,
    selectedCaptures,
  })
  if (requests.length > 10_000) {
    throw new Error('Capture plan contains more than 10,000 requests')
  }
  if (input.globalBaseline === undefined) {
    throw new Error(
      'globalBaseline is required so production regressions remain hash-bound after planning',
    )
  }
  assertSafeId(input.globalBaseline.id, 'globalBaseline.id')
  if (input.globalBaseline.required !== true) {
    throw new Error('globalBaseline.required must be true')
  }
  const globalBaseline = {
    id: input.globalBaseline.id,
    required: true as const,
    report: {
      path: resolve(input.globalBaseline.reportPath),
      ...(await fileDigest(resolve(input.globalBaseline.reportPath))),
    },
  }
  await assertPassingBaselineReport(globalBaseline.report.path)
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('generatedAt must be an ISO date-time')
  }
  const planBody: Omit<BrowserCapturePlan, 'planId' | 'planSha256'> = {
    schemaVersion: browserCaptureSchemaVersion,
    kind: 'headed-browser-capture-plan',
    generatedAt,
    execution: {
      driver: 'Browser-or-Chrome-control',
      headedRequired: true,
      launchesBrowser: false,
    },
    animalId: input.animalId,
    reviewUrl: reviewUrl.toString(),
    pageContract,
    finalGlb: {
      path: finalGlbPath,
      ...finalGlb,
    },
    animation: {
      clipName,
      durationSeconds: input.animation.durationSeconds,
      fullLoopSampleTimesSeconds: times,
      maximumSampleGapSeconds: maximumGap,
      actualTimeToleranceSeconds,
    },
    coverage: {
      mode: captureMode,
      primaryViewportId: primaryViewport.id,
      primaryCameraAngleId: primaryCameraAngle.id,
      auxiliaryCameraAngleIds: auxiliaryCameraAngles.map(({ id }) => id),
    },
    viewports: [...input.viewports],
    cameraAngles: [...input.cameraAngles],
    stateSequence: states,
    requests,
    globalBaseline,
  }
  const planSha256 = browserCapturePlanDigest(planBody)
  return {
    ...planBody,
    planId: `headed-${input.animalId}-${planSha256.slice(0, 16)}`,
    planSha256,
  }
}

export const createHeadedBrowserCapturePlan = createBrowserCapturePlan

export async function writeBrowserCapturePlan(
  outputPath: string,
  input: BrowserCapturePlanInput,
): Promise<BrowserCapturePlan> {
  const plan = await createBrowserCapturePlan(input)
  await writeJson(outputPath, plan)
  return plan
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

type BrowserCapturePlanBody = Omit<
  BrowserCapturePlan,
  'planId' | 'planSha256'
>

export function browserCapturePlanDigest(
  plan: BrowserCapturePlan | BrowserCapturePlanBody,
): string {
  const body: Record<string, unknown> = { ...plan }
  delete body.planId
  delete body.planSha256
  return sha256(Buffer.from(canonicalJson(body), 'utf8'))
}

async function assertPassingBaselineReport(path: string): Promise<void> {
  const bytes = await readFile(path)
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown
  } catch {
    throw new Error('Global baseline report must be valid JSON.')
  }
  if (!isRecord(parsed)) {
    throw new Error('Global baseline report must be a JSON object.')
  }
  const reportErrors = parsed.errors
  if (
    parsed.pass !== true ||
    !Array.isArray(reportErrors) ||
    reportErrors.length !== 0
  ) {
    throw new Error('Global baseline report must record pass=true and no errors.')
  }
  const checked = asFiniteNumber(parsed.checked)
  const actualIds = Array.isArray(parsed.actualIds) ? parsed.actualIds : null
  if (
    !(
      (checked !== null && Number.isInteger(checked) && checked > 0) ||
      (actualIds !== null &&
        actualIds.length > 0 &&
        actualIds.every((id) => typeof id === 'string' && id.length > 0))
    )
  ) {
    throw new Error(
      'Global baseline report must include a positive checked count or non-empty actualIds.',
    )
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): void {
  const allowed = new Set([...required, ...optional])
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label}.${key} is required`)
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label}.${key} is not allowed`)
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function requiredNumber(value: unknown, label: string): number {
  const number = asFiniteNumber(value)
  if (number === null) throw new Error(`${label} must be a finite number`)
  return number
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`)
  return value
}

function requiredArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function optionalString(
  value: Record<string, unknown>,
  key: string,
  label: string,
): string | undefined {
  return Object.prototype.hasOwnProperty.call(value, key)
    ? requiredString(value[key], `${label}.${key}`)
    : undefined
}

function parseViewportValue(value: unknown, label: string): BrowserCaptureViewport {
  const record = requiredRecord(value, label)
  assertExactKeys(
    record,
    ['id', 'width', 'height', 'deviceScaleFactor'],
    [],
    label,
  )
  const viewport = {
    id: requiredString(record.id, `${label}.id`),
    width: requiredNumber(record.width, `${label}.width`),
    height: requiredNumber(record.height, `${label}.height`),
    deviceScaleFactor: requiredNumber(
      record.deviceScaleFactor,
      `${label}.deviceScaleFactor`,
    ),
  }
  validateViewport(viewport, 0)
  return viewport
}

function parseCameraValue(
  value: unknown,
  label: string,
): BrowserCaptureCameraAngle {
  const record = requiredRecord(value, label)
  assertExactKeys(
    record,
    ['id', 'yawDegrees', 'pitchDegrees', 'distance', 'target'],
    [],
    label,
  )
  const targetValues = requiredArray(record.target, `${label}.target`)
  if (targetValues.length !== 3) {
    throw new Error(`${label}.target must contain exactly three numbers`)
  }
  const target: readonly [number, number, number] = [
    requiredNumber(targetValues[0], `${label}.target[0]`),
    requiredNumber(targetValues[1], `${label}.target[1]`),
    requiredNumber(targetValues[2], `${label}.target[2]`),
  ]
  const camera = {
    id: requiredString(record.id, `${label}.id`),
    yawDegrees: requiredNumber(record.yawDegrees, `${label}.yawDegrees`),
    pitchDegrees: requiredNumber(record.pitchDegrees, `${label}.pitchDegrees`),
    distance: requiredNumber(record.distance, `${label}.distance`),
    target,
  }
  validateCameraAngle(camera, 0)
  return camera
}

function parseStateAction(
  value: unknown,
  label: string,
): BrowserCaptureStateAction {
  const record = requiredRecord(value, label)
  const command = requiredString(record.command, `${label}.command`)
  if (command === 'reset-view') {
    assertExactKeys(record, ['command'], [], label)
    return { command }
  }
  if (command === 'orbit') {
    assertExactKeys(
      record,
      ['command', 'yawDeltaDegrees', 'pitchDeltaDegrees'],
      [],
      label,
    )
    return {
      command,
      yawDeltaDegrees: requiredNumber(
        record.yawDeltaDegrees,
        `${label}.yawDeltaDegrees`,
      ),
      pitchDeltaDegrees: requiredNumber(
        record.pitchDeltaDegrees,
        `${label}.pitchDeltaDegrees`,
      ),
    }
  }
  if (command === 'zoom') {
    assertExactKeys(record, ['command', 'delta'], [], label)
    return {
      command,
      delta: requiredNumber(record.delta, `${label}.delta`),
    }
  }
  if (command === 'pan') {
    assertExactKeys(record, ['command', 'xPixels', 'yPixels'], [], label)
    return {
      command,
      xPixels: requiredNumber(record.xPixels, `${label}.xPixels`),
      yPixels: requiredNumber(record.yPixels, `${label}.yPixels`),
    }
  }
  if (command === 'custom') {
    assertExactKeys(record, ['command', 'name'], ['payload'], label)
    const payload = Object.prototype.hasOwnProperty.call(record, 'payload')
      ? requiredRecord(record.payload, `${label}.payload`)
      : undefined
    return {
      command,
      name: requiredString(record.name, `${label}.name`),
      ...(payload ? { payload } : {}),
    }
  }
  throw new Error(`${label}.command is unsupported`)
}

function parseStateInputValue(
  value: unknown,
  label: string,
): BrowserCaptureStateInput {
  const record = requiredRecord(value, label)
  assertExactKeys(
    record,
    ['id', 'kind', 'actions'],
    ['captureFullLoop', 'captureTimesSeconds'],
    label,
  )
  const kind = requiredString(record.kind, `${label}.kind`)
  if (kind !== 'initial' && kind !== 'interaction') {
    throw new Error(`${label}.kind must be initial or interaction`)
  }
  const actions = requiredArray(record.actions, `${label}.actions`).map(
    (action, index) => parseStateAction(action, `${label}.actions[${index}]`),
  )
  const captureFullLoop = Object.prototype.hasOwnProperty.call(
    record,
    'captureFullLoop',
  )
    ? requiredBoolean(record.captureFullLoop, `${label}.captureFullLoop`)
    : undefined
  const captureTimesSeconds = Object.prototype.hasOwnProperty.call(
    record,
    'captureTimesSeconds',
  )
    ? requiredArray(
        record.captureTimesSeconds,
        `${label}.captureTimesSeconds`,
      ).map((time, index) =>
        requiredNumber(time, `${label}.captureTimesSeconds[${index}]`),
      )
    : undefined
  return {
    id: requiredString(record.id, `${label}.id`),
    kind,
    actions,
    ...(captureFullLoop === undefined ? {} : { captureFullLoop }),
    ...(captureTimesSeconds === undefined ? {} : { captureTimesSeconds }),
  }
}

function parseStatePlanValue(
  value: unknown,
  label: string,
): BrowserCaptureStatePlan {
  const record = requiredRecord(value, label)
  assertExactKeys(
    record,
    [
      'id',
      'kind',
      'sequenceIndex',
      'actions',
      'captureTimesSeconds',
      'fullLoop',
    ],
    [],
    label,
  )
  const input = parseStateInputValue(
    {
      id: record.id,
      kind: record.kind,
      actions: record.actions,
      captureFullLoop: record.fullLoop,
      captureTimesSeconds: record.captureTimesSeconds,
    },
    label,
  )
  const sequenceIndex = requiredNumber(
    record.sequenceIndex,
    `${label}.sequenceIndex`,
  )
  if (!Number.isInteger(sequenceIndex) || sequenceIndex < 0) {
    throw new Error(`${label}.sequenceIndex must be a non-negative integer`)
  }
  return {
    id: input.id,
    kind: input.kind,
    sequenceIndex,
    actions: input.actions,
    captureTimesSeconds: input.captureTimesSeconds ?? [],
    fullLoop: input.captureFullLoop ?? false,
  }
}

function parsePageContractValue(
  value: unknown,
  label: string,
  partial: true,
): Partial<BrowserCapturePageContract>
function parsePageContractValue(
  value: unknown,
  label: string,
  partial: false,
): BrowserCapturePageContract
function parsePageContractValue(
  value: unknown,
  label: string,
  partial: boolean,
): Partial<BrowserCapturePageContract> | BrowserCapturePageContract {
  const record = requiredRecord(value, label)
  const keys = [
    'animalSelectorTemplate',
    'readySelector',
    'readyAnimalAttribute',
    'canvasSelector',
    'loadedGlbShaAttribute',
  ] as const
  assertExactKeys(record, partial ? [] : keys, partial ? keys : [], label)
  if (!partial) {
    return {
      animalSelectorTemplate: requiredString(
        record.animalSelectorTemplate,
        `${label}.animalSelectorTemplate`,
      ),
      readySelector: requiredString(
        record.readySelector,
        `${label}.readySelector`,
      ),
      readyAnimalAttribute: requiredString(
        record.readyAnimalAttribute,
        `${label}.readyAnimalAttribute`,
      ),
      canvasSelector: requiredString(
        record.canvasSelector,
        `${label}.canvasSelector`,
      ),
      loadedGlbShaAttribute: requiredString(
        record.loadedGlbShaAttribute,
        `${label}.loadedGlbShaAttribute`,
      ),
    }
  }
  return {
    ...(optionalString(record, 'animalSelectorTemplate', label)
      ? {
          animalSelectorTemplate: optionalString(
            record,
            'animalSelectorTemplate',
            label,
          ),
        }
      : {}),
    ...(optionalString(record, 'readySelector', label)
      ? { readySelector: optionalString(record, 'readySelector', label) }
      : {}),
    ...(optionalString(record, 'readyAnimalAttribute', label)
      ? {
          readyAnimalAttribute: optionalString(
            record,
            'readyAnimalAttribute',
            label,
          ),
        }
      : {}),
    ...(optionalString(record, 'canvasSelector', label)
      ? { canvasSelector: optionalString(record, 'canvasSelector', label) }
      : {}),
    ...(optionalString(record, 'loadedGlbShaAttribute', label)
      ? {
          loadedGlbShaAttribute: optionalString(
            record,
            'loadedGlbShaAttribute',
            label,
          ),
        }
      : {}),
  }
}

export function parseBrowserCapturePlanInput(
  value: unknown,
): BrowserCapturePlanInput {
  const record = requiredRecord(value, 'capturePlanInput')
  assertExactKeys(
    record,
    [
      'animalId',
      'finalGlbPath',
      'reviewUrl',
      'viewports',
      'cameraAngles',
      'animation',
      'globalBaseline',
    ],
    [
      'stateSequence',
      'captureMode',
      'primaryViewportId',
      'primaryCameraAngleId',
      'auxiliaryCameraAngleIds',
      'pageContract',
      'generatedAt',
    ],
    'capturePlanInput',
  )
  const viewports = requiredArray(record.viewports, 'capturePlanInput.viewports').map(
    (viewport, index) =>
      parseViewportValue(viewport, `capturePlanInput.viewports[${index}]`),
  )
  const cameraAngles = requiredArray(
    record.cameraAngles,
    'capturePlanInput.cameraAngles',
  ).map((camera, index) =>
    parseCameraValue(camera, `capturePlanInput.cameraAngles[${index}]`),
  )
  const animationRecord = requiredRecord(
    record.animation,
    'capturePlanInput.animation',
  )
  assertExactKeys(
    animationRecord,
    ['durationSeconds'],
    [
      'clipName',
      'sampleIntervalSeconds',
      'sampleTimesSeconds',
      'actualTimeToleranceSeconds',
    ],
    'capturePlanInput.animation',
  )
  const sampleTimesSeconds = Object.prototype.hasOwnProperty.call(
    animationRecord,
    'sampleTimesSeconds',
  )
    ? requiredArray(
        animationRecord.sampleTimesSeconds,
        'capturePlanInput.animation.sampleTimesSeconds',
      ).map((time, index) =>
        requiredNumber(
          time,
          `capturePlanInput.animation.sampleTimesSeconds[${index}]`,
        ),
      )
    : undefined
  const stateSequence = Object.prototype.hasOwnProperty.call(
    record,
    'stateSequence',
  )
    ? requiredArray(record.stateSequence, 'capturePlanInput.stateSequence').map(
        (state, index) =>
          parseStateInputValue(
            state,
            `capturePlanInput.stateSequence[${index}]`,
          ),
      )
    : undefined
  const captureMode = optionalString(
    record,
    'captureMode',
    'capturePlanInput',
  )
  if (
    captureMode !== undefined &&
    captureMode !== 'review-efficient' &&
    captureMode !== 'exhaustive'
  ) {
    throw new Error('capturePlanInput.captureMode is invalid')
  }
  const auxiliaryCameraAngleIds = Object.prototype.hasOwnProperty.call(
    record,
    'auxiliaryCameraAngleIds',
  )
    ? requiredArray(
        record.auxiliaryCameraAngleIds,
        'capturePlanInput.auxiliaryCameraAngleIds',
      ).map((id, index) =>
        requiredString(
          id,
          `capturePlanInput.auxiliaryCameraAngleIds[${index}]`,
        ),
      )
    : undefined
  const baseline = requiredRecord(
    record.globalBaseline,
    'capturePlanInput.globalBaseline',
  )
  assertExactKeys(
    baseline,
    ['id', 'required', 'reportPath'],
    [],
    'capturePlanInput.globalBaseline',
  )
  if (
    requiredBoolean(
      baseline.required,
      'capturePlanInput.globalBaseline.required',
    ) !== true
  ) {
    throw new Error('capturePlanInput.globalBaseline.required must be true')
  }
  const globalBaseline: BrowserCapturePlanInput['globalBaseline'] = {
    id: requiredString(baseline.id, 'capturePlanInput.globalBaseline.id'),
    required: true,
    reportPath: requiredString(
      baseline.reportPath,
      'capturePlanInput.globalBaseline.reportPath',
    ),
  }
  return {
    animalId: requiredString(record.animalId, 'capturePlanInput.animalId'),
    finalGlbPath: requiredString(
      record.finalGlbPath,
      'capturePlanInput.finalGlbPath',
    ),
    reviewUrl: requiredString(record.reviewUrl, 'capturePlanInput.reviewUrl'),
    viewports,
    cameraAngles,
    animation: {
      durationSeconds: requiredNumber(
        animationRecord.durationSeconds,
        'capturePlanInput.animation.durationSeconds',
      ),
      ...(optionalString(animationRecord, 'clipName', 'capturePlanInput.animation')
        ? {
            clipName: optionalString(
              animationRecord,
              'clipName',
              'capturePlanInput.animation',
            ),
          }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(
        animationRecord,
        'sampleIntervalSeconds',
      )
        ? {
            sampleIntervalSeconds: requiredNumber(
              animationRecord.sampleIntervalSeconds,
              'capturePlanInput.animation.sampleIntervalSeconds',
            ),
          }
        : {}),
      ...(sampleTimesSeconds ? { sampleTimesSeconds } : {}),
      ...(Object.prototype.hasOwnProperty.call(
        animationRecord,
        'actualTimeToleranceSeconds',
      )
        ? {
            actualTimeToleranceSeconds: requiredNumber(
              animationRecord.actualTimeToleranceSeconds,
              'capturePlanInput.animation.actualTimeToleranceSeconds',
            ),
          }
        : {}),
    },
    ...(stateSequence ? { stateSequence } : {}),
    ...(captureMode ? { captureMode } : {}),
    ...(optionalString(record, 'primaryViewportId', 'capturePlanInput')
      ? {
          primaryViewportId: optionalString(
            record,
            'primaryViewportId',
            'capturePlanInput',
          ),
        }
      : {}),
    ...(optionalString(record, 'primaryCameraAngleId', 'capturePlanInput')
      ? {
          primaryCameraAngleId: optionalString(
            record,
            'primaryCameraAngleId',
            'capturePlanInput',
          ),
        }
      : {}),
    ...(auxiliaryCameraAngleIds ? { auxiliaryCameraAngleIds } : {}),
    ...(Object.prototype.hasOwnProperty.call(record, 'pageContract')
      ? {
          pageContract: parsePageContractValue(
            record.pageContract,
            'capturePlanInput.pageContract',
            true,
          ),
        }
      : {}),
    ...(optionalString(record, 'generatedAt', 'capturePlanInput')
      ? {
          generatedAt: optionalString(
            record,
            'generatedAt',
            'capturePlanInput',
          ),
        }
      : {}),
    globalBaseline,
  }
}

function parseDigestRecord(
  value: unknown,
  label: string,
  includePath: boolean,
): { readonly path: string; readonly bytes: number; readonly sha256: string } {
  const record = requiredRecord(value, label)
  assertExactKeys(
    record,
    includePath ? ['path', 'bytes', 'sha256'] : ['bytes', 'sha256'],
    [],
    label,
  )
  const bytes = requiredNumber(record.bytes, `${label}.bytes`)
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`${label}.bytes must be a positive integer`)
  }
  const digest = requiredString(record.sha256, `${label}.sha256`)
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${label}.sha256 must be a lowercase SHA-256`)
  }
  return {
    path: includePath ? requiredString(record.path, `${label}.path`) : '',
    bytes,
    sha256: digest,
  }
}

export function parseBrowserCapturePlan(value: unknown): BrowserCapturePlan {
  const record = requiredRecord(value, 'capturePlan')
  assertExactKeys(
    record,
    [
      'schemaVersion',
      'kind',
      'planId',
      'planSha256',
      'generatedAt',
      'execution',
      'animalId',
      'reviewUrl',
      'pageContract',
      'finalGlb',
      'animation',
      'coverage',
      'viewports',
      'cameraAngles',
      'stateSequence',
      'requests',
      'globalBaseline',
    ],
    [],
    'capturePlan',
  )
  if (record.schemaVersion !== browserCaptureSchemaVersion) {
    throw new Error('capturePlan.schemaVersion must be 1')
  }
  if (record.kind !== 'headed-browser-capture-plan') {
    throw new Error('capturePlan.kind is invalid')
  }
  const generatedAt = requiredString(record.generatedAt, 'capturePlan.generatedAt')
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('capturePlan.generatedAt must be an ISO date-time')
  }
  const execution = requiredRecord(record.execution, 'capturePlan.execution')
  assertExactKeys(
    execution,
    ['driver', 'headedRequired', 'launchesBrowser'],
    [],
    'capturePlan.execution',
  )
  if (
    execution.driver !== 'Browser-or-Chrome-control' ||
    execution.headedRequired !== true ||
    execution.launchesBrowser !== false
  ) {
    throw new Error('capturePlan.execution must require existing headed control')
  }
  const animalId = requiredString(record.animalId, 'capturePlan.animalId')
  assertSafeId(animalId, 'capturePlan.animalId')
  const reviewUrl = requiredString(record.reviewUrl, 'capturePlan.reviewUrl')
  let parsedReviewUrl: URL
  try {
    parsedReviewUrl = new URL(reviewUrl)
  } catch {
    throw new Error('capturePlan.reviewUrl must be a valid URL')
  }
  if (
    !['http:', 'https:'].includes(parsedReviewUrl.protocol) ||
    parsedReviewUrl.toString() !== reviewUrl
  ) {
    throw new Error('capturePlan.reviewUrl must be a canonical HTTP(S) URL')
  }
  const pageContract = parsePageContractValue(
    record.pageContract,
    'capturePlan.pageContract',
    false,
  )
  if (
    pageContract.animalSelectorTemplate === undefined ||
    pageContract.readySelector === undefined ||
    pageContract.readyAnimalAttribute === undefined ||
    pageContract.canvasSelector === undefined ||
    pageContract.loadedGlbShaAttribute === undefined
  ) {
    throw new Error('capturePlan.pageContract is incomplete')
  }
  selectorForAnimal(pageContract.animalSelectorTemplate, animalId)
  const finalGlb = parseDigestRecord(record.finalGlb, 'capturePlan.finalGlb', true)
  const animationRecord = requiredRecord(record.animation, 'capturePlan.animation')
  assertExactKeys(
    animationRecord,
    [
      'clipName',
      'durationSeconds',
      'fullLoopSampleTimesSeconds',
      'maximumSampleGapSeconds',
      'actualTimeToleranceSeconds',
    ],
    [],
    'capturePlan.animation',
  )
  const fullLoopTimes = requiredArray(
    animationRecord.fullLoopSampleTimesSeconds,
    'capturePlan.animation.fullLoopSampleTimesSeconds',
  ).map((time, index) =>
    requiredNumber(
      time,
      `capturePlan.animation.fullLoopSampleTimesSeconds[${index}]`,
    ),
  )
  const animation = {
    clipName: requiredString(
      animationRecord.clipName,
      'capturePlan.animation.clipName',
    ),
    durationSeconds: requiredNumber(
      animationRecord.durationSeconds,
      'capturePlan.animation.durationSeconds',
    ),
    fullLoopSampleTimesSeconds: fullLoopTimes,
    maximumSampleGapSeconds: requiredNumber(
      animationRecord.maximumSampleGapSeconds,
      'capturePlan.animation.maximumSampleGapSeconds',
    ),
    actualTimeToleranceSeconds: requiredNumber(
      animationRecord.actualTimeToleranceSeconds,
      'capturePlan.animation.actualTimeToleranceSeconds',
    ),
  }
  validateRequiredFullLoop(animation.durationSeconds, fullLoopTimes)
  const expectedMaximumSampleGap = maximumSampleGap(fullLoopTimes)
  if (
    !numberNear(
      animation.maximumSampleGapSeconds,
      expectedMaximumSampleGap,
      0.000001,
    )
  ) {
    throw new Error(
      'capturePlan.animation.maximumSampleGapSeconds does not match its sample sequence',
    )
  }
  if (
    animation.actualTimeToleranceSeconds < 0 ||
    animation.actualTimeToleranceSeconds > expectedMaximumSampleGap / 2
  ) {
    throw new Error('capturePlan.animation.actualTimeToleranceSeconds is invalid')
  }
  const viewports = requiredArray(record.viewports, 'capturePlan.viewports').map(
    (viewport, index) =>
      parseViewportValue(viewport, `capturePlan.viewports[${index}]`),
  )
  assertUniqueIds(viewports, 'capturePlan.viewports')
  validateRequiredViewportCoverage(viewports)
  const cameraAngles = requiredArray(
    record.cameraAngles,
    'capturePlan.cameraAngles',
  ).map((camera, index) =>
    parseCameraValue(camera, `capturePlan.cameraAngles[${index}]`),
  )
  assertUniqueIds(cameraAngles, 'capturePlan.cameraAngles')
  if (cameraAngles.length < 2 || cameraAngles.length > 3) {
    throw new Error('capturePlan must contain one primary and 1-2 auxiliary angles')
  }
  const states = requiredArray(
    record.stateSequence,
    'capturePlan.stateSequence',
  ).map((state, index) =>
    parseStatePlanValue(state, `capturePlan.stateSequence[${index}]`),
  )
  const normalizedStates = validateStateSequence(
    states.map((state) => ({
      id: state.id,
      kind: state.kind,
      actions: state.actions,
      captureFullLoop: state.fullLoop,
      captureTimesSeconds: state.captureTimesSeconds,
    })),
    fullLoopTimes,
    animation.durationSeconds,
  )
  if (canonicalJson(states) !== canonicalJson(normalizedStates)) {
    throw new Error('capturePlan.stateSequence is not canonical')
  }
  if (!states.some(({ kind }) => kind === 'interaction')) {
    throw new Error('capturePlan must contain an interaction state')
  }
  const coverageRecord = requiredRecord(record.coverage, 'capturePlan.coverage')
  assertExactKeys(
    coverageRecord,
    [
      'mode',
      'primaryViewportId',
      'primaryCameraAngleId',
      'auxiliaryCameraAngleIds',
    ],
    [],
    'capturePlan.coverage',
  )
  const mode = requiredString(coverageRecord.mode, 'capturePlan.coverage.mode')
  if (mode !== 'review-efficient' && mode !== 'exhaustive') {
    throw new Error('capturePlan.coverage.mode is invalid')
  }
  const primaryViewportId = requiredString(
    coverageRecord.primaryViewportId,
    'capturePlan.coverage.primaryViewportId',
  )
  if (primaryViewportId !== 'desktop') {
    throw new Error('capturePlan.coverage.primaryViewportId must be desktop')
  }
  const primaryViewport = selectById(
    viewports,
    primaryViewportId,
    'capturePlan.coverage.primaryViewportId',
  )
  const primaryCameraAngleId = requiredString(
    coverageRecord.primaryCameraAngleId,
    'capturePlan.coverage.primaryCameraAngleId',
  )
  const primaryCameraAngle = selectById(
    cameraAngles,
    primaryCameraAngleId,
    'capturePlan.coverage.primaryCameraAngleId',
  )
  const auxiliaryCameraAngleIds = requiredArray(
    coverageRecord.auxiliaryCameraAngleIds,
    'capturePlan.coverage.auxiliaryCameraAngleIds',
  ).map((id, index) =>
    requiredString(
      id,
      `capturePlan.coverage.auxiliaryCameraAngleIds[${index}]`,
    ),
  )
  if (
    auxiliaryCameraAngleIds.length < 1 ||
    auxiliaryCameraAngleIds.length > 2 ||
    new Set(auxiliaryCameraAngleIds).size !== auxiliaryCameraAngleIds.length ||
    auxiliaryCameraAngleIds.includes(primaryCameraAngle.id)
  ) {
    throw new Error('capturePlan must bind one or two unique auxiliary angles')
  }
  const auxiliaryCameraAngles = auxiliaryCameraAngleIds.map((id) =>
    selectById(cameraAngles, id, 'capturePlan.coverage.auxiliaryCameraAngleIds'),
  )
  const expectedAuxiliaryIds =
    mode === 'review-efficient'
      ? selectAuxiliaryCameraAngles(
          cameraAngles,
          primaryCameraAngle,
          auxiliaryCameraAngleIds,
        ).map(({ id }) => id)
      : cameraAngles
          .filter(({ id }) => id !== primaryCameraAngle.id)
          .map(({ id }) => id)
  if (canonicalJson(auxiliaryCameraAngleIds) !== canonicalJson(expectedAuxiliaryIds)) {
    throw new Error('capturePlan auxiliary angle coverage is not canonical')
  }
  const baselineRecord = requiredRecord(
    record.globalBaseline,
    'capturePlan.globalBaseline',
  )
  assertExactKeys(
    baselineRecord,
    ['id', 'required', 'report'],
    [],
    'capturePlan.globalBaseline',
  )
  const baselineId = requiredString(
    baselineRecord.id,
    'capturePlan.globalBaseline.id',
  )
  assertSafeId(baselineId, 'capturePlan.globalBaseline.id')
  if (
    requiredBoolean(
      baselineRecord.required,
      'capturePlan.globalBaseline.required',
    ) !== true
  ) {
    throw new Error('capturePlan.globalBaseline.required must be true')
  }
  const globalBaseline: BrowserCapturePlan['globalBaseline'] = {
    id: baselineId,
    required: true,
    report: parseDigestRecord(
      baselineRecord.report,
      'capturePlan.globalBaseline.report',
      true,
    ),
  }
  const coverage: BrowserCapturePlan['coverage'] = {
    mode,
    primaryViewportId,
    primaryCameraAngleId,
    auxiliaryCameraAngleIds,
  }
  const selectedCaptures = selectRequestedCaptures(
    mode,
    viewports,
    cameraAngles,
    states,
    primaryViewport,
    primaryCameraAngle,
    auxiliaryCameraAngles,
  )
  const expectedRequests = buildCaptureRequests({
    animalId,
    reviewUrl,
    pageContract,
    finalGlbSha256: finalGlb.sha256,
    clipName: animation.clipName,
    states,
    selectedCaptures,
  })
  if (canonicalJson(record.requests) !== canonicalJson(expectedRequests)) {
    throw new Error(
      'capturePlan.requests were removed, edited, reordered, or do not cover the declared plan',
    )
  }
  const body: BrowserCapturePlanBody = {
    schemaVersion: browserCaptureSchemaVersion,
    kind: 'headed-browser-capture-plan',
    generatedAt,
    execution: {
      driver: 'Browser-or-Chrome-control',
      headedRequired: true,
      launchesBrowser: false,
    },
    animalId,
    reviewUrl,
    pageContract,
    finalGlb,
    animation,
    coverage,
    viewports,
    cameraAngles,
    stateSequence: states,
    requests: expectedRequests,
    globalBaseline,
  }
  const expectedSha256 = browserCapturePlanDigest(body)
  const planSha256 = requiredString(record.planSha256, 'capturePlan.planSha256')
  if (planSha256 !== expectedSha256) {
    throw new Error('capturePlan.planSha256 does not match its canonical body')
  }
  const expectedPlanId = `headed-${animalId}-${expectedSha256.slice(0, 16)}`
  const planId = requiredString(record.planId, 'capturePlan.planId')
  if (planId !== expectedPlanId) {
    throw new Error('capturePlan.planId does not match its canonical digest')
  }
  return { ...body, planId, planSha256 }
}

export async function loadBrowserCapturePlan(
  path: string,
): Promise<BrowserCapturePlan> {
  const parsed = JSON.parse(await readFile(resolve(path), 'utf8')) as unknown
  return parseBrowserCapturePlan(parsed)
}

function numberNear(left: unknown, right: number, tolerance = 0.000001): boolean {
  const value = asFiniteNumber(left)
  return value !== null && Math.abs(value - right) <= tolerance
}

function angleDistanceDegrees(left: number, right: number): number {
  return Math.abs((((left - right) % 360) + 540) % 360 - 180)
}

function actualTimeMatches(
  requested: number,
  actual: unknown,
  duration: number,
  tolerance: number,
): boolean {
  const value = asFiniteNumber(actual)
  if (value === null) return false
  if (Math.abs(value - requested) <= tolerance) return true
  return (
    Math.abs(requested - duration) <= tolerance &&
    Math.abs(value) <= tolerance
  )
}

function safeCapturePath(
  captureRoot: string,
  relativePath: unknown,
): string | null {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    isAbsolute(relativePath) ||
    relativePath.includes('\\')
  ) {
    return null
  }
  const root = resolve(captureRoot)
  const absolute = resolve(root, relativePath)
  const fromRoot = relative(root, absolute)
  if (
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    return null
  }
  return absolute
}

function isStrictChildPath(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return (
    fromRoot.length > 0 &&
    fromRoot !== '..' &&
    !fromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(fromRoot)
  )
}

async function assertStrictNonSymlinkChildFile(
  rootPath: string,
  candidatePath: string,
  label: string,
): Promise<string> {
  const root = resolve(rootPath)
  const candidate = resolve(candidatePath)
  if (candidatePath !== candidate) {
    throw new Error(`${label} must be an absolute canonical path inside the run directory.`)
  }
  if (!isStrictChildPath(root, candidate)) {
    throw new Error(`${label} must be a strict child of the run directory.`)
  }

  const rootEntry = await lstat(root).catch(() => null)
  if (
    rootEntry === null ||
    !rootEntry.isDirectory() ||
    rootEntry.isSymbolicLink()
  ) {
    throw new Error('Browser capture run directory must be a real directory, not a symlink.')
  }

  const segments = relative(root, candidate).split(sep)
  let current = root
  for (const segment of segments) {
    current = join(current, segment)
    const entry = await lstat(current).catch(() => null)
    if (entry === null) throw new Error(`${label} is missing.`)
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} must not contain symlink path components.`)
    }
  }
  const candidateEntry = await lstat(candidate)
  if (!candidateEntry.isFile() || candidateEntry.size <= 0) {
    throw new Error(`${label} must be a non-empty regular file.`)
  }

  const [realRoot, realCandidate] = await Promise.all([
    realpath(root),
    realpath(candidate),
  ])
  if (!isStrictChildPath(realRoot, realCandidate)) {
    throw new Error(`${label} escapes the real run directory.`)
  }
  return candidate
}

async function strictCaptureArtifactPath(
  captureRoot: string,
  relativePath: unknown,
): Promise<string | null> {
  const lexicalPath = safeCapturePath(captureRoot, relativePath)
  if (lexicalPath === null) return null
  return assertStrictNonSymlinkChildFile(
    captureRoot,
    lexicalPath,
    'Screenshot artifact',
  ).catch(() => null)
}

async function decodedPngDimensions(
  bytes: Buffer,
  expectedWidth: number,
  expectedHeight: number,
): Promise<{
  readonly width: number
  readonly height: number
  readonly visuallyNonUniform: boolean
} | null> {
  if (
    bytes.length <= 33 ||
    bytes.length > 20 * 1024 * 1024 ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    bytes.toString('ascii', 12, 16) !== 'IHDR' ||
    bytes.readUInt32BE(16) !== expectedWidth ||
    bytes.readUInt32BE(20) !== expectedHeight
  ) {
    return null
  }
  try {
    const decoded = await sharp(bytes, {
      failOn: 'error',
      sequentialRead: true,
    })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const { width, height, channels } = decoded.info
    if (width <= 0 || height <= 0 || channels <= 0) return null
    const colorChannels = Math.min(3, channels)
    const minima = Array.from({ length: colorChannels }, () => 255)
    const maxima = Array.from({ length: colorChannels }, () => 0)
    const pixelCount = width * height
    const sampleStridePixels = Math.max(1, Math.floor(pixelCount / 8192))
    for (let pixel = 0; pixel < pixelCount; pixel += sampleStridePixels) {
      const offset = pixel * channels
      for (let channel = 0; channel < colorChannels; channel += 1) {
        const value = decoded.data[offset + channel] ?? 0
        minima[channel] = Math.min(minima[channel], value)
        maxima[channel] = Math.max(maxima[channel], value)
      }
    }
    const sampledColorRange = maxima.reduce(
      (sum, maximum, channel) => sum + maximum - minima[channel],
      0,
    )
    return {
      width,
      height,
      visuallyNonUniform: sampledColorRange >= 24,
    }
  } catch {
    return null
  }
}

class ErrorSet {
  readonly values = new Set<string>()

  add(message: string): void {
    this.values.add(message)
  }

  list(): string[] {
    return [...this.values]
  }

  size(): number {
    return this.values.size
  }
}

function validateEvidenceHeader(
  plan: BrowserCapturePlan,
  value: Record<string, unknown>,
  errors: ErrorSet,
): void {
  try {
    assertExactKeys(
      value,
      [
        'schemaVersion',
        'kind',
        'planId',
        'planSha256',
        'animalId',
        'capturedAt',
        'browser',
        'finalGlbSha256',
        'page',
        'stateSequence',
        'captures',
        'globalBaseline',
      ],
      [],
      'browserCaptureEvidence',
    )
  } catch (error) {
    errors.add(error instanceof Error ? error.message : String(error))
  }
  if (value.schemaVersion !== browserCaptureSchemaVersion) {
    errors.add('Evidence schemaVersion must be 1.')
  }
  if (value.kind !== 'headed-browser-capture-evidence') {
    errors.add('Evidence kind must be headed-browser-capture-evidence.')
  }
  if (value.planId !== plan.planId) errors.add('Evidence planId does not match.')
  if (value.planSha256 !== plan.planSha256) {
    errors.add('Evidence planSha256 does not match the canonical capture plan.')
  }
  if (value.animalId !== plan.animalId) {
    errors.add('Evidence animalId does not match the candidate.')
  }
  const capturedAt = asString(value.capturedAt)
  if (capturedAt === null || Number.isNaN(Date.parse(capturedAt))) {
    errors.add('Evidence capturedAt must be an ISO date-time.')
  }
  const browser = isRecord(value.browser) ? value.browser : null
  if (browser !== null) {
    try {
      assertExactKeys(
        browser,
        [
          'controlSurface',
          'headed',
          'collector',
          'collectorTaskId',
          'attestation',
        ],
        ['userAgent'],
        'browserCaptureEvidence.browser',
      )
    } catch (error) {
      errors.add(error instanceof Error ? error.message : String(error))
    }
  }
  if (
    browser === null ||
    !['Browser', 'Chrome'].includes(asString(browser.controlSurface) ?? '') ||
    browser.headed !== true
  ) {
    errors.add('Evidence must come from headed Browser or Chrome control.')
  }
  if (
    browser === null ||
    (asString(browser.collector) ?? '').trim().length === 0 ||
    (asString(browser.collectorTaskId) ?? '').trim().length === 0 ||
    browser.attestation !== browserCaptureCollectorAttestation
  ) {
    errors.add(
      'Evidence must include the exact named collector, Codex task identity and headed-control attestation.',
    )
  }
  if (value.finalGlbSha256 !== plan.finalGlb.sha256) {
    errors.add('Reported final GLB SHA does not match the capture plan.')
  }
  const page = isRecord(value.page) ? value.page : null
  if (page === null) {
    errors.add('Evidence page metadata is missing.')
  } else {
    try {
      assertExactKeys(
        page,
        ['url', 'actualLoadedGlbSha256'],
        [],
        'browserCaptureEvidence.page',
      )
    } catch (error) {
      errors.add(error instanceof Error ? error.message : String(error))
    }
    if (page.url !== plan.reviewUrl) {
      errors.add('Captured page URL does not match the capture plan.')
    }
    if (page.actualLoadedGlbSha256 !== plan.finalGlb.sha256) {
      errors.add('Page actually loaded a different GLB SHA.')
    }
  }
}

function validateStateEvidence(
  plan: BrowserCapturePlan,
  value: unknown,
  errors: ErrorSet,
): void {
  if (!Array.isArray(value)) {
    errors.add('Evidence stateSequence is missing.')
    return
  }
  if (value.length !== plan.stateSequence.length) {
    errors.add('Evidence stateSequence length does not match the plan.')
  }
  const entries: readonly unknown[] = value
  plan.stateSequence.forEach((expected, index) => {
    const actual = entries[index]
    if (!isRecord(actual)) {
      errors.add(`State sequence entry ${index} is missing.`)
      return
    }
    if (
      actual.id !== expected.id ||
      actual.kind !== expected.kind ||
      actual.sequenceIndex !== expected.sequenceIndex
    ) {
      errors.add(`State sequence entry ${index} does not match the plan.`)
    }
    if (canonicalJson(actual.actionsApplied) !== canonicalJson(expected.actions)) {
      errors.add(`State ${expected.id} did not record the planned actions.`)
    }
  })
}

function validateViewportEvidence(
  actual: unknown,
  expected: BrowserCaptureViewport,
): boolean {
  return (
    isRecord(actual) &&
    actual.id === expected.id &&
    actual.width === expected.width &&
    actual.height === expected.height &&
    numberNear(actual.deviceScaleFactor, expected.deviceScaleFactor)
  )
}

function parseCameraEvidence(
  actual: unknown,
): BrowserCaptureCameraAngle | null {
  if (!isRecord(actual)) return null
  const id = asString(actual.id)
  const yaw = asFiniteNumber(actual.yawDegrees)
  const pitch = asFiniteNumber(actual.pitchDegrees)
  const distance = asFiniteNumber(actual.distance)
  if (
    id === null ||
    !SAFE_ID_PATTERN.test(id) ||
    yaw === null ||
    pitch === null ||
    distance === null ||
    distance <= 0 ||
    !Array.isArray(actual.target) ||
    actual.target.length !== 3
  ) {
    return null
  }
  const target = actual.target.map((value) => asFiniteNumber(value))
  if (target.some((value) => value === null)) return null
  return {
    id,
    yawDegrees: yaw,
    pitchDegrees: pitch,
    distance,
    target: target as [number, number, number],
  }
}

function validateCameraEvidence(
  actual: unknown,
  expected: BrowserCaptureCameraAngle,
  strictPose: boolean,
): boolean {
  const parsed = parseCameraEvidence(actual)
  if (parsed === null || parsed.id !== expected.id) return false
  if (!strictPose) return true
  return (
    angleDistanceDegrees(parsed.yawDegrees, expected.yawDegrees) <= 0.1 &&
    Math.abs(parsed.pitchDegrees - expected.pitchDegrees) <= 0.1 &&
    Math.abs(parsed.distance - expected.distance) <= 0.001 &&
    expected.target.every((value, index) =>
      numberNear(parsed.target[index], value, 0.001),
    )
  )
}

function validateCaptureMetadata(
  plan: BrowserCapturePlan,
  request: BrowserCaptureRequest,
  actual: Record<string, unknown>,
  errors: ErrorSet,
): void {
  const label = request.id
  if (actual.actualLoadedGlbSha256 !== plan.finalGlb.sha256) {
    errors.add(`${label}: page-loaded GLB SHA does not match the final GLB.`)
  }
  if (!validateViewportEvidence(actual.viewport, request.viewport)) {
    errors.add(`${label}: viewport metadata does not match the plan.`)
  }
  if (
    !validateCameraEvidence(
      actual.cameraAngle,
      request.cameraAngle,
      request.state.kind === 'initial',
    )
  ) {
    errors.add(
      request.state.kind === 'initial'
        ? `${label}: camera angle metadata does not match the plan.`
        : `${label}: interaction camera metadata is invalid or does not retain its base camera ID.`,
    )
  }
  const state = isRecord(actual.state) ? actual.state : null
  if (
    state === null ||
    state.id !== request.state.id ||
    state.kind !== request.state.kind ||
    state.sequenceIndex !== request.state.sequenceIndex
  ) {
    errors.add(`${label}: initial/interaction state does not match the plan.`)
  }
  const animation = isRecord(actual.animation) ? actual.animation : null
  if (
    animation === null ||
    animation.clipName !== request.animation.clipName ||
    !numberNear(
      animation.requestedTimeSeconds,
      request.animation.requestedTimeSeconds,
    )
  ) {
    errors.add(`${label}: requested animation time does not match the plan.`)
  }
  if (
    animation === null ||
    !actualTimeMatches(
      request.animation.requestedTimeSeconds,
      animation.actualTimeSeconds,
      plan.animation.durationSeconds,
      plan.animation.actualTimeToleranceSeconds,
    )
  ) {
    errors.add(`${label}: actual animation time is outside tolerance.`)
  }
  if (animation === null || animation.paused !== true) {
    errors.add(`${label}: animation was not paused for the screenshot.`)
  }
}

async function verifyScreenshot(
  plan: BrowserCapturePlan,
  request: BrowserCaptureRequest,
  actual: Record<string, unknown>,
  captureRoot: string,
  errors: ErrorSet,
): Promise<VerifiedBrowserCaptureArtifact | null> {
  const label = request.id
  const screenshot = isRecord(actual.screenshot) ? actual.screenshot : null
  if (screenshot === null) {
    errors.add(`${label}: screenshot metadata is missing.`)
    return null
  }
  if (screenshot.relativePath !== request.screenshotRelativePath) {
    errors.add(`${label}: screenshot path does not match the plan.`)
  }
  if (screenshot.mediaType !== 'image/png') {
    errors.add(`${label}: screenshot media type must be image/png.`)
  }
  const absolutePath = await strictCaptureArtifactPath(
    captureRoot,
    screenshot.relativePath,
  )
  if (absolutePath === null) {
    errors.add(`${label}: screenshot path is unsafe.`)
    return null
  }
  const bytes = await readFile(absolutePath).catch(() => null)
  if (bytes === null) {
    errors.add(`${label}: screenshot file is missing.`)
    return null
  }
  const expectedWidth = Math.round(
    request.viewport.width * request.viewport.deviceScaleFactor,
  )
  const expectedHeight = Math.round(
    request.viewport.height * request.viewport.deviceScaleFactor,
  )
  const dimensions = await decodedPngDimensions(
    bytes,
    expectedWidth,
    expectedHeight,
  )
  if (dimensions === null) {
    errors.add(`${label}: screenshot is not a fully decodable PNG.`)
    return null
  }
  if (!dimensions.visuallyNonUniform) {
    errors.add(
      `${label}: screenshot is visually uniform and cannot serve as review evidence.`,
    )
  }
  const digest = { bytes: bytes.length, sha256: sha256(bytes) }
  if (screenshot.bytes !== digest.bytes || screenshot.sha256 !== digest.sha256) {
    errors.add(`${label}: screenshot file hash or byte count does not match.`)
  }
  if (
    screenshot.pixelWidth !== dimensions.width ||
    screenshot.pixelHeight !== dimensions.height
  ) {
    errors.add(`${label}: screenshot pixel dimensions do not match its PNG.`)
  }
  if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
    errors.add(`${label}: screenshot dimensions do not match the viewport.`)
  }
  const animation = isRecord(actual.animation) ? actual.animation : null
  return {
    requestId: request.id,
    viewportId: request.viewport.id,
    cameraAngleId: request.cameraAngle.id,
    cameraAngleRole:
      request.cameraAngle.id === plan.coverage.primaryCameraAngleId
        ? 'primary'
        : 'auxiliary',
    stateId: request.state.id,
    stateKind: request.state.kind,
    stateSequenceIndex: request.state.sequenceIndex,
    requestedTimeSeconds: request.animation.requestedTimeSeconds,
    actualTimeSeconds:
      asFiniteNumber(animation?.actualTimeSeconds) ?? Number.NaN,
    animationDurationSeconds: plan.animation.durationSeconds,
    actualTimeToleranceSeconds: plan.animation.actualTimeToleranceSeconds,
    purposes: request.purposes,
    actualCameraAngle: parseCameraEvidence(actual.cameraAngle) ?? request.cameraAngle,
    relativePath: request.screenshotRelativePath,
    absolutePath,
    ...digest,
    pixelWidth: dimensions.width,
    pixelHeight: dimensions.height,
  }
}

function cameraTargetDistance(
  left: BrowserCaptureCameraAngle,
  right: BrowserCaptureCameraAngle,
): number {
  return Math.sqrt(
    left.target.reduce((sum, value, index) => {
      const delta = value - right.target[index]
      return sum + delta * delta
    }, 0),
  )
}

function validateInteractionEffects(
  plan: BrowserCapturePlan,
  artifacts: readonly VerifiedBrowserCaptureArtifact[],
  errors: ErrorSet,
): void {
  const artifactsByRequest = new Map(
    artifacts.map((artifact) => [artifact.requestId, artifact]),
  )
  const initialState = plan.stateSequence[0]
  for (const request of plan.requests.filter(
    ({ state }) => state.kind === 'interaction',
  )) {
    const interaction = artifactsByRequest.get(request.id)
    if (!interaction) continue
    const initialRequest = plan.requests.find(
      (candidate) =>
        candidate.viewport.id === request.viewport.id &&
        candidate.cameraAngle.id === request.cameraAngle.id &&
        candidate.state.id === initialState.id &&
        candidate.animation.requestedTimeSeconds ===
          request.animation.requestedTimeSeconds,
    )
    const baseline = initialRequest
      ? artifactsByRequest.get(initialRequest.id)
      : undefined
    if (!baseline) {
      errors.add(
        `${request.id}: interaction evidence has no matching initial-state capture.`,
      )
      continue
    }
    if (interaction.sha256 === baseline.sha256) {
      errors.add(
        `${request.id}: interaction screenshot is byte-identical to its initial-state capture.`,
      )
    }
    const actions = plan.stateSequence
      .slice(1, request.state.sequenceIndex + 1)
      .flatMap(({ actions: stateActions }) => stateActions)
    const zoomDelta = actions.reduce(
      (sum, action) =>
        action.command === 'zoom' ? sum + action.delta : sum,
      0,
    )
    if (zoomDelta < 0 && interaction.actualCameraAngle.distance >= baseline.actualCameraAngle.distance - 0.001) {
      errors.add(
        `${request.id}: zoom-in interaction did not reduce the observed camera distance.`,
      )
    }
    if (zoomDelta > 0 && interaction.actualCameraAngle.distance <= baseline.actualCameraAngle.distance + 0.001) {
      errors.add(
        `${request.id}: zoom-out interaction did not increase the observed camera distance.`,
      )
    }
    const orbit = actions.reduce(
      (sum, action) =>
        action.command === 'orbit'
          ? {
              yaw: sum.yaw + action.yawDeltaDegrees,
              pitch: sum.pitch + action.pitchDeltaDegrees,
            }
          : sum,
      { yaw: 0, pitch: 0 },
    )
    if (
      orbit.yaw !== 0 &&
      angleDistanceDegrees(
        interaction.actualCameraAngle.yawDegrees,
        baseline.actualCameraAngle.yawDegrees + orbit.yaw,
      ) > 0.2
    ) {
      errors.add(
        `${request.id}: observed yaw does not reflect the declared orbit interaction.`,
      )
    }
    if (
      orbit.pitch !== 0 &&
      Math.abs(
        interaction.actualCameraAngle.pitchDegrees -
          (baseline.actualCameraAngle.pitchDegrees + orbit.pitch),
      ) > 0.2
    ) {
      errors.add(
        `${request.id}: observed pitch does not reflect the declared orbit interaction.`,
      )
    }
    const panMagnitude = actions.reduce(
      (sum, action) =>
        action.command === 'pan'
          ? sum + Math.abs(action.xPixels) + Math.abs(action.yPixels)
          : sum,
      0,
    )
    if (
      panMagnitude > 0 &&
      cameraTargetDistance(
        interaction.actualCameraAngle,
        baseline.actualCameraAngle,
      ) <= 0.001
    ) {
      errors.add(
        `${request.id}: pan interaction did not change the observed camera target.`,
      )
    }
  }
}

async function validateGlobalBaseline(
  plan: BrowserCapturePlan,
  value: unknown,
): Promise<BrowserCaptureValidationReport['globalBaseline']> {
  const errors = new ErrorSet()
  const required = true
  const expectedId = plan.globalBaseline.id
  if (value === undefined) {
    errors.add('Required global baseline evidence is missing.')
    return {
      id: expectedId,
      required,
      provided: false,
      pass: false,
      errors: errors.list(),
      report: null,
    }
  }
  if (!isRecord(value)) {
    errors.add('Global baseline evidence must be an object.')
    return {
      id: expectedId,
      required,
      provided: true,
      pass: false,
      errors: errors.list(),
      report: null,
    }
  }
  try {
    assertExactKeys(value, ['id', 'reportSha256'], [], 'globalBaseline')
  } catch (error) {
    errors.add(error instanceof Error ? error.message : String(error))
  }
  const actualId = asString(value.id)
  if (actualId === null || !SAFE_ID_PATTERN.test(actualId)) {
    errors.add('Global baseline ID must be a lowercase filesystem-safe ID.')
  }
  if (expectedId !== null && actualId !== expectedId) {
    errors.add('Global baseline ID does not match the capture plan.')
  }
  const expectedReport = plan.globalBaseline.report
  if (value.reportSha256 !== expectedReport.sha256) {
    errors.add('Global baseline report SHA does not match the capture plan.')
  }
  const actualReport = await fileDigest(expectedReport.path).catch(() => null)
  if (
    actualReport === null ||
    actualReport.bytes !== expectedReport.bytes ||
    actualReport.sha256 !== expectedReport.sha256
  ) {
    errors.add('Global baseline report changed or disappeared after planning.')
  } else {
    await assertPassingBaselineReport(expectedReport.path).catch((error) => {
      errors.add(
        `Global baseline report is not a passing machine report: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    })
  }
  return {
    id: actualId ?? expectedId,
    required,
    provided: true,
    pass: errors.values.size === 0,
    errors: errors.list(),
    report:
      actualReport === null
        ? null
        : { path: expectedReport.path, ...actualReport },
  }
}

export async function validateBrowserCaptureEvidence(
  plan: BrowserCapturePlan,
  evidence: unknown,
  captureRoot: string,
): Promise<BrowserCaptureValidationReport> {
  const verifiedPlan = parseBrowserCapturePlan(plan)
  const candidateErrors = new ErrorSet()
  const value = isRecord(evidence) ? evidence : null
  if (value === null) {
    candidateErrors.add('Browser capture evidence must be an object.')
  } else {
    validateEvidenceHeader(verifiedPlan, value, candidateErrors)
    validateStateEvidence(verifiedPlan, value.stateSequence, candidateErrors)
  }

  const currentFinalGlb = await fileDigest(verifiedPlan.finalGlb.path).catch(
    () => null,
  )
  if (
    currentFinalGlb === null ||
    currentFinalGlb.bytes !== verifiedPlan.finalGlb.bytes ||
    currentFinalGlb.sha256 !== verifiedPlan.finalGlb.sha256
  ) {
    candidateErrors.add('Final GLB changed or disappeared after plan creation.')
  }

  const captures = value && Array.isArray(value.captures) ? value.captures : []
  if (!value || !Array.isArray(value.captures)) {
    candidateErrors.add('Evidence captures must be an array.')
  }
  const byRequest = new Map<string, Record<string, unknown>>()
  for (const capture of captures) {
    if (!isRecord(capture) || typeof capture.requestId !== 'string') {
      candidateErrors.add('Capture entry is missing a requestId.')
      continue
    }
    if (byRequest.has(capture.requestId)) {
      candidateErrors.add(`Duplicate capture requestId ${capture.requestId}.`)
      continue
    }
    byRequest.set(capture.requestId, capture)
  }
  const expectedIds = new Set(verifiedPlan.requests.map(({ id }) => id))
  for (const actualId of byRequest.keys()) {
    if (!expectedIds.has(actualId)) {
      candidateErrors.add(`Unexpected capture requestId ${actualId}.`)
    }
  }
  const artifacts: VerifiedBrowserCaptureArtifact[] = []
  for (const request of verifiedPlan.requests) {
    const actual = byRequest.get(request.id)
    if (actual === undefined) {
      candidateErrors.add(`Missing planned capture ${request.id}.`)
      continue
    }
    const errorsBeforeCapture = candidateErrors.size()
    validateCaptureMetadata(verifiedPlan, request, actual, candidateErrors)
    const artifact = await verifyScreenshot(
      verifiedPlan,
      request,
      actual,
      captureRoot,
      candidateErrors,
    )
    if (
      artifact !== null &&
      candidateErrors.size() === errorsBeforeCapture
    ) {
      artifacts.push(artifact)
    }
  }
  validateInteractionEffects(verifiedPlan, artifacts, candidateErrors)
  const globalBaseline = await validateGlobalBaseline(
    verifiedPlan,
    value?.globalBaseline,
  )
  const candidateErrorList = candidateErrors.list()
  const candidatePass = candidateErrorList.length === 0
  return {
    schemaVersion: browserCaptureSchemaVersion,
    kind: 'headed-browser-capture-validation',
    planId: verifiedPlan.planId,
    planSha256: verifiedPlan.planSha256,
    animalId: verifiedPlan.animalId,
    candidate: {
      pass: candidatePass,
      errors: candidateErrorList,
      expectedCaptureCount: verifiedPlan.requests.length,
      verifiedCaptureCount: artifacts.length,
      artifacts,
    },
    globalBaseline,
    pass: candidatePass && globalBaseline.pass,
    provenance: {
      assurance: 'collector-attested',
      cryptographicallyVerified: false,
      collector:
        value && isRecord(value.browser)
          ? asString(value.browser.collector)
          : null,
      collectorTaskId:
        value && isRecord(value.browser)
          ? asString(value.browser.collectorTaskId)
          : null,
      warning: browserCaptureProvenanceWarning,
    },
  }
}

export const ingestBrowserCaptureEvidence = validateBrowserCaptureEvidence
export const ingestHeadedBrowserCapture = validateBrowserCaptureEvidence

export async function ingestBrowserCaptureEvidenceFile(
  plan: BrowserCapturePlan,
  metadataPath: string,
): Promise<BrowserCaptureValidationReport> {
  const absoluteMetadataPath = resolve(metadataPath)
  const metadataBytes = await readFile(absoluteMetadataPath)
  const evidence = JSON.parse(metadataBytes.toString('utf8')) as unknown
  const report = await validateBrowserCaptureEvidence(
    plan,
    evidence,
    dirname(absoluteMetadataPath),
  )
  return {
    ...report,
    sourceMetadata: {
      path: absoluteMetadataPath,
      bytes: metadataBytes.length,
      sha256: sha256(metadataBytes),
    },
  }
}

export async function ingestBrowserCaptureEvidenceFiles(
  planPath: string,
  metadataPath: string,
): Promise<BrowserCaptureValidationReport> {
  const absolutePlanPath = resolve(planPath)
  const planBytes = await readFile(absolutePlanPath)
  const plan = parseBrowserCapturePlan(
    JSON.parse(planBytes.toString('utf8')) as unknown,
  )
  const report = await ingestBrowserCaptureEvidenceFile(plan, metadataPath)
  return {
    ...report,
    sourcePlan: {
      path: absolutePlanPath,
      bytes: planBytes.length,
      sha256: sha256(planBytes),
    },
  }
}

export interface ProfileBoundBrowserCaptureValidation {
  readonly report: BrowserCaptureValidationReport
  readonly plan: BrowserCapturePlan
  readonly validationPath: string
  readonly sourcePlanPath: string
  readonly sourceMetadataPath: string
}

async function assertPlanMatchesCurrentProfileModel(
  plan: BrowserCapturePlan,
  animalId: string,
  modelOutputPath: string,
): Promise<void> {
  if (plan.animalId !== animalId) {
    throw new Error('Capture plan animalId does not match the current profile.')
  }
  const expectedModelPath = resolve(modelOutputPath)
  if (plan.finalGlb.path !== expectedModelPath) {
    throw new Error(
      'Capture plan finalGlb.path does not match the current profile.model.outputPath.',
    )
  }
  const [plannedEntry, expectedEntry] = await Promise.all([
    lstat(plan.finalGlb.path).catch(() => null),
    lstat(expectedModelPath).catch(() => null),
  ])
  if (
    plannedEntry === null ||
    expectedEntry === null ||
    !plannedEntry.isFile() ||
    !expectedEntry.isFile() ||
    plannedEntry.isSymbolicLink() ||
    expectedEntry.isSymbolicLink()
  ) {
    throw new Error('Capture plan and profile must reference a real non-symlink GLB file.')
  }
  const [plannedRealPath, expectedRealPath, currentDigest] = await Promise.all([
    realpath(plan.finalGlb.path),
    realpath(expectedModelPath),
    fileDigest(expectedModelPath),
  ])
  if (plannedRealPath !== expectedRealPath) {
    throw new Error('Capture plan finalGlb resolves to a different file than the current profile model.')
  }
  if (
    plan.finalGlb.bytes !== currentDigest.bytes ||
    plan.finalGlb.sha256 !== currentDigest.sha256
  ) {
    throw new Error(
      'Capture plan finalGlb bytes or SHA-256 do not match the current profile model.',
    )
  }
}

/**
 * Rebuild the headed-capture validation from the immutable plan and browser
 * evidence, while binding every source back to the current onboarding run and
 * current profile model. A stored validation report is only a cache: it must be
 * byte-for-byte equivalent at the data level to this fresh recomputation.
 */
export async function verifyBrowserCaptureValidationForProfile(input: {
  readonly animalId: string
  readonly runDirectory: string
  readonly modelOutputPath: string
  readonly validationPath: string
}): Promise<ProfileBoundBrowserCaptureValidation> {
  const validationPath = await assertStrictNonSymlinkChildFile(
    input.runDirectory,
    input.validationPath,
    'Browser capture validation report',
  )
  const storedValue = JSON.parse(
    await readFile(validationPath, 'utf8'),
  ) as unknown
  const stored = requiredRecord(
    storedValue,
    'browserCaptureValidation',
  ) as unknown as BrowserCaptureValidationReport
  const sourcePlanPath = requiredString(
    requiredRecord(stored.sourcePlan, 'browserCaptureValidation.sourcePlan').path,
    'browserCaptureValidation.sourcePlan.path',
  )
  const sourceMetadataPath = requiredString(
    requiredRecord(
      stored.sourceMetadata,
      'browserCaptureValidation.sourceMetadata',
    ).path,
    'browserCaptureValidation.sourceMetadata.path',
  )
  const strictPlanPath = await assertStrictNonSymlinkChildFile(
    input.runDirectory,
    sourcePlanPath,
    'Browser capture source plan',
  )
  const strictMetadataPath = await assertStrictNonSymlinkChildFile(
    input.runDirectory,
    sourceMetadataPath,
    'Browser capture source evidence',
  )
  const plan = await loadBrowserCapturePlan(strictPlanPath)
  await assertPlanMatchesCurrentProfileModel(
    plan,
    input.animalId,
    input.modelOutputPath,
  )
  const recomputed = await ingestBrowserCaptureEvidenceFiles(
    strictPlanPath,
    strictMetadataPath,
  )
  if (!isDeepStrictEqual(storedValue, recomputed)) {
    throw new Error(
      'Stored browser capture validation is stale or does not deeply match freshly ingested evidence.',
    )
  }
  return {
    report: recomputed,
    plan,
    validationPath,
    sourcePlanPath: strictPlanPath,
    sourceMetadataPath: strictMetadataPath,
  }
}
