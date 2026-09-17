import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
  type Object3D,
} from 'three'
import {
  SCALE_ENCOUNTER_DEFINITIONS,
  type ScaleEncounterAnimalId,
  type ScaleEncounterAvatarMotion,
  type ScaleEncounterGender,
  type ScaleEncounterHabitat,
} from '../viewer/scale-encounter'
import type {
  ScaleEncounterAvatarPresentationProfile,
} from './types'
export type {
  ScaleEncounterAvatarPresentationProfile,
} from './types'

export type ScaleEncounterAvatarPresentationId =
  `${ScaleEncounterGender}-${ScaleEncounterAvatarPresentationProfile}`

export type ScaleEncounterAvatarPoseProfile =
  | 'grounded-observer'
  | 'cold-weather-observer'
  | 'prone-wingsuit-glide'
  | 'horizontal-scuba-trim'

export interface ScaleEncounterAvatarPresentation {
  readonly animalId: ScaleEncounterAnimalId
  readonly bodyOrientation: 'upright' | 'prone'
  readonly equipment:
    | 'trail-daypack'
    | 'insulated-cold-weather-kit'
    | 'helmeted-wingsuit-and-parachute'
    | 'scuba-kit'
  readonly gender: ScaleEncounterGender
  readonly habitat: ScaleEncounterHabitat
  readonly id: ScaleEncounterAvatarPresentationId
  readonly pose: ScaleEncounterAvatarPoseProfile
  readonly profile: ScaleEncounterAvatarPresentationProfile
}

const PRESENTATION_BY_PROFILE: Readonly<
  Record<
    ScaleEncounterAvatarPresentationProfile,
    Omit<ScaleEncounterAvatarPresentation, 'animalId' | 'gender' | 'id'>
  >
> = {
  'land-explorer': {
    bodyOrientation: 'upright',
    equipment: 'trail-daypack',
    habitat: 'land',
    pose: 'grounded-observer',
    profile: 'land-explorer',
  },
  'snow-expedition': {
    bodyOrientation: 'upright',
    equipment: 'insulated-cold-weather-kit',
    habitat: 'land',
    pose: 'cold-weather-observer',
    profile: 'snow-expedition',
  },
  'air-wingsuit': {
    bodyOrientation: 'prone',
    equipment: 'helmeted-wingsuit-and-parachute',
    habitat: 'air',
    pose: 'prone-wingsuit-glide',
    profile: 'air-wingsuit',
  },
  'water-diver': {
    bodyOrientation: 'prone',
    equipment: 'scuba-kit',
    habitat: 'water',
    pose: 'horizontal-scuba-trim',
    profile: 'water-diver',
  },
}

export function scaleEncounterAvatarPresentationFor(
  gender: ScaleEncounterGender,
  habitat: ScaleEncounterHabitat,
  animalId: ScaleEncounterAnimalId,
): ScaleEncounterAvatarPresentation {
  const profile = SCALE_ENCOUNTER_DEFINITIONS[animalId].avatarProfile
  const presentation = PRESENTATION_BY_PROFILE[profile]
  if (presentation.habitat !== habitat) {
    throw new Error(
      `candidate-avatar-presentation-habitat-mismatch:${animalId}:${habitat}`,
    )
  }
  return {
    ...presentation,
    animalId,
    gender,
    id: `${gender}-${presentation.profile}`,
  }
}

export interface AvatarEquipmentResources {
  readonly geometries: ReadonlySet<BufferGeometry>
  readonly materials: ReadonlySet<Material>
  readonly meshes: readonly Mesh[]
}

interface MutableAvatarEquipmentResources {
  readonly geometries: Set<BufferGeometry>
  readonly materials: Set<Material>
  readonly meshes: Mesh[]
}

const WORLD_UP = new Vector3(0, 1, 0)
const LOCAL_FORWARD = new Vector3(0, 0, 1)
const UPRIGHT_VISUAL_QUATERNION = new Quaternion().setFromAxisAngle(
  WORLD_UP,
  Math.PI / 2,
)
const PRONE_VISUAL_QUATERNION = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(
    new Vector3(0, 0, -1),
    new Vector3(1, 0, 0),
    new Vector3(0, -1, 0),
  ),
)

export function orientAvatarVisualForPresentation(
  visual: Group,
  presentation: ScaleEncounterAvatarPresentation,
): void {
  visual.position.set(0, 0, 0)
  visual.scale.set(1, 1, 1)
  visual.quaternion.copy(
    presentation.bodyOrientation === 'prone'
      ? PRONE_VISUAL_QUATERNION
      : UPRIGHT_VISUAL_QUATERNION,
  )
  visual.updateMatrixWorld(true)
}

function standardMaterial(
  name: string,
  color: number,
  roughness = 0.72,
  metalness = 0,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    metalness,
    roughness,
  })
  material.name = name
  return material
}

