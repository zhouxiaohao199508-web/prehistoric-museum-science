import { PropertyType, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import { fileURLToPath } from 'node:url'

const DEFAULT_FRAMES_PER_SECOND = 24
const CUBIC_SPLINE = 'CUBICSPLINE'
const LINEAR = 'LINEAR'

function normalizedQuaternion(values) {
  const length = Math.hypot(...values)
  if (length <= Number.EPSILON) {
    return [0, 0, 0, 1]
  }
  return values.map((value) => value / length)
}

/**
 * q and -q encode the same orientation, but interpolating between opposite
 * signs takes the long path and can create a one-frame half-turn. Flip the
 * complete cubic key (in tangent, value, and out tangent) whenever needed so
 * every neighbouring quaternion stays in the same hemisphere.
 */
export function makeCubicSplineQuaternionSignsContinuous(splineValues) {
  const continuousValues = Float32Array.from(splineValues)
  const keyCount = continuousValues.length / 12
  for (let keyIndex = 1; keyIndex < keyCount; keyIndex += 1) {
    const previousValueOffset = ((keyIndex - 1) * 3 + 1) * 4
    const valueOffset = (keyIndex * 3 + 1) * 4
    let dot = 0
    for (let component = 0; component < 4; component += 1) {
      dot +=
        continuousValues[previousValueOffset + component] *
        continuousValues[valueOffset + component]
    }
    if (dot >= 0) {
      continue
    }
    const keyOffset = keyIndex * 12
    for (let component = 0; component < 12; component += 1) {
      continuousValues[keyOffset + component] *= -1
    }
  }
  return continuousValues
}

/**
 * Evaluates one glTF CUBICSPLINE quaternion channel and normalizes the result
 * as required by the glTF animation specification.
 */
export function sampleCubicSplineQuaternion(times, splineValues, time) {
  if (times.length < 2) {
    throw new Error('A cubic-spline rotation track needs at least two keys.')
  }
  const clampedTime = Math.min(
    Math.max(time, times[0]),
    times[times.length - 1],
  )
  let keyIndex = 0
  while (
    keyIndex < times.length - 2 &&
    clampedTime > times[keyIndex + 1]
  ) {
    keyIndex += 1
  }

  const startTime = times[keyIndex]
  const endTime = times[keyIndex + 1]
  const duration = Math.max(endTime - startTime, Number.EPSILON)
  const t = (clampedTime - startTime) / duration
  const t2 = t * t
  const t3 = t2 * t
  const startValueOffset = (keyIndex * 3 + 1) * 4
  const startTangentOffset = (keyIndex * 3 + 2) * 4
  const endTangentOffset = ((keyIndex + 1) * 3) * 4
  const endValueOffset = ((keyIndex + 1) * 3 + 1) * 4
  const result = new Array(4)

  for (let component = 0; component < 4; component += 1) {
    const startValue = splineValues[startValueOffset + component]
    const startTangent = splineValues[startTangentOffset + component]
    const endTangent = splineValues[endTangentOffset + component]
    const endValue = splineValues[endValueOffset + component]
    result[component] =
      (2 * t3 - 3 * t2 + 1) * startValue +
      (t3 - 2 * t2 + t) * duration * startTangent +
      (-2 * t3 + 3 * t2) * endValue +
      (t3 - t2) * duration * endTangent
  }

  return normalizedQuaternion(result)
}

function decodedAccessorArray(accessor) {
  const values = new Float32Array(
    accessor.getCount() * accessor.getElementSize(),
  )
  const element = []
  for (let index = 0; index < accessor.getCount(); index += 1) {
    accessor.getElement(index, element)
    values.set(element, index * accessor.getElementSize())
  }
  return values
}

function createSampleTimes(sourceTimes, framesPerSecond) {
  const firstTime = sourceTimes[0]
  const lastTime = sourceTimes[sourceTimes.length - 1]
  const duration = lastTime - firstTime
  const intervalCount = Math.max(1, Math.ceil(duration * framesPerSecond))
  const times = new Float32Array(intervalCount + 1)
  for (let index = 0; index <= intervalCount; index += 1) {
    times[index] =
      index === intervalCount
        ? lastTime
        : Math.min(firstTime + index / framesPerSecond, lastTime)
  }
  return times
}

export async function resampleCubicRotationTracks(
  inputPath,
  outputPath,
  { framesPerSecond = DEFAULT_FRAMES_PER_SECOND } = {},
) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.read(inputPath)
  const root = document.getRoot()
  const fallbackBuffer = root.listBuffers()[0] ?? document.createBuffer()
  const sampledInputs = new Map()
  let resampledTracks = 0

  for (const animation of root.listAnimations()) {
    for (const channel of animation.listChannels()) {
      const sampler = channel.getSampler()
      if (
        channel.getTargetPath() !== 'rotation' ||
        sampler.getInterpolation() !== CUBIC_SPLINE
      ) {
        continue
      }

      const sourceInput = sampler.getInput()
      const sourceOutput = sampler.getOutput()
      const sourceTimes = decodedAccessorArray(sourceInput)
      const sourceValues = makeCubicSplineQuaternionSignsContinuous(
        decodedAccessorArray(sourceOutput),
      )
      if (sourceOutput.getCount() !== sourceInput.getCount() * 3) {
        throw new Error(
          `Invalid CUBICSPLINE rotation output on ${channel.getTargetNode()?.getName() || 'unnamed node'}.`,
        )
      }

      const sampleTimes = createSampleTimes(sourceTimes, framesPerSecond)
      const inputKey = Array.from(sampleTimes).join(',')
      let sampledInput = sampledInputs.get(inputKey)
      if (!sampledInput) {
        sampledInput = document
          .createAccessor(`${animation.getName() || 'animation'}-linear-time`)
          .setType('SCALAR')
          .setArray(sampleTimes)
          .setBuffer(sourceInput.getBuffer() ?? fallbackBuffer)
        sampledInputs.set(inputKey, sampledInput)
      }

      const sampledValues = new Float32Array(sampleTimes.length * 4)
      for (let index = 0; index < sampleTimes.length; index += 1) {
        sampledValues.set(
          sampleCubicSplineQuaternion(
            sourceTimes,
            sourceValues,
            sampleTimes[index],
          ),
          index * 4,
        )
      }
      const sampledOutput = document
        .createAccessor(
          `${channel.getTargetNode()?.getName() || 'node'}-linear-rotation`,
        )
        .setType('VEC4')
        .setArray(sampledValues)
        .setBuffer(sourceOutput.getBuffer() ?? fallbackBuffer)

      sampler
        .setInput(sampledInput)
        .setOutput(sampledOutput)
        .setInterpolation(LINEAR)
      resampledTracks += 1
    }
  }

  if (resampledTracks > 0) {
    await document.transform(
      prune({
        keepAttributes: true,
        keepIndices: true,
        propertyTypes: [PropertyType.ACCESSOR],
      }),
    )
  }
  await io.write(outputPath, document)
  return resampledTracks
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath] = process.argv
  if (!inputPath || !outputPath) {
    throw new Error(
      'Usage: node scripts/resample-cubic-rotation-tracks.mjs <input.glb> <output.glb>',
    )
  }
  const resampledTracks = await resampleCubicRotationTracks(
    inputPath,
    outputPath,
  )
  console.log(`Resampled ${resampledTracks} cubic rotation track(s).`)
}
