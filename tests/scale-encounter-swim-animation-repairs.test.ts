import { resolve } from 'node:path'

import type {
  Accessor,
  Animation,
  Document,
  Primitive,
} from '@gltf-transform/core'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const repositoryRoot = resolve(import.meta.dirname, '..')
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

function elements(accessor: Accessor): number[][] {
  const result: number[][] = []
  const value = new Array<number>(accessor.getElementSize()).fill(0)
  for (let index = 0; index < accessor.getCount(); index += 1) {
    accessor.getElement(index, value)
    result.push([...value])
  }
  return result
}

function quaternionDot(a: readonly number[], b: readonly number[]): number {
  return (
    (a[0] ?? 0) * (b[0] ?? 0) +
    (a[1] ?? 0) * (b[1] ?? 0) +
    (a[2] ?? 0) * (b[2] ?? 0) +
    (a[3] ?? 0) * (b[3] ?? 0)
  )
}

function rotationTrack(animation: Animation, nodeName: string) {
  const channel = animation.listChannels().find(
    (candidate) =>
      candidate.getTargetPath() === 'rotation' &&
      candidate.getTargetNode()?.getName() === nodeName,
  )
  if (!channel) throw new Error(`rotation-track-missing:${nodeName}`)
  const sampler = channel.getSampler()
  if (!sampler) throw new Error(`rotation-sampler-missing:${nodeName}`)
  return sampler
}

function positionAndTarget(
  primitive: Primitive,
  targetName: string,
): { readonly position: Accessor; readonly target: Accessor } {
  const position = primitive.getAttribute('POSITION')
  const target = primitive
    .listTargets()
    .find((candidate) => candidate.getName() === targetName)
    ?.getAttribute('POSITION')
  if (!position || !target) throw new Error(`target-missing:${targetName}`)
  return { position, target }
}

