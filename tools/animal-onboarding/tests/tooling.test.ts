import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { compositionMetricsPass } from '../src/composition-metrics'
import {
  browserMotionEvidencePass,
  groundContactShadowEvidence,
  initialHeadSideEvidence,
  mouthMotionEvidencePass,
  motionVisibilityEvidencePass,
  qwenNarrationEvidencePass,
  qwenSerenaNarrationEvidencePass,
} from '../src/evidence-metrics'
import { inspectGlbBytes } from '../src/glb'
import { narrationScriptForLocale } from '../src/publication'
import {
  bilingualNarrationReviewComplete,
  loadProfile,
  localizedNarrationAssets,
  scoreCandidate,
  scoreDimensions,
} from '../src/profile'
import {
  bilingualPublicationContractErrors,
  parseCollectionAnimalIds,
  renderCollectionAnimalIds,
} from '../src/promotion'
import type {
  AssetProfile,
  CandidateIntake,
  IntakeDimensions,
  PromotionManifest,
} from '../src/types'

const testDirectory =
  new URL(import.meta.url).protocol === 'file:'
    ? dirname(fileURLToPath(import.meta.url))
    : resolve(process.cwd(), 'tools/animal-onboarding/tests')

const maximumDimensions: IntakeDimensions = {
  anatomy: 20,
  editability: 15,
  materials: 10,
  performance: 10,
  normalization: 10,
  animation: 10,
  familiarity: 10,
  ecology: 10,
  scientificIdentity: 5,
}

function glb(json: Record<string, unknown>): Buffer {
  const rawJson = Buffer.from(JSON.stringify(json), 'utf8')
  const padding = (4 - (rawJson.length % 4)) % 4
  const jsonChunk = Buffer.concat([
    rawJson,
    Buffer.alloc(padding, 0x20),
  ])
  const output = Buffer.alloc(20 + jsonChunk.length)
  output.write('glTF', 0, 'ascii')
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(output.length, 8)
  output.writeUInt32LE(jsonChunk.length, 12)
  output.writeUInt32LE(0x4e4f534a, 16)
  jsonChunk.copy(output, 20)
  return output
}

describe('candidate intake', () => {
  it('uses the documented 100-point weighting', () => {
    expect(scoreDimensions(maximumDimensions)).toBe(100)
    expect(() =>
      scoreDimensions({ ...maximumDimensions, anatomy: 21 }),
    ).toThrow(/anatomy/)
  })

  it('never recommends an explicitly held candidate', () => {
    const candidate: CandidateIntake = {
      id: 'held-candidate',
      displayName: 'Held candidate',
      sourceUrl: 'https://example.test/model',
      author: 'Example Author',
      licenseId: 'CC-BY-4.0',
      directSourceVerified: true,
      downloadAllowed: true,
      modificationAllowed: true,
      redistributionAllowed: true,
      dimensions: maximumDimensions,
      disposition: 'hold',
    }
    expect(scoreCandidate(candidate)).toMatchObject({
      score: 100,
      rightsPass: true,
      recommended: false,
      disposition: 'hold',
    })
  })
})

describe('atomic promotion collection editing', () => {
  const source = `export const mainCollection = {
  animalIds: [
    'stegosaurus',
    'maiasaura',
  ],
  defaultAnimalId: 'stegosaurus',
}`

  it('round-trips an explicit approved order without touching other fields', () => {
    const rendered = renderCollectionAnimalIds(source, [
      'stegosaurus',
      'maiasaura',
      'sauropelta',
      'dilophosaurus',
      'mosasaurus',
    ])
    expect(parseCollectionAnimalIds(rendered)).toEqual([
      'stegosaurus',
      'maiasaura',
      'sauropelta',
      'dilophosaurus',
      'mosasaurus',
    ])
    expect(rendered).toContain("defaultAnimalId: 'stegosaurus'")
    expect(
      renderCollectionAnimalIds(rendered, parseCollectionAnimalIds(rendered)),
    ).toBe(rendered)
  })

  it('hard-fails when a collection source has no explicit animalIds list', () => {
    expect(() => renderCollectionAnimalIds('export const value = {}', [])).toThrow(
      /Cannot update animalIds/,
    )
  })
})

