import { MathUtils, Vector3, type Box3 } from 'three'

export interface CameraFit {
  distance: number
  far: number
  near: number
  position: Vector3
  target: Vector3
}

export interface CameraFitOptions {
  aspect: number
  bounds: Box3
  fieldOfViewDegrees: number
  modelScale?: number
  paddingFraction: number
  viewDirection?: Vector3
}

export interface CompositionViewOffsetOptions {
  compositionHeight: number
  compositionLeft: number
  compositionTop: number
  compositionWidth: number
  horizontalOffsetFraction?: number
  verticalOffsetFraction?: number
  viewportHeight: number
  viewportWidth: number
}

const MIN_EXTENT = 0.001

export function computeCompositionFieldOfView(
  fullFieldOfViewDegrees: number,
  viewportHeight: number,
  compositionHeight: number,
): number {
  const safeViewportHeight = Math.max(viewportHeight, 1)
  const heightFraction = MathUtils.clamp(
    compositionHeight / safeViewportHeight,
    MIN_EXTENT,
    1,
  )
  const fullHalfTangent = Math.tan(
    MathUtils.degToRad(fullFieldOfViewDegrees) / 2,
  )

  return MathUtils.radToDeg(
    2 * Math.atan(fullHalfTangent * heightFraction),
  )
}

export function computeCompositionViewOffset({
  compositionHeight,
  compositionLeft,
  compositionTop,
  compositionWidth,
  horizontalOffsetFraction = 0,
  verticalOffsetFraction = 0,
  viewportHeight,
  viewportWidth,
}: CompositionViewOffsetOptions): { x: number; y: number } {
  const clampedHorizontalOffset = MathUtils.clamp(
    horizontalOffsetFraction,
    -0.25,
    0.25,
  )
  const clampedVerticalOffset = MathUtils.clamp(
    verticalOffsetFraction,
    -0.3,
    0.3,
  )
  const targetCentreX =
    compositionLeft +
    compositionWidth * (0.5 + clampedHorizontalOffset)
  const targetCentreY =
    compositionTop +
    compositionHeight * (0.5 + clampedVerticalOffset)

  return {
    x: viewportWidth / 2 - targetCentreX,
    y: viewportHeight / 2 - targetCentreY,
  }
}

export function computeCameraFit({
  aspect,
  bounds,
  fieldOfViewDegrees,
  modelScale = 1,
  paddingFraction,
  viewDirection = new Vector3(0, 0.18, 1),
}: CameraFitOptions): CameraFit {
  const safeAspect = Math.max(aspect, MIN_EXTENT)
  const size = bounds.getSize(new Vector3())
  const target = bounds.getCenter(new Vector3())
  const verticalFieldOfView = MathUtils.degToRad(fieldOfViewDegrees)
  const horizontalFieldOfView = 2 * Math.atan(Math.tan(verticalFieldOfView / 2) * safeAspect)
  const clampedPadding = MathUtils.clamp(paddingFraction, 0, 0.42)
  const clampedModelScale = MathUtils.clamp(modelScale, 0.5, 1.5)
  const usableFraction = Math.min(
    (1 - clampedPadding * 2) * clampedModelScale,
    1,
  )
  const verticalTangent = Math.max(Math.tan(verticalFieldOfView / 2), MIN_EXTENT)
  const horizontalTangent = Math.max(Math.tan(horizontalFieldOfView / 2), MIN_EXTENT)
  const direction = viewDirection.clone()
  if (direction.lengthSq() < MIN_EXTENT * MIN_EXTENT) {
    direction.set(0, 0.18, 1)
  }
  direction.normalize()

  const referenceUp =
    Math.abs(direction.y) > 0.999 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  const right = referenceUp.cross(direction).normalize()
  const cameraUp = direction.clone().cross(right).normalize()
  const corner = new Vector3()
  const offset = new Vector3()
  const depthMargin = Math.max(size.length() * 0.01, MIN_EXTENT)
  let distance = MIN_EXTENT
  let maximumAxialOffset = Number.NEGATIVE_INFINITY

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z)
        offset.copy(corner).sub(target)
        const axialOffset = offset.dot(direction)
        maximumAxialOffset = Math.max(maximumAxialOffset, axialOffset)
        distance = Math.max(
          distance,
          axialOffset +
            Math.abs(offset.dot(right)) / (horizontalTangent * usableFraction),
          axialOffset +
            Math.abs(offset.dot(cameraUp)) / (verticalTangent * usableFraction),
        )
      }
    }
  }

  distance = Math.max(distance, maximumAxialOffset + depthMargin)
  const position = target.clone().add(direction.multiplyScalar(distance))
  const nearestDepth = Math.max(distance - maximumAxialOffset, MIN_EXTENT)

  return {
    distance,
    far: Math.max(distance * 25, 100),
    near: Math.max(nearestDepth * 0.25, 0.001),
    position,
    target,
  }
}