describe('reviewed marine animation repairs', () => {
  let ichthyosaur: Document
  let megalodon: Document
  let mosasaurus: Document

  beforeAll(async () => {
    const documents = await Promise.all(
      ['ichthyosaur', 'megalodon', 'mosasaurus'].map((animalId) =>
        io.read(
          resolve(
            repositoryRoot,
            `src/content/animals/${animalId}/model/model.glb`,
          ),
        ),
      ),
    )
    ichthyosaur = documents[0]!
    megalodon = documents[1]!
    mosasaurus = documents[2]!
  })

  it('closes every Ichthyosaur bone track at an exact zero-second seam', () => {
    const animation = ichthyosaur.getRoot().listAnimations()[0]!
    expect(
      ichthyosaur.getRoot().getExtras().scaleEncounterAnimationRepair,
    ).toBe('seamless-head-v1')

    for (const channel of animation.listChannels()) {
      if (channel.getTargetPath() !== 'rotation') continue
      const sampler = channel.getSampler()!
      const times = elements(sampler.getInput()!).map(([time]) => time!)
      const rotations = elements(sampler.getOutput()!)
      expect(times[0]).toBeCloseTo(0, 7)
      expect(times.at(-1)).toBeCloseTo(6, 5)
      expect(Math.abs(quaternionDot(rotations[0]!, rotations.at(-1)!))).toBeGreaterThan(
        0.999_999,
      )
    }
  })

  it('keeps every promoted float accessor valid for Three.js GLTFLoader', () => {
    for (const document of [ichthyosaur, megalodon, mosasaurus]) {
      expect(
        document
          .getRoot()
          .listAccessors()
          .filter(
            (accessor) =>
              accessor.getComponentType() === 5126 &&
              accessor.getNormalized(),
          ),
      ).toEqual([])
    }
  })

  it('uses uniform tail motion and mirrored paired Megalodon pectoral fins', () => {
    const animation = megalodon.getRoot().listAnimations()[0]!
    const tailNames = [
      'Bone.001_Armature_13',
      'Bone.003_Armature_5',
      'Bone.002_Armature_4',
      'Bone.004_Armature_3',
    ]
    for (const name of tailNames) {
      const sampler = rotationTrack(animation, name)
      const times = elements(sampler.getInput()!).map(([time]) => time!)
      const rotations = elements(sampler.getOutput()!)
      expect(times).toHaveLength(193)
      expect(times[1]! - times[0]!).toBeCloseTo(1 / 24, 6)
      expect(times.at(-1)).toBeCloseTo(8, 6)
      expect(Math.abs(quaternionDot(rotations[0]!, rotations.at(-1)!))).toBeGreaterThan(
        0.999_999,
      )
    }

    for (const [leftName, rightName] of [
      ['Bone.011_Armature_22', 'Bone.012_Armature_25'],
      ['Bone.013_Armature_21', 'Bone.014_Armature_24'],
      ['Bone.015_Armature_20', 'Bone.016_Armature_23'],
    ] as const) {
      const left = elements(rotationTrack(animation, leftName).getOutput()!)
      const right = elements(rotationTrack(animation, rightName).getOutput()!)
      expect(left).toHaveLength(193)
      for (let frame = 0; frame < left.length; frame += 1) {
        const [x, y, z, w] = left[frame]!
        expect(
          Math.abs(quaternionDot([x!, -y!, -z!, w!], right[frame]!)),
        ).toBeGreaterThan(0.999_99)
      }
    }
  })

  it('keeps the Mosasaurus tail on one continuous arc and moves all four flippers', () => {
    const mesh = mosasaurus.getRoot().listMeshes()[0]!
    expect(
      mosasaurus.getRoot().getExtras().scaleEncounterAnimationRepair,
    ).toBe('single-arc-tail-flippers-v2')
    expect(mesh.getWeights()).toEqual([0, 0, 0, 0, 0])
    for (const primitive of mesh.listPrimitives()) {
      expect(primitive.listTargets().map((target) => target.getName())).toEqual([
        'MouthClose',
        'MotionPositive',
        'MotionNegative',
        'FlippersUp',
        'FlippersDown',
      ])
    }

    const primitive = mesh.listPrimitives()[0]!
    const lateralDisplacements: Record<string, number[]> = {}
    for (const targetName of ['MotionPositive', 'MotionNegative']) {
      const { position, target } = positionAndTarget(primitive, targetName)
      const point = [0, 0, 0]
      const delta = [0, 0, 0]
      const samples: number[] = []
      let maximumVerticalDisplacement = 0
      for (let bin = 0; bin < 7; bin += 1) {
        const minimumX = 0.3 + bin * 0.1
        const maximumX = minimumX + 0.1
        let count = 0
        let lateralDisplacement = 0
        for (let index = 0; index < position.getCount(); index += 1) {
          position.getElement(index, point)
          if (point[0]! < minimumX || point[0]! >= maximumX) continue
          target.getElement(index, delta)
          lateralDisplacement += delta[2]!
          maximumVerticalDisplacement = Math.max(
            maximumVerticalDisplacement,
            Math.abs(delta[1]!),
          )
          count += 1
        }
        samples.push(lateralDisplacement / count)
      }
      lateralDisplacements[targetName] = samples
      // A single-curvature swimming stroke never changes lateral sign or
      // folds back near the tail tip, and its amplitude grows continuously
      // from the muscular root to the terminal section.
      const direction = targetName === 'MotionPositive' ? 1 : -1
      expect(samples.every((sample) => sample * direction > 0)).toBe(true)
      for (let index = 1; index < samples.length; index += 1) {
        expect(Math.abs(samples[index]!)).toBeGreaterThan(
          Math.abs(samples[index - 1]!),
        )
      }
      expect(Math.abs(samples.at(-1)!)).toBeGreaterThan(0.17)
      expect(maximumVerticalDisplacement).toBeLessThan(0.000_001)
    }
    for (let index = 0; index < 7; index += 1) {
      expect(
        lateralDisplacements.MotionPositive![index]!,
      ).toBeCloseTo(-lateralDisplacements.MotionNegative![index]!, 4)
    }

    for (const targetName of ['FlippersUp', 'FlippersDown']) {
      const { position, target } = positionAndTarget(primitive, targetName)
      const point = [0, 0, 0]
      const delta = [0, 0, 0]
      const movingVertices = {
        foreLeft: 0,
        foreRight: 0,
        rearLeft: 0,
        rearRight: 0,
      }
      for (let index = 0; index < position.getCount(); index += 1) {
        position.getElement(index, point)
        target.getElement(index, delta)
        if (Math.hypot(...delta) < 0.000_01) continue
        const side = point[2]! > 0 ? 'Left' : 'Right'
        if (point[0]! >= -0.68 && point[0]! <= -0.1) {
          movingVertices[`fore${side}`] += 1
        } else if (point[0]! >= -0.08 && point[0]! <= 0.36) {
          movingVertices[`rear${side}`] += 1
        }
      }
      expect(movingVertices.foreLeft).toBeGreaterThan(500)
      expect(movingVertices.foreRight).toBeGreaterThan(500)
      expect(movingVertices.rearLeft).toBeGreaterThan(250)
      expect(movingVertices.rearRight).toBeGreaterThan(250)
    }

    const animation = mosasaurus.getRoot().listAnimations()[0]!
    const sampler = animation.listChannels()[0]!.getSampler()!
    expect(sampler.getOutput()?.getCount()).toBe(
      sampler.getInput()!.getCount() * 5,
    )
    const weights = elements(sampler.getOutput()!).map(([weight]) => weight!)
    const frameCount = sampler.getInput()!.getCount()
    for (let frame = 0; frame < frameCount; frame += 1) {
      const positive = weights[frame * 5 + 1]!
      const negative = weights[frame * 5 + 2]!
      expect(positive * negative).toBe(0)
      expect(positive).toBeGreaterThanOrEqual(0)
      expect(negative).toBeGreaterThanOrEqual(0)
    }
    expect(weights[1]).toBe(0)
    expect(weights[(frameCount - 1) * 5 + 1]).toBe(0)
    expect(weights[(frameCount - 1) * 5 + 2]).toBe(0)
  })
})
