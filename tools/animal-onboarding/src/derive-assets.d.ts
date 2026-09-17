export function convertBackgrounds(profile: {
  readonly id: string
  readonly assets: {
    readonly backgroundLandscapePath: string
    readonly backgroundPortraitPath: string
    readonly backgroundEvidencePath: string
    readonly posterPath: string
    readonly posterPortraitPath?: string
    readonly thumbnailPath: string
  }
}): Promise<Record<string, string>>

export function pixelDifference(
  foreground: string,
  background: string,
): Promise<{
  readonly width: number
  readonly height: number
  readonly changedPixels: number
  readonly ratio: number
  readonly bbox: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  } | null
}>

export function deriveReviewImages(options: {
  readonly profile: {
    readonly assets: {
      readonly posterPath: string
      readonly posterPortraitPath: string
      readonly thumbnailPath: string
    }
  }
  readonly screenshotPath: string
  readonly portraitScreenshotPath: string
  readonly modelBounds: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
}): Promise<void>

export function makeContactSheet(
  inputPaths: readonly string[],
  outputPath: string,
): Promise<void>
