import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { verifyCurrentBrowserCapture } from '../src/agent-review'
import {
  browserCapturePlanDigest,
  browserCaptureCollectorAttestation,
  createBrowserCapturePlan,
  ingestBrowserCaptureEvidenceFile,
  ingestBrowserCaptureEvidenceFiles,
  maximumFullLoopSampleCount,
  parseBrowserCapturePlan,
  requiredBrowserCaptureViewports,
  validateBrowserCaptureEvidence,
  verifyBrowserCaptureValidationForProfile,
  type BrowserCaptureEvidence,
  type BrowserCaptureEvidenceArtifact,
  type BrowserCapturePlan,
} from '../src/browser-capture'
import { sha256 } from '../src/io'
import type { AnimalOnboardingProfile } from '../src/types'

const testDirectory =
  new URL(import.meta.url).protocol === 'file:'
    ? dirname(fileURLToPath(import.meta.url))
    : resolve(process.cwd(), 'tools/animal-onboarding/tests')

async function validPng(
  width: number,
  height: number,
  marker: number,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: marker % 255,
        g: (marker * 37) % 255,
        b: (marker * 71) % 255,
        alpha: 1,
      },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${width}" height="${height}"><defs><linearGradient id="g"><stop stop-color="#000000" stop-opacity=".15"/><stop offset="1" stop-color="#ffffff" stop-opacity=".35"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><rect x="${10 + (marker % 40)}" y="10" width="80" height="80" fill="#ffffff"/></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer()
}

function fakeSignatureOnlyPng(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(33)
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  bytes[24] = 8
  bytes[25] = 6
  return bytes
}

async function planFixture(
  root: string,
  glbPath = join(root, 'review', 'model.glb'),
  glbBytes = Buffer.from('final-candidate-glb'),
): Promise<BrowserCapturePlan> {
  const baselineReportPath = join(root, 'production-baseline-report.json')
  await mkdir(dirname(glbPath), { recursive: true })
  await writeFile(glbPath, glbBytes)
  await writeFile(
    baselineReportPath,
    `${JSON.stringify({ pass: true, checked: 3, errors: [] }, null, 2)}\n`,
  )
  return createBrowserCapturePlan({
    animalId: 'test-animal',
    finalGlbPath: glbPath,
    reviewUrl: 'http://127.0.0.1:4175/',
    generatedAt: '2026-08-31T00:00:00.000Z',
    viewports: requiredBrowserCaptureViewports,
    cameraAngles: [
      {
        id: 'front-left',
        yawDegrees: -35,
        pitchDegrees: 8,
        distance: 4.5,
        target: [0, 0.5, 0],
      },
      {
        id: 'rear-right',
        yawDegrees: 145,
        pitchDegrees: 8,
        distance: 4.5,
        target: [0, 0.5, 0],
      },
    ],
    animation: {
      clipName: 'Idle',
      durationSeconds: 8,
      sampleTimesSeconds: [0, 2, 4, 6, 8],
      actualTimeToleranceSeconds: 0.01,
    },
    stateSequence: [
      {
        id: 'initial',
        kind: 'initial',
        actions: [{ command: 'reset-view' }],
        captureFullLoop: true,
      },
      {
        id: 'zoomed',
        kind: 'interaction',
        actions: [{ command: 'zoom', delta: -480 }],
      },
    ],
    globalBaseline: {
      id: 'production-golden',
      required: true,
      reportPath: baselineReportPath,
    },
  })
}