function visorMaterial(name: string, color: number): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color,
    depthWrite: false,
    metalness: 0,
    opacity: 0.42,
    roughness: 0.12,
    side: DoubleSide,
    thickness: 0.008,
    transparent: true,
    transmission: 0.18,
  })
  material.name = name
  return material
}

function registerMaterial(
  resources: MutableAvatarEquipmentResources,
  material: Material,
): Material {
  resources.materials.add(material)
  return material
}

function registerMesh<TGeometry extends BufferGeometry>(
  resources: MutableAvatarEquipmentResources,
  geometry: TGeometry,
  material: Material,
  name: string,
): Mesh<TGeometry, Material> {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  resources.geometries.add(geometry)
  resources.meshes.push(mesh)
  return mesh
}

function socketFor(visual: Group, name: string): Object3D {
  const socket = visual.getObjectByName(name)
  if (!socket) {
    throw new Error(`candidate-avatar-missing-equipment-socket:${name}`)
  }
  return socket
}

function visualPosition(
  visual: Group,
  object: Object3D,
  target = new Vector3(),
): Vector3 {
  visual.updateMatrixWorld(true)
  object.getWorldPosition(target)
  return visual.worldToLocal(target)
}

function attachPreservingVisualPose(
  visual: Group,
  socketName: string,
  object: Object3D,
): void {
  visual.add(object)
  visual.updateMatrixWorld(true)
  const socket = socketFor(visual, socketName)
  socket.attach(object)
  visual.updateMatrixWorld(true)
}

function addBox(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  socketName: string,
  name: string,
  material: Material,
  position: Readonly<Vector3>,
  size: Readonly<Vector3>,
  rotation = new Vector3(),
): Mesh {
  const mesh = registerMesh(
    resources,
    new BoxGeometry(size.x, size.y, size.z, 2, 2, 2),
    material,
    name,
  )
  mesh.position.copy(position)
  mesh.rotation.set(rotation.x, rotation.y, rotation.z)
  attachPreservingVisualPose(visual, socketName, mesh)
  return mesh
}

function addSphere(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  socketName: string,
  name: string,
  material: Material,
  position: Readonly<Vector3>,
  scale: Readonly<Vector3>,
  topHemisphere = false,
): Mesh {
  const geometry = new SphereGeometry(
    1,
    28,
    16,
    0,
    Math.PI * 2,
    0,
    topHemisphere ? Math.PI / 2 : Math.PI,
  )
  const mesh = registerMesh(resources, geometry, material, name)
  mesh.position.copy(position)
  mesh.scale.copy(scale)
  attachPreservingVisualPose(visual, socketName, mesh)
  return mesh
}

function addTorus(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  socketName: string,
  name: string,
  material: Material,
  position: Readonly<Vector3>,
  majorRadius: number,
  tubeRadius: number,
  scale = new Vector3(1, 1, 1),
): Mesh {
  const mesh = registerMesh(
    resources,
    new TorusGeometry(majorRadius, tubeRadius, 10, 36),
    material,
    name,
  )
  mesh.position.copy(position)
  mesh.rotation.x = Math.PI / 2
  mesh.scale.copy(scale)
  attachPreservingVisualPose(visual, socketName, mesh)
  return mesh
}

function addCylinderBetween(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  socketName: string,
  name: string,
  material: Material,
  start: Readonly<Vector3>,
  end: Readonly<Vector3>,
  radius: number,
): Mesh {
  const direction = new Vector3().subVectors(end, start)
  const length = direction.length()
  if (length <= 1e-6) {
    throw new Error(`candidate-avatar-equipment-segment-empty:${name}`)
  }
  const mesh = registerMesh(
    resources,
    new CylinderGeometry(radius, radius * 1.03, length, 18, 2),
    material,
    name,
  )
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(WORLD_UP, direction.normalize())
  attachPreservingVisualPose(visual, socketName, mesh)
  return mesh
}

function addExtrudedMembrane(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  socketName: string,
  name: string,
  material: Material,
  points: readonly (readonly [number, number])[],
  depth = 0.018,
): Mesh {
  const shape = new Shape()
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  })
  geometry.translate(0, 0, -depth / 2)
  const mesh = registerMesh(resources, geometry, material, name)
  attachPreservingVisualPose(visual, socketName, mesh)
  return mesh
}

