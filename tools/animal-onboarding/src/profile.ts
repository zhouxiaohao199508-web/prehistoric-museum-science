import { lstat, readFile } from 'node:fs/promises'
import {
  basename,
  dirname,
  isAbsolute,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path'

import type {
  ApprovalProfile,
  AnimalOnboardingProfile,
  AssetProfile,
  CandidateIntake,
  IntakeDimensions,
  NarrationAssetProfile,
  OnboardingLocale,
} from './types'
import { validateModelBudgetPolicy } from './budget-policy'

const animalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
const allowedLicenses = new Set(['CC0-1.0', 'CC-BY-4.0'])
const onboardingLocales = ['zh-CN', 'en'] as const satisfies readonly OnboardingLocale[]

function assertStrictChildPath(
  rootPath: string,
  childPath: string,
  label: string,
): void {
  if (childPath.split(/[\\/]/u).includes('..')) {
    throw new Error(`${label} must not contain parent-directory traversal`)
  }
  const root = resolve(rootPath)
  const child = resolve(childPath)
  const relativePath = relative(root, child)
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`${label} must remain a strict child of ${rootPath}`)
  }
}

async function assertNoSymlinkComponents(
  candidatePath: string,
  label: string,
): Promise<void> {
  let current = resolve(candidatePath)
  const root = parse(current).root
  while (current !== root) {
    const entry = await lstat(current).catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return null
      }
      throw error
    })
    if (entry?.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link: ${current}`)
    }
    current = dirname(current)
  }
}

export function localizedNarrationAssets(
  assets: AssetProfile,
): Partial<Readonly<Record<OnboardingLocale, NarrationAssetProfile>>> {
  if (assets.narration) return assets.narration
  if (!assets.narrationPath || !assets.narrationScriptPath) return {}
  return {
    'zh-CN': {
      path: assets.narrationPath,
      scriptPath: assets.narrationScriptPath,
      metricsPath: undefined,
      speaker: 'Serena',
      language: 'Chinese',
      humanReviewStatus: assets.audioHumanReviewStatus ?? 'pending',
    },
  }
}

export function bilingualNarrationReviewComplete(
  assets: AssetProfile,
): boolean {
  const narrations = localizedNarrationAssets(assets)
  return (
    narrations['zh-CN']?.humanReviewStatus === 'approved' &&
    narrations.en?.humanReviewStatus === 'approved'
  )
}

export function ownerApprovalRecorded(approvals: ApprovalProfile): boolean {
  return (
    approvals.scientific &&
    approvals.visual &&
    approvals.motion &&
    approvals.audio &&
    approvals.audioByLocale?.['zh-CN'] === true &&
    approvals.audioByLocale?.en === true &&
    approvals.production &&
    typeof approvals.approvedBy === 'string' &&
    approvals.approvedBy.trim().length > 0 &&
    typeof approvals.approvedOn === 'string' &&
    isoDatePattern.test(approvals.approvedOn)
  )
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function stringValue(
  source: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = source[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}.${key} must be a non-empty string`)
  }
  return value
}

function booleanValue(
  source: Record<string, unknown>,
  key: string,
  label: string,
): boolean {
  const value = source[key]
  if (typeof value !== 'boolean') {
    throw new Error(`${label}.${key} must be a boolean`)
  }
  return value
}

