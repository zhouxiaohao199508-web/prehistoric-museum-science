import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  AnimalAnimation,
  AnimalContent,
  AnimalContentEn,
  AnimalContentZhCN,
  AnimalKind,
  AnimalPresentation,
  AtmosphereKind,
  Habitat,
} from '../../../src/content/types'
import { fileDigest, regularFile, sha256 } from './io'
import { localizedNarrationAssets } from './profile'
import type {
  AnimalOnboardingProfile,
  NarrationAssetProfile,
  OnboardingLocale,
  PromotionFile,
  PromotionGeneratedFile,
  PromotionManifest,
} from './types'

type PublicationMetadata = NonNullable<PromotionManifest['publication']>

interface ReviewAnimal {
  readonly id: string
  readonly status: 'draft' | 'published'
  readonly kind: AnimalKind
  readonly habitat: Habitat
  readonly atmosphere: AtmosphereKind
  readonly content: Partial<{
    readonly 'zh-CN': AnimalContentZhCN
    readonly en: AnimalContentEn
  }>
  readonly presentation: AnimalPresentation
  readonly animation?: AnimalAnimation
}

interface BackgroundEvidence {
  readonly generatedOn: string
  readonly tool: string
  readonly landscape: {
    readonly sourcePath: string
    readonly promptSummary: string
  }
  readonly portrait: {
    readonly sourcePath: string
    readonly promptSummary: string
  }
  readonly derivation: {
    readonly method: string
    readonly landscape: {
      readonly source: { readonly bytes: number; readonly sha256: string }
      readonly runtime: { readonly bytes: number; readonly sha256: string }
    }
    readonly portrait: {
      readonly source: { readonly bytes: number; readonly sha256: string }
      readonly runtime: { readonly bytes: number; readonly sha256: string }
    }
  }
}

interface NarrationMetrics {
  readonly generatedOn: string
  readonly script: string
  readonly engine: {
    readonly package: string
    readonly packageVersion: string
    readonly model: string
    readonly modelRevision: string
    readonly speaker: string
    readonly language: string
    readonly seed: number
  }
  readonly artifact: { readonly bytes: number; readonly sha256: string }
}

type LocalizedNarrationMetrics = Readonly<
  Record<OnboardingLocale, NarrationMetrics>
>

interface NormalizationLog {
  readonly modifications?: ReadonlyArray<{
    readonly operation?: string
    readonly reason?: string
  }>
}

export interface PublicationBundle {
  readonly generatedFiles: readonly PromotionGeneratedFile[]
  readonly contents: ReadonlyMap<string, Buffer>
  readonly publication: PublicationMetadata
}

function formatValue(value: unknown, indentation = 2): string {
  const prefix = ' '.repeat(indentation)
  const serialized = JSON.stringify(value, null, 2)
  if (serialized === undefined) throw new Error('Cannot serialize publication value.')
  return serialized.replaceAll('\n', `\n${prefix}`)
}

function pendingEditorialMarkers(content: AnimalContent): string[] {
  const serialized = JSON.stringify(content)
  return [
    'Human scientific review pending',
    'Human editorial review pending',
    'Pending human review',
    'Review pending',
    '仍等待人工',
    '等待人工科学复核',
    '等待科学、视觉、动作与听审',
  ].filter((marker) => serialized.includes(marker))
}

export function narrationScriptForLocale(
  content: AnimalContent,
  locale: OnboardingLocale,
): string {
  return content.narration.sentences.join(locale === 'en' ? ' ' : '')
}

async function loadReviewAnimal(id: string): Promise<ReviewAnimal | null> {
  const packagePath = resolve(`src/review/animals/${id}/package.ts`)
  if (!(await regularFile(packagePath))) return null
  const loaded = (await import(
    `${pathToFileURL(packagePath).href}?promotion=${Date.now()}`
  )) as { readonly animal?: ReviewAnimal }
  const animal = loaded.animal
  if (!animal || animal.id !== id) {
    throw new Error(`Review package must export animal with id ${id}.`)
  }
  return animal
}

