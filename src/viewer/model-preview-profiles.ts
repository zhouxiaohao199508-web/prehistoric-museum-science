export const MODEL_PREVIEW_CONTRACT_VERSION = 3
export const MODEL_PREVIEW_MANIFEST_FILE = 'model-preview.manifest.json'

/**
 * These values are part of the generated-preview camera/layout contract.
 * Bump MODEL_PREVIEW_CONTRACT_VERSION and regenerate every preview whenever
 * the full-screen canvas, composition frame, camera, pixel ratio, or preview
 * object-fit behavior changes.
 */
export const MODEL_PREVIEW_CAMERA_FIELD_OF_VIEW_DEGREES = 34
export const MODEL_PREVIEW_MAX_PIXEL_RATIO = 2
export const MODEL_PREVIEW_PHONE_PORTRAIT_SCALE = 1.15
export const MODEL_PREVIEW_LAYOUT_COORDINATE_SYSTEM =
  'fixed-fullscreen-canvas+composition-frame-v1'
export const MODEL_PREVIEW_OBJECT_FIT = 'contain'

export function modelScaleForViewport(
  viewportWidth: number,
  viewportHeight: number,
): number {
  return viewportHeight > viewportWidth && viewportWidth <= 599
    ? MODEL_PREVIEW_PHONE_PORTRAIT_SCALE
    : 1
}

/**
 * A preview profile describes the stable inner model viewport, not the full
 * browser window. Every animal uses the same profiles; adding an animal never
 * adds media queries or viewport-specific positioning code.
 */
export const modelPreviewProfiles = [
  {
    fileName: 'preview-landscape-compact.webp',
    height: 650,
    key: 'landscapeCompact',
    media: '(orientation: landscape) and (max-height: 500px)',
    referenceHeight: 390,
    referenceWidth: 844,
    width: 1250,
  },
  {
    fileName: 'preview-desktop-wide.webp',
    height: 800,
    key: 'desktopWide',
    media: '(orientation: landscape) and (min-aspect-ratio: 17 / 10)',
    referenceHeight: 720,
    referenceWidth: 1280,
    width: 1200,
  },
  {
    fileName: 'preview-phone-compact.webp',
    height: 1000,
    key: 'phonePortraitCompact',
    media:
      '(orientation: portrait) and (max-width: 599px) and (max-height: 700px)',
    referenceHeight: 640,
    referenceWidth: 360,
    width: 875,
  },
  {
    fileName: 'preview-phone-tall.webp',
    height: 1000,
    key: 'phonePortraitTall',
    media: '(orientation: portrait) and (max-width: 599px)',
    referenceHeight: 844,
    referenceWidth: 390,
    width: 640,
  },
  {
    fileName: 'preview-tablet-portrait.webp',
    height: 960,
    key: 'tabletPortrait',
    media: '(orientation: portrait)',
    referenceHeight: 1024,
    referenceWidth: 768,
    width: 900,
  },
  {
    fileName: 'preview-desktop-standard.webp',
    height: 960,
    key: 'desktopStandard',
    media: '(orientation: landscape)',
    referenceHeight: 900,
    referenceWidth: 1440,
    width: 1200,
  },
] as const

export type ModelPreviewProfile = (typeof modelPreviewProfiles)[number]
export type ModelPreviewProfileKey = ModelPreviewProfile['key']
export type ModelPreviewFileName = ModelPreviewProfile['fileName']

export function selectModelPreviewProfile(
  matches: (media: string) => boolean,
): ModelPreviewProfile {
  return (
    modelPreviewProfiles.find(({ media }) => matches(media)) ??
    modelPreviewProfiles[modelPreviewProfiles.length - 1]!
  )
}

export interface ModelPreviewManifest {
  readonly animalId: string
  readonly contractVersion: number
  readonly generatedAt: string
  readonly presentationSignature: string
  readonly profiles: Readonly<
    Record<
      ModelPreviewProfileKey,
      {
        readonly bytes: number
        readonly fileName: ModelPreviewFileName
        readonly height: number
        readonly sha256: string
        readonly width: number
      }
    >
  >
  readonly sourceModel: {
    readonly bytes: number
    readonly sha256: string
  }
  readonly target: 'production' | 'review'
}