function addFin(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  side: 'Left' | 'Right',
  material: Material,
): void {
  const foot = socketFor(visual, `${side}Foot`)
  const toe = socketFor(visual, `${side}ToeBase`)
  const start = visualPosition(visual, foot)
  const toePosition = visualPosition(visual, toe)
  const direction = toePosition.sub(start).normalize()
  const blade = new Shape()
  blade.moveTo(-0.038, -0.015)
  blade.lineTo(0.038, -0.015)
  blade.lineTo(0.047, 0.09)
  blade.lineTo(0.068, 0.25)
  blade.lineTo(0, 0.295)
  blade.lineTo(-0.068, 0.25)
  blade.lineTo(-0.047, 0.09)
  blade.closePath()
  const geometry = new ExtrudeGeometry(blade, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.004,
    bevelThickness: 0.003,
    curveSegments: 1,
    depth: 0.018,
    steps: 1,
  })
  geometry.rotateX(Math.PI / 2)
  const fin = registerMesh(
    resources,
    geometry,
    material,
    `avatar-equipment-water-${side.toLowerCase()}-fin`,
  )
  fin.position.copy(start).addScaledVector(direction, 0.025)
  fin.quaternion.setFromUnitVectors(LOCAL_FORWARD, direction)
  attachPreservingVisualPose(visual, `${side}Foot`, fin)
}

function addFunctionalLimbLayers(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  prefix: 'air' | 'water',
  suitMaterial: Material,
  handMaterial: Material,
  footwearMaterial: Material,
): void {
  for (const side of ['Left', 'Right'] as const) {
    const sideId = side.toLowerCase()
    const arm = socketFor(visual, `${side}Arm`)
    const forearm = socketFor(visual, `${side}ForeArm`)
    const hand = socketFor(visual, `${side}Hand`)
    const armPosition = visualPosition(visual, arm)
    const forearmPosition = visualPosition(visual, forearm)
    const handPosition = visualPosition(visual, hand)
    addCylinderBetween(
      resources,
      visual,
      `${side}Arm`,
      `avatar-equipment-${prefix}-${sideId}-upper-sleeve`,
      suitMaterial,
      armPosition,
      forearmPosition,
      0.048,
    )
    addCylinderBetween(
      resources,
      visual,
      `${side}ForeArm`,
      `avatar-equipment-${prefix}-${sideId}-lower-sleeve`,
      suitMaterial,
      forearmPosition,
      handPosition,
      0.043,
    )
    addSphere(
      resources,
      visual,
      `${side}Hand`,
      `avatar-equipment-${prefix}-${sideId}-glove`,
      handMaterial,
      handPosition,
      new Vector3(0.13, 0.07, 0.06),
    )

    const upperLeg = socketFor(visual, `${side}UpLeg`)
    const lowerLeg = socketFor(visual, `${side}Leg`)
    const foot = socketFor(visual, `${side}Foot`)
    const toe = socketFor(visual, `${side}ToeBase`)
    const upperLegPosition = visualPosition(visual, upperLeg)
    const lowerLegPosition = visualPosition(visual, lowerLeg)
    const footPosition = visualPosition(visual, foot)
    const toePosition = visualPosition(visual, toe)
    addCylinderBetween(
      resources,
      visual,
      `${side}UpLeg`,
      `avatar-equipment-${prefix}-${sideId}-upper-leg-shell`,
      suitMaterial,
      upperLegPosition,
      lowerLegPosition,
      0.055,
    )
    addCylinderBetween(
      resources,
      visual,
      `${side}Leg`,
      `avatar-equipment-${prefix}-${sideId}-lower-leg-shell`,
      suitMaterial,
      lowerLegPosition,
      footPosition,
      0.047,
    )
    const footDirection = toePosition.clone().sub(footPosition).normalize()
    addCylinderBetween(
      resources,
      visual,
      `${side}Foot`,
      `avatar-equipment-${prefix}-${sideId}-footwear`,
      footwearMaterial,
      footPosition.clone().addScaledVector(footDirection, -0.025),
      toePosition.clone().addScaledVector(footDirection, 0.065),
      0.068,
    )
  }
}

function addTrailDaypack(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  accent: number,
): void {
  const canvas = registerMaterial(
    resources,
    standardMaterial('Avatar explorer canvas', 0x536b4f, 0.9),
  )
  const trim = registerMaterial(
    resources,
    standardMaterial('Avatar explorer safety trim', accent, 0.68),
  )
  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-land-daypack',
    canvas,
    new Vector3(0, 0.7, -0.105),
    new Vector3(0.13, 0.18, 0.072),
  )
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-land-chest-strap',
    trim,
    new Vector3(0, 0.71, 0.104),
    new Vector3(0.23, 0.025, 0.018),
  )
  for (const sign of [-1, 1]) {
    addBox(
      resources,
      visual,
      'Spine01',
      `avatar-equipment-land-shoulder-strap-${sign < 0 ? 'right' : 'left'}`,
      trim,
      new Vector3(sign * 0.105, 0.74, 0.015),
      new Vector3(0.022, 0.26, 0.026),
      new Vector3(0, 0, sign * 0.12),
    )
  }
}