describe('bilingual publication contract', () => {
  const completeRoles = [
    'model',
    'background-landscape',
    'background-portrait',
    'poster',
    'poster-portrait',
    'thumbnail',
    'narration-zh-CN',
    'narration-en',
  ]
  const completeTargets = [
    'src/content/animals/example/content.zh-CN.ts',
    'src/content/animals/example/content.en.ts',
    'src/content/animals/example/package.ts',
    'src/content/animals/example/provenance.ts',
    'src/content/animals/example/animal.ts',
    'src/content/animals/example/provenance/LICENSES/model-license.txt',
    'src/content/animals/example/provenance/LICENSES/model-source.txt',
    'src/content/animals/example/provenance/LICENSES/background-generation.txt',
    'src/content/animals/example/provenance/LICENSES/derived-images.txt',
    'src/content/animals/example/provenance/LICENSES/narration-rights.txt',
  ]

  function manifest(
    runtimeRoles: readonly string[],
    generatedTargets = completeTargets,
  ): PromotionManifest {
    return {
      files: runtimeRoles.map((role) => ({ role })),
      generatedFiles: generatedTargets.map((productionTargetPath) => ({
        productionTargetPath,
      })),
      publication: {
        narration: {
          'zh-CN': {
            humanListeningReview: 'approved',
            publicDistributionDecision: 'approved',
          },
          en: {
            humanListeningReview: 'approved',
            publicDistributionDecision: 'approved',
          },
        },
        editorialReview: {
          'zh-CN': { pendingMarkers: [] },
          en: { pendingMarkers: [] },
        },
      },
    } as unknown as PromotionManifest
  }

  it('blocks a legacy single-language package from publication', () => {
    const errors = bilingualPublicationContractErrors(
      manifest([
        'model',
        'background-landscape',
        'background-portrait',
        'poster',
        'thumbnail',
        'narration',
      ]),
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/poster-portrait/),
        expect.stringMatching(/narration-zh-CN/),
        expect.stringMatching(/narration-en/),
      ]),
    )
  })

  it('requires both generated content modules and accepts no mixed locale set', () => {
    expect(
      bilingualPublicationContractErrors(
        manifest(
          completeRoles,
          completeTargets.filter((path) => !path.endsWith('/content.en.ts')),
        ),
      ),
    ).toContain(
      'Publication requires generated content.en.ts for locale en.',
    )
    expect(bilingualPublicationContractErrors(manifest(completeRoles))).toEqual(
      [],
    )
    expect(
      bilingualPublicationContractErrors(
        manifest([...completeRoles, 'narration']),
      ),
    ).toContain(
      'Publication must not include the legacy locale-less narration role.',
    )
    expect(
      bilingualPublicationContractErrors(
        manifest(
          completeRoles,
          completeTargets.filter(
            (path) => !path.endsWith('/narration-rights.txt'),
          ),
        ),
      ),
    ).toContain('Publication requires generated narration-rights.txt.')
  })
})