function requireRuntimeFile(
  files: readonly PromotionFile[],
  role: string,
): PromotionFile {
  const file = files.find((candidate) => candidate.role === role)
  if (!file) throw new Error(`Promotion manifest is missing runtime role ${role}.`)
  return file
}

function requireReviewContent(
  animal: ReviewAnimal,
  locale: OnboardingLocale,
): AnimalContent {
  const content = animal.content[locale]
  if (!content) {
    throw new Error(`${animal.id}: review package is missing ${locale} content.`)
  }
  return content
}

function modelModifications(
  profile: AnimalOnboardingProfile,
  normalization: NormalizationLog,
): readonly [string, ...string[]] {
  const summaries = (normalization.modifications ?? [])
    .map(({ operation, reason }) => {
      if (!reason) return null
      return `${reason}${operation ? ` Operation: ${operation}.` : ''}`
    })
    .filter((value): value is string => value !== null)
  summaries.push(
    `Authored and validator-checked one closed eight-second ${profile.model.motionProfile} Idle for the shared museum viewer.`,
  )
  if (profile.model.mouthMotion.mode !== 'disabled') {
    summaries.push(
      `Included the human-reviewed ${profile.model.mouthMotion.mode} partial mouth relaxation in the same Idle loop.`,
    )
  }
  return summaries as [string, ...string[]]
}

function renderContentSource(
  content: AnimalContent,
  locale: OnboardingLocale,
): string {
  const typeName = locale === 'zh-CN' ? 'AnimalContentZhCN' : 'AnimalContentEn'
  const exportName = locale === 'zh-CN' ? 'zhCN' : 'en'
  return `import type { ${typeName} } from '../../../content/types'

export const ${exportName} = ${JSON.stringify(content, null, 2)} satisfies ${typeName}
`
}

function renderPackageSource(animal: ReviewAnimal): string {
  return `import { definePublishedAnimal } from '../../types'
import { en } from './content.en'
import { zhCN } from './content.zh-CN'
import { provenance } from './provenance'

export const animalDefinition = definePublishedAnimal({
  id: ${JSON.stringify(animal.id)},
  status: 'published',
  kind: ${JSON.stringify(animal.kind)},
  habitat: ${JSON.stringify(animal.habitat)},
  atmosphere: ${JSON.stringify(animal.atmosphere)},
  content: {
    'zh-CN': zhCN,
    en,
  },
  presentation: ${formatValue(animal.presentation, 2)},
${animal.animation ? `  animation: ${formatValue(animal.animation, 2)},\n` : ''}  narration: {
    'zh-CN': {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      speaker: 'Serena',
      language: 'Chinese',
      humanReviewStatus: 'approved',
    },
    en: {
      status: 'ready',
      sourcePath: 'audio/narration.en.mp3',
      mimeType: 'audio/mpeg',
      speaker: 'Serena',
      language: 'English',
      humanReviewStatus: 'approved',
    },
  },
  provenance,
})
`
}

function renderAnimalSource(): string {
  return `import narrationEnUrl from './audio/narration.en.mp3'
import narrationZhCNUrl from './audio/narration.zh-CN.mp3'
import landscapeUrl from './backgrounds/landscape.webp'
import portraitUrl from './backgrounds/portrait.webp'
import posterUrl from './images/poster.webp'
import posterPortraitUrl from './images/poster-portrait.webp'
import thumbnailUrl from './images/thumbnail.webp'
import modelUrl from './model/model.glb?url'

import { createRuntimeAnimal } from '../../create-runtime-animal'
import { animalDefinition } from './package'

export const animal = createRuntimeAnimal(animalDefinition, {
  backgroundLandscape: landscapeUrl,
  backgroundPortrait: portraitUrl,
  model: modelUrl,
  narration: {
    'zh-CN': narrationZhCNUrl,
    en: narrationEnUrl,
  },
  poster: posterUrl,
  posterPortrait: posterPortraitUrl,
  thumbnail: thumbnailUrl,
})
`
}