function addColdWeatherKit(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  accent: number,
): void {
  const shell = registerMaterial(
    resources,
    standardMaterial('Avatar insulated shell', 0x315c6e, 0.86),
  )
  const insulation = registerMaterial(
    resources,
    standardMaterial('Avatar insulated trousers', 0x243746, 0.9),
  )
  const safetyTrim = registerMaterial(
    resources,
    standardMaterial('Avatar winter safety trim', accent, 0.72),
  )
  const boot = registerMaterial(
    resources,
    standardMaterial('Avatar insulated winter boot', 0x202a32, 0.94),
  )

  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-snow-puffer-body',
    shell,
    new Vector3(0, 0.69, 0),
    new Vector3(0.175, 0.225, 0.125),
  )
  for (const y of [0.59, 0.66, 0.73, 0.8]) {
    addTorus(
      resources,
      visual,
      'Spine01',
      `avatar-equipment-snow-quilt-${y}`,
      safetyTrim,
      new Vector3(0, y, 0),
      0.137,
      0.004,
      new Vector3(1, 1, 0.76),
    )
  }
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-snow-zipper',
    safetyTrim,
    new Vector3(0, 0.69, 0.126),
    new Vector3(0.012, 0.34, 0.012),
  )
  addTorus(
    resources,
    visual,
    'neck',
    'avatar-equipment-snow-neck-gaiter',
    safetyTrim,
    new Vector3(0, 0.865, 0),
    0.082,
    0.018,
    new Vector3(1, 1, 0.82),
  )
  addSphere(
    resources,
    visual,
    'Head',
    'avatar-equipment-snow-beanie',
    shell,
    new Vector3(0, 1.075, 0),
    new Vector3(0.145, 0.115, 0.132),
    true,
  )
  addTorus(
    resources,
    visual,
    'Head',
    'avatar-equipment-snow-beanie-band',
    safetyTrim,
    new Vector3(0, 1.055, 0),
    0.125,
    0.018,
    new Vector3(1, 1, 0.88),
  )

  for (const side of ['Left', 'Right'] as const) {
    const arm = socketFor(visual, `${side}Arm`)
    const forearm = socketFor(visual, `${side}ForeArm`)
    const hand = socketFor(visual, `${side}Hand`)
    const armPosition = visualPosition(visual, arm)
    const forearmPosition = visualPosition(visual, forearm)
    const handPosition = visualPosition(visual, hand)
    addCylinderBetween(
      resources,
      visual,
      `${side}Arm`,
      `avatar-equipment-snow-${side.toLowerCase()}-upper-sleeve`,
      shell,
      armPosition,
      forearmPosition,
      0.057,
    )
    addCylinderBetween(
      resources,
      visual,
      `${side}ForeArm`,
      `avatar-equipment-snow-${side.toLowerCase()}-lower-sleeve`,
      shell,
      forearmPosition,
      handPosition,
      0.052,
    )
    addSphere(
      resources,
      visual,
      `${side}Hand`,
      `avatar-equipment-snow-${side.toLowerCase()}-mitten`,
      safetyTrim,
      handPosition
        .clone()
        .add(new Vector3(side === 'Left' ? 0.04 : -0.04, 0, 0)),
      new Vector3(0.062, 0.052, 0.046),
    )

    const upperLeg = socketFor(visual, `${side}UpLeg`)
    const lowerLeg = socketFor(visual, `${side}Leg`)
    const foot = socketFor(visual, `${side}Foot`)
    const upperLegPosition = visualPosition(visual, upperLeg)
    const lowerLegPosition = visualPosition(visual, lowerLeg)
    const footPosition = visualPosition(visual, foot)
    addCylinderBetween(
      resources,
      visual,
      `${side}UpLeg`,
      `avatar-equipment-snow-${side.toLowerCase()}-upper-trouser`,
      insulation,
      upperLegPosition,
      lowerLegPosition,
      0.063,
    )
    addCylinderBetween(
      resources,
      visual,
      `${side}Leg`,
      `avatar-equipment-snow-${side.toLowerCase()}-lower-trouser`,
      insulation,
      lowerLegPosition,
      footPosition,
      0.056,
    )
    addBox(
      resources,
      visual,
      `${side}Foot`,
      `avatar-equipment-snow-${side.toLowerCase()}-boot`,
      boot,
      footPosition.clone().add(new Vector3(0, -0.018, 0.045)),
      new Vector3(0.11, 0.105, 0.205),
    )
  }
}

