import { rename } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Accessor, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const repositoryRoot = resolve(import.meta.dirname, '..')
const bufferTarget = Accessor.Type

await MeshoptEncoder.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

function dotQuaternion(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
}

function normaliseQuaternion(quaternion) {
  const length = Math.hypot(...quaternion) || 1
  return quaternion.map((component) => component / length)
}

function slerpQuaternion(a, b, amount) {
  let target = b
  let cosine = dotQuaternion(a, b)
  if (cosine < 0) {
    cosine = -cosine
    target = b.map((component) => -component)
  }
  if (cosine > 0.9995) {
    return normaliseQuaternion(
      a.map((component, index) =>
        component + (target[index] - component) * amount,
      ),
    )
  }
  const angle = Math.acos(clamp(cosine, -1, 1))
  const denominator = Math.sin(angle)
  const fromWeight = Math.sin((1 - amount) * angle) / denominator
  const toWeight = Math.sin(amount * angle) / denominator
  return a.map(
    (component, index) =>
      component * fromWeight + target[index] * toWeight,
  )
}

function readAccessorElements(accessor) {
  const values = []
  const element = new Array(accessor.getElementSize()).fill(0)
  for (let index = 0; index < accessor.getCount(); index += 1) {
    accessor.getElement(index, element)
    values.push([...element])
  }
  return values
}

function flattenElements(elements) {
  return new Float32Array(elements.flat())
}

function sampleQuaternionTrack(times, values, time) {
  if (time <= times[0]) return values[0]
  if (time >= times[times.length - 1]) return values.at(-1)
  let low = 0
  let high = times.length - 1
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (times[middle] <= time) low = middle
    else high = middle
  }
  const duration = Math.max(times[high] - times[low], Number.EPSILON)
  return slerpQuaternion(
    values[low],
    values[high],
    (time - times[low]) / duration,
  )
}

function smoothPeriodicQuaternionTrack(values, passes = 2) {
  const uniqueCount = values.length - 1
  let current = values.slice(0, uniqueCount).map(normaliseQuaternion)
  const weights = [1, 2, 3, 2, 1]
  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((centre, index) => {
      const sum = [0, 0, 0, 0]
      let totalWeight = 0
      for (let offset = -2; offset <= 2; offset += 1) {
        const neighbour = current[(index + offset + uniqueCount) % uniqueCount]
        const sign = dotQuaternion(centre, neighbour) < 0 ? -1 : 1
        const weight = weights[offset + 2]
        for (let axis = 0; axis < 4; axis += 1) {
          sum[axis] += neighbour[axis] * sign * weight
        }
        totalWeight += weight
      }
      return normaliseQuaternion(sum.map((value) => value / totalWeight))
    })
  }
  current.push([...current[0]])
  return current
}

function canonicaliseQuaternionSigns(values) {
  const result = values.map(normaliseQuaternion)
  for (let index = 1; index < result.length; index += 1) {
    if (dotQuaternion(result[index - 1], result[index]) < 0) {
      result[index] = result[index].map((component) => -component)
    }
  }
  result[result.length - 1] = [...result[0]]
  return result
}

function animationChannelFor(animation, nodeName, targetPath = 'rotation') {
  return animation
    .listChannels()
    .find(
      (channel) =>
        channel.getTargetNode()?.getName() === nodeName &&
        channel.getTargetPath() === targetPath,
    )
}

async function writeModel(document, targetPath) {
  const temporaryPath = `${targetPath}.repairing.glb`
  await io.write(temporaryPath, document)
  // Re-read before replacing the source so a missing encoder, malformed
  // accessor or inconsistent morph target cannot corrupt the runtime model.
  await io.read(temporaryPath)
  await rename(temporaryPath, targetPath)
}

function clearInvalidFloatNormalization(document) {
  let repaired = 0
  for (const accessor of document.getRoot().listAccessors()) {
    // glTF permits `normalized` only for integer component types. Animation
    // and morph accessors imported from quantized source data keep that flag
    // when `setArray(Float32Array)` promotes them to FLOAT, and Three's loader
    // correctly rejects the invalid combination. Clear it after promotion.
    if (accessor.getComponentType() === 5126 && accessor.getNormalized()) {
      accessor.setNormalized(false)
      repaired += 1
    }
  }
  return repaired
}

