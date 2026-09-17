export type GateKind = 'automated' | 'warning' | 'human-only'
export type GateStatus = 'pass' | 'fail' | 'pending' | 'not-applicable'

export interface GateResult {
  readonly id: string
  readonly kind: GateKind
  readonly status: GateStatus
  readonly summary: string
  readonly evidence?: readonly string[]
  readonly measured?: Readonly<Record<string, string | number | boolean>>
}

export interface IntakeDimensions {
  readonly anatomy: number
  readonly editability: number
  readonly materials: number
  readonly performance: number
  readonly normalization: number
  readonly animation: number
  readonly familiarity: number
  readonly ecology: number
  readonly scientificIdentity: number
}

export interface CandidateIntake {
  readonly id: string
  readonly displayName: string
  readonly sourceUrl: string
  readonly author: string
  readonly licenseId: string
  readonly directSourceVerified: boolean
  readonly downloadAllowed: boolean
  readonly modificationAllowed: boolean
  readonly redistributionAllowed: boolean
  readonly dimensions: IntakeDimensions
  readonly disposition?: 'advance' | 'hold' | 'reject'
  readonly hardFailureReasons?: readonly string[]
  readonly notes?: readonly string[]
}

export type MotionProfile =
  | 'land-breathe-tail'
  | 'marine-tail'
  | 'flipper-swim'
  | 'flying-wing'
  | 'flying-insect'
  | 'static-breathe'

/**
 * Declares who owns the source rig/animation rewrite. The shared Blender
 * normalizer implements only replace-with-project-morph; the other strategies
 * deliberately route to dedicated, animal-specific work.
 */
export type ModelProcessingStrategy =
  | 'replace-with-project-morph'
  | 'preserve-source-rig-retime'
  | 'custom-rebuild'

export interface AnimationStrategyProfile {
  readonly mode: ModelProcessingStrategy
  readonly sourceArmature: 'present' | 'absent'
  readonly sourceAnimation: 'present' | 'absent'
  readonly destructiveReplacementAccepted: boolean
  readonly reason: string
}

export interface DisabledMouthMotionProfile {
  readonly mode: 'disabled'
  readonly reason: string
}

export interface SourceRigMouthMotionProfile {
  readonly mode: 'source-rig'
  readonly sourcePose: 'open'
  readonly jawBone: string
  readonly tongueBones: readonly string[]
  readonly rotationAxis: 'X' | 'Y' | 'Z'
  readonly closeDegrees: number
  readonly minimumJawWeightedVertices: number
  readonly minimumTongueWeightedVertices: number
  readonly maximumAffectedVertexFraction: number
  readonly humanReviewStatus: 'pending' | 'approved'
}

export interface CuratedComponentSelector {
  readonly centroidXMinimum?: number
  readonly centroidXMaximum?: number
  readonly centroidZMaximum: number
  readonly maximumComponentVertices: number
  readonly expectedComponentCount: number
  readonly expectedVertexCount: number
  readonly expectedVertexTolerance: number
  readonly softTissueVertexCounts: readonly number[]
  readonly softTissueAngleScale: number
  readonly largestComponentRegion?: {
    readonly componentVertexCounts?: readonly number[]
    readonly xRampStart: number
    readonly xRampEnd: number
    readonly fullWeightZ: number
    readonly zeroWeightZ: number
    readonly expectedVertexCount: number
  }
}

export interface CuratedMouthMotionProfile {
  readonly mode: 'curated-components'
  readonly sourcePose: 'open'
  readonly hingePivot: readonly [number, number, number]
  readonly rotationAxis: 'X' | 'Y' | 'Z'
  readonly closeDegrees: number
  readonly componentSelector: CuratedComponentSelector
  readonly maximumAffectedVertexFraction: number
  readonly humanReviewStatus: 'pending' | 'approved'
}

export type MouthMotionProfile =
  | DisabledMouthMotionProfile
  | SourceRigMouthMotionProfile
  | CuratedMouthMotionProfile

export interface SourceProfile {
  readonly title: string
  readonly author: string
  readonly pageUrl: string
  readonly licenseId: string
  readonly licenseName: string
  readonly licenseUrl: string
  readonly accessedOn: string
  readonly directSourceVerified: boolean
  readonly downloadAllowed: boolean
  readonly modificationAllowed: boolean
  readonly redistributionAllowed: boolean
  readonly sourceModelPath: string
  readonly sourceArchivePath?: string
  readonly evidencePaths: readonly string[]
}