async function persistedCaptureFixture(
  runDirectory: string,
  modelPath = join(runDirectory, 'review', 'model.glb'),
  modelBytes = Buffer.from('final-candidate-glb'),
): Promise<{
  readonly modelPath: string
  readonly planPath: string
  readonly metadataPath: string
  readonly validationPath: string
}> {
  const plan = await planFixture(runDirectory, modelPath, modelBytes)
  const evidence = await evidenceFixture(plan, runDirectory)
  const planPath = join(runDirectory, 'browser-capture-plan.json')
  const metadataPath = join(runDirectory, 'browser-capture-evidence.json')
  const validationPath = join(
    runDirectory,
    'browser-capture-validation.json',
  )
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`)
  await writeFile(metadataPath, `${JSON.stringify(evidence, null, 2)}\n`)
  const report = await ingestBrowserCaptureEvidenceFiles(
    planPath,
    metadataPath,
  )
  await writeFile(validationPath, `${JSON.stringify(report, null, 2)}\n`)
  return { modelPath, planPath, metadataPath, validationPath }
}

function captureProfile(
  runDirectory: string,
  modelOutputPath: string,
): AnimalOnboardingProfile {
  return {
    id: 'test-animal',
    runDirectory,
    model: { outputPath: modelOutputPath },
  } as AnimalOnboardingProfile
}

async function evidenceFixture(
  plan: BrowserCapturePlan,
  root: string,
): Promise<BrowserCaptureEvidence> {
  const captures: BrowserCaptureEvidenceArtifact[] = []
  for (const [index, request] of plan.requests.entries()) {
    const screenshotBytes = await validPng(
      request.viewport.width * request.viewport.deviceScaleFactor,
      request.viewport.height * request.viewport.deviceScaleFactor,
      index,
    )
    const screenshotPath = resolve(root, request.screenshotRelativePath)
    await mkdir(dirname(screenshotPath), { recursive: true })
    await writeFile(screenshotPath, screenshotBytes)
    captures.push({
      requestId: request.id,
      actualLoadedGlbSha256: plan.finalGlb.sha256,
      viewport: request.viewport,
      cameraAngle:
        request.state.kind === 'interaction'
          ? { ...request.cameraAngle, distance: request.cameraAngle.distance - 1 }
          : request.cameraAngle,
      state: request.state,
      animation: {
        clipName: request.animation.clipName,
        requestedTimeSeconds: request.animation.requestedTimeSeconds,
        // A loop endpoint may truthfully report the wrapped animation time.
        actualTimeSeconds:
          request.animation.requestedTimeSeconds ===
          plan.animation.durationSeconds
            ? 0
            : request.animation.requestedTimeSeconds,
        paused: true,
      },
      screenshot: {
        relativePath: request.screenshotRelativePath,
        mediaType: 'image/png',
        bytes: screenshotBytes.length,
        sha256: sha256(screenshotBytes),
        pixelWidth: request.viewport.width,
        pixelHeight: request.viewport.height,
      },
    })
  }
  return {
    schemaVersion: 1,
    kind: 'headed-browser-capture-evidence',
    planId: plan.planId,
    planSha256: plan.planSha256,
    animalId: plan.animalId,
    capturedAt: '2026-08-31T01:00:00.000Z',
    browser: {
      controlSurface: 'Browser',
      headed: true,
      collector: 'Capture Agent',
      collectorTaskId: '/capture/test-animal',
      attestation: browserCaptureCollectorAttestation,
      userAgent: 'headed-test-browser',
    },
    finalGlbSha256: plan.finalGlb.sha256,
    page: {
      url: plan.reviewUrl,
      actualLoadedGlbSha256: plan.finalGlb.sha256,
    },
    stateSequence: plan.stateSequence.map((state) => ({
      id: state.id,
      kind: state.kind,
      sequenceIndex: state.sequenceIndex,
      actionsApplied: state.actions,
    })),
    captures,
    globalBaseline: {
      id: 'production-golden',
      reportSha256: plan.globalBaseline.report.sha256,
    },
  }
}

function globalBaselineFrom(plan: BrowserCapturePlan) {
  return {
    id: plan.globalBaseline.id,
    required: true as const,
    reportPath: plan.globalBaseline.report.path,
  }
}

describe('headed Browser/Chrome capture plan', () => {
  it('builds an animal-agnostic multi-view, full-loop execution plan', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-plan-'))
    const plan = await planFixture(root)

    expect(plan.execution).toEqual({
      driver: 'Browser-or-Chrome-control',
      headedRequired: true,
      launchesBrowser: false,
    })
    expect(plan.animalId).toBe('test-animal')
    expect(plan.finalGlb.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(plan.cameraAngles).toHaveLength(2)
    expect(plan.animation.fullLoopSampleTimesSeconds).toEqual([0, 2, 4, 6, 8])
    expect(plan.stateSequence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial',
          fullLoop: true,
          captureTimesSeconds: [0, 2, 4, 6, 8],
        }),
        expect.objectContaining({
          id: 'zoomed',
          fullLoop: false,
          captureTimesSeconds: [0],
        }),
      ]),
    )
    expect(plan.coverage).toEqual({
      mode: 'review-efficient',
      primaryViewportId: 'desktop',
      primaryCameraAngleId: 'front-left',
      auxiliaryCameraAngleIds: ['rear-right'],
    })
    expect(plan.requests).toHaveLength(15)
    expect(
      plan.requests.filter(({ purposes }) => purposes.includes('full-loop')),
    ).toHaveLength(10)
    for (const cameraAngle of plan.cameraAngles) {
      expect(
        plan.requests
          .filter(
            (request) =>
              request.cameraAngle.id === cameraAngle.id &&
              request.state.kind === 'initial' &&
              request.purposes.includes('full-loop'),
          )
          .map(({ animation }) => animation.requestedTimeSeconds),
      ).toEqual([0, 2, 4, 6, 8])
    }
    expect(
      plan.requests.every((request) =>
        request.screenshotRelativePath.startsWith(
          'candidate/test-animal/',
        ),
      ),
    ).toBe(true)
    expect(plan.requests[0]?.instructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'wait-for-loaded-glb-sha' }),
        expect.objectContaining({ command: 'assert-animation-paused' }),
        expect.objectContaining({ command: 'record-capture-metadata' }),
      ]),
    )
    const zoomInstructions = plan.requests.find(
      ({ state }) => state.id === 'zoomed',
    )!.instructions
    expect(
      zoomInstructions.filter(({ command }) => command === 'apply-state'),
    ).toEqual([
      expect.objectContaining({ actions: [{ command: 'reset-view' }] }),
      expect.objectContaining({ actions: [{ command: 'zoom', delta: -480 }] }),
    ])
    const instructionCommands = zoomInstructions.map(({ command }) => command)
    expect(instructionCommands.indexOf('set-camera-angle')).toBeLessThan(
      instructionCommands.lastIndexOf('apply-state'),
    )
  })

  it('supports an explicit exhaustive capture mode for investigations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-plan-'))
    const base = await planFixture(root)
    const plan = await createBrowserCapturePlan({
      animalId: base.animalId,
      finalGlbPath: base.finalGlb.path,
      reviewUrl: base.reviewUrl,
      viewports: base.viewports,
      cameraAngles: base.cameraAngles,
      captureMode: 'exhaustive',
      animation: {
        clipName: 'Idle',
        durationSeconds: 8,
        sampleTimesSeconds: [0, 2, 4, 6, 8],
      },
      stateSequence: [
        {
          id: 'initial',
          kind: 'initial',
          actions: [{ command: 'reset-view' }],
          captureFullLoop: true,
        },
        {
          id: 'zoomed',
          kind: 'interaction',
          actions: [{ command: 'zoom', delta: -480 }],
        },
      ],
      globalBaseline: globalBaselineFrom(base),
    })

    expect(plan.coverage.mode).toBe('exhaustive')
    expect(plan.requests).toHaveLength(60)
    expect(
      plan.requests.every(({ purposes }) => purposes.includes('exhaustive')),
    ).toBe(true)
  })

  it('accepts an ordered dense superset of the mandatory loop checkpoints', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-dense-plan-'))
    const base = await planFixture(root)
    const denseTimes = Array.from({ length: 33 }, (_, index) => index / 4)
    const plan = await createBrowserCapturePlan({
      animalId: base.animalId,
      finalGlbPath: base.finalGlb.path,
      reviewUrl: base.reviewUrl,
      viewports: base.viewports,
      cameraAngles: base.cameraAngles,
      animation: {
        durationSeconds: 8,
        sampleTimesSeconds: denseTimes,
      },
      stateSequence: [
        {
          id: 'initial',
          kind: 'initial',
          actions: [{ command: 'reset-view' }],
          captureFullLoop: true,
        },
        {
          id: 'zoomed',
          kind: 'interaction',
          actions: [{ command: 'zoom', delta: -480 }],
        },
      ],
      globalBaseline: globalBaselineFrom(base),
    })

    expect(plan.animation.fullLoopSampleTimesSeconds).toEqual(denseTimes)
    expect(plan.animation.maximumSampleGapSeconds).toBe(0.25)
    expect(
      plan.requests.filter(({ purposes }) => purposes.includes('full-loop')),
    ).toHaveLength(66)
    expect(plan.requests).toHaveLength(71)
    expect(parseBrowserCapturePlan(JSON.parse(JSON.stringify(plan)))).toEqual(
      plan,
    )
  })

  it('rejects dense loop samples that omit a mandatory checkpoint or violate ordering, uniqueness, range, or the count cap', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-dense-invalid-'))
    const base = await planFixture(root)
    const denseTimes = Array.from({ length: 33 }, (_, index) => index / 4)
    const inputFor = (sampleTimesSeconds: readonly number[]) => ({
      animalId: base.animalId,
      finalGlbPath: base.finalGlb.path,
      reviewUrl: base.reviewUrl,
      viewports: base.viewports,
      cameraAngles: base.cameraAngles,
      animation: { durationSeconds: 8, sampleTimesSeconds },
      stateSequence: [
        {
          id: 'initial',
          kind: 'initial' as const,
          actions: [{ command: 'reset-view' as const }],
        },
        {
          id: 'zoomed',
          kind: 'interaction' as const,
          actions: [{ command: 'zoom' as const, delta: -480 }],
        },
      ],
      globalBaseline: globalBaselineFrom(base),
    })

    await expect(
      createBrowserCapturePlan(inputFor(denseTimes.filter((time) => time !== 2))),
    ).rejects.toThrow(/mandatory 0\/2\/4\/6\/8/)
    await expect(
      createBrowserCapturePlan(
        inputFor([denseTimes[0], denseTimes[1], denseTimes[1], ...denseTimes.slice(2)]),
      ),
    ).rejects.toThrow(/duplicate sample times/)
    await expect(
      createBrowserCapturePlan(
        inputFor([denseTimes[0], denseTimes[2], denseTimes[1], ...denseTimes.slice(3)]),
      ),
    ).rejects.toThrow(/strictly increasing order/)
    await expect(
      createBrowserCapturePlan(inputFor([-0.25, ...denseTimes.slice(1)])),
    ).rejects.toThrow(/inside the full loop/)
    await expect(
      createBrowserCapturePlan(
        inputFor(
          Array.from(
            { length: maximumFullLoopSampleCount + 1 },
            (_, index) => Number(((index * 8) / maximumFullLoopSampleCount).toFixed(6)),
          ),
        ),
      ),
    ).rejects.toThrow(/at most 257 samples/)
  })

  it('strictly parses the canonical plan and rejects removed or edited requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-plan-tamper-'))
    const plan = await planFixture(root)

    expect(parseBrowserCapturePlan(JSON.parse(JSON.stringify(plan)))).toEqual(
      plan,
    )

    const removedRequestPlan = {
      ...plan,
      requests: plan.requests.slice(0, -1),
    }
    expect(() => parseBrowserCapturePlan(removedRequestPlan)).toThrow(
      /requests were removed, edited, reordered/,
    )

    const editedRequestPlan = {
      ...plan,
      requests: plan.requests.map((request, index) =>
        index === 0
          ? { ...request, screenshotRelativePath: 'candidate/tampered.png' }
          : request,
      ),
    }
    const recomputedSha = browserCapturePlanDigest(editedRequestPlan)
    const recomputedIdentityPlan = {
      ...editedRequestPlan,
      planSha256: recomputedSha,
      planId: `headed-${plan.animalId}-${recomputedSha.slice(0, 16)}`,
    }
    expect(() => parseBrowserCapturePlan(recomputedIdentityPlan)).toThrow(
      /requests were removed, edited, reordered/,
    )

    const missingBaseline = { ...plan } as Record<string, unknown>
    delete missingBaseline.globalBaseline
    expect(() => parseBrowserCapturePlan(missingBaseline)).toThrow(
      /globalBaseline is required/,
    )
  })

  it('captures every declared angle for the full loop without a viewport Cartesian product', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-plan-'))
    const base = await planFixture(root)
    const plan = await createBrowserCapturePlan({
      animalId: base.animalId,
      finalGlbPath: base.finalGlb.path,
      reviewUrl: base.reviewUrl,
      viewports: requiredBrowserCaptureViewports,
      cameraAngles: [
        ...base.cameraAngles,
        {
          id: 'profile',
          yawDegrees: 90,
          pitchDegrees: 8,
          distance: 4.5,
          target: [0, 0.5, 0],
        },
      ],
      animation: {
        durationSeconds: 8,
      },
      stateSequence: [
        {
          id: 'initial',
          kind: 'initial',
          actions: [{ command: 'reset-view' }],
          captureFullLoop: true,
        },
        {
          id: 'zoomed',
          kind: 'interaction',
          actions: [{ command: 'zoom', delta: -480 }],
        },
        {
          id: 'orbited',
          kind: 'interaction',
          actions: [
            {
              command: 'orbit',
              yawDeltaDegrees: 30,
              pitchDeltaDegrees: 0,
            },
          ],
        },
      ],
      globalBaseline: globalBaselineFrom(base),
    })

    expect(plan.requests).toHaveLength(21)
    expect(plan.animation.fullLoopSampleTimesSeconds).toEqual([0, 2, 4, 6, 8])
    expect(
      plan.requests.filter(({ purposes }) =>
        purposes.includes('viewport-initial'),
      ),
    ).toHaveLength(5)
    expect(
      plan.requests.filter(({ purposes }) =>
        purposes.includes('auxiliary-angle'),
      ),
    ).toHaveLength(10)
    expect(
      plan.requests.filter(({ purposes }) => purposes.includes('full-loop')),
    ).toHaveLength(15)
    expect(
      new Set(
        plan.requests
          .filter(({ purposes }) => purposes.includes('interaction'))
          .map(({ state }) => state.id),
      ),
    ).toEqual(new Set(['zoomed', 'orbited']))
    expect(plan.requests.length).toBeLessThan(5 * 3 * 6)
  })

  it('rejects changed viewport contracts, loop samples, or one camera view', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-plan-'))
    const plan = await planFixture(root)
    await expect(
      createBrowserCapturePlan({
        animalId: plan.animalId,
        finalGlbPath: plan.finalGlb.path,
        reviewUrl: plan.reviewUrl,
        viewports: plan.viewports,
        cameraAngles: plan.cameraAngles.slice(0, 1),
        animation: {
          durationSeconds: 8,
          sampleTimesSeconds: [0, 2, 4, 6, 8],
        },
        stateSequence: [
          {
            id: 'initial',
            kind: 'initial',
            actions: [{ command: 'reset-view' }],
          },
          {
            id: 'zoomed',
            kind: 'interaction',
            actions: [{ command: 'zoom', delta: -480 }],
          },
        ],
        globalBaseline: globalBaselineFrom(plan),
      }),
    ).rejects.toThrow(/one primary and one or two auxiliary/)

    await expect(
      createBrowserCapturePlan({
        animalId: plan.animalId,
        finalGlbPath: plan.finalGlb.path,
        reviewUrl: plan.reviewUrl,
        viewports: plan.viewports,
        cameraAngles: plan.cameraAngles,
        animation: {
          durationSeconds: 8,
          sampleTimesSeconds: [0, 1, 3, 5, 7, 8],
        },
        stateSequence: [
          {
            id: 'initial',
            kind: 'initial',
            actions: [{ command: 'reset-view' }],
          },
          {
            id: 'zoomed',
            kind: 'interaction',
            actions: [{ command: 'zoom', delta: -480 }],
          },
        ],
        globalBaseline: globalBaselineFrom(plan),
      }),
    ).rejects.toThrow(/0\/2\/4\/6\/8/)

    await expect(
      createBrowserCapturePlan({
        animalId: plan.animalId,
        finalGlbPath: plan.finalGlb.path,
        reviewUrl: plan.reviewUrl,
        viewports: plan.viewports.map((viewport) =>
          viewport.id === 'phone-compact'
            ? { ...viewport, width: 361 }
            : viewport,
        ),
        cameraAngles: plan.cameraAngles,
        animation: { durationSeconds: 8 },
        stateSequence: [
          {
            id: 'initial',
            kind: 'initial',
            actions: [{ command: 'reset-view' }],
          },
          {
            id: 'zoomed',
            kind: 'interaction',
            actions: [{ command: 'zoom', delta: -480 }],
          },
        ],
        globalBaseline: globalBaselineFrom(plan),
      }),
    ).rejects.toThrow(/phone-compact must be 360x640/)
  })

  it('does not allow a declared camera angle to be omitted from review-efficient coverage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-angle-coverage-'))
    const base = await planFixture(root)
    await expect(
      createBrowserCapturePlan({
        animalId: base.animalId,
        finalGlbPath: base.finalGlb.path,
        reviewUrl: base.reviewUrl,
        viewports: base.viewports,
        cameraAngles: [
          ...base.cameraAngles,
          {
            id: 'rear',
            yawDegrees: 215,
            pitchDegrees: 8,
            distance: 4.5,
            target: [0, 0.5, 0],
          },
        ],
        primaryCameraAngleId: 'front-left',
        auxiliaryCameraAngleIds: ['rear-right'],
        animation: { durationSeconds: 8 },
        stateSequence: [
          {
            id: 'initial',
            kind: 'initial',
            actions: [{ command: 'reset-view' }],
          },
          {
            id: 'zoomed',
            kind: 'interaction',
            actions: [{ command: 'zoom', delta: -480 }],
          },
        ],
        globalBaseline: globalBaselineFrom(base),
      }),
    ).rejects.toThrow(/every non-primary camera angle/)
  })
})

describe('headed capture evidence ingestion', () => {
  it('verifies captured metadata, PNG dimensions and every file digest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-evidence-'))
    const plan = await planFixture(root)
    const evidence = await evidenceFixture(plan, root)
    const metadataPath = join(root, 'capture-metadata.json')
    await writeFile(metadataPath, `${JSON.stringify(evidence, null, 2)}\n`)

    const report = await ingestBrowserCaptureEvidenceFile(plan, metadataPath)

    expect(report.pass).toBe(true)
    expect(report.candidate).toMatchObject({
      pass: true,
      expectedCaptureCount: 15,
      verifiedCaptureCount: 15,
      errors: [],
    })
    expect(report.globalBaseline).toMatchObject({
      id: 'production-golden',
      required: true,
      provided: true,
      pass: true,
      errors: [],
    })
    expect(report.provenance).toMatchObject({
      assurance: 'collector-attested',
      cryptographicallyVerified: false,
      collector: 'Capture Agent',
      collectorTaskId: '/capture/test-animal',
    })
    expect(report.provenance.warning).toMatch(
      /self-attested rather than cryptographically signed/,
    )
    const sourceMetadata = report.sourceMetadata
    expect(sourceMetadata).toBeDefined()
    if (sourceMetadata === undefined) {
      throw new Error('Expected validated source metadata.')
    }
    expect(sourceMetadata.path).toBe(metadataPath)
    expect(sourceMetadata.bytes).toBeGreaterThan(0)
    expect(sourceMetadata.sha256).toMatch(/^[a-f0-9]{64}$/)
    const firstArtifact = report.candidate.artifacts[0]
    expect(firstArtifact?.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(firstArtifact?.pixelWidth).toBe(1440)
    expect(firstArtifact?.pixelHeight).toBe(900)
    expect(firstArtifact).toMatchObject({
      viewportId: 'desktop',
      cameraAngleId: 'front-left',
      cameraAngleRole: 'primary',
      stateId: 'initial',
      stateKind: 'initial',
      requestedTimeSeconds: 0,
      actualTimeSeconds: 0,
      animationDurationSeconds: 8,
      actualTimeToleranceSeconds: 0.01,
    })
  })

  it('rejects a signature-only fake PNG even when its metadata digest matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-fake-png-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)
    const first = valid.captures[0]
    const fake = fakeSignatureOnlyPng(
      first.screenshot.pixelWidth,
      first.screenshot.pixelHeight,
    )
    await writeFile(resolve(root, first.screenshot.relativePath), fake)
    const evidence = {
      ...valid,
      captures: [
        {
          ...first,
          screenshot: {
            ...first.screenshot,
            bytes: fake.length,
            sha256: sha256(fake),
          },
        },
        ...valid.captures.slice(1),
      ],
    }

    const report = await validateBrowserCaptureEvidence(plan, evidence, root)

    expect(report.pass).toBe(false)
    expect(report.candidate.errors).toContain(
      `${first.requestId}: screenshot is not a fully decodable PNG.`,
    )
  })

  it('rejects visually uniform synthetic screenshots even when PNG metadata and hashes match', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-uniform-png-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)
    const first = valid.captures[0]
    const uniform = await sharp({
      create: {
        width: first.screenshot.pixelWidth,
        height: first.screenshot.pixelHeight,
        channels: 4,
        background: '#335577',
      },
    })
      .png()
      .toBuffer()
    await writeFile(resolve(root, first.screenshot.relativePath), uniform)
    const evidence = {
      ...valid,
      captures: [
        {
          ...first,
          screenshot: {
            ...first.screenshot,
            bytes: uniform.length,
            sha256: sha256(uniform),
          },
        },
        ...valid.captures.slice(1),
      ],
    }

    const report = await validateBrowserCaptureEvidence(plan, evidence, root)

    expect(report.pass).toBe(false)
    expect(report.candidate.errors).toContain(
      `${first.requestId}: screenshot is visually uniform and cannot serve as review evidence.`,
    )
  })

  it('rejects a closest-view capture whose zoom was overwritten by the base camera', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-overwritten-zoom-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)
    const interaction = valid.captures.find(
      ({ state }) => state.kind === 'interaction',
    )!
    const initial = valid.captures.find(
      (capture) =>
        capture.state.kind === 'initial' &&
        capture.viewport.id === interaction.viewport.id &&
        capture.cameraAngle.id === interaction.cameraAngle.id &&
        capture.animation.requestedTimeSeconds ===
          interaction.animation.requestedTimeSeconds,
    )!
    const initialBytes = await readFile(
      resolve(root, initial.screenshot.relativePath),
    )
    await writeFile(
      resolve(root, interaction.screenshot.relativePath),
      initialBytes,
    )
    const overwritten = {
      ...interaction,
      cameraAngle: initial.cameraAngle,
      screenshot: {
        ...interaction.screenshot,
        bytes: initialBytes.length,
        sha256: sha256(initialBytes),
      },
    }
    const evidence = {
      ...valid,
      captures: valid.captures.map((capture) =>
        capture.requestId === interaction.requestId ? overwritten : capture,
      ),
    }

    const report = await validateBrowserCaptureEvidence(plan, evidence, root)

    expect(report.pass).toBe(false)
    expect(report.candidate.errors).toEqual(
      expect.arrayContaining([
        `${interaction.requestId}: interaction screenshot is byte-identical to its initial-state capture.`,
        `${interaction.requestId}: zoom-in interaction did not reduce the observed camera distance.`,
      ]),
    )
  })

  it('rejects and withholds artifacts whose viewport, angle, state, or timing metadata was edited', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-metadata-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)
    const first = valid.captures[0]
    const evidence = {
      ...valid,
      captures: [
        {
          ...first,
          viewport: { ...first.viewport, id: 'phone-compact' },
          cameraAngle: { ...first.cameraAngle, id: 'rear-right' },
          state: { ...first.state, id: 'zoomed', kind: 'interaction' as const },
          animation: {
            ...first.animation,
            requestedTimeSeconds: 2,
            actualTimeSeconds: 1.5,
          },
        },
        ...valid.captures.slice(1),
      ],
    }

    const report = await validateBrowserCaptureEvidence(plan, evidence, root)

    expect(report.pass).toBe(false)
    expect(report.candidate.errors).toEqual(
      expect.arrayContaining([
        `${first.requestId}: viewport metadata does not match the plan.`,
        `${first.requestId}: camera angle metadata does not match the plan.`,
        `${first.requestId}: initial/interaction state does not match the plan.`,
        `${first.requestId}: requested animation time does not match the plan.`,
        `${first.requestId}: actual animation time is outside tolerance.`,
      ]),
    )
    expect(
      report.candidate.artifacts.some(
        ({ requestId }) => requestId === first.requestId,
      ),
    ).toBe(false)
  })

  it('binds evidence to the canonical plan and a current baseline report digest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-bindings-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)

    const wrongPlan = await validateBrowserCaptureEvidence(
      plan,
      { ...valid, planSha256: '0'.repeat(64) },
      root,
    )
    expect(wrongPlan.candidate.errors).toContain(
      'Evidence planSha256 does not match the canonical capture plan.',
    )

    const wrongBaseline = await validateBrowserCaptureEvidence(
      plan,
      {
        ...valid,
        globalBaseline: {
          id: valid.globalBaseline.id,
          reportSha256: 'f'.repeat(64),
        },
      },
      root,
    )
    expect(wrongBaseline.globalBaseline.pass).toBe(false)
    expect(wrongBaseline.globalBaseline.errors).toContain(
      'Global baseline report SHA does not match the capture plan.',
    )
    expect(wrongBaseline.globalBaseline.report).toEqual(
      plan.globalBaseline.report,
    )
  })

  it('keeps candidate failures separate from the global baseline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-errors-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)
    const first = valid.captures[0]
    const evidence = {
      ...valid,
      page: {
        ...valid.page,
        actualLoadedGlbSha256: '0'.repeat(64),
      },
      captures: [
        {
          ...first,
          animation: { ...first.animation, paused: false },
          screenshot: { ...first.screenshot, sha256: 'f'.repeat(64) },
        },
        ...valid.captures.slice(1),
      ],
    }
    await writeFile(
      plan.globalBaseline.report.path,
      `${JSON.stringify({
        pass: false,
        checked: 3,
        errors: ['production golden asset changed'],
      })}\n`,
    )

    const report = await validateBrowserCaptureEvidence(plan, evidence, root)

    expect(report.pass).toBe(false)
    expect(report.candidate.pass).toBe(false)
    expect(report.candidate.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Page actually loaded a different GLB SHA/),
        expect.stringMatching(/animation was not paused/),
        expect.stringMatching(/file hash or byte count/),
      ]),
    )
    expect(report.candidate.errors.join('\n')).not.toContain(
      'production golden asset changed',
    )
    expect(report.globalBaseline.pass).toBe(false)
    expect(report.globalBaseline.errors).toContain(
      'Global baseline report changed or disappeared after planning.',
    )
    expect(report.globalBaseline.errors.join('\n')).not.toContain(
      'animation was not paused',
    )
  })

  it('fails a candidate when any planned full-loop view is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'browser-capture-missing-'))
    const plan = await planFixture(root)
    const valid = await evidenceFixture(plan, root)
    const removed = valid.captures.find(
      ({ requestId }) =>
        requestId.includes('front-left') && requestId.endsWith('008000ms'),
    )!
    const evidence = {
      ...valid,
      captures: valid.captures.filter(
        ({ requestId }) => requestId !== removed.requestId,
      ),
    }

    const report = await validateBrowserCaptureEvidence(plan, evidence, root)

    expect(report.candidate.pass).toBe(false)
    expect(report.candidate.errors).toContain(
      `Missing planned capture ${removed.requestId}.`,
    )
    expect(report.globalBaseline.pass).toBe(true)
  })

  it('publishes a strict evidence schema for external collectors', async () => {
    const schema = JSON.parse(
      await readFile(
        resolve(testDirectory, '../schemas/browser-capture.schema.json'),
        'utf8',
      ),
    ) as Record<string, unknown>
    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
    })
    expect(schema).toHaveProperty(
      'properties.browser.properties.headed.const',
      true,
    )
    expect(schema).toHaveProperty(
      'properties.browser.properties.attestation.const',
      browserCaptureCollectorAttestation,
    )
    expect(schema).toHaveProperty('properties.browser.properties.collectorTaskId')
    expect(schema.required).toContain('globalBaseline')
    expect(schema).toHaveProperty(
      'properties.page.properties.actualLoadedGlbSha256',
    )
    expect(schema).toHaveProperty('properties.planSha256')
    expect(schema).toHaveProperty('$defs.capture.properties.cameraAngle')
    expect(schema).toHaveProperty('$defs.animation.properties.actualTimeSeconds')
    expect(schema).toHaveProperty('$defs.screenshot.properties.sha256')
    expect(schema).toHaveProperty(
      '$defs.globalBaseline.properties.reportSha256',
    )
  })
})

describe('profile-bound headed capture verification', () => {
  it('accepts only a current, deeply recomputed run-local evidence bundle for the exact profile model', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-profile-bound-'),
    )
    const fixture = await persistedCaptureFixture(runDirectory)

    const verified = await verifyBrowserCaptureValidationForProfile({
      animalId: 'test-animal',
      runDirectory,
      modelOutputPath: fixture.modelPath,
      validationPath: fixture.validationPath,
    })

    expect(verified.report.pass).toBe(true)
    expect(verified.plan.finalGlb.path).toBe(resolve(fixture.modelPath))
    expect(verified.sourcePlanPath).toBe(fixture.planPath)
    expect(verified.sourceMetadataPath).toBe(fixture.metadataPath)
  })

  it('rejects a fully self-consistent known-good GLB substituted for the profile model, even with identical bytes', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-model-substitute-'),
    )
    const profileModelPath = join(runDirectory, 'review', 'profile.glb')
    const substitutedModelPath = join(
      runDirectory,
      'review',
      'known-good-substitute.glb',
    )
    const identicalBytes = Buffer.from('known-good-identical-glb')
    await mkdir(dirname(profileModelPath), { recursive: true })
    await writeFile(profileModelPath, identicalBytes)
    const fixture = await persistedCaptureFixture(
      runDirectory,
      substitutedModelPath,
      identicalBytes,
    )

    await expect(
      verifyBrowserCaptureValidationForProfile({
        animalId: 'test-animal',
        runDirectory,
        modelOutputPath: profileModelPath,
        validationPath: fixture.validationPath,
      }),
    ).rejects.toThrow(/finalGlb\.path does not match/)
  })

  it('rejects run-external validation, plan, and evidence sources', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-containment-run-'),
    )
    const outside = await mkdtemp(
      join(tmpdir(), 'browser-capture-containment-outside-'),
    )
    const fixture = await persistedCaptureFixture(runDirectory)
    const outsideValidation = join(outside, 'validation.json')
    await copyFile(fixture.validationPath, outsideValidation)
    await expect(
      verifyBrowserCaptureValidationForProfile({
        animalId: 'test-animal',
        runDirectory,
        modelOutputPath: fixture.modelPath,
        validationPath: outsideValidation,
      }),
    ).rejects.toThrow(/strict child of the run directory/)

    const stored = JSON.parse(
      await readFile(fixture.validationPath, 'utf8'),
    ) as Record<string, unknown>
    for (const [sourceKey, fixturePath] of [
      ['sourcePlan', fixture.planPath],
      ['sourceMetadata', fixture.metadataPath],
    ] as const) {
      const outsidePath = join(outside, `${sourceKey}.json`)
      await copyFile(fixturePath, outsidePath)
      const source = stored[sourceKey] as Record<string, unknown>
      await writeFile(
        fixture.validationPath,
        `${JSON.stringify({
          ...stored,
          [sourceKey]: { ...source, path: outsidePath },
        }, null, 2)}\n`,
      )
      await expect(
        verifyBrowserCaptureValidationForProfile({
          animalId: 'test-animal',
          runDirectory,
          modelOutputPath: fixture.modelPath,
          validationPath: fixture.validationPath,
        }),
      ).rejects.toThrow(/strict child of the run directory/)
    }
  })

  it('rejects symlinked validation, plan, evidence, and screenshot sources', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-symlink-run-'),
    )
    const fixture = await persistedCaptureFixture(runDirectory)
    const stored = JSON.parse(
      await readFile(fixture.validationPath, 'utf8'),
    ) as Record<string, unknown>

    const validationLink = join(runDirectory, 'validation-link.json')
    await symlink(fixture.validationPath, validationLink)
    await expect(
      verifyBrowserCaptureValidationForProfile({
        animalId: 'test-animal',
        runDirectory,
        modelOutputPath: fixture.modelPath,
        validationPath: validationLink,
      }),
    ).rejects.toThrow(/symlink path components/)

    for (const [sourceKey, fixturePath] of [
      ['sourcePlan', fixture.planPath],
      ['sourceMetadata', fixture.metadataPath],
    ] as const) {
      const linkedPath = join(runDirectory, `${sourceKey}-link.json`)
      await symlink(fixturePath, linkedPath)
      const source = stored[sourceKey] as Record<string, unknown>
      await writeFile(
        fixture.validationPath,
        `${JSON.stringify({
          ...stored,
          [sourceKey]: { ...source, path: linkedPath },
        }, null, 2)}\n`,
      )
      await expect(
        verifyBrowserCaptureValidationForProfile({
          animalId: 'test-animal',
          runDirectory,
          modelOutputPath: fixture.modelPath,
          validationPath: fixture.validationPath,
        }),
      ).rejects.toThrow(/symlink path components/)
    }

    await writeFile(
      fixture.validationPath,
      `${JSON.stringify(stored, null, 2)}\n`,
    )
    const plan = parseBrowserCapturePlan(
      JSON.parse(await readFile(fixture.planPath, 'utf8')) as unknown,
    )
    const firstScreenshot = resolve(
      runDirectory,
      plan.requests[0].screenshotRelativePath,
    )
    const realScreenshot = `${firstScreenshot}.real`
    await rename(firstScreenshot, realScreenshot)
    await symlink(realScreenshot, firstScreenshot)
    const recomputed = await ingestBrowserCaptureEvidenceFiles(
      fixture.planPath,
      fixture.metadataPath,
    )
    expect(recomputed.pass).toBe(false)
    expect(recomputed.candidate.errors.join('\n')).toMatch(/path is unsafe/)
  })

  it('rejects a tampered cached validation even when plan and evidence remain valid', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-validation-tamper-'),
    )
    const fixture = await persistedCaptureFixture(runDirectory)
    const stored = JSON.parse(
      await readFile(fixture.validationPath, 'utf8'),
    ) as Record<string, unknown>
    await writeFile(
      fixture.validationPath,
      `${JSON.stringify({ ...stored, pass: false, injected: true }, null, 2)}\n`,
    )

    await expect(
      verifyBrowserCaptureValidationForProfile({
        animalId: 'test-animal',
        runDirectory,
        modelOutputPath: fixture.modelPath,
        validationPath: fixture.validationPath,
      }),
    ).rejects.toThrow(/does not deeply match freshly ingested evidence/)
  })

  it('closes the alternate-model bypass in the verifier shared by agent review and model lock', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-agent-review-model-lock-'),
    )
    const profileModelPath = join(runDirectory, 'review', 'profile.glb')
    const substitutedModelPath = join(
      runDirectory,
      'review',
      'substituted.glb',
    )
    const identicalBytes = Buffer.from('same-valid-model-bytes')
    await mkdir(dirname(profileModelPath), { recursive: true })
    await writeFile(profileModelPath, identicalBytes)
    const fixture = await persistedCaptureFixture(
      runDirectory,
      substitutedModelPath,
      identicalBytes,
    )

    const result = await verifyCurrentBrowserCapture(
      captureProfile(runDirectory, profileModelPath),
      fixture.metadataPath,
    )

    expect(result.pass).toBe(false)
    expect(result.errors.join('\n')).toMatch(/finalGlb\.path does not match/)
    expect(result.planSha256).toBeNull()
    expect(result.validationSha256).toBeNull()
  })

  it('closes the symlink-evidence bypass in the verifier shared by agent review and model lock', async () => {
    const runDirectory = await mkdtemp(
      join(tmpdir(), 'browser-capture-agent-review-symlink-'),
    )
    const fixture = await persistedCaptureFixture(runDirectory)
    const realMetadataPath = `${fixture.metadataPath}.real`
    await rename(fixture.metadataPath, realMetadataPath)
    await symlink(realMetadataPath, fixture.metadataPath)

    const result = await verifyCurrentBrowserCapture(
      captureProfile(runDirectory, fixture.modelPath),
      fixture.metadataPath,
    )

    expect(result.pass).toBe(false)
    expect(result.errors.join('\n')).toMatch(/symlink path components/)
  })
})