function modelLicense(profile: AnimalOnboardingProfile): {
  readonly spdx: 'CC-BY-4.0' | 'CC0-1.0'
  readonly name: string
  readonly url: string
} {
  return {
    spdx: profile.source.licenseId as 'CC-BY-4.0' | 'CC0-1.0',
    name: profile.source.licenseName,
    url: profile.source.licenseUrl,
  }
}

function renderProvenanceSource(input: {
  readonly profile: AnimalOnboardingProfile
  readonly animal: ReviewAnimal
  readonly files: readonly PromotionFile[]
  readonly backgrounds: BackgroundEvidence
  readonly narration: LocalizedNarrationMetrics
  readonly modifications: readonly [string, ...string[]]
  readonly sourceDigest: { readonly bytes: number; readonly sha256: string }
}): string {
  const {
    profile,
    animal,
    files,
    backgrounds,
    narration,
    modifications,
    sourceDigest,
  } = input
  const zhCN = requireReviewContent(animal, 'zh-CN')
  const en = requireReviewContent(animal, 'en')
  const model = requireRuntimeFile(files, 'model')
  const landscape = requireRuntimeFile(files, 'background-landscape')
  const portrait = requireRuntimeFile(files, 'background-portrait')
  const poster = requireRuntimeFile(files, 'poster')
  const posterPortrait = requireRuntimeFile(files, 'poster-portrait')
  const thumbnail = requireRuntimeFile(files, 'thumbnail')
  const license = modelLicense(profile)
  const modelAttribution = `“${profile.source.title}” by ${profile.source.author}, ${profile.source.licenseId}; modified for the Prehistoric Animal Museum.`
  const generatedOn = profile.approvals.approvedOn ?? backgrounds.generatedOn
  const derivedEvidence = [
    'provenance/LICENSES/model-license.txt',
    'provenance/LICENSES/model-source.txt',
    'provenance/LICENSES/derived-images.txt',
  ]
  const records = [
    {
      assetPath: 'model/model.glb',
      kind: 'model',
      source: {
        type: 'third-party',
        title: profile.source.title,
        author: profile.source.author,
        url: profile.source.pageUrl,
        accessedOn: profile.source.accessedOn,
        sha256: sourceDigest.sha256,
        bytes: sourceDigest.bytes,
      },
      license,
      runtime: { bytes: model.bytes, sha256: model.sha256 },
      modifications,
      attribution: modelAttribution,
      redistributionAllowed: profile.source.redistributionAllowed,
      evidencePaths: [
        'provenance/LICENSES/model-license.txt',
        'provenance/LICENSES/model-source.txt',
      ],
    },
    ...(
      [
        ['landscape', landscape, backgrounds.landscape, backgrounds.derivation.landscape],
        ['portrait', portrait, backgrounds.portrait, backgrounds.derivation.portrait],
      ] as const
    ).map(([orientation, runtime, summary, derivation]) => ({
      assetPath: `backgrounds/${orientation}.webp`,
      kind: 'background',
      source: {
        type: 'generated',
        title: `${en.name} reviewed habitat — ${orientation}`,
        tool: 'OpenAI built-in image_gen',
        generatedOn: backgrounds.generatedOn,
        prompt: summary.promptSummary,
        sha256: derivation.source.sha256,
        bytes: derivation.source.bytes,
      },
      license: {
        spdx: 'LicenseRef-OpenAI-Output',
        name: 'Project-generated OpenAI ImageGen output',
        url: 'https://openai.com/policies/terms-of-use/',
      },
      runtime: { bytes: runtime.bytes, sha256: runtime.sha256 },
      modifications: [
        backgrounds.derivation.method,
        'Removed ancillary metadata without applying a runtime tint or filter.',
      ],
      attribution: `Project-generated ${en.name} ${orientation} background created with OpenAI ImageGen.`,
      redistributionAllowed: true,
      evidencePaths: ['provenance/LICENSES/background-generation.txt'],
    })),
    ...(
      [
        [
          'images/poster.webp',
          'landscape',
          poster,
          'backgrounds/landscape.webp',
          'accepted desktop review screenshot',
        ],
        [
          'images/poster-portrait.webp',
          'portrait',
          posterPortrait,
          'backgrounds/portrait.webp',
          'accepted phone-portrait review screenshot',
        ],
      ] as const
    ).map(([assetPath, orientation, runtime, backgroundPath, methodSource]) => ({
      assetPath,
      kind: 'poster',
      source: {
        type: 'derived',
        title: `${en.name} ${orientation} model fallback poster`,
        generatedOn,
        inputAssetPaths: ['model/model.glb', backgroundPath],
        method: `Deterministic crop from the ${methodSource} and measured model bounds.`,
      },
      license,
      runtime: { bytes: runtime.bytes, sha256: runtime.sha256 },
      modifications: [
        `Composited the accepted runtime model presentation with the reviewed ${orientation} background.`,
        'Exported without text, controls, labels, logos, or watermarks.',
      ],
      attribution: `${modelAttribution} Scene art generated for this project.`,
      redistributionAllowed: true,
      evidencePaths: derivedEvidence,
    })),
    {
      assetPath: 'images/thumbnail.webp',
      kind: 'thumbnail',
      source: {
        type: 'derived',
        title: `${en.name} collection thumbnail`,
        generatedOn,
        inputAssetPaths: ['model/model.glb', 'backgrounds/landscape.webp'],
        method:
          'Deterministic square crop from the accepted desktop review presentation after hiding all interface chrome.',
      },
      license,
      runtime: { bytes: thumbnail.bytes, sha256: thumbnail.sha256 },
      modifications: [
        'Selected a card-size crop that keeps the animal readable.',
        'Exported without embedded text, controls, labels, logos, or watermarks.',
      ],
      attribution: `${modelAttribution} Scene art generated for this project.`,
      redistributionAllowed: true,
      evidencePaths: derivedEvidence,
    },
    ...(['zh-CN', 'en'] as const).map((locale) => {
      const metrics = narration[locale]
      const narrationFile = requireRuntimeFile(files, `narration-${locale}`)
      const content = locale === 'zh-CN' ? zhCN : en
      const languageLabel = locale === 'zh-CN' ? 'Mandarin' : 'English'
      return {
        assetPath: `audio/narration.${locale}.mp3`,
        kind: 'narration',
        source: {
          type: 'generated',
          title: `${content.name} ${languageLabel} narration`,
          tool: 'Qwen3-TTS CustomVoice',
          model: metrics.engine.model,
          revision: `${metrics.engine.modelRevision}; ${metrics.engine.speaker} built-in voice`,
          generatedOn: metrics.generatedOn,
          prompt: metrics.script,
          sha256: narrationFile.sha256,
          bytes: narrationFile.bytes,
        },
        license: {
          spdx: 'CC-BY-NC-SA-4.0',
          name: 'CC BY-NC-SA 4.0 project-owned Qwen3-TTS output',
          url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        },
        runtime: {
          bytes: narrationFile.bytes,
          sha256: narrationFile.sha256,
        },
        modifications: [
          `Generated offline from the exact reviewed ${locale} two-sentence script with the ${metrics.engine.speaker} voice.`,
          'Normalized to a reviewed 48 kHz mono MP3 without runtime synthesis.',
        ],
        attribution: `Project-generated ${languageLabel} narration produced locally with Qwen3-TTS 0.6B CustomVoice (${metrics.engine.speaker}).`,
        redistributionAllowed: true,
        evidencePaths: ['provenance/LICENSES/narration-rights.txt'],
      }
    }),
  ]
  return `import type { AssetProvenance } from '../../types'

export const provenance = ${JSON.stringify(records, null, 2)} as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
`
}

