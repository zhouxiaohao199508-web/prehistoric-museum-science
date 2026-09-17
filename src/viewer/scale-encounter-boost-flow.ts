import {
  DataTexture,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  MathUtils,
  Points,
  PointsMaterial,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { BufferGeometry as ThreeBufferGeometry } from 'three'
import type {
  ScaleEncounterAvatar,
  ScaleEncounterHabitat,
} from './scale-encounter'

const WATER_BUBBLE_COUNT = 48
const WATER_STREAM_COUNT = 18
const AIR_STREAM_COUNT = 20
const FLOW_NEAR_Z = -0.28
const FLOW_FAR_Z = -8.5

interface StreamField {
  readonly geometry: BufferGeometry
  readonly line: LineSegments
  readonly material: LineBasicMaterial
  readonly phase: Float32Array
  readonly speed: Float32Array
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
}

interface BubbleField {
  readonly age: Float32Array
  readonly emitter: Uint8Array
  readonly geometry: BufferGeometry
  readonly initialized: Uint8Array
  readonly lifetime: Float32Array
  readonly material: PointsMaterial
  readonly points: Points
  readonly rise: Float32Array
  readonly speed: Float32Array
  readonly texture: DataTexture
  readonly velocityX: Float32Array
  readonly velocityY: Float32Array
  readonly velocityZ: Float32Array
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
}

interface FinWakeAnchor {
  readonly foot: Object3D
  readonly toe: Object3D
  readonly direction: Vector3
  readonly footPosition: Vector3
  readonly previousToePosition: Vector3
  readonly sweepVelocity: Vector3
  readonly toePosition: Vector3
  readonly wakeDirection: Vector3
}

interface FinWakeState {
  readonly anchors: readonly [FinWakeAnchor, FinWakeAnchor]
  initialized: boolean
}

export interface ScaleEncounterBoostFlowEffect {
  readonly habitat: 'air' | 'water'
  readonly root: Group
  dispose(): void
  setIntensity(intensity: number): void
  update(
    deltaSeconds: number,
    camera: PerspectiveCamera,
    reducedMotion: boolean,
    avatar?: ScaleEncounterAvatar,
  ): void
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function randomRange(random: () => number, minimum: number, maximum: number) {
  return minimum + (maximum - minimum) * random()
}

function createBubbleTexture(): DataTexture {
  const size = 32
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size * 2 - 1
      const ny = (y + 0.5) / size * 2 - 1
      const radius = Math.hypot(nx, ny)
      const ring = Math.exp(-Math.pow((radius - 0.72) / 0.105, 2))
      const highlight = Math.exp(
        -(
          Math.pow((nx + 0.34) / 0.18, 2) +
          Math.pow((ny - 0.31) / 0.18, 2)
        ),
      )
      const edgeFade = 1 - MathUtils.smoothstep(radius, 0.82, 1)
      const alpha = MathUtils.clamp(
        (ring * 0.82 + highlight * 0.74) * edgeFade,
        0,
        1,
      )
      const offset = (y * size + x) * 4
      pixels[offset] = 218
      pixels[offset + 1] = 246
      pixels[offset + 2] = 255
      pixels[offset + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.name = 'scale-encounter-water-bubble-texture'
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function createBubbleField(random: () => number): BubbleField {
  const age = new Float32Array(WATER_BUBBLE_COUNT)
  const emitter = new Uint8Array(WATER_BUBBLE_COUNT)
  const initialized = new Uint8Array(WATER_BUBBLE_COUNT)
  const lifetime = new Float32Array(WATER_BUBBLE_COUNT)
  const x = new Float32Array(WATER_BUBBLE_COUNT)
  const y = new Float32Array(WATER_BUBBLE_COUNT)
  const z = new Float32Array(WATER_BUBBLE_COUNT)
  const speed = new Float32Array(WATER_BUBBLE_COUNT)
  const rise = new Float32Array(WATER_BUBBLE_COUNT)
  const velocityX = new Float32Array(WATER_BUBBLE_COUNT)
  const velocityY = new Float32Array(WATER_BUBBLE_COUNT)
  const velocityZ = new Float32Array(WATER_BUBBLE_COUNT)
  const positions = new Float32Array(WATER_BUBBLE_COUNT * 3)
  for (let index = 0; index < WATER_BUBBLE_COUNT; index += 1) {
    age[index] = randomRange(random, 0, 1.25)
    emitter[index] = index % 2
    lifetime[index] = randomRange(random, 0.75, 1.45)
    speed[index] = randomRange(random, 0.76, 1.28)
    rise[index] = randomRange(random, 0.035, 0.095)
  }

  const geometry = new ThreeBufferGeometry()
  geometry.name = 'scale-encounter-water-bubbles-geometry'
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const texture = createBubbleTexture()
  const material = new PointsMaterial({
    color: 0xdaf7ff,
    depthWrite: false,
    map: texture,
    opacity: 0,
    size: 0.085,
    sizeAttenuation: true,
    transparent: true,
  })
  material.name = 'scale-encounter-water-bubbles-material'
  material.toneMapped = false
  const points = new Points(geometry, material)
  points.name = 'scale-encounter-water-boost-bubbles'
  points.frustumCulled = false
  points.renderOrder = 18
  points.userData.scaleEncounterBoostParticleCount = WATER_BUBBLE_COUNT
  return {
    age,
    emitter,
    geometry,
    initialized,
    lifetime,
    material,
    points,
    rise,
    speed,
    texture,
    velocityX,
    velocityY,
    velocityZ,
    x,
    y,
    z,
  }
}

function createStreamField(
  habitat: 'air' | 'water',
  random: () => number,
): StreamField {
  const count = habitat === 'air' ? AIR_STREAM_COUNT : WATER_STREAM_COUNT
  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const z = new Float32Array(count)
  const speed = new Float32Array(count)
  const phase = new Float32Array(count)
  const positions = new Float32Array(count * 2 * 3)
  for (let index = 0; index < count; index += 1) {
    x[index] =
      habitat === 'water'
        ? randomRange(random, -0.055, 0.055)
        : randomRange(random, -2.65, 2.65)
    y[index] =
      habitat === 'water'
        ? randomRange(random, -0.04, 0.04)
        : randomRange(random, -1.5, 1.5)
    z[index] =
      habitat === 'water'
        ? randomRange(random, 0, 1)
        : randomRange(random, FLOW_FAR_Z, -0.6)
    speed[index] = randomRange(random, 0.78, 1.22)
    phase[index] = randomRange(random, 0, Math.PI * 2)
  }
  const geometry = new ThreeBufferGeometry()
  geometry.name = `scale-encounter-${habitat}-stream-geometry`
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const material = new LineBasicMaterial({
    color: habitat === 'water' ? 0xbcefff : 0xe8f5ff,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  })
  material.name = `scale-encounter-${habitat}-stream-material`
  material.toneMapped = false
  const line = new LineSegments(geometry, material)
  line.name = `scale-encounter-${habitat}-boost-streams`
  line.frustumCulled = false
  line.renderOrder = 17
  line.userData.scaleEncounterBoostStreamCount = count
  return { geometry, line, material, phase, speed, x, y, z }
}

function updateStreamField(
  field: StreamField,
  habitat: 'air' | 'water',
  deltaSeconds: number,
  intensity: number,
  elapsedSeconds: number,
) {
  const positions = field.geometry.getAttribute('position')
  const count = field.z.length
  const baseTravel = habitat === 'air' ? 0.75 : 0.46
  const boostTravel = habitat === 'air' ? 10.4 : 7.1
  const streakLength =
    habitat === 'air' ? 0.34 + intensity * 1.05 : 0.2 + intensity * 0.62
  for (let index = 0; index < count; index += 1) {
    field.z[index] =
      field.z[index]! +
      deltaSeconds * (baseTravel + boostTravel * intensity) * field.speed[index]!
    if (field.z[index]! > FLOW_NEAR_Z) {
      field.z[index] = FLOW_FAR_Z - (index / count) * 1.4
    }
    const drift = Math.sin(elapsedSeconds * 0.7 + field.phase[index]!) * 0.025
    const offset = index * 6
    positions.array[offset] = field.x[index]! + drift
    positions.array[offset + 1] = field.y[index]!
    positions.array[offset + 2] = field.z[index]!
    positions.array[offset + 3] = field.x[index]! - drift
    positions.array[offset + 4] = field.y[index]! + (habitat === 'water' ? 0.025 : 0)
    positions.array[offset + 5] = field.z[index]! - streakLength * field.speed[index]!
  }
  positions.needsUpdate = true
}

function createFinWakeAnchor(
  avatar: ScaleEncounterAvatar,
  side: 'Left' | 'Right',
): FinWakeAnchor | null {
  const foot = avatar.visual.getObjectByName(`${side}Foot`)
  const toe = avatar.visual.getObjectByName(`${side}ToeBase`)
  if (!foot || !toe) return null
  return {
    direction: new Vector3(),
    foot,
    footPosition: new Vector3(),
    previousToePosition: new Vector3(),
    sweepVelocity: new Vector3(),
    toe,
    toePosition: new Vector3(),
    wakeDirection: new Vector3(),
  }
}

function createFinWakeState(
  avatar: ScaleEncounterAvatar,
): FinWakeState | null {
  const left = createFinWakeAnchor(avatar, 'Left')
  const right = createFinWakeAnchor(avatar, 'Right')
  if (!left || !right) return null
  return { anchors: [left, right], initialized: false }
}

function updateFinWakeAnchors(
  state: FinWakeState,
  deltaSeconds: number,
): void {
  const stepSeconds = Math.max(deltaSeconds, 1 / 240)
  for (const anchor of state.anchors) {
    anchor.foot.getWorldPosition(anchor.footPosition)
    anchor.toe.getWorldPosition(anchor.toePosition)
    anchor.direction
      .subVectors(anchor.toePosition, anchor.footPosition)
      .normalize()
    if (state.initialized) {
      anchor.sweepVelocity
        .subVectors(anchor.toePosition, anchor.previousToePosition)
        .divideScalar(stepSeconds)
      if (anchor.sweepVelocity.lengthSq() > 1.44) {
        anchor.sweepVelocity.setLength(1.2)
      }
    } else {
      anchor.sweepVelocity.set(0, 0, 0)
    }
    // Water leaves the flexible trailing edge along the fin blade. Mixing in
    // the opposite of the blade's instantaneous sweep makes the wake alternate
    // above and below the swimmer as the flutter kick changes direction.
    anchor.wakeDirection
      .copy(anchor.direction)
      .addScaledVector(anchor.sweepVelocity, -0.28)
      .normalize()
    anchor.previousToePosition.copy(anchor.toePosition)
  }
  state.initialized = true
}

const WORLD_UP = new Vector3(0, 1, 0)

function finWakeBasis(
  direction: Readonly<Vector3>,
  side: Vector3,
  normal: Vector3,
): void {
  side.crossVectors(direction, WORLD_UP)
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
  else side.normalize()
  normal.crossVectors(side, direction).normalize()
}

function updateWaterStreamField(
  field: StreamField,
  state: FinWakeState,
  deltaSeconds: number,
  intensity: number,
): void {
  const positions = field.geometry.getAttribute('position')
  const count = field.z.length
  const side = new Vector3()
  const normal = new Vector3()
  const start = new Vector3()
  const trailSpeed = 0.38 + intensity * 1.7
  for (let index = 0; index < count; index += 1) {
    const anchor = state.anchors[index % 2]!
    field.z[index] =
      (field.z[index]! +
        deltaSeconds * trailSpeed * field.speed[index]!) %
      1
    finWakeBasis(anchor.wakeDirection, side, normal)
    const trailDistance = 0.045 + field.z[index]! * (0.5 + intensity * 0.52)
    start
      .copy(anchor.toePosition)
      .addScaledVector(anchor.wakeDirection, trailDistance)
      .addScaledVector(side, field.x[index]!)
      .addScaledVector(
        normal,
        field.y[index]! + Math.sin(field.phase[index]! + field.z[index]! * 8) * 0.018,
      )
    const streakLength = (0.055 + intensity * 0.18) * field.speed[index]!
    const offset = index * 6
    positions.array[offset] = start.x
    positions.array[offset + 1] = start.y
    positions.array[offset + 2] = start.z
    positions.array[offset + 3] =
      start.x + anchor.wakeDirection.x * streakLength
    positions.array[offset + 4] =
      start.y + anchor.wakeDirection.y * streakLength
    positions.array[offset + 5] =
      start.z + anchor.wakeDirection.z * streakLength
  }
  positions.needsUpdate = true
}

function respawnBubble(
  field: BubbleField,
  index: number,
  anchor: FinWakeAnchor,
  intensity: number,
  initialTrailFraction: number,
): void {
  const side = new Vector3()
  const normal = new Vector3()
  finWakeBasis(anchor.wakeDirection, side, normal)
  const jitterSide = Math.sin(index * 17.17) * 0.032
  const jitterNormal = Math.cos(index * 11.73) * 0.026
  const initialTrail = initialTrailFraction * (0.42 + intensity * 0.38)
  const position = anchor.toePosition
    .clone()
    .addScaledVector(anchor.wakeDirection, initialTrail)
    .addScaledVector(side, jitterSide)
    .addScaledVector(normal, jitterNormal)
  const flowSpeed = (0.18 + intensity * 0.72) * field.speed[index]!
  const velocity = anchor.wakeDirection
    .clone()
    .multiplyScalar(flowSpeed)
    .addScaledVector(WORLD_UP, field.rise[index]!)
    .addScaledVector(anchor.sweepVelocity, -0.08)
  field.x[index] = position.x
  field.y[index] = position.y
  field.z[index] = position.z
  field.velocityX[index] = velocity.x
  field.velocityY[index] = velocity.y
  field.velocityZ[index] = velocity.z
  field.age[index] = initialTrailFraction * field.lifetime[index]!
  field.initialized[index] = 1
}

function updateBubbleField(
  field: BubbleField,
  state: FinWakeState,
  deltaSeconds: number,
  intensity: number,
) {
  const positions = field.geometry.getAttribute('position')
  for (let index = 0; index < field.z.length; index += 1) {
    field.age[index] = field.age[index]! + deltaSeconds
    if (
      field.initialized[index] === 0 ||
      field.age[index]! >= field.lifetime[index]!
    ) {
      respawnBubble(
        field,
        index,
        state.anchors[field.emitter[index]!]!,
        intensity,
        field.initialized[index] === 0 ? (index % 12) / 12 : 0,
      )
    } else {
      field.x[index] = field.x[index]! + field.velocityX[index]! * deltaSeconds
      field.y[index] = field.y[index]! + field.velocityY[index]! * deltaSeconds
      field.z[index] = field.z[index]! + field.velocityZ[index]! * deltaSeconds
      field.velocityY[index] = field.velocityY[index]! + deltaSeconds * 0.018
    }
    const offset = index * 3
    positions.array[offset] = field.x[index]!
    positions.array[offset + 1] = field.y[index]!
    positions.array[offset + 2] = field.z[index]!
  }
  positions.needsUpdate = true
}

export function createScaleEncounterBoostFlowEffect(
  habitat: ScaleEncounterHabitat,
): ScaleEncounterBoostFlowEffect | null {
  if (habitat === 'land') return null

  const random = createSeededRandom(habitat === 'water' ? 0x5ea2026 : 0xa172026)
  const root = new Group()
  root.name = `scale-encounter-${habitat}-boost-flow`
  root.visible = false
  root.userData.scaleEncounterBoostFlow = habitat
  if (habitat === 'water') {
    root.userData.scaleEncounterBoostFlowModel =
      'paired-fin-anchored-flutter-wakes'
  }
  const streams = createStreamField(habitat, random)
  root.add(streams.line)
  const bubbles = habitat === 'water' ? createBubbleField(random) : null
  if (bubbles) root.add(bubbles.points)

  let disposed = false
  let elapsedSeconds = 0
  let finWakeAvatar: ScaleEncounterAvatar | null = null
  let finWakeState: FinWakeState | null = null
  let intensity = 0

  const cameraPosition = root.position.clone()
  const cameraQuaternion = root.quaternion.clone()

  return {
    habitat,
    root,
    dispose: () => {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      streams.geometry.dispose()
      streams.material.dispose()
      if (bubbles) {
        bubbles.geometry.dispose()
        bubbles.material.dispose()
        bubbles.texture.dispose()
      }
      root.clear()
    },
    setIntensity: (nextIntensity) => {
      intensity = MathUtils.clamp(
        Number.isFinite(nextIntensity) ? nextIntensity : 0,
        0,
        1,
      )
      root.userData.scaleEncounterBoostIntensity = intensity
    },
    update: (deltaSeconds, camera, reducedMotion, avatar) => {
      if (disposed) return
      const renderedIntensity = reducedMotion ? 0 : intensity
      root.visible = renderedIntensity > 0.012
      streams.material.opacity =
        renderedIntensity * (habitat === 'air' ? 0.19 : 0.13)
      if (bubbles) bubbles.material.opacity = renderedIntensity * 0.72
      if (!root.visible) return

      const stepSeconds = Math.max(0, deltaSeconds)
      elapsedSeconds += stepSeconds
      if (habitat === 'water') {
        if (!avatar) {
          root.visible = false
          return
        }
        if (finWakeAvatar !== avatar) {
          finWakeAvatar = avatar
          finWakeState = createFinWakeState(avatar)
          bubbles?.initialized.fill(0)
        }
        if (!finWakeState) {
          root.visible = false
          return
        }
        root.position.set(0, 0, 0)
        root.quaternion.identity()
        updateFinWakeAnchors(finWakeState, stepSeconds)
        updateWaterStreamField(
          streams,
          finWakeState,
          stepSeconds,
          renderedIntensity,
        )
        if (bubbles) {
          updateBubbleField(
            bubbles,
            finWakeState,
            stepSeconds,
            renderedIntensity,
          )
        }
        root.userData.scaleEncounterWaterWakeAnchorNames = [
          finWakeState.anchors[0].toe.name,
          finWakeState.anchors[1].toe.name,
        ]
        root.userData.scaleEncounterWaterWakeDirections =
          finWakeState.anchors.map((anchor) => anchor.wakeDirection.toArray())
      } else {
        camera.getWorldPosition(cameraPosition)
        camera.getWorldQuaternion(cameraQuaternion)
        root.position.copy(cameraPosition)
        root.quaternion.copy(cameraQuaternion)
        updateStreamField(
          streams,
          habitat,
          stepSeconds,
          renderedIntensity,
          elapsedSeconds,
        )
      }
    },
  }
}