async function repairIchthyosaur() {
  const targetPath = resolve(
    repositoryRoot,
    'src/content/animals/ichthyosaur/model/model.glb',
  )
  const document = await io.read(targetPath)
  const root = document.getRoot()
  const invalidNormalizationCount = clearInvalidFloatNormalization(document)
  if (root.getExtras().scaleEncounterAnimationRepair === 'seamless-head-v1') {
    if (invalidNormalizationCount > 0) await writeModel(document, targetPath)
    return
  }
  const animation = root.listAnimations().find((clip) => clip.getName() === 'Idle')
  if (!animation) throw new Error('ichthyosaur-idle-missing')

  const shiftedInputs = new Set()
  for (const sampler of animation.listSamplers()) {
    const input = sampler.getInput()
    if (!input || shiftedInputs.has(input)) continue
    const times = readAccessorElements(input).map(([time]) => time)
    const firstTime = times[0]
    input.setArray(new Float32Array(times.map((time) => time - firstTime)))
    shiftedInputs.add(input)
  }

  for (const channel of animation.listChannels()) {
    if (channel.getTargetPath() !== 'rotation') continue
    const output = channel.getSampler()?.getOutput()
    if (!output) continue
    const nodeName = channel.getTargetNode()?.getName() ?? ''
    const original = readAccessorElements(output)
    const repaired = ['head', 'neck'].includes(nodeName)
      ? smoothPeriodicQuaternionTrack(original, 2)
      : nodeName === 'body'
        ? smoothPeriodicQuaternionTrack(original, 1)
        : canonicaliseQuaternionSigns(original)
    output.setArray(flattenElements(repaired))
    output.setNormalized(false)
  }

  root.setExtras({
    ...root.getExtras(),
    scaleEncounterAnimationRepair: 'seamless-head-v1',
  })
  await writeModel(document, targetPath)
}

async function repairMegalodon() {
  const targetPath = resolve(
    repositoryRoot,
    'src/content/animals/megalodon/model/model.glb',
  )
  const document = await io.read(targetPath)
  const root = document.getRoot()
  const invalidNormalizationCount = clearInvalidFloatNormalization(document)
  if (root.getExtras().scaleEncounterAnimationRepair === 'paired-fins-tail-v1') {
    if (invalidNormalizationCount > 0) await writeModel(document, targetPath)
    return
  }
  const animation = root.listAnimations().find((clip) => clip.getName() === 'Idle')
  if (!animation) throw new Error('megalodon-idle-missing')
  const durationSeconds = 8
  const frameCount = durationSeconds * 24 + 1
  const uniformTimes = Array.from(
    { length: frameCount },
    (_, index) => index / 24,
  )
  const commonInput = document
    .createAccessor('Megalodon smooth swim time', root.listBuffers()[0])
    .setType(bufferTarget.SCALAR)
    .setArray(new Float32Array(uniformTimes))

  const smoothNodes = new Set([
    'Bone.001_Armature_13',
    'Bone.003_Armature_5',
    'Bone.002_Armature_4',
    'Bone.004_Armature_3',
    'Bone.005_Armature_26',
    'Bone.007_Armature_19',
    'Bone.006_Armature_18',
    'Bone.008_Armature_14',
    'Bone.011_Armature_22',
    'Bone.013_Armature_21',
    'Bone.015_Armature_20',
  ])
  const repairedLeftTracks = new Map()

  for (const nodeName of smoothNodes) {
    const channel = animationChannelFor(animation, nodeName)
    const sampler = channel?.getSampler()
    const input = sampler?.getInput()
    const output = sampler?.getOutput()
    if (!sampler || !input || !output) {
      throw new Error(`megalodon-track-missing:${nodeName}`)
    }
    const originalTimes = readAccessorElements(input).map(([time]) => time)
    const originalValues = readAccessorElements(output)
    const sampled = uniformTimes.map((time) =>
      sampleQuaternionTrack(originalTimes, originalValues, time),
    )
    const repaired = smoothPeriodicQuaternionTrack(
      sampled,
      nodeName.startsWith('Bone.00') ? 3 : 2,
    )
    sampler.setInput(commonInput)
    output.setArray(flattenElements(repaired))
    output.setNormalized(false)
    if (nodeName.startsWith('Bone.01')) {
      repairedLeftTracks.set(nodeName, repaired)
    }
  }

  const finPairs = [
    ['Bone.011_Armature_22', 'Bone.012_Armature_25'],
    ['Bone.013_Armature_21', 'Bone.014_Armature_24'],
    ['Bone.015_Armature_20', 'Bone.016_Armature_23'],
  ]
  for (const [leftName, rightName] of finPairs) {
    const leftValues = repairedLeftTracks.get(leftName)
    const rightChannel = animationChannelFor(animation, rightName)
    const rightSampler = rightChannel?.getSampler()
    const rightOutput = rightSampler?.getOutput()
    if (!leftValues || !rightSampler || !rightOutput) {
      throw new Error(`megalodon-fin-pair-missing:${leftName}:${rightName}`)
    }
    const mirrored = canonicaliseQuaternionSigns(
      leftValues.map(([x, y, z, w]) => [x, -y, -z, w]),
    )
    rightSampler.setInput(commonInput)
    rightOutput.setArray(flattenElements(mirrored))
    rightOutput.setNormalized(false)
  }

  root.setExtras({
    ...root.getExtras(),
    scaleEncounterAnimationRepair: 'paired-fins-tail-v1',
  })
  await writeModel(document, targetPath)
}