describe('localized narration profiles', () => {
  const visuals = {
    backgroundLandscapePath: 'output/background-landscape.webp',
    backgroundPortraitPath: 'output/background-portrait.webp',
    backgroundEvidencePath: 'run/background-evidence.json',
    posterPath: 'output/poster.webp',
    thumbnailPath: 'output/thumbnail.webp',
  }

  it('keeps legacy Chinese draft narration readable without making it bilingual', () => {
    const assets = {
      ...visuals,
      narrationPath: 'run/narration.mp3',
      narrationScriptPath: 'run/narration.zh-CN.txt',
      audioHumanReviewStatus: 'approved',
    } satisfies AssetProfile
    expect(localizedNarrationAssets(assets)).toEqual({
      'zh-CN': {
        path: 'run/narration.mp3',
        scriptPath: 'run/narration.zh-CN.txt',
        metricsPath: undefined,
        speaker: 'Serena',
        language: 'Chinese',
        humanReviewStatus: 'approved',
      },
    })
  })

  it('preserves separate scripts, artifacts, voices and listening gates', () => {
    const assets = {
      ...visuals,
      narration: {
        'zh-CN': {
          path: 'run/narration.zh-CN.mp3',
          scriptPath: 'run/narration.zh-CN.txt',
          metricsPath: 'run/narration.zh-CN.metrics.json',
          speaker: 'Serena',
          language: 'Chinese',
          humanReviewStatus: 'approved',
        },
        en: {
          path: 'run/narration.en.mp3',
          scriptPath: 'run/narration.en.txt',
          metricsPath: 'run/narration.en.metrics.json',
          speaker: 'Serena',
          language: 'English',
          humanReviewStatus: 'pending',
        },
      },
    } satisfies AssetProfile
    expect(localizedNarrationAssets(assets)).toEqual(assets.narration)
    expect(bilingualNarrationReviewComplete(assets)).toBe(false)
    expect(
      bilingualNarrationReviewComplete({
        ...assets,
        narration: {
          ...assets.narration,
          en: {
            ...assets.narration.en,
            humanReviewStatus: 'approved',
          },
        },
      }),
    ).toBe(true)
  })

  it('loads incomplete localized drafts but rejects locale/language mixing', async () => {
    const fixture = JSON.parse(
      await readFile(
        resolve(testDirectory, 'fixtures/profile.json'),
        'utf8',
      ),
    ) as Record<string, unknown>
    const assets = fixture.assets as Record<string, unknown>
    delete assets.audioHumanReviewStatus
    assets.narration = {
      en: {
        path: '.handoff/animal-onboarding-runs/onboarding-fixture/narration.en.mp3',
        scriptPath:
          '.handoff/animal-onboarding-runs/onboarding-fixture/narration.en.txt',
        speaker: 'Serena',
        language: 'English',
        humanReviewStatus: 'pending',
      },
    }
    const directory = await mkdtemp(join(tmpdir(), 'museum-onboarding-'))
    const profilePath = join(directory, 'profile.json')
    await writeFile(profilePath, JSON.stringify(fixture), 'utf8')
    await expect(loadProfile(profilePath)).resolves.toMatchObject({
      id: 'onboarding-fixture',
    })

    ;(
      (assets.narration as Record<string, Record<string, unknown>>).en
    ).language = 'Chinese'
    await writeFile(profilePath, JSON.stringify(fixture), 'utf8')
    await expect(loadProfile(profilePath)).rejects.toThrow(
      /narration\.en\.language must be English/,
    )

    ;(
      (assets.narration as Record<string, Record<string, unknown>>).en
    ).language = 'English'
    ;(
      (assets.narration as Record<string, Record<string, unknown>>).en
    ).speaker = 'Aiden'
    await writeFile(profilePath, JSON.stringify(fixture), 'utf8')
    await expect(loadProfile(profilePath)).rejects.toThrow(
      /narration\.en\.speaker must be Serena/,
    )
  })

  it('rejects traversal and cross-animal write paths', async () => {
    const fixture = JSON.parse(
      await readFile(resolve(testDirectory, 'fixtures/profile.json'), 'utf8'),
    ) as Record<string, unknown>
    const directory = await mkdtemp(join(tmpdir(), 'museum-onboarding-paths-'))
    const profilePath = join(directory, 'profile.json')

    fixture.runDirectory =
      '.handoff/animal-onboarding-runs/onboarding-fixture/../../escaped'
    await writeFile(profilePath, JSON.stringify(fixture), 'utf8')
    await expect(loadProfile(profilePath)).rejects.toThrow(/traversal/)

    fixture.runDirectory =
      '.handoff/animal-onboarding-runs/onboarding-fixture'
    ;(fixture.model as Record<string, unknown>).outputPath =
      'assets/candidates/another-animal/output/model.glb'
    await writeFile(profilePath, JSON.stringify(fixture), 'utf8')
    await expect(loadProfile(profilePath)).rejects.toThrow(/strict child/)
  })

  it('rejects a model input path that is not the rights-verified source', async () => {
    const fixture = JSON.parse(
      await readFile(resolve(testDirectory, 'fixtures/profile.json'), 'utf8'),
    ) as Record<string, unknown>
    ;(fixture.model as Record<string, unknown>).inputPath =
      '.handoff/animal-onboarding-runs/onboarding-fixture/substituted.glb'
    const directory = await mkdtemp(join(tmpdir(), 'museum-source-input-'))
    const profilePath = join(directory, 'profile.json')
    await writeFile(profilePath, JSON.stringify(fixture), 'utf8')

    await expect(loadProfile(profilePath)).rejects.toThrow(
      /exact rights-verified.*sourceModelPath/,
    )
  })
})