function addWingsuitAndParachute(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  accent: number,
): void {
  const suit = registerMaterial(
    resources,
    standardMaterial('Avatar wingsuit shell', 0x203448, 0.76),
  )
  const membrane = registerMaterial(
    resources,
    standardMaterial('Avatar wingsuit membrane', accent, 0.7),
  )
  membrane.side = DoubleSide
  const harness = registerMaterial(
    resources,
    standardMaterial('Avatar parachute harness', 0x101820, 0.82),
  )
  const helmet = registerMaterial(
    resources,
    standardMaterial('Avatar flight helmet', 0xe8eef2, 0.44),
  )
  const visor = registerMaterial(
    resources,
    visorMaterial('Avatar integrated flight visor', 0x6ca6c1),
  )

  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-air-suit-torso',
    suit,
    new Vector3(0, 0.69, 0),
    new Vector3(0.16, 0.215, 0.105),
  )
  addFunctionalLimbLayers(
    resources,
    visual,
    'air',
    suit,
    harness,
    harness,
  )
  addExtrudedMembrane(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-air-left-wing',
    membrane,
    [
      [0.095, 0.77],
      [0.12, 0.54],
      [0.435, 0.62],
      [0.43, 0.72],
    ],
  )
  addExtrudedMembrane(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-air-right-wing',
    membrane,
    [
      [-0.095, 0.77],
      [-0.12, 0.54],
      [-0.435, 0.62],
      [-0.43, 0.72],
    ],
  )
  addExtrudedMembrane(
    resources,
    visual,
    'Hips',
    'avatar-equipment-air-leg-wing',
    membrane,
    [
      [-0.09, 0.53],
      [-0.11, 0.09],
      [0.11, 0.09],
      [0.09, 0.53],
      [0, 0.42],
    ],
  )
  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-air-parachute-container',
    harness,
    new Vector3(0, 0.7, -0.145),
    new Vector3(0.14, 0.19, 0.075),
  )
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-air-reserve-handle',
    membrane,
    new Vector3(0.12, 0.68, 0.105),
    new Vector3(0.035, 0.055, 0.022),
  )
  for (const sign of [-1, 1]) {
    addBox(
      resources,
      visual,
      'Spine01',
      `avatar-equipment-air-harness-${sign < 0 ? 'right' : 'left'}`,
      harness,
      new Vector3(sign * 0.09, 0.69, 0.105),
      new Vector3(0.026, 0.35, 0.026),
      new Vector3(0, 0, sign * 0.08),
    )
    addTorus(
      resources,
      visual,
      sign < 0 ? 'RightUpLeg' : 'LeftUpLeg',
      `avatar-equipment-air-leg-strap-${sign < 0 ? 'right' : 'left'}`,
      harness,
      new Vector3(sign * 0.065, 0.46, 0),
      0.06,
      0.012,
      new Vector3(1, 1, 0.82),
    )
  }
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-air-chest-strap',
    harness,
    new Vector3(0, 0.75, 0.11),
    new Vector3(0.235, 0.022, 0.024),
  )
  addBox(
    resources,
    visual,
    'LeftForeArm',
    'avatar-equipment-air-visible-altimeter',
    membrane,
    new Vector3(0.31, 0.76, 0.035),
    new Vector3(0.045, 0.055, 0.02),
  )
  addSphere(
    resources,
    visual,
    'Head',
    'avatar-equipment-air-helmet-shell',
    helmet,
    new Vector3(0, 1.01, 0),
    new Vector3(0.155, 0.165, 0.145),
  )
  addTorus(
    resources,
    visual,
    'Head',
    'avatar-equipment-air-helmet-rim',
    harness,
    new Vector3(0, 1.01, 0),
    0.132,
    0.014,
    new Vector3(1, 1, 0.88),
  )
  addBox(
    resources,
    visual,
    'Head',
    'avatar-equipment-air-integrated-visor',
    visor,
    new Vector3(0, 1.005, 0.121),
    new Vector3(0.22, 0.095, 0.018),
    new Vector3(-0.08, 0, 0),
  )
}