function flipperWindow(x, absoluteZ) {
  const fore =
    smoothstep(-0.68, -0.56, x) * (1 - smoothstep(-0.2, -0.1, x))
  const rear =
    smoothstep(-0.08, 0.01, x) * (1 - smoothstep(0.27, 0.36, x))
  const side = smoothstep(0.082, 0.17, absoluteZ)
  return Math.max(fore, rear) * side
}

function createFlipperTarget(document, primitive, direction, label) {
  const position = primitive.getAttribute('POSITION')
  const normal = primitive.getAttribute('NORMAL')
  if (!position || !normal) throw new Error('mosasaurus-base-geometry-missing')
  const buffer = document.getRoot().listBuffers()[0]
  const positionDelta = new Float32Array(position.getCount() * 3)
  const normalDelta = new Float32Array(normal.getCount() * 3)
  const point = [0, 0, 0]
  const normalVector = [0, 0, 0]
  const angleMagnitude = (14 * Math.PI) / 180

  for (let index = 0; index < position.getCount(); index += 1) {
    position.getElement(index, point)
    normal.getElement(index, normalVector)
    const [x, y, z] = point
    const weight = flipperWindow(x, Math.abs(z))
    if (weight <= 0) continue
    const side = z < 0 ? -1 : 1
    const angle = -side * direction * angleMagnitude
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const pivotY = 0.035
    const pivotZ = side * 0.075
    const relativeY = y - pivotY
    const relativeZ = z - pivotZ
    const rotatedY = relativeY * cosine - relativeZ * sine + pivotY
    const rotatedZ = relativeY * sine + relativeZ * cosine + pivotZ
    positionDelta[index * 3 + 1] = (rotatedY - y) * weight
    positionDelta[index * 3 + 2] = (rotatedZ - z) * weight

    const rotatedNormalY = normalVector[1] * cosine - normalVector[2] * sine
    const rotatedNormalZ = normalVector[1] * sine + normalVector[2] * cosine
    const blendedY = normalVector[1] +
      (rotatedNormalY - normalVector[1]) * weight
    const blendedZ = normalVector[2] +
      (rotatedNormalZ - normalVector[2]) * weight
    const normalLength = Math.hypot(normalVector[0], blendedY, blendedZ) || 1
    normalDelta[index * 3] = normalVector[0] / normalLength - normalVector[0]
    normalDelta[index * 3 + 1] = blendedY / normalLength - normalVector[1]
    normalDelta[index * 3 + 2] = blendedZ / normalLength - normalVector[2]
  }

  const target = document.createPrimitiveTarget(label)
  target.setAttribute(
    'POSITION',
    document
      .createAccessor(`${label} position`, buffer)
      .setType(bufferTarget.VEC3)
      .setArray(positionDelta),
  )
  target.setAttribute(
    'NORMAL',
    document
      .createAccessor(`${label} normal`, buffer)
      .setType(bufferTarget.VEC3)
      .setArray(normalDelta),
  )
  return target
}

