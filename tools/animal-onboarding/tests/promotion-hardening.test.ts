import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  approvalBundlesEqual,
  canonicalApprovalBundleSha256,
  type ApprovalBundleFile,
} from '../src/approval-bundle'
import { approvalReadinessErrors } from '../src/qa'
import {
  collectRelativeFiles,
  promotionBindingErrors,
} from '../src/promotion'
import type {
  AnimalOnboardingProfile,
  PromotionManifest,
  QaReport,
} from '../src/types'

function profile(): AnimalOnboardingProfile {
  return {
    schemaVersion: 1,
    id: 'test-animal',
    status: 'draft',
    source: {
      title: 'Test',
      author: 'Author',
      pageUrl: 'https://example.test',
      licenseId: 'CC0-1.0',
      licenseName: 'CC0',
      licenseUrl: 'https://example.test/license',
      accessedOn: '2026-08-31',
      directSourceVerified: true,
      downloadAllowed: true,
      modificationAllowed: true,
      redistributionAllowed: true,
      sourceModelPath: '.handoff/animal-onboarding-runs/test-animal/source.glb',
      evidencePaths: [
        '.handoff/animal-onboarding-runs/test-animal/source-evidence.json',
      ],
    },
    science: {
      displayName: '测试动物',
      classificationLabel: 'Test',
      identityScope: 'Test',
      confidence: 'high',
      sourceUrls: ['https://example.test/science'],
      uncertaintyNotes: [],
      humanReviewStatus: 'approved',
    },
    model: {
      inputPath: '.handoff/animal-onboarding-runs/test-animal/source.glb',
      outputPath: 'assets/candidates/test-animal/output/model.glb',
      normalizedBlendPath: 'assets/candidates/test-animal/working/model.blend',
      normalizationLogPath: 'assets/candidates/test-animal/evidence/normalization.json',
      landmarksPath: 'assets/candidates/test-animal/evidence/landmarks.json',
      normalizationStrategy: 'replace-with-project-morph',
      animationStrategy: {
        mode: 'replace-with-project-morph',
        sourceArmature: 'absent',
        sourceAnimation: 'absent',
        destructiveReplacementAccepted: false,
        reason: 'The deterministic test fixture has no source rig or animation.',
      },
      habitat: 'water',
      motionProfile: 'marine-tail',
      mouthMotion: { mode: 'disabled', reason: 'No mouth rig.' },
      tailAxisSign: 1,
      animationRequired: true,
      expectedClip: 'Idle',
    },
    presentation: {
      initialYawDegrees: 0,
      initialHeadSide: 'left',
      safeAreaPadding: 0.1,
      shadow: 'none',
    },
    assets: {
      backgroundLandscapePath: 'assets/candidates/test-animal/output/background-landscape.webp',
      backgroundPortraitPath: 'assets/candidates/test-animal/output/background-portrait.webp',
      backgroundEvidencePath: '.handoff/animal-onboarding-runs/test-animal/background-evidence.json',
      posterPath: 'assets/candidates/test-animal/output/poster.webp',
      posterPortraitPath: 'assets/candidates/test-animal/output/poster-portrait.webp',
      thumbnailPath: 'assets/candidates/test-animal/output/thumbnail.webp',
      narration: {
        'zh-CN': {
          path: '.handoff/animal-onboarding-runs/test-animal/narration.zh-CN.mp3',
          scriptPath: '.handoff/animal-onboarding-runs/test-animal/narration.zh-CN.txt',
          metricsPath: '.handoff/animal-onboarding-runs/test-animal/narration.zh-CN.metrics.json',
          speaker: 'Serena',
          language: 'Chinese',
          humanReviewStatus: 'approved',
        },
        en: {
          path: '.handoff/animal-onboarding-runs/test-animal/narration.en.mp3',
          scriptPath: '.handoff/animal-onboarding-runs/test-animal/narration.en.txt',
          metricsPath: '.handoff/animal-onboarding-runs/test-animal/narration.en.metrics.json',
          speaker: 'Serena',
          language: 'English',
          humanReviewStatus: 'approved',
        },
      },
    },
    runDirectory: '.handoff/animal-onboarding-runs/test-animal',
    proposedCollectionIndex: 1,
    approvals: {
      scientific: true,
      visual: true,
      motion: true,
      audio: true,
      audioByLocale: { 'zh-CN': true, en: true },
      production: true,
      approvedBy: 'Leon',
      approvedOn: '2026-08-31',
    },
  }
}