function addScubaKit(
  resources: MutableAvatarEquipmentResources,
  visual: Group,
  accent: number,
): void {
  const neoprene = registerMaterial(
    resources,
    standardMaterial('Avatar neoprene and BCD', 0x162b3a, 0.86),
  )
  const accentMaterial = registerMaterial(
    resources,
    standardMaterial('Avatar diver safety accent', accent, 0.7),
  )
  const tank = registerMaterial(
    resources,
    standardMaterial('Avatar compressed-air cylinder', 0xa9bac3, 0.38, 0.44),
  )
  const rubber = registerMaterial(
    resources,
    standardMaterial('Avatar regulator rubber', 0x0b1116, 0.82),
  )
  const lens = registerMaterial(
    resources,
    visorMaterial('Avatar diving mask lens', 0x80c9dd),
  )
  const alternate = registerMaterial(
    resources,
    standardMaterial('Avatar alternate air source', 0xe9b949, 0.72),
  )

  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-water-neoprene-suit-torso',
    neoprene,
    new Vector3(0, 0.69, 0),
    new Vector3(0.155, 0.215, 0.102),
  )
  addFunctionalLimbLayers(
    resources,
    visual,
    'water',
    neoprene,
    neoprene,
    rubber,
  )
  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-water-bcd',
    neoprene,
    new Vector3(0, 0.7, 0),
    new Vector3(0.17, 0.225, 0.12),
  )
  const tankMesh = registerMesh(
    resources,
    new CylinderGeometry(0.062, 0.062, 0.34, 24, 2),
    tank,
    'avatar-equipment-water-air-cylinder',
  )
  tankMesh.position.set(0, 0.7, -0.16)
  attachPreservingVisualPose(visual, 'Spine01', tankMesh)
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-water-cylinder-harness',
    rubber,
    new Vector3(0, 0.7, -0.095),
    new Vector3(0.25, 0.27, 0.035),
  )
  addSphere(
    resources,
    visual,
    'Head',
    'avatar-equipment-water-neoprene-hood',
    neoprene,
    new Vector3(0, 1.015, -0.012),
    new Vector3(0.148, 0.16, 0.14),
    true,
  )
  addBox(
    resources,
    visual,
    'Head',
    'avatar-equipment-water-mask-lens',
    lens,
    new Vector3(0, 1.0, 0.122),
    new Vector3(0.225, 0.09, 0.02),
  )
  addBox(
    resources,
    visual,
    'Head',
    'avatar-equipment-water-mask-strap',
    rubber,
    new Vector3(0, 1.0, -0.105),
    new Vector3(0.25, 0.026, 0.02),
  )
  addSphere(
    resources,
    visual,
    'Head',
    'avatar-equipment-water-regulator',
    rubber,
    new Vector3(0.055, 0.95, 0.13),
    new Vector3(0.04, 0.032, 0.026),
  )
  addTorus(
    resources,
    visual,
    'Spine',
    'avatar-equipment-water-regulator-hose',
    rubber,
    new Vector3(0.08, 0.84, 0.015),
    0.13,
    0.009,
    new Vector3(0.7, 1, 0.75),
  )
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-water-bcd-inflator',
    accentMaterial,
    new Vector3(-0.12, 0.75, 0.11),
    new Vector3(0.035, 0.12, 0.028),
  )
  addSphere(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-water-alternate-second-stage',
    alternate,
    new Vector3(-0.105, 0.7, 0.13),
    new Vector3(0.035, 0.035, 0.022),
  )
  addBox(
    resources,
    visual,
    'Spine01',
    'avatar-equipment-water-pressure-gauge',
    accentMaterial,
    new Vector3(0.12, 0.65, 0.12),
    new Vector3(0.045, 0.065, 0.025),
  )
  addFin(resources, visual, 'Left', accentMaterial)
  addFin(resources, visual, 'Right', accentMaterial)
}

export function addAvatarEquipmentForPresentation(
  visual: Group,
  presentation: ScaleEncounterAvatarPresentation,
): AvatarEquipmentResources {
  const resources: MutableAvatarEquipmentResources = {
    geometries: new Set(),
    materials: new Set(),
    meshes: [],
  }
  const accent = presentation.gender === 'boy' ? 0x2a9d8f : 0xe07a5f
  switch (presentation.equipment) {
    case 'trail-daypack':
      addTrailDaypack(resources, visual, accent)
      break
    case 'insulated-cold-weather-kit':
      addColdWeatherKit(resources, visual, accent)
      break
    case 'helmeted-wingsuit-and-parachute':
      addWingsuitAndParachute(resources, visual, accent)
      break
    case 'scuba-kit':
      addScubaKit(resources, visual, accent)
      break
  }
  visual.updateMatrixWorld(true)
  return resources
}

const LEFT_ARM_DOWN = new Vector3(0.055, -0.995, 0.08).normalize()
const RIGHT_ARM_DOWN = new Vector3(-0.055, -0.995, 0.08).normalize()
const LEFT_ARM_COLD = new Vector3(0.035, -0.999, 0.025).normalize()
const RIGHT_ARM_COLD = new Vector3(-0.035, -0.999, 0.025).normalize()
const LEFT_ARM_WING = new Vector3(1, 0.08, 0).normalize()
const RIGHT_ARM_WING = new Vector3(-1, 0.08, 0).normalize()
const LEFT_UPPER_ARM_DIVE = new Vector3(0.58, -0.72, 0.38).normalize()
const RIGHT_UPPER_ARM_DIVE = new Vector3(-0.58, -0.72, 0.38).normalize()
const LEFT_FOREARM_DIVE = new Vector3(-0.42, 0.9, -0.08).normalize()
const RIGHT_FOREARM_DIVE = new Vector3(0.42, 0.9, -0.08).normalize()
const LEFT_LEG_TRAIL = new Vector3(0.075, -0.997, 0).normalize()
const RIGHT_LEG_TRAIL = new Vector3(-0.075, -0.997, 0).normalize()
const LEFT_DIVE_LEG = new Vector3(0.035, -0.999, 0).normalize()
const RIGHT_DIVE_LEG = new Vector3(-0.035, -0.999, 0).normalize()
const AIR_GAZE = new Vector3(0, 1, -0.08).normalize()
const WATER_GAZE = new Vector3(0, 1, -0.18).normalize()
const WATER_KICK_AXIS = new Vector3(1, 0, 0)