const MOSASAURUS_TAIL_ROOT_X = 0.12
const MOSASAURUS_TAIL_TIP_X = 1
const MOSASAURUS_TAIL_MAX_ANGLE = (26 * Math.PI) / 180
const MOSASAURUS_TAIL_ARC_SAMPLE_COUNT = 512

function mosasaurusTailTangentAngle(direction, amount) {
  return direction * MOSASAURUS_TAIL_MAX_ANGLE * smoothstep(0, 1, amount)
}

function createMosasaurusTailArc(direction) {
  const centreX = new Float64Array(MOSASAURUS_TAIL_ARC_SAMPLE_COUNT + 1)
  const centreZ = new Float64Array(MOSASAURUS_TAIL_ARC_SAMPLE_COUNT + 1)
  const step = 1 / MOSASAURUS_TAIL_ARC_SAMPLE_COUNT
  for (let index = 1; index <= MOSASAURUS_TAIL_ARC_SAMPLE_COUNT; index += 1) {
    const previousAmount = (index - 1) * step
    const amount = index * step
    const previousAngle = mosasaurusTailTangentAngle(
      direction,
      previousAmount,
    )
    const angle = mosasaurusTailTangentAngle(direction, amount)
    centreX[index] =
      centreX[index - 1] +
      ((Math.cos(previousAngle) + Math.cos(angle)) / 2) * step
    centreZ[index] =
      centreZ[index - 1] +
      ((Math.sin(previousAngle) + Math.sin(angle)) / 2) * step
  }
  return { centreX, centreZ }
}

function sampleMosasaurusTailArc(arc, amount) {
  const scaled = amount * MOSASAURUS_TAIL_ARC_SAMPLE_COUNT
  const index = Math.min(
    MOSASAURUS_TAIL_ARC_SAMPLE_COUNT - 1,
    Math.floor(scaled),
  )
  const mix = scaled - index
  return [
    arc.centreX[index] +
      (arc.centreX[index + 1] - arc.centreX[index]) * mix,
    arc.centreZ[index] +
      (arc.centreZ[index + 1] - arc.centreZ[index]) * mix,
  ]
}

function replaceMosasaurusTailTarget(primitive, targetIndex, direction) {
  const position = primitive.getAttribute('POSITION')
  const normal = primitive.getAttribute('NORMAL')
  const target = primitive.listTargets()[targetIndex]
  const targetPosition = target?.getAttribute('POSITION')
  const targetNormal = target?.getAttribute('NORMAL')
  if (!position || !normal || !targetPosition || !targetNormal) {
    throw new Error(`mosasaurus-tail-target-missing:${targetIndex}`)
  }
  const positionDelta = new Float32Array(position.getCount() * 3)
  const normalDelta = new Float32Array(normal.getCount() * 3)
  const tailLength = MOSASAURUS_TAIL_TIP_X - MOSASAURUS_TAIL_ROOT_X
  const arc = createMosasaurusTailArc(direction)
  const point = [0, 0, 0]
  const normalVector = [0, 0, 0]

  for (let index = 0; index < position.getCount(); index += 1) {
    position.getElement(index, point)
    if (point[0] <= MOSASAURUS_TAIL_ROOT_X) continue
    normal.getElement(index, normalVector)
    const amount = clamp(
      (point[0] - MOSASAURUS_TAIL_ROOT_X) / tailLength,
      0,
      1,
    )
    const angle = mosasaurusTailTangentAngle(direction, amount)
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const [normalisedCentreX, normalisedCentreZ] =
      sampleMosasaurusTailArc(arc, amount)
    const centreX = MOSASAURUS_TAIL_ROOT_X + normalisedCentreX * tailLength
    const centreZ = normalisedCentreZ * tailLength
    // Rotate each cross-section with the arc tangent. The centreline therefore
    // keeps one curvature sign from tail root to tip instead of folding back
    // into the source morph's S shape.
    const transformedX = centreX - sine * point[2]
    const transformedZ = centreZ + cosine * point[2]
    positionDelta[index * 3] = transformedX - point[0]
    positionDelta[index * 3 + 1] = 0
    positionDelta[index * 3 + 2] = transformedZ - point[2]

    const transformedNormalX =
      cosine * normalVector[0] - sine * normalVector[2]
    const transformedNormalZ =
      sine * normalVector[0] + cosine * normalVector[2]
    normalDelta[index * 3] = transformedNormalX - normalVector[0]
    normalDelta[index * 3 + 1] = 0
    normalDelta[index * 3 + 2] = transformedNormalZ - normalVector[2]
  }

  targetPosition.setArray(positionDelta)
  targetPosition.setNormalized(false)
  targetNormal.setArray(normalDelta)
  targetNormal.setNormalized(false)
}