describe('locale narration scripts', () => {
  const content = {
    narration: {
      sentences: ['First sentence.', 'Second sentence.'],
    },
  }

  it('keeps Chinese punctuation adjacent and English sentences spaced', () => {
    expect(
      narrationScriptForLocale(content as never, 'zh-CN'),
    ).toBe('First sentence.Second sentence.')
    expect(narrationScriptForLocale(content as never, 'en')).toBe(
      'First sentence. Second sentence.',
    )
  })
})

describe('deterministic GLB inspection', () => {
  it('measures geometry, self-containment and the Idle duration', () => {
    const inspection = inspectGlbBytes(
      glb({
        asset: { version: '2.0' },
        accessors: [
          { count: 300 },
          { max: [8] },
        ],
        meshes: [
          {
            primitives: [
              {
                attributes: { POSITION: 0 },
                material: 0,
                mode: 4,
              },
            ],
          },
        ],
        materials: [{}],
        animations: [
          {
            name: 'Idle',
            samplers: [{ input: 1 }],
          },
        ],
      }),
    )
    expect(inspection).toMatchObject({
      animationDurations: [8],
      animationNames: ['Idle'],
      drawCalls: 1,
      externalUris: [],
      materials: 1,
      triangles: 100,
      version: 2,
    })
  })

  it('rejects a malformed container deterministically', () => {
    expect(() => inspectGlbBytes(Buffer.from('not glb'))).toThrow(
      /not a GLB/,
    )
  })
})

describe('responsive composition measurements', () => {
  const validSlenderAnimal = {
    hasModelBounds: true,
    modelPixelCount: 90,
    modelPixelFillRatio: 0.008,
    safeFrameCoverage: 0.08,
    withinSafeFrame: true,
    forbiddenOverlapPixels: 0,
    overflowPixels: 0,
  }

  it('accepts a measurable slender marine silhouette', () => {
    expect(compositionMetricsPass(validSlenderAnimal)).toBe(true)
  })

  it('rejects crop, UI overlap, fragments and horizontal overflow', () => {
    expect(
      compositionMetricsPass({
        ...validSlenderAnimal,
        withinSafeFrame: false,
      }),
    ).toBe(false)
    expect(
      compositionMetricsPass({
        ...validSlenderAnimal,
        forbiddenOverlapPixels: 25,
      }),
    ).toBe(false)
    expect(
      compositionMetricsPass({
        ...validSlenderAnimal,
        modelPixelCount: 63,
      }),
    ).toBe(false)
    expect(
      compositionMetricsPass({
        ...validSlenderAnimal,
        overflowPixels: 2,
      }),
    ).toBe(false)
  })
})

