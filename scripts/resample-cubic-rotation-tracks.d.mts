export function sampleCubicSplineQuaternion(
  times: ArrayLike<number>,
  splineValues: ArrayLike<number>,
  time: number,
): number[]

export function makeCubicSplineQuaternionSignsContinuous(
  splineValues: ArrayLike<number>,
): Float32Array

export function resampleCubicRotationTracks(
  inputPath: string,
  outputPath: string,
  options?: { framesPerSecond?: number },
): Promise<number>