export interface ScienceProfile {
  readonly displayName: string
  readonly classificationLabel: string
  readonly identityScope: string
  readonly confidence: 'high' | 'medium' | 'low'
  readonly sourceUrls: readonly string[]
  readonly uncertaintyNotes: readonly string[]
  readonly humanReviewStatus: 'pending' | 'approved'
}

export interface ModelProfile {
  readonly inputPath: string
  readonly outputPath: string
  readonly normalizedBlendPath: string
  readonly normalizationLogPath: string
  readonly landmarksPath: string
  readonly normalizationStrategy: ModelProcessingStrategy
  readonly animationStrategy: AnimationStrategyProfile
  readonly habitat: 'land' | 'water' | 'air'
  readonly motionProfile: MotionProfile
  /** Source-space body axis to align with canonical +X; omitted means longest-axis auto detection. */
  readonly sourceBodyAxis?: 'x' | 'y' | 'z'
  readonly mouthMotion: MouthMotionProfile
  readonly tailAxisSign: -1 | 1
  readonly animationRequired: boolean
  readonly expectedClip: 'Idle'
  readonly targetBytes?: number
  readonly maxBytes?: number
  readonly maxTriangles?: number
  readonly maxDrawCalls?: number
  readonly maxMaterials?: number
  readonly maxBones?: number
  readonly budgetException?: {
    /** Metrics whose requested ceilings exceed the normal review contract. */
    readonly metrics: readonly (
      | 'bytes'
      | 'triangles'
      | 'drawCalls'
      | 'materials'
      | 'bones'
    )[]
    readonly reason: string
    readonly acceptedBy: string
    readonly acceptedOn: string
  }
}

export interface PresentationProfile {
  readonly initialYawDegrees: number
  readonly initialHeadSide: 'left' | 'right'
  readonly safeAreaPadding: number
  readonly portraitSafeAreaPadding?: number
  readonly shadow: 'ground' | 'none'
  readonly shadowOpacity?: number
  readonly shadowScale?: number
  readonly shadowDepthScale?: number
  readonly shadowHorizontalOffset?: number
  readonly toneMappingExposure?: number
}

export interface AssetProfile {
  readonly backgroundLandscapePath: string
  readonly backgroundPortraitPath: string
  readonly backgroundEvidencePath: string
  readonly posterPath: string
  /** Optional while drafting; required before a package can be promoted. */
  readonly posterPortraitPath?: string
  readonly thumbnailPath: string
  /**
   * Locale-complete narration inputs. Drafts may omit either locale, but
   * publication requires both entries and their independent listening gates.
   */
  readonly narration?: Partial<Readonly<Record<OnboardingLocale, NarrationAssetProfile>>>
  /** @deprecated Legacy Chinese-only draft input; never satisfies publication. */
  readonly narrationPath?: string
  /** @deprecated Legacy Chinese-only draft input; never satisfies publication. */
  readonly narrationScriptPath?: string
  /** @deprecated Legacy Chinese-only listening gate. */
  readonly audioHumanReviewStatus?: 'pending' | 'approved'
}

export type OnboardingLocale = 'zh-CN' | 'en'
export type NarrationLanguage = 'Chinese' | 'English'

export interface NarrationAssetProfile {
  readonly path: string
  readonly scriptPath: string
  readonly metricsPath?: string
  readonly speaker: string
  readonly language: NarrationLanguage
  readonly humanReviewStatus: 'pending' | 'approved'
}

export interface ApprovalProfile {
  readonly scientific: boolean
  readonly visual: boolean
  readonly motion: boolean
  readonly audio: boolean
  /** Required for publication; the legacy aggregate remains readable. */
  readonly audioByLocale?: Partial<Readonly<Record<OnboardingLocale, boolean>>>
  readonly production: boolean
  readonly approvedBy?: string
  readonly approvedOn?: string
}

export interface AnimalOnboardingProfile {
  readonly schemaVersion: 1
  readonly id: string
  readonly status: 'draft'
  readonly source: SourceProfile
  readonly science: ScienceProfile
  readonly model: ModelProfile
  readonly presentation: PresentationProfile
  readonly assets: AssetProfile
  readonly runDirectory: string
  readonly proposedCollectionIndex: number
  readonly approvals: ApprovalProfile
}