function forgedQa(): QaReport {
  return {
    schemaVersion: 1,
    animalId: 'test-animal',
    generatedAt: '2026-08-31T00:00:00.000Z',
    profilePath: '/repo/profile.json',
    profileSha256: 'a'.repeat(64),
    automatedPass: true,
    localDraftReady: true,
    ownerApproved: true,
    counts: { hardFailures: 0, warnings: 0, pendingHumanOnly: 0 },
    gates: [],
    artifacts: {},
  }
}

describe('promotion trust-boundary hardening', () => {
  it('rejects handcrafted QA booleans when the exact gate set is absent', () => {
    expect(
      approvalReadinessErrors(profile(), forgedQa(), {
        requireHumanPass: true,
      }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/missing required QA gates/)]))
  })

  it('rejects swapped runtime roles and non-canonical approval evidence paths', () => {
    const current = profile()
    const manifest = {
      files: [
        {
          role: 'model',
          reviewSourcePath: current.assets.posterPath,
          productionTargetPath: 'src/content/animals/test-animal/images/poster.webp',
        },
      ],
      evidenceFiles: [
        {
          role: 'owner-approval-record',
          path: '.handoff/animal-onboarding-runs/another-animal/approval-record.json',
        },
      ],
    } as unknown as PromotionManifest
    const errors = promotionBindingErrors(current, manifest)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/model.*profile-configured source/),
        expect.stringMatching(/model.*canonical target/),
        expect.stringMatching(/owner-approval-record.*canonical path/),
        expect.stringMatching(/motion-render-start/),
      ]),
    )
  })

  it('requires the complete mouth evidence role set when mouth motion is enabled', () => {
    const current = profile()
    const enabled = {
      ...current,
      model: {
        ...current.model,
        mouthMotion: {
          mode: 'source-rig',
          sourcePose: 'open',
          jawBone: 'jaw',
          tongueBones: ['tongue'],
          rotationAxis: 'Z',
          closeDegrees: 10,
          minimumJawWeightedVertices: 10,
          minimumTongueWeightedVertices: 5,
          maximumAffectedVertexFraction: 0.1,
          humanReviewStatus: 'approved',
        },
      },
    } satisfies AnimalOnboardingProfile
    const errors = promotionBindingErrors(enabled, {
      files: [],
      evidenceFiles: [],
    } as unknown as PromotionManifest)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/mouth-render-open/),
        expect.stringMatching(/mouth-render-close/),
        expect.stringMatching(/mouth-render-loop/),
      ]),
    )
  })

  it('changes the canonical approval digest when model, narration or a nested screenshot changes', () => {
    const original: ApprovalBundleFile[] = [
      { path: 'assets/model.glb', bytes: 10, sha256: '1'.repeat(64) },
      { path: 'run/narration.mp3', bytes: 20, sha256: '2'.repeat(64) },
      { path: 'run/screenshots/frame.png', bytes: 30, sha256: '3'.repeat(64) },
    ]
    for (const index of [0, 1, 2]) {
      const changed = original.map((file, fileIndex) =>
        fileIndex === index ? { ...file, sha256: 'f'.repeat(64) } : file,
      )
      expect(canonicalApprovalBundleSha256(changed)).not.toBe(
        canonicalApprovalBundleSha256(original),
      )
      expect(
        approvalBundlesEqual(
          {
            algorithm: 'sha256',
            sha256: canonicalApprovalBundleSha256(original),
            files: original,
          },
          {
            algorithm: 'sha256',
            sha256: canonicalApprovalBundleSha256(changed),
            files: changed,
          },
        ),
      ).toBe(false)
    }
  })

  it('rejects a symlink hidden inside staging or an installed package', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'promotion-tree-'))
    const packageRoot = join(directory, 'package')
    await mkdir(packageRoot)
    await writeFile(join(packageRoot, 'model.glb'), 'model', 'utf8')
    await symlink(join(packageRoot, 'model.glb'), join(packageRoot, 'linked.glb'))
    await expect(collectRelativeFiles(packageRoot)).rejects.toThrow(/symbolic links/)
  })
})