function licenseDocuments(input: {
  readonly profile: AnimalOnboardingProfile
  readonly animal: ReviewAnimal
  readonly files: readonly PromotionFile[]
  readonly backgrounds: BackgroundEvidence
  readonly narration: LocalizedNarrationMetrics
  readonly modifications: readonly [string, ...string[]]
  readonly sourceDigest: { readonly bytes: number; readonly sha256: string }
}): Readonly<Record<string, string>> {
  const {
    profile,
    animal,
    files,
    backgrounds,
    narration,
    modifications,
    sourceDigest,
  } = input
  const model = requireRuntimeFile(files, 'model')
  const localizedNarration = localizedNarrationAssets(profile.assets)
  const approval = `${profile.approvals.approvedBy ?? 'PENDING'} on ${profile.approvals.approvedOn ?? 'PENDING'}`
  return {
    'provenance/LICENSES/model-license.txt': `Model license

SPDX: ${profile.source.licenseId}
Name: ${profile.source.licenseName}
URL: ${profile.source.licenseUrl}
Redistribution allowed: ${profile.source.redistributionAllowed}
`,
    'provenance/LICENSES/model-source.txt': `Model source and derivation

Title: ${profile.source.title}
Author: ${profile.source.author}
Direct source: ${profile.source.pageUrl}
Accessed: ${profile.source.accessedOn}
Source bytes: ${sourceDigest.bytes}
Source SHA-256: ${sourceDigest.sha256}
Runtime bytes: ${model.bytes}
Runtime SHA-256: ${model.sha256}

${modifications.map((value) => `- ${value}`).join('\n')}
`,
    'provenance/LICENSES/background-generation.txt': `Reviewed background generation

Tool: ${backgrounds.tool}
Generated: ${backgrounds.generatedOn}
Approved: ${approval}

Landscape source: ${backgrounds.landscape.sourcePath}
Landscape prompt: ${backgrounds.landscape.promptSummary}
Landscape source SHA-256: ${backgrounds.derivation.landscape.source.sha256}
Landscape runtime SHA-256: ${backgrounds.derivation.landscape.runtime.sha256}

Portrait source: ${backgrounds.portrait.sourcePath}
Portrait prompt: ${backgrounds.portrait.promptSummary}
Portrait source SHA-256: ${backgrounds.derivation.portrait.source.sha256}
Portrait runtime SHA-256: ${backgrounds.derivation.portrait.runtime.sha256}
`,
    'provenance/LICENSES/derived-images.txt': `Derived review images

Animal: ${requireReviewContent(animal, 'en').name}
Method: deterministic crops from the accepted desktop and phone-portrait compositions and measured model bounds.
Inputs: model/model.glb, backgrounds/landscape.webp and backgrounds/portrait.webp
Approved: ${approval}
`,
    'provenance/LICENSES/narration-rights.txt': `Narration generation and review

${(['zh-CN', 'en'] as const).map((locale) => {
  const metrics = narration[locale]
  const narrationFile = requireRuntimeFile(files, `narration-${locale}`)
  return `Locale: ${locale}
Package: ${metrics.engine.package} ${metrics.engine.packageVersion}
Model: ${metrics.engine.model}
Revision: ${metrics.engine.modelRevision}
Speaker: ${metrics.engine.speaker}
Language: ${metrics.engine.language}
Seed: ${metrics.engine.seed}
Generated: ${metrics.generatedOn}
Runtime bytes: ${narrationFile.bytes}
Runtime SHA-256: ${narrationFile.sha256}
Human listening review: ${localizedNarration[locale]?.humanReviewStatus ?? 'pending'}
Public distribution decision: ${profile.approvals.audioByLocale?.[locale] && profile.approvals.production ? 'approved' : 'pending'}
Approved: ${approval}

Script: ${metrics.script}`
}).join('\n\n')}
`,
  }
}

