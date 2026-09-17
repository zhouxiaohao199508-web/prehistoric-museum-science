export interface CompositionMetrics {
  readonly hasModelBounds: boolean
  readonly modelPixelCount: number
  readonly modelPixelFillRatio: number
  readonly safeFrameCoverage: number
  readonly withinSafeFrame: boolean
  readonly forbiddenOverlapPixels: number
  readonly overflowPixels: number
}

export function compositionMetricsPass(
  metrics: CompositionMetrics,
): boolean {
  return (
    metrics.hasModelBounds &&
    metrics.modelPixelCount >= 64 &&
    metrics.modelPixelFillRatio >= 0.005 &&
    metrics.safeFrameCoverage >= 0.05 &&
    metrics.safeFrameCoverage <= 0.8 &&
    metrics.withinSafeFrame &&
    metrics.forbiddenOverlapPixels <= 24 &&
    metrics.overflowPixels <= 1
  )
}