export interface AvatarPresentationPoseController {
  apply(
    animationTimeSeconds: number,
    reducedMotion: boolean,
    motion?: ScaleEncounterAvatarMotion,
  ): void
}

export function createAvatarPresentationPoseController(
  visual: Group,
  presentation: ScaleEncounterAvatarPresentation,
): AvatarPresentationPoseController {
  const bones = new Map<string, Object3D>()
  for (const name of [
    'Head',
    'headfront',
    'LeftArm',
    'LeftForeArm',
    'LeftHand',
    'RightArm',
    'RightForeArm',
    'RightHand',
    'LeftUpLeg',
    'LeftLeg',
    'LeftFoot',
    'LeftToeBase',
    'RightUpLeg',
    'RightLeg',
    'RightFoot',
    'RightToeBase',
  ]) {
    const bone = visual.getObjectByName(name)
    if (bone) bones.set(name, bone)
  }
  const baseQuaternions = new Map(
    [...bones].map(([name, bone]) => [name, bone.quaternion.clone()]),
  )

  const bonePosition = new Vector3()
  const childPosition = new Vector3()
  const currentDirection = new Vector3()
  const targetWorldDirection = new Vector3()
  const axisWorld = new Vector3()
  const visualWorldQuaternion = new Quaternion()
  const boneWorldQuaternion = new Quaternion()
  const parentWorldQuaternion = new Quaternion()
  const deltaQuaternion = new Quaternion()
  const targetWorldQuaternion = new Quaternion()

  const named = (name: string) => bones.get(name)

  const setWorldDirection = (
    bone: Object3D | undefined,
    child: Object3D | undefined,
    targetVisualDirection: Readonly<Vector3>,
  ) => {
    if (!bone || !child || !bone.parent) return
    visual.updateMatrixWorld(true)
    bone.getWorldPosition(bonePosition)
    child.getWorldPosition(childPosition)
    currentDirection.subVectors(childPosition, bonePosition)
    if (currentDirection.lengthSq() <= 1e-12) return
    currentDirection.normalize()
    visual.getWorldQuaternion(visualWorldQuaternion)
    targetWorldDirection
      .copy(targetVisualDirection)
      .applyQuaternion(visualWorldQuaternion)
      .normalize()
    deltaQuaternion.setFromUnitVectors(
      currentDirection,
      targetWorldDirection,
    )
    bone.getWorldQuaternion(boneWorldQuaternion)
    targetWorldQuaternion.copy(deltaQuaternion).multiply(boneWorldQuaternion)
    bone.parent.getWorldQuaternion(parentWorldQuaternion).invert()
    bone.quaternion
      .copy(parentWorldQuaternion)
      .multiply(targetWorldQuaternion)
      .normalize()
    visual.updateMatrixWorld(true)
  }

  const rotateAroundVisualAxis = (
    bone: Object3D | undefined,
    axis: Readonly<Vector3>,
    radians: number,
  ) => {
    if (!bone || !bone.parent || Math.abs(radians) <= 1e-12) return
    visual.updateMatrixWorld(true)
    visual.getWorldQuaternion(visualWorldQuaternion)
    axisWorld.copy(axis).applyQuaternion(visualWorldQuaternion).normalize()
    deltaQuaternion.setFromAxisAngle(axisWorld, radians)
    bone.getWorldQuaternion(boneWorldQuaternion)
    targetWorldQuaternion.copy(deltaQuaternion).multiply(boneWorldQuaternion)
    bone.parent.getWorldQuaternion(parentWorldQuaternion).invert()
    bone.quaternion
      .copy(parentWorldQuaternion)
      .multiply(targetWorldQuaternion)
      .normalize()
    visual.updateMatrixWorld(true)
  }

  const alignArm = (
    armName: 'LeftArm' | 'RightArm',
    forearmName: 'LeftForeArm' | 'RightForeArm',
    handName: 'LeftHand' | 'RightHand',
    upperDirection: Readonly<Vector3>,
    lowerDirection = upperDirection,
  ) => {
    setWorldDirection(named(armName), named(forearmName), upperDirection)
    setWorldDirection(named(forearmName), named(handName), lowerDirection)
  }

  const alignLeg = (
    side: 'Left' | 'Right',
    direction: Readonly<Vector3>,
  ) => {
    setWorldDirection(
      named(`${side}UpLeg`),
      named(`${side}Leg`),
      direction,
    )
    setWorldDirection(
      named(`${side}Leg`),
      named(`${side}Foot`),
      direction,
    )
    setWorldDirection(
      named(`${side}Foot`),
      named(`${side}ToeBase`),
      direction,
    )
  }

  return {
    apply: (animationTimeSeconds, reducedMotion, motion = 'idle') => {
      // Walk/run clips already animate every pose bone. Resetting to the
      // reviewed stationary frame after AnimationMixer.update() would erase
      // the imported gait on every rendered frame.
      if (
        (presentation.pose === 'grounded-observer' ||
          presentation.pose === 'cold-weather-observer') &&
        (motion === 'walk' || motion === 'run')
      ) {
        return
      }
      for (const [name, base] of baseQuaternions) {
        named(name)?.quaternion.copy(base)
      }
      visual.updateMatrixWorld(true)

      if (presentation.pose === 'grounded-observer') {
        alignArm('LeftArm', 'LeftForeArm', 'LeftHand', LEFT_ARM_DOWN)
        alignArm('RightArm', 'RightForeArm', 'RightHand', RIGHT_ARM_DOWN)
        return
      }

      if (presentation.pose === 'cold-weather-observer') {
        alignArm('LeftArm', 'LeftForeArm', 'LeftHand', LEFT_ARM_COLD)
        alignArm('RightArm', 'RightForeArm', 'RightHand', RIGHT_ARM_COLD)
        return
      }

      if (presentation.pose === 'prone-wingsuit-glide') {
        alignArm('LeftArm', 'LeftForeArm', 'LeftHand', LEFT_ARM_WING)
        alignArm('RightArm', 'RightForeArm', 'RightHand', RIGHT_ARM_WING)
        alignLeg('Left', LEFT_LEG_TRAIL)
        alignLeg('Right', RIGHT_LEG_TRAIL)
        setWorldDirection(named('Head'), named('headfront'), AIR_GAZE)
        return
      }

      alignArm(
        'LeftArm',
        'LeftForeArm',
        'LeftHand',
        LEFT_UPPER_ARM_DIVE,
        LEFT_FOREARM_DIVE,
      )
      alignArm(
        'RightArm',
        'RightForeArm',
        'RightHand',
        RIGHT_UPPER_ARM_DIVE,
        RIGHT_FOREARM_DIVE,
      )
      alignLeg('Left', LEFT_DIVE_LEG)
      alignLeg('Right', RIGHT_DIVE_LEG)
      setWorldDirection(named('Head'), named('headfront'), WATER_GAZE)
      if (reducedMotion) return

      const swimming = motion === 'swim'
      const phase =
        animationTimeSeconds * Math.PI * (swimming ? 1.45 : 0.65)
      const amplitude = swimming ? 1 : 0.42
      const thighSwing = Math.sin(phase) * (Math.PI / 24) * amplitude
      const kneeSwing =
        Math.sin(phase + Math.PI / 2) * (Math.PI / 36) * amplitude
      const footSwing =
        Math.sin(phase + Math.PI / 2) * (Math.PI / 18) * amplitude
      rotateAroundVisualAxis(named('LeftUpLeg'), WATER_KICK_AXIS, thighSwing)
      rotateAroundVisualAxis(named('RightUpLeg'), WATER_KICK_AXIS, -thighSwing)
      rotateAroundVisualAxis(named('LeftLeg'), WATER_KICK_AXIS, -kneeSwing)
      rotateAroundVisualAxis(named('RightLeg'), WATER_KICK_AXIS, kneeSwing)
      rotateAroundVisualAxis(named('LeftFoot'), WATER_KICK_AXIS, footSwing)
      rotateAroundVisualAxis(named('RightFoot'), WATER_KICK_AXIS, -footSwing)
    },
  }
}

export function avatarPresentationPoseSnapshot(
  visual: Group,
): {
  readonly bodyAxis: Vector3
  readonly gazeDirection: Vector3 | null
  readonly leftArmDirection: Vector3 | null
  readonly leftFootDirection: Vector3 | null
  readonly rightArmDirection: Vector3 | null
  readonly rightFootDirection: Vector3 | null
} {
  const direction = (startName: string, endName: string): Vector3 | null => {
    const start = visual.getObjectByName(startName)
    const end = visual.getObjectByName(endName)
    if (!start || !end) return null
    const from = start.getWorldPosition(new Vector3())
    return end.getWorldPosition(new Vector3()).sub(from).normalize()
  }
  visual.updateMatrixWorld(true)
  const bodyAxis = WORLD_UP.clone()
    .applyQuaternion(visual.getWorldQuaternion(new Quaternion()))
    .normalize()
  return {
    bodyAxis,
    gazeDirection: direction('Head', 'headfront'),
    leftArmDirection: direction('LeftArm', 'LeftForeArm'),
    leftFootDirection: direction('LeftFoot', 'LeftToeBase'),
    rightArmDirection: direction('RightArm', 'RightForeArm'),
    rightFootDirection: direction('RightFoot', 'RightToeBase'),
  }
}