export async function buildPublicationBundle(
  profile: AnimalOnboardingProfile,
  files: readonly PromotionFile[],
): Promise<PublicationBundle | null> {
  const animal = await loadReviewAnimal(profile.id)
  if (!animal) return null
  if (animal.status !== 'draft' && animal.status !== 'published') {
    throw new Error(`${profile.id}: review package has invalid status.`)
  }
  const zhCN = animal.content['zh-CN']
  const en = animal.content.en
  const narrationProfiles = localizedNarrationAssets(profile.assets)
  const zhCNNarration = narrationProfiles['zh-CN']
  const enNarration = narrationProfiles.en
  if (
    !zhCN ||
    !en ||
    !zhCNNarration ||
    !enNarration ||
    !profile.assets.posterPortraitPath ||
    !files.some(({ role }) => role === 'poster-portrait') ||
    !files.some(({ role }) => role === 'narration-zh-CN') ||
    !files.some(({ role }) => role === 'narration-en')
  ) {
    return null
  }
  const narrationProfileByLocale = {
    'zh-CN': zhCNNarration,
    en: enNarration,
  } satisfies Readonly<Record<OnboardingLocale, NarrationAssetProfile>>
  const metricsPath = (locale: OnboardingLocale): string =>
    narrationProfileByLocale[locale].metricsPath ??
    `${profile.runDirectory}/narration.${locale}.metrics.json`
  if (
    !(await regularFile(resolve(metricsPath('zh-CN')))) ||
    !(await regularFile(resolve(metricsPath('en'))))
  ) {
    return null
  }
  const [backgrounds, zhCNMetrics, enMetrics, normalization] = await Promise.all([
    readFile(resolve(profile.assets.backgroundEvidencePath), 'utf8').then(
      (value) => JSON.parse(value) as BackgroundEvidence,
    ),
    readFile(resolve(metricsPath('zh-CN')), 'utf8').then(
      (value) => JSON.parse(value) as NarrationMetrics,
    ),
    readFile(resolve(metricsPath('en')), 'utf8').then(
      (value) => JSON.parse(value) as NarrationMetrics,
    ),
    readFile(resolve(profile.model.normalizationLogPath), 'utf8').then(
      (value) => JSON.parse(value) as NormalizationLog,
    ),
  ])
  const narration = {
    'zh-CN': zhCNMetrics,
    en: enMetrics,
  } satisfies LocalizedNarrationMetrics
  for (const locale of ['zh-CN', 'en'] as const) {
    const content = locale === 'zh-CN' ? zhCN : en
    const script = narrationScriptForLocale(content, locale)
    if (script !== narration[locale].script) {
      throw new Error(
        `${profile.id}: reviewed ${locale} content and narration metrics scripts differ.`,
      )
    }
  }
  for (const [label, source] of [
    ['landscape', backgrounds.derivation.landscape.source],
    ['portrait', backgrounds.derivation.portrait.source],
  ] as const) {
    const path =
      label === 'landscape'
        ? backgrounds.landscape.sourcePath
        : backgrounds.portrait.sourcePath
    const actual = await fileDigest(resolve(path))
    if (actual.bytes !== source.bytes || actual.sha256 !== source.sha256) {
      throw new Error(`${profile.id}: ${label} source background hash differs.`)
    }
  }
  const [sourceDigest, modifications] = await Promise.all([
    fileDigest(resolve(profile.source.sourceModelPath)),
    Promise.resolve(modelModifications(profile, normalization)),
  ])
  const productionDirectory = `src/content/animals/${profile.id}`
  const common = {
    profile,
    animal,
    files,
    backgrounds,
    narration,
    modifications,
    sourceDigest,
  }
  const sources: Readonly<Record<string, string>> = {
    [`${productionDirectory}/content.zh-CN.ts`]: renderContentSource(
      zhCN,
      'zh-CN',
    ),
    [`${productionDirectory}/content.en.ts`]: renderContentSource(en, 'en'),
    [`${productionDirectory}/package.ts`]: renderPackageSource(animal),
    [`${productionDirectory}/provenance.ts`]: renderProvenanceSource(common),
    ...Object.fromEntries(
      Object.entries(licenseDocuments(common)).map(([path, value]) => [
        `${productionDirectory}/${path}`,
        value,
      ]),
    ),
    [`${productionDirectory}/animal.ts`]: renderAnimalSource(),
  }
  const contents = new Map(
    Object.entries(sources).map(([path, value]) => [path, Buffer.from(value)]),
  )
  const generatedFiles = [...contents].map(([productionTargetPath, buffer]) => ({
    role:
      productionTargetPath.endsWith('/animal.ts')
        ? 'animal-entry'
        : productionTargetPath.includes('/provenance/LICENSES/')
          ? `license-${productionTargetPath.split('/').at(-1)}`
          : productionTargetPath.split('/').at(-1) ?? 'generated-file',
    productionTargetPath,
    bytes: buffer.length,
    sha256: sha256(buffer),
  }))
  const publication: PublicationMetadata = {
    reviewContentPaths: {
      'zh-CN': `src/review/animals/${profile.id}/content.zh-CN.ts`,
      en: `src/review/animals/${profile.id}/content.en.ts`,
    },
    reviewPackagePath: `src/review/animals/${profile.id}/package.ts`,
    modelModifications: modifications,
    backgrounds: {
      landscape: {
        title: `${en.name} reviewed habitat — landscape`,
        sourcePath: backgrounds.landscape.sourcePath,
        prompt: backgrounds.landscape.promptSummary,
        generatedOn: backgrounds.generatedOn,
        tool: backgrounds.tool,
        sourceBytes: backgrounds.derivation.landscape.source.bytes,
        sourceSha256: backgrounds.derivation.landscape.source.sha256,
        runtimeBytes: backgrounds.derivation.landscape.runtime.bytes,
        runtimeSha256: backgrounds.derivation.landscape.runtime.sha256,
      },
      portrait: {
        title: `${en.name} reviewed habitat — portrait`,
        sourcePath: backgrounds.portrait.sourcePath,
        prompt: backgrounds.portrait.promptSummary,
        generatedOn: backgrounds.generatedOn,
        tool: backgrounds.tool,
        sourceBytes: backgrounds.derivation.portrait.source.bytes,
        sourceSha256: backgrounds.derivation.portrait.source.sha256,
        runtimeBytes: backgrounds.derivation.portrait.runtime.bytes,
        runtimeSha256: backgrounds.derivation.portrait.runtime.sha256,
      },
    },
    narration: Object.fromEntries(
      (['zh-CN', 'en'] as const).map((locale) => {
        const metrics = narration[locale]
        return [
          locale,
          {
            locale,
            script: metrics.script,
            generatedOn: metrics.generatedOn,
            ...metrics.engine,
            bytes: metrics.artifact.bytes,
            sha256: metrics.artifact.sha256,
            humanListeningReview:
              narrationProfileByLocale[locale].humanReviewStatus,
            publicDistributionDecision:
              profile.approvals.audioByLocale?.[locale] &&
              profile.approvals.production
                ? 'approved'
                : 'pending',
          },
        ]
      }),
    ) as unknown as PublicationMetadata['narration'],
    editorialReview: Object.fromEntries(
      (['zh-CN', 'en'] as const).map((locale) => {
        const content = locale === 'zh-CN' ? zhCN : en
        return [
          locale,
          {
            reviewedBy: content.editorial.reviewedBy,
            reviewedOn: content.editorial.reviewedOn,
            pendingMarkers: pendingEditorialMarkers(content),
          },
        ]
      }),
    ) as unknown as PublicationMetadata['editorialReview'],
    scientificReviewStatus: profile.science.humanReviewStatus,
    mouthReviewStatus:
      profile.model.mouthMotion.mode === 'disabled'
        ? 'not-applicable'
        : profile.model.mouthMotion.humanReviewStatus,
  }
  return { generatedFiles, contents, publication }
}