function numberValue(
  source: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label}.${key} must be a finite number`)
  }
  return value
}

function enumValue(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  label: string,
): string {
  const value = stringValue(source, key, label)
  if (!allowed.includes(value)) {
    throw new Error(`${label}.${key} must be one of ${allowed.join(', ')}`)
  }
  return value
}

function assertStringArray(value: unknown, label: string): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error(`${label} must be a non-empty string array`)
  }
}

function assertSelectedSemanticValue(value: unknown, label: string): void {
  if (
    typeof value === 'string' &&
    value.startsWith('BLOCKED_UNSELECTED_')
  ) {
    throw new Error(`${label} is still an unresolved semantic selection`)
  }
  if (
    typeof value === 'string' &&
    value.startsWith('BLOCKED_UNINSPECTED_')
  ) {
    throw new Error(`${label} is still an unresolved source inspection`)
  }
}

export async function loadProfile(
  profilePath: string,
): Promise<AnimalOnboardingProfile> {
  const absolutePath = resolve(profilePath)
  const parsed: unknown = JSON.parse(await readFile(absolutePath, 'utf8'))
  const root = record(parsed, 'profile')
  if (root.schemaVersion !== 1 || root.status !== 'draft') {
    throw new Error('profile.schemaVersion must be 1 and status must be draft')
  }
  const id = stringValue(root, 'id', 'profile')
  if (!animalIdPattern.test(id)) {
    throw new Error(`Invalid profile.id: ${id}`)
  }

  const source = record(root.source, 'profile.source')
  for (const key of [
    'title',
    'author',
    'pageUrl',
    'licenseId',
    'licenseName',
    'licenseUrl',
    'accessedOn',
    'sourceModelPath',
  ]) {
    stringValue(source, key, 'profile.source')
  }
  for (const key of [
    'directSourceVerified',
    'downloadAllowed',
    'modificationAllowed',
    'redistributionAllowed',
  ]) {
    booleanValue(source, key, 'profile.source')
  }
  if (!isoDatePattern.test(String(source.accessedOn))) {
    throw new Error('profile.source.accessedOn must be YYYY-MM-DD')
  }
  assertStringArray(source.evidencePaths, 'profile.source.evidencePaths')

  const science = record(root.science, 'profile.science')
  for (const key of [
    'displayName',
    'classificationLabel',
    'identityScope',
  ]) {
    stringValue(science, key, 'profile.science')
  }
  enumValue(science, 'confidence', ['high', 'medium', 'low'], 'profile.science')
  enumValue(
    science,
    'humanReviewStatus',
    ['pending', 'approved'],
    'profile.science',
  )
  assertStringArray(science.sourceUrls, 'profile.science.sourceUrls')
  if (!Array.isArray(science.uncertaintyNotes)) {
    throw new Error('profile.science.uncertaintyNotes must be an array')
  }

  const model = record(root.model, 'profile.model')
  for (const key of [
    'inputPath',
    'outputPath',
    'normalizedBlendPath',
    'normalizationLogPath',
    'landmarksPath',
  ]) {
    stringValue(model, key, 'profile.model')
  }
  if (resolve(String(model.inputPath)) !== resolve(String(source.sourceModelPath))) {
    throw new Error(
      'profile.model.inputPath must be the exact rights-verified profile.source.sourceModelPath; derived models belong in outputPath and the hash-bound processing log',
    )
  }
  for (const [label, value] of [
    ['profile.model.normalizationStrategy', model.normalizationStrategy],
    ['profile.model.habitat', model.habitat],
    ['profile.model.motionProfile', model.motionProfile],
    ['profile.model.tailAxisSign', model.tailAxisSign],
  ] as const) {
    assertSelectedSemanticValue(value, label)
  }
  enumValue(
    model,
    'normalizationStrategy',
    [
      'replace-with-project-morph',
      'preserve-source-rig-retime',
      'custom-rebuild',
    ],
    'profile.model',
  )
  const animationStrategy = record(
    model.animationStrategy,
    'profile.model.animationStrategy',
  )
  for (const [label, value] of [
    ['profile.model.animationStrategy.mode', animationStrategy.mode],
    [
      'profile.model.animationStrategy.sourceArmature',
      animationStrategy.sourceArmature,
    ],
    [
      'profile.model.animationStrategy.sourceAnimation',
      animationStrategy.sourceAnimation,
    ],
  ] as const) {
    assertSelectedSemanticValue(value, label)
  }
  const animationStrategyMode = enumValue(
    animationStrategy,
    'mode',
    [
      'replace-with-project-morph',
      'preserve-source-rig-retime',
      'custom-rebuild',
    ],
    'profile.model.animationStrategy',
  )
  if (animationStrategyMode !== model.normalizationStrategy) {
    throw new Error(
      'profile.model.animationStrategy.mode must match profile.model.normalizationStrategy',
    )
  }
  const sourceArmature = enumValue(
    animationStrategy,
    'sourceArmature',
    ['present', 'absent'],
    'profile.model.animationStrategy',
  )
  const sourceAnimation = enumValue(
    animationStrategy,
    'sourceAnimation',
    ['present', 'absent'],
    'profile.model.animationStrategy',
  )
  const destructiveReplacementAccepted = booleanValue(
    animationStrategy,
    'destructiveReplacementAccepted',
    'profile.model.animationStrategy',
  )
  stringValue(
    animationStrategy,
    'reason',
    'profile.model.animationStrategy',
  )
  if (
    animationStrategyMode === 'preserve-source-rig-retime' &&
    (sourceArmature !== 'present' || sourceAnimation !== 'present')
  ) {
    throw new Error(
      'preserve-source-rig-retime requires a declared source armature and source animation',
    )
  }
  if (
    animationStrategyMode !== 'replace-with-project-morph' &&
    destructiveReplacementAccepted
  ) {
    throw new Error(
      'destructiveReplacementAccepted is only valid for replace-with-project-morph',
    )
  }
  if (
    animationStrategyMode === 'replace-with-project-morph' &&
    (sourceArmature === 'present' || sourceAnimation === 'present') &&
    !destructiveReplacementAccepted
  ) {
    throw new Error(
      'profile.model.animationStrategy.destructiveReplacementAccepted must be true when replace-with-project-morph discards a source armature or animation',
    )
  }
  enumValue(model, 'habitat', ['land', 'water', 'air'], 'profile.model')
  enumValue(
    model,
    'motionProfile',
    [
      'land-breathe-tail',
      'marine-tail',
      'flipper-swim',
      'flying-wing',
      'flying-insect',
      'static-breathe',
    ],
    'profile.model',
  )
  if (model.sourceBodyAxis !== undefined) {
    enumValue(
      model,
      'sourceBodyAxis',
      ['x', 'y', 'z'],
      'profile.model',
    )
  }
  enumValue(model, 'expectedClip', ['Idle'], 'profile.model')
  booleanValue(model, 'animationRequired', 'profile.model')
  if (model.tailAxisSign !== -1 && model.tailAxisSign !== 1) {
    throw new Error('profile.model.tailAxisSign must be -1 or 1')
  }
  const mouthMotion = record(
    model.mouthMotion,
    'profile.model.mouthMotion',
  )
  const mouthMode = enumValue(
    mouthMotion,
    'mode',
    ['disabled', 'source-rig', 'curated-components'],
    'profile.model.mouthMotion',
  )
  if (mouthMode === 'disabled') {
    stringValue(mouthMotion, 'reason', 'profile.model.mouthMotion')
  } else {
    enumValue(
      mouthMotion,
      'sourcePose',
      ['open'],
      'profile.model.mouthMotion',
    )
    enumValue(
      mouthMotion,
      'rotationAxis',
      ['X', 'Y', 'Z'],
      'profile.model.mouthMotion',
    )
    enumValue(
      mouthMotion,
      'humanReviewStatus',
      ['pending', 'approved'],
      'profile.model.mouthMotion',
    )
    const closeDegrees = numberValue(
      mouthMotion,
      'closeDegrees',
      'profile.model.mouthMotion',
    )
    if (Math.abs(closeDegrees) < 0.5 || Math.abs(closeDegrees) > 45) {
      throw new Error(
        'profile.model.mouthMotion.closeDegrees must be between 0.5 and 45 degrees in magnitude',
      )
    }
    const maximumAffectedVertexFraction = numberValue(
      mouthMotion,
      'maximumAffectedVertexFraction',
      'profile.model.mouthMotion',
    )
    if (
      maximumAffectedVertexFraction <= 0 ||
      maximumAffectedVertexFraction > 0.5
    ) {
      throw new Error(
        'profile.model.mouthMotion.maximumAffectedVertexFraction must be greater than 0 and at most 0.5',
      )
    }
    if (mouthMode === 'source-rig') {
      stringValue(mouthMotion, 'jawBone', 'profile.model.mouthMotion')
      assertStringArray(
        mouthMotion.tongueBones,
        'profile.model.mouthMotion.tongueBones',
      )
      for (const key of [
        'minimumJawWeightedVertices',
        'minimumTongueWeightedVertices',
      ]) {
        const value = numberValue(
          mouthMotion,
          key,
          'profile.model.mouthMotion',
        )
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error(
            `profile.model.mouthMotion.${key} must be a positive integer`,
          )
        }
      }
    } else {
      if (
        !Array.isArray(mouthMotion.hingePivot) ||
        mouthMotion.hingePivot.length !== 3 ||
        mouthMotion.hingePivot.some(
          (entry) => typeof entry !== 'number' || !Number.isFinite(entry),
        )
      ) {
        throw new Error(
          'profile.model.mouthMotion.hingePivot must contain three finite numbers',
        )
      }
      const selector = record(
        mouthMotion.componentSelector,
        'profile.model.mouthMotion.componentSelector',
      )
      if (
        selector.centroidXMinimum === undefined &&
        selector.centroidXMaximum === undefined
      ) {
        throw new Error(
          'profile.model.mouthMotion.componentSelector requires an X bound',
        )
      }
      for (const key of ['centroidXMinimum', 'centroidXMaximum']) {
        if (selector[key] !== undefined) {
          numberValue(
            selector,
            key,
            'profile.model.mouthMotion.componentSelector',
          )
        }
      }
      numberValue(
        selector,
        'centroidZMaximum',
        'profile.model.mouthMotion.componentSelector',
      )
      for (const key of [
        'maximumComponentVertices',
        'expectedVertexCount',
      ]) {
        const value = numberValue(
          selector,
          key,
          'profile.model.mouthMotion.componentSelector',
        )
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error(
            `profile.model.mouthMotion.componentSelector.${key} must be a positive integer`,
          )
        }
      }
      const expectedComponentCount = numberValue(
        selector,
        'expectedComponentCount',
        'profile.model.mouthMotion.componentSelector',
      )
      if (
        !Number.isInteger(expectedComponentCount) ||
        expectedComponentCount < 0
      ) {
        throw new Error(
          'profile.model.mouthMotion.componentSelector.expectedComponentCount must be a non-negative integer',
        )
      }
      const tolerance = numberValue(
        selector,
        'expectedVertexTolerance',
        'profile.model.mouthMotion.componentSelector',
      )
      if (!Number.isInteger(tolerance) || tolerance < 0) {
        throw new Error(
          'profile.model.mouthMotion.componentSelector.expectedVertexTolerance must be a non-negative integer',
        )
      }
      if (
        !Array.isArray(selector.softTissueVertexCounts) ||
        selector.softTissueVertexCounts.some(
          (entry) => !Number.isInteger(entry) || entry <= 0,
        )
      ) {
        throw new Error(
          'profile.model.mouthMotion.componentSelector.softTissueVertexCounts must be an integer array',
        )
      }
      const softTissueScale = numberValue(
        selector,
        'softTissueAngleScale',
        'profile.model.mouthMotion.componentSelector',
      )
      if (softTissueScale < 0 || softTissueScale > 1) {
        throw new Error(
          'profile.model.mouthMotion.componentSelector.softTissueAngleScale must be between 0 and 1',
        )
      }
      if (selector.largestComponentRegion !== undefined) {
        const region = record(
          selector.largestComponentRegion,
          'profile.model.mouthMotion.componentSelector.largestComponentRegion',
        )
        for (const key of [
          'xRampStart',
          'xRampEnd',
          'fullWeightZ',
          'zeroWeightZ',
        ]) {
          numberValue(
            region,
            key,
            'profile.model.mouthMotion.componentSelector.largestComponentRegion',
          )
        }
        if (Number(region.xRampStart) === Number(region.xRampEnd)) {
          throw new Error(
            'profile.model.mouthMotion.componentSelector.largestComponentRegion xRampStart and xRampEnd must differ',
          )
        }
        if (Number(region.fullWeightZ) >= Number(region.zeroWeightZ)) {
          throw new Error(
            'profile.model.mouthMotion.componentSelector.largestComponentRegion fullWeightZ must be below zeroWeightZ',
          )
        }
        const expectedRegionVertices = numberValue(
          region,
          'expectedVertexCount',
          'profile.model.mouthMotion.componentSelector.largestComponentRegion',
        )
        if (
          !Number.isInteger(expectedRegionVertices) ||
          expectedRegionVertices <= 0
        ) {
          throw new Error(
            'profile.model.mouthMotion.componentSelector.largestComponentRegion.expectedVertexCount must be a positive integer',
          )
        }
        if (region.componentVertexCounts !== undefined) {
          if (
            !Array.isArray(region.componentVertexCounts) ||
            region.componentVertexCounts.length === 0 ||
            region.componentVertexCounts.some(
              (entry) => !Number.isInteger(entry) || entry <= 0,
            )
          ) {
            throw new Error(
              'profile.model.mouthMotion.componentSelector.largestComponentRegion.componentVertexCounts must be a non-empty positive-integer array',
            )
          }
        }
      }
    }
  }
  for (const key of [
    'targetBytes',
    'maxBytes',
    'maxTriangles',
    'maxDrawCalls',
    'maxMaterials',
    'maxBones',
  ]) {
    if (model[key] !== undefined && numberValue(model, key, 'profile.model') <= 0) {
      throw new Error(`profile.model.${key} must be positive`)
    }
  }
  if (model.budgetException !== undefined) {
    const exception = record(
      model.budgetException,
      'profile.model.budgetException',
    )
    if (
      !Array.isArray(exception.metrics) ||
      exception.metrics.length === 0 ||
      exception.metrics.some(
        (metric) =>
          typeof metric !== 'string' ||
          ![
            'bytes',
            'triangles',
            'drawCalls',
            'materials',
            'bones',
          ].includes(metric),
      )
    ) {
      throw new Error(
        'profile.model.budgetException.metrics must be a non-empty supported metric array',
      )
    }
    for (const key of ['reason', 'acceptedBy', 'acceptedOn']) {
      stringValue(exception, key, 'profile.model.budgetException')
    }
  }
  validateModelBudgetPolicy(model as unknown as AnimalOnboardingProfile['model'])

  const presentation = record(root.presentation, 'profile.presentation')
  for (const [label, value] of [
    ['profile.presentation.initialYawDegrees', presentation.initialYawDegrees],
    ['profile.presentation.initialHeadSide', presentation.initialHeadSide],
    ['profile.presentation.shadow', presentation.shadow],
    ['profile.presentation.shadowOpacity', presentation.shadowOpacity],
    ['profile.presentation.shadowScale', presentation.shadowScale],
  ] as const) {
    assertSelectedSemanticValue(value, label)
  }
  numberValue(presentation, 'initialYawDegrees', 'profile.presentation')
  enumValue(
    presentation,
    'initialHeadSide',
    ['left', 'right'],
    'profile.presentation',
  )
  const safeAreaPadding = numberValue(
    presentation,
    'safeAreaPadding',
    'profile.presentation',
  )
  if (safeAreaPadding < 0 || safeAreaPadding >= 0.5) {
    throw new Error(
      'profile.presentation.safeAreaPadding must be between 0 and 0.5',
    )
  }
  enumValue(
    presentation,
    'shadow',
    ['ground', 'none'],
    'profile.presentation',
  )
  for (const key of [
    'shadowOpacity',
    'shadowScale',
    'shadowDepthScale',
    'shadowHorizontalOffset',
    'toneMappingExposure',
  ]) {
    if (presentation[key] !== undefined) {
      numberValue(presentation, key, 'profile.presentation')
    }
  }
  const assets = record(root.assets, 'profile.assets')
  for (const key of [
    'backgroundLandscapePath',
    'backgroundPortraitPath',
    'backgroundEvidencePath',
    'posterPath',
    'thumbnailPath',
  ]) {
    stringValue(assets, key, 'profile.assets')
  }
  const posterPortraitPath =
    assets.posterPortraitPath === undefined
      ? undefined
      : stringValue(assets, 'posterPortraitPath', 'profile.assets')
  enumValue(
    assets.audioHumanReviewStatus === undefined
      ? { audioHumanReviewStatus: 'pending' }
      : assets,
    'audioHumanReviewStatus',
    ['pending', 'approved'],
    'profile.assets',
  )
  const narrationConfigured = typeof assets.narrationPath === 'string'
  const narrationScriptConfigured =
    typeof assets.narrationScriptPath === 'string'
  if (narrationConfigured !== narrationScriptConfigured) {
    throw new Error(
      'profile.assets narrationPath and narrationScriptPath must be configured together',
    )
  }
  if (assets.narration !== undefined) {
    if (narrationConfigured || narrationScriptConfigured) {
      throw new Error(
        'profile.assets must not mix localized narration with legacy narrationPath fields',
      )
    }
    const narration = record(assets.narration, 'profile.assets.narration')
    const unsupportedLocales = Object.keys(narration).filter(
      (locale) => !onboardingLocales.includes(locale as OnboardingLocale),
    )
    if (unsupportedLocales.length > 0) {
      throw new Error(
        `profile.assets.narration has unsupported locale(s): ${unsupportedLocales.join(', ')}`,
      )
    }
    for (const locale of onboardingLocales) {
      if (narration[locale] === undefined) continue
      const localized = record(
        narration[locale],
        `profile.assets.narration.${locale}`,
      )
      for (const key of ['path', 'scriptPath', 'speaker']) {
        stringValue(localized, key, `profile.assets.narration.${locale}`)
      }
      if (localized.speaker !== 'Serena') {
        throw new Error(
          `profile.assets.narration.${locale}.speaker must be Serena`,
        )
      }
      if (localized.metricsPath !== undefined) {
        stringValue(localized, 'metricsPath', `profile.assets.narration.${locale}`)
      }
      const expectedLanguage = locale === 'zh-CN' ? 'Chinese' : 'English'
      const language = enumValue(
        localized,
        'language',
        ['Chinese', 'English'],
        `profile.assets.narration.${locale}`,
      )
      if (language !== expectedLanguage) {
        throw new Error(
          `profile.assets.narration.${locale}.language must be ${expectedLanguage}`,
        )
      }
      enumValue(
        localized,
        'humanReviewStatus',
        ['pending', 'approved'],
        `profile.assets.narration.${locale}`,
      )
    }
  }
  const approvals = record(root.approvals, 'profile.approvals')
  for (const key of [
    'scientific',
    'visual',
    'motion',
    'audio',
    'production',
  ]) {
    booleanValue(approvals, key, 'profile.approvals')
  }
  if (approvals.audioByLocale !== undefined) {
    const audioByLocale = record(
      approvals.audioByLocale,
      'profile.approvals.audioByLocale',
    )
    for (const locale of onboardingLocales) {
      if (audioByLocale[locale] !== undefined) {
        booleanValue(
          audioByLocale,
          locale,
          'profile.approvals.audioByLocale',
        )
      }
    }
  }
  stringValue(root, 'runDirectory', 'profile')
  if (!Number.isInteger(root.proposedCollectionIndex)) {
    throw new Error('profile.proposedCollectionIndex must be an integer')
  }
  const runDirectory = String(root.runDirectory)
  const outputPath = String(model.outputPath)
  assertStrictChildPath(
    '.handoff/animal-onboarding-runs',
    runDirectory,
    'profile.runDirectory',
  )
  if (basename(resolve(runDirectory)) !== id) {
    throw new Error('profile.runDirectory basename must equal profile.id')
  }
  await assertNoSymlinkComponents(runDirectory, 'profile.runDirectory')
  const candidateRoot = `assets/candidates/${id}`
  for (const [label, path] of [
    ['profile.model.outputPath', outputPath],
    ['profile.model.normalizedBlendPath', String(model.normalizedBlendPath)],
    ['profile.model.normalizationLogPath', String(model.normalizationLogPath)],
    ['profile.model.landmarksPath', String(model.landmarksPath)],
    [
      'profile.assets.backgroundLandscapePath',
      String(assets.backgroundLandscapePath),
    ],
    [
      'profile.assets.backgroundPortraitPath',
      String(assets.backgroundPortraitPath),
    ],
    ['profile.assets.posterPath', String(assets.posterPath)],
    ['profile.assets.thumbnailPath', String(assets.thumbnailPath)],
  ] as const) {
    assertStrictChildPath(candidateRoot, path, label)
    await assertNoSymlinkComponents(path, label)
  }
  if (posterPortraitPath !== undefined) {
    assertStrictChildPath(
      candidateRoot,
      posterPortraitPath,
      'profile.assets.posterPortraitPath',
    )
    await assertNoSymlinkComponents(
      posterPortraitPath,
      'profile.assets.posterPortraitPath',
    )
  }
  assertStrictChildPath(
    runDirectory,
    String(assets.backgroundEvidencePath),
    'profile.assets.backgroundEvidencePath',
  )
  await assertNoSymlinkComponents(
    String(assets.backgroundEvidencePath),
    'profile.assets.backgroundEvidencePath',
  )
  if (assets.narration !== undefined) {
    const narrations = localizedNarrationAssets(
      assets as unknown as AssetProfile,
    )
    for (const locale of onboardingLocales) {
      const narration = narrations[locale]
      if (!narration) continue
      for (const path of [
        narration.path,
        narration.scriptPath,
        narration.metricsPath ??
          `${runDirectory}/narration.${locale}.metrics.json`,
      ]) {
        assertStrictChildPath(
          runDirectory,
          path,
          `profile.assets.narration.${locale} artifacts`,
        )
        await assertNoSymlinkComponents(
          path,
          `profile.assets.narration.${locale} artifacts`,
        )
      }
    }
  }
  return parsed as AnimalOnboardingProfile
}

export function scoreDimensions(dimensions: IntakeDimensions): number {
  const weights: Readonly<Record<keyof IntakeDimensions, number>> = {
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
  let score = 0
  for (const [key, weight] of Object.entries(weights) as Array<
    [keyof IntakeDimensions, number]
  >) {
    const value = dimensions[key]
    if (!Number.isFinite(value) || value < 0 || value > weight) {
      throw new Error(`${key} must be between 0 and ${weight}`)
    }
    score += value
  }
  return score
}

export function scoreCandidate(candidate: CandidateIntake): {
  readonly id: string
  readonly score: number
  readonly rightsPass: boolean
  readonly recommended: boolean
  readonly disposition: 'advance' | 'hold' | 'reject'
  readonly hardFailureReasons: readonly string[]
} {
  const rightsFailures = [
    !candidate.directSourceVerified ? 'direct source not verified' : null,
    !candidate.author ? 'author missing' : null,
    !allowedLicenses.has(candidate.licenseId)
      ? `license ${candidate.licenseId} not allowlisted`
      : null,
    !candidate.downloadAllowed ? 'download not allowed' : null,
    !candidate.modificationAllowed ? 'modification not allowed' : null,
    !candidate.redistributionAllowed ? 'redistribution not allowed' : null,
    ...(candidate.hardFailureReasons ?? []),
  ].filter((value): value is string => value !== null)
  const score = scoreDimensions(candidate.dimensions)
  const rightsPass = rightsFailures.length === 0
  const meetsScore = rightsPass && score >= 70
  const disposition =
    candidate.disposition ??
    (meetsScore ? 'advance' : rightsPass ? 'hold' : 'reject')
  const recommended = meetsScore && disposition === 'advance'
  return {
    id: candidate.id,
    score,
    rightsPass,
    recommended,
    disposition,
    hardFailureReasons: rightsFailures,
  }
}