async function repairMosasaurus() {
  const targetPath = resolve(
    repositoryRoot,
    'src/content/animals/mosasaurus/model/model.glb',
  )
  const document = await io.read(targetPath)
  const root = document.getRoot()
  const invalidNormalizationCount = clearInvalidFloatNormalization(document)
  if (
    root.getExtras().scaleEncounterAnimationRepair ===
    'single-arc-tail-flippers-v2'
  ) {
    if (invalidNormalizationCount > 0) await writeModel(document, targetPath)
    return
  }
  const mesh = root.listMeshes()[0]
  const originalTargetCount = mesh.listPrimitives()[0]?.listTargets().length
  if (originalTargetCount !== 3 && originalTargetCount !== 5) {
    throw new Error(`mosasaurus-unexpected-target-count:${originalTargetCount}`)
  }

  for (const primitive of mesh.listPrimitives()) {
    replaceMosasaurusTailTarget(primitive, 1, 1)
    replaceMosasaurusTailTarget(primitive, 2, -1)
    if (originalTargetCount === 3) {
      primitive.addTarget(
        createFlipperTarget(document, primitive, 1, 'FlippersUp'),
      )
      primitive.addTarget(
        createFlipperTarget(document, primitive, -1, 'FlippersDown'),
      )
    }
  }
  mesh.setWeights([0, 0, 0, 0, 0])

  const animation = root.listAnimations().find((clip) => clip.getName() === 'Idle')
  const channel = animation?.listChannels().find(
    (candidate) => candidate.getTargetPath() === 'weights',
  )
  const sampler = channel?.getSampler()
  const input = sampler?.getInput()
  const output = sampler?.getOutput()
  if (!input || !output) throw new Error('mosasaurus-weight-animation-missing')
  const times = readAccessorElements(input).map(([time]) => time)
  const oldWeights = readAccessorElements(output).map(([weight]) => weight)
  const oldWeightStride = output.getCount() / times.length
  if (![3, 5].includes(oldWeightStride)) {
    throw new Error(`mosasaurus-unexpected-weight-stride:${oldWeightStride}`)
  }
  const repairedWeights = new Float32Array(times.length * 5)
  for (let frame = 0; frame < times.length; frame += 1) {
    repairedWeights[frame * 5] = oldWeights[frame * oldWeightStride]
    repairedWeights[frame * 5 + 1] =
      oldWeights[frame * oldWeightStride + 1]
    repairedWeights[frame * 5 + 2] =
      oldWeights[frame * oldWeightStride + 2]
    const flap = Math.sin((times[frame] / 4) * Math.PI * 2) * 0.72
    repairedWeights[frame * 5 + 3] = Math.max(0, flap)
    repairedWeights[frame * 5 + 4] = Math.max(0, -flap)
  }
  output.setArray(repairedWeights)
  output.setNormalized(false)

  root.setExtras({
    ...root.getExtras(),
    scaleEncounterAnimationRepair: 'single-arc-tail-flippers-v2',
  })
  await writeModel(document, targetPath)
}

await repairIchthyosaur()
await repairMegalodon()
await repairMosasaurus()

console.log('Repaired Ichthyosaur, Megalodon and Mosasaurus swim animations.')
