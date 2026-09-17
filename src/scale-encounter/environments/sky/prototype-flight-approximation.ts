/**
 * Prototype question: can a reversible rigid transform around the rendered
 * Avatar bounds centre validate a horizontal flight comparison without
 * changing the GLB, rig, model hash, source animation, or Avatar Runtime?
 */
import {
  Box3,
  Euler,
  Group,
  MathUtils,
  Quaternion,
  Vector3,
} from 'three'
import type {
  ScaleEncounterAvatar,
  ScaleEncounterAvatarMotionState,
} from '../../../viewer/scale-encounter'

export const SKY_PROTOTYPE_FLIGHT_APPROXIMATION_REVISION =
  'sky-prototype-flight-approximation-v1' as const

export const SKY_PROTOTYPE_FLIGHT_APPROXIMATION_LIMITATION =
  'Rigid whole-Avatar posture approximation for prototype wingspan composition only; it is not a final flight pose or animation and must not be baked into the GLB or Avatar Runtime.' as const

const STANDING_BODY_AXIS = new Vector3(0, 1, 0)
const IDENTITY_QUATERNION = new Quaternion()

export interface PrototypeFlightApproximationSnapshot {
  readonly approximatedBodyAxisWorld: readonly [number, number, number]
  readonly enabled: boolean
  readonly flightDirectionWorld: readonly [number, number, number]
  readonly limitation: typeof SKY_PROTOTYPE_FLIGHT_APPROXIMATION_LIMITATION
  readonly modelTransformBaked: false
  readonly pivotLocal: readonly [number, number, number]
  readonly pivotPolicy: 'rendered-source-bounds-centre-before-rigid-rotation'
  readonly pivotWorld: readonly [number, number, number]
  readonly poseSemantics: 'prototype-rigid-body-approximation'
  readonly revision: typeof SKY_PROTOTYPE_FLIGHT_APPROXIMATION_REVISION
  readonly rotationEulerDegrees: {
    readonly order: 'XYZ'
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly rotationQuaternion: {
    readonly w: number
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly sourceAnimationReclassified: false
  readonly sourceBoundsAtCurrentPlacement: Box3
  readonly sourceBoundsAtPivotCapture: Box3
  readonly standingBodyAxisWorld: readonly [0, 1, 0]
  readonly transformedDynamicBounds: Box3
}

export interface PrototypeFlightApproximation {
  readonly carrier: Group
  readonly flightDirection: Vector3
  readonly pivotLocal: Vector3
  readonly rotationQuaternion: Quaternion
  readonly sourceBoundsAtPivotCapture: Box3
  getSnapshot(): PrototypeFlightApproximationSnapshot
  setEnabled(enabled: boolean): void
}

function tuple(value: Readonly<Vector3>): readonly [number, number, number] {
  return [rounded(value.x), rounded(value.y), rounded(value.z)]
}

function rounded(value: number, places = 9): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

export function createPrototypeFlightApproximation(
  avatarRoot: Group,
  requestedFlightDirection: Readonly<Vector3>,
): PrototypeFlightApproximation {
  const flightDirection = new Vector3().copy(requestedFlightDirection)
  if (
    !Number.isFinite(flightDirection.lengthSq()) ||
    flightDirection.lengthSq() < 1e-8
  ) {
    throw new Error('sky-prototype-flight-direction-invalid')
  }
  flightDirection.normalize()

  avatarRoot.updateMatrixWorld(true)
  const sourceBoundsAtPivotCapture = new Box3().setFromObject(avatarRoot, true)
  if (sourceBoundsAtPivotCapture.isEmpty()) {
    throw new Error('sky-prototype-flight-avatar-bounds-empty')
  }
  const pivotLocal = sourceBoundsAtPivotCapture.getCenter(new Vector3())
  const rotationQuaternion = new Quaternion().setFromUnitVectors(
    STANDING_BODY_AXIS,
    flightDirection,
  )

  const carrier = new Group()
  carrier.name = 'prototype-flight-approximation-carrier'
  const rotationPivot = new Group()
  rotationPivot.name = 'prototype-flight-approximation-bounds-centre-pivot'
  rotationPivot.position.copy(pivotLocal)
  rotationPivot.quaternion.copy(rotationQuaternion)
  carrier.add(rotationPivot)
  rotationPivot.add(avatarRoot)
  avatarRoot.position.copy(pivotLocal).multiplyScalar(-1)
  carrier.updateMatrixWorld(true)

  let enabled = true
  return {
    carrier,
    flightDirection,
    pivotLocal,
    rotationQuaternion,
    sourceBoundsAtPivotCapture,
    getSnapshot: () => {
      carrier.updateMatrixWorld(true)
      const rotationEuler = new Euler().setFromQuaternion(
        rotationQuaternion,
        'XYZ',
      )
      const sourceBoundsAtCurrentPlacement = sourceBoundsAtPivotCapture
        .clone()
        .translate(carrier.position)
      const pivotWorld = rotationPivot.getWorldPosition(new Vector3())
      const transformedDynamicBounds = new Box3().setFromObject(carrier, true)
      const approximatedBodyAxisWorld = STANDING_BODY_AXIS.clone()
        .applyQuaternion(rotationQuaternion)
        .normalize()
      return {
        approximatedBodyAxisWorld: tuple(approximatedBodyAxisWorld),
        enabled,
        flightDirectionWorld: tuple(flightDirection),
        limitation: SKY_PROTOTYPE_FLIGHT_APPROXIMATION_LIMITATION,
        modelTransformBaked: false,
        pivotLocal: tuple(pivotLocal),
        pivotPolicy: 'rendered-source-bounds-centre-before-rigid-rotation',
        pivotWorld: tuple(pivotWorld),
        poseSemantics: 'prototype-rigid-body-approximation',
        revision: SKY_PROTOTYPE_FLIGHT_APPROXIMATION_REVISION,
        rotationEulerDegrees: {
          order: 'XYZ',
          x: rounded(MathUtils.radToDeg(rotationEuler.x), 6),
          y: rounded(MathUtils.radToDeg(rotationEuler.y), 6),
          z: rounded(MathUtils.radToDeg(rotationEuler.z), 6),
        },
        rotationQuaternion: {
          w: rounded(rotationQuaternion.w),
          x: rounded(rotationQuaternion.x),
          y: rounded(rotationQuaternion.y),
          z: rounded(rotationQuaternion.z),
        },
        sourceAnimationReclassified: false,
        sourceBoundsAtCurrentPlacement,
        sourceBoundsAtPivotCapture: sourceBoundsAtPivotCapture.clone(),
        standingBodyAxisWorld: [0, 1, 0],
        transformedDynamicBounds,
      }
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled
      rotationPivot.quaternion.copy(
        nextEnabled ? rotationQuaternion : IDENTITY_QUATERNION,
      )
      carrier.updateMatrixWorld(true)
    },
  }
}

export function prototypeFlightPivotWorldPosition(
  approximation: PrototypeFlightApproximation,
  target = new Vector3(),
): Vector3 {
  const pivot = approximation.carrier.getObjectByName(
    'prototype-flight-approximation-bounds-centre-pivot',
  )
  if (!pivot) throw new Error('sky-prototype-flight-pivot-missing')
  return pivot.getWorldPosition(target)
}

/**
 * Scene-owned adapter around the frozen Avatar instance. It changes only the
 * temporary scene graph returned to ViewerController; the source GLB, hash,
 * rig, animation clip and shared Avatar factory remain untouched.
 */
export function createSkyPrototypeFlightAvatar(
  avatar: ScaleEncounterAvatar,
  flightDirection: Readonly<Vector3>,
  enabled = true,
): ScaleEncounterAvatar {
  const approximation = createPrototypeFlightApproximation(
    avatar.root,
    flightDirection,
  )
  approximation.setEnabled(enabled)
  const initialSnapshot = approximation.getSnapshot()
  approximation.carrier.userData.scaleEncounterPrototypeFlightApproximation = {
    enabled,
    flightDirectionWorld: initialSnapshot.flightDirectionWorld,
    limitation: initialSnapshot.limitation,
    modelTransformBaked: false,
    pivotPolicy: initialSnapshot.pivotPolicy,
    poseSemantics: initialSnapshot.poseSemantics,
    revision: initialSnapshot.revision,
    sourceAnimationReclassified: false,
  }
  const syncAvatarMotionMetadata = () => {
    const source = avatar.root.userData as Record<string, unknown>
    const carrier = approximation.carrier.userData as Record<string, unknown>
    for (const key of [
      'scaleEncounterAvatarActiveClip',
      'scaleEncounterAvatarMotion',
      'scaleEncounterAvatarTravelSpeed',
    ]) {
      if (source[key] === undefined) delete carrier[key]
      else carrier[key] = source[key]
    }
  }
  syncAvatarMotionMetadata()
  const dispose = avatar.dispose
    ? () => {
        approximation.setEnabled(false)
        avatar.dispose?.()
        approximation.carrier.clear()
      }
    : undefined
  return {
    ...(dispose ? { dispose } : {}),
    bodyOrientation: 'prone',
    eyeAnchor: avatar.eyeAnchor,
    root: approximation.carrier,
    visual: avatar.visual,
    ...(avatar.leftArm ? { leftArm: avatar.leftArm } : {}),
    ...(avatar.rightArm ? { rightArm: avatar.rightArm } : {}),
    ...(avatar.torso ? { torso: avatar.torso } : {}),
    ...(avatar.baseLeftArmRotationX === undefined
      ? {}
      : { baseLeftArmRotationX: avatar.baseLeftArmRotationX }),
    ...(avatar.baseRightArmRotationX === undefined
      ? {}
      : { baseRightArmRotationX: avatar.baseRightArmRotationX }),
    ...(avatar.setMotionState
      ? {
          setMotionState: (motion: ScaleEncounterAvatarMotionState) => {
            avatar.setMotionState?.(motion)
            syncAvatarMotionMetadata()
          },
        }
      : {}),
    ...(avatar.updateIdle
      ? {
          updateIdle: (elapsedSeconds: number, reducedMotion: boolean) => {
            avatar.updateIdle?.(elapsedSeconds, reducedMotion)
            syncAvatarMotionMetadata()
          },
        }
      : {}),
  }
}