export interface GlbInspection {
  readonly version: number
  readonly declaredBytes: number
  readonly animationNames: readonly string[]
  readonly animationDurations: readonly number[]
  readonly externalUris: readonly string[]
  readonly triangles: number
  readonly drawCalls: number
  readonly materials: number
  readonly bones: number
  readonly meshes: number
  readonly textures: number
}

export interface QaReport {
  readonly schemaVersion: 1
  readonly animalId: string
  readonly generatedAt: string
  readonly profilePath: string
  readonly profileSha256: string
  readonly automatedPass: boolean
  readonly localDraftReady: boolean
  readonly ownerApproved: boolean
  readonly counts: {
    readonly hardFailures: number
    readonly warnings: number
    readonly pendingHumanOnly: number
  }
  readonly gates: readonly GateResult[]
  readonly artifacts: Readonly<Record<string, string>>
}

export interface PromotionFile {
  readonly role: string
  readonly reviewSourcePath: string
  readonly productionTargetPath: string
  readonly bytes: number
  readonly sha256: string
}

export interface PromotionEvidenceFile {
  readonly role: string
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export interface PromotionGeneratedFile {
  readonly role: string
  readonly productionTargetPath: string
  readonly bytes: number
  readonly sha256: string
}

export interface PromotionBackgroundSource {
  readonly title: string
  readonly sourcePath: string
  readonly prompt: string
  readonly generatedOn: string
  readonly tool: string
  readonly sourceBytes: number
  readonly sourceSha256: string
  readonly runtimeBytes: number
  readonly runtimeSha256: string
}

export interface PromotionNarrationRecord {
  readonly locale: OnboardingLocale
  readonly script: string
  readonly generatedOn: string
  readonly package: string
  readonly packageVersion: string
  readonly model: string
  readonly modelRevision: string
  readonly speaker: string
  readonly language: string
  readonly seed: number
  readonly bytes: number
  readonly sha256: string
  readonly humanListeningReview: 'pending' | 'approved'
  readonly publicDistributionDecision: 'pending' | 'approved'
}

export interface PromotionManifest {
  readonly schemaVersion: 1
  readonly animalId: string
  readonly status: 'draft'
  readonly generatedAt: string
  readonly profilePath: string
  readonly profileSha256: string
  readonly qaReport: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
    readonly profileSha256: string
  }
  readonly proposedCollectionIndex: number
  readonly productionDirectory: string
  readonly source: SourceProfile & {
    readonly sourceModelBytes: number
    readonly sourceModelSha256: string
  }
  readonly files: readonly PromotionFile[]
  readonly generatedFiles: readonly PromotionGeneratedFile[]
  readonly evidenceFiles: readonly PromotionEvidenceFile[]
  readonly derivation: {
    readonly backgrounds: string
    readonly posterAndThumbnail: string
    readonly narration: string
  }
  readonly gates: readonly GateResult[]
  readonly presentation: PresentationProfile
  readonly motionProfile: MotionProfile
  readonly mouthMotion: MouthMotionProfile
  readonly landmarksPath: string
  readonly qaReportPath: string
  readonly publication?: {
    readonly reviewContentPaths: Readonly<Record<OnboardingLocale, string>>
    readonly reviewPackagePath: string
    readonly modelModifications: readonly [string, ...string[]]
    readonly backgrounds: {
      readonly landscape: PromotionBackgroundSource
      readonly portrait: PromotionBackgroundSource
    }
    readonly narration: Readonly<Record<OnboardingLocale, PromotionNarrationRecord>>
    readonly editorialReview: Readonly<
      Record<
        OnboardingLocale,
        {
          readonly reviewedBy: string
          readonly reviewedOn: string
          readonly pendingMarkers: readonly string[]
        }
      >
    >
    readonly scientificReviewStatus: 'pending' | 'approved'
    readonly mouthReviewStatus: 'pending' | 'approved' | 'not-applicable'
  }
  readonly approvalRecordPath?: string
  readonly approvals: ApprovalProfile
  readonly automatedPass: boolean
  readonly ownerApproved: boolean
}