describe('review evidence that cannot be replaced by metadata-only checks', () => {
  const script = '这是双冠龙。'
  const artifact = {
    bytes: 123_456,
    sha256: 'runtime-sha256',
  }

  it('rejects system TTS even when its MP3 metrics pass', () => {
    expect(
      qwenSerenaNarrationEvidencePass({
        metrics: {
          script,
          scriptUtf8Sha256:
            '781fda6918808238547438714436281565cb28dcb0f5768564c938e2f7772816',
          engine: {
            tool: 'macOS say',
            voice: 'Tingting',
          },
          generation: {
            runsByteIdentical: true,
            rawRuns: [
              { sha256: '1'.repeat(64) },
              { sha256: '1'.repeat(64) },
            ],
          },
          artifact: {
            ...artifact,
            codec: 'mp3',
            sampleRateHz: 48_000,
            channels: 1,
            durationSeconds: 12,
          },
          automaticAcceptance: { allPassed: true },
          humanListeningReview: 'pending',
          publicDistributionDecision: 'pending',
        },
        script,
        scriptSha256:
          '781fda6918808238547438714436281565cb28dcb0f5768564c938e2f7772816',
        artifact,
      }),
    ).toBe(false)
  })

  it('accepts only the pinned Qwen CustomVoice Serena chain with two identical raw runs', () => {
    expect(
      qwenSerenaNarrationEvidencePass({
        metrics: {
          script,
          scriptUtf8Sha256:
            '781fda6918808238547438714436281565cb28dcb0f5768564c938e2f7772816',
          engine: {
            package: 'qwen-tts',
            packageVersion: '0.1.1',
            model: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
            modelRevision: '85e237c12c027371202489a0ec509ded67b5e4b5',
            speaker: 'Serena',
            language: 'Chinese',
            seed: 20_260_726,
          },
          generation: {
            runsByteIdentical: true,
            rawRuns: [
              { sha256: '1'.repeat(64) },
              { sha256: '1'.repeat(64) },
            ],
          },
          artifact: {
            ...artifact,
            codec: 'mp3',
            sampleRateHz: 48_000,
            channels: 1,
            durationSeconds: 12,
          },
          automaticAcceptance: { allPassed: true },
          humanListeningReview: 'pending',
          publicDistributionDecision: 'pending',
        },
        script,
        scriptSha256:
          '781fda6918808238547438714436281565cb28dcb0f5768564c938e2f7772816',
        artifact,
      }),
    ).toBe(true)
  })

  it('binds English evidence to its declared locale and voice', () => {
    const script = 'Meet Pachycephalosaurus. Look at its thick, rounded skull.'
    const scriptSha256 =
      'a'.repeat(64)
    const metrics = {
      script,
      scriptUtf8Sha256: scriptSha256,
      engine: {
        package: 'qwen-tts',
        packageVersion: '0.1.1',
        model: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
        modelRevision: '85e237c12c027371202489a0ec509ded67b5e4b5',
        speaker: 'Serena',
        language: 'English',
        seed: 20_260_726,
      },
      generation: {
        runsByteIdentical: true,
        rawRuns: [
          { sha256: '1'.repeat(64) },
          { sha256: '1'.repeat(64) },
        ],
      },
      artifact: {
        ...artifact,
        codec: 'mp3',
        sampleRateHz: 48_000,
        channels: 1,
        durationSeconds: 12,
      },
      automaticAcceptance: { allPassed: true },
      humanListeningReview: 'pending',
      publicDistributionDecision: 'pending',
    }
    expect(
      qwenNarrationEvidencePass({
        metrics,
        script,
        scriptSha256,
        artifact,
        expected: {
          locale: 'en',
          speaker: 'Serena',
          language: 'English',
        },
      }),
    ).toBe(true)
    expect(
      qwenNarrationEvidencePass({
        metrics,
        script,
        scriptSha256,
        artifact,
        expected: {
          locale: 'en',
          speaker: 'Aiden',
          language: 'English',
        },
      }),
    ).toBe(false)
    expect(
      qwenNarrationEvidencePass({
        metrics,
        script,
        scriptSha256,
        artifact,
        expected: {
          locale: 'zh-CN',
          speaker: 'Serena',
          language: 'Chinese',
        },
      }),
    ).toBe(false)
  })

  it('rejects an Idle that exists but has no measurable visual effect', () => {
    expect(
      browserMotionEvidencePass({
        changedPixelFractionOfModel: 0,
        frameCount: 2,
      }),
    ).toBe(false)
    expect(
      browserMotionEvidencePass({
        changedPixelFractionOfModel: 0.08,
        frameCount: 2,
      }),
    ).toBe(false)
    expect(
      browserMotionEvidencePass({
        changedPixelFractionOfModel: 0.08,
        frameCount: 2,
        startState: {
          paused: true,
          requestedTime: 0,
          time: 0,
          timeScale: 0,
        },
        quarterState: {
          paused: true,
          requestedTime: 2,
          time: 2,
          timeScale: 0,
        },
      }),
    ).toBe(true)
    expect(
      motionVisibilityEvidencePass({
        motionProfile: 'land-breathe-tail',
        firstFrameMatchesLast: true,
        rootTranslation: 0,
        maximumVertexDisplacementFraction: 0.035,
        changedPixelFractionOfModel: 0,
        motionRenderCount: 3,
      }),
    ).toBe(false)
    expect(
      motionVisibilityEvidencePass({
        motionProfile: 'land-breathe-tail',
        firstFrameMatchesLast: true,
        rootTranslation: 0,
        maximumVertexDisplacementFraction: 0.075,
        changedPixelFractionOfModel: 0.08,
        motionRenderCount: 3,
      }),
    ).toBe(true)
  })

  it('requires exact open/close browser frames for conditional mouth motion', () => {
    const openState = {
      paused: true,
      requestedTime: 0,
      time: 0,
      timeScale: 0,
      maximumMorphWeight: 0,
    }
    const closeState = {
      paused: true,
      requestedTime: 4,
      time: 4,
      timeScale: 0,
      maximumMorphWeight: 1,
    }
    expect(
      mouthMotionEvidencePass({
        changedPixels: 240,
        changedPixelFractionOfModel: 0.004,
        frameCount: 2,
        loopChangedPixels: 0,
        openState,
        closeState,
      }),
    ).toBe(true)
    expect(
      mouthMotionEvidencePass({
        changedPixels: 240,
        changedPixelFractionOfModel: 0.004,
        frameCount: 2,
        loopChangedPixels: 5,
        openState,
        closeState,
      }),
    ).toBe(false)
    expect(
      mouthMotionEvidencePass({
        changedPixels: 240,
        changedPixelFractionOfModel: 0.004,
        frameCount: 2,
        loopChangedPixels: 0,
        openState,
        closeState: { ...closeState, requestedTime: 2, time: 2 },
      }),
    ).toBe(false)
  })

  it('requires a land shadow to cover measured foot contacts', () => {
    const dilophosaurusLandmarks = {
      bounds: {
        min: [-1.6, -0.261713, 0],
        max: [1.6, 0.261713, 0.959331],
      },
      contacts: [
        {
          position: [0.450646, 0.226447, 0],
          method: 'lowest-vertex-quadrant',
        },
        {
          position: [0.450655, -0.226438, 0.000019],
          method: 'lowest-vertex-quadrant',
        },
      ],
    }
    expect(
      groundContactShadowEvidence(dilophosaurusLandmarks, {
        initialYawDegrees: 0,
        shadowOpacity: 0.22,
        shadowScale: 0.28,
      }).pass,
    ).toBe(false)
    expect(
      groundContactShadowEvidence(dilophosaurusLandmarks, {
        initialYawDegrees: 0,
        shadowOpacity: 0.58,
        shadowScale: 0.38,
        shadowDepthScale: 1.15,
        shadowHorizontalOffset: 0.45,
      }),
    ).toMatchObject({
      pass: true,
      measuredContactCount: 2,
      coveredContactCount: 2,
    })
  })

  it('requires the declared initial head side to be clear after yaw rotation', () => {
    const landmarks = {
      bounds: {
        min: [-1.6, -0.3, 0],
        max: [1.6, 0.3, 1],
      },
      head: { position: [1.6, 0, 0.6] },
      tailTip: { position: [-1.6, 0, 0.45] },
    }

    expect(
      initialHeadSideEvidence(landmarks, {
        initialYawDegrees: 0,
        initialHeadSide: 'left',
      }),
    ).toMatchObject({
      pass: false,
      expectedSide: 'left',
      measuredSide: 'right',
    })
    expect(
      initialHeadSideEvidence(landmarks, {
        initialYawDegrees: 180,
        initialHeadSide: 'left',
      }),
    ).toMatchObject({
      pass: true,
      expectedSide: 'left',
      measuredSide: 'left',
      separationFraction: 1,
    })
    expect(
      initialHeadSideEvidence(landmarks, {
        initialYawDegrees: 90,
        initialHeadSide: 'left',
      }),
    ).toMatchObject({
      pass: false,
      measuredSide: 'ambiguous',
    })
  })

  it('rotates measured land contacts before validating the shadow center', () => {
    const landmarks = {
      bounds: {
        min: [-1.6, -0.3, 0],
        max: [1.6, 0.3, 1],
      },
      contacts: [
        {
          position: [0.45, 0.2, 0],
          method: 'lowest-vertex-quadrant',
        },
        {
          position: [0.45, -0.2, 0],
          method: 'lowest-vertex-quadrant',
        },
      ],
    }
    const presentation = {
      initialYawDegrees: 180,
      shadowOpacity: 0.58,
      shadowScale: 0.38,
      shadowDepthScale: 1.15,
      shadowHorizontalOffset: -0.45,
    }

    expect(
      groundContactShadowEvidence(landmarks, presentation),
    ).toMatchObject({
      pass: true,
      measuredContactCount: 2,
      coveredContactCount: 2,
    })
    expect(
      groundContactShadowEvidence(landmarks, {
        ...presentation,
        shadowHorizontalOffset: 0.45,
      }).pass,
    ).toBe(false)
  })
})
