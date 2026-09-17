import {
  makeCubicSplineQuaternionSignsContinuous,
  sampleCubicSplineQuaternion,
} from '../scripts/resample-cubic-rotation-tracks.mjs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

describe('cubic-spline rotation resampling', () => {
  it('preserves exact endpoints and normalizes intermediate quaternions', () => {
    const times = Float32Array.from([0, 1])
    const halfTurn = Math.SQRT1_2
    const values = Float32Array.from([
      0, 0, 0, 0,
      0, 0, 0, 1,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, halfTurn, 0, halfTurn,
      0, 0, 0, 0,
    ])

    expect(sampleCubicSplineQuaternion(times, values, 0)).toEqual([
      0, 0, 0, 1,
    ])
    const end = sampleCubicSplineQuaternion(times, values, 1)
    expect(end[0]).toBe(0)
    expect(end[1]).toBeCloseTo(halfTurn, 12)
    expect(end[2]).toBe(0)
    expect(end[3]).toBeCloseTo(halfTurn, 12)
    expect(
      Math.hypot(...sampleCubicSplineQuaternion(times, values, 0.5)),
    ).toBeCloseTo(1, 12)
  })

  it('flips an opposite-sign cubic key together with both tangents', () => {
    const values = Float32Array.from([
      1, 2, 3, 4,
      0, 0, 0, 1,
      5, 6, 7, 8,
      -1, -2, -3, -4,
      0, 0, 0, -1,
      -5, -6, -7, -8,
    ])

    expect(
      Array.from(makeCubicSplineQuaternionSignsContinuous(values), (value) =>
        Object.is(value, -0) ? 0 : value,
      ),
    ).toEqual([
      1, 2, 3, 4,
      0, 0, 0, 1,
      5, 6, 7, 8,
      1, 2, 3, 4,
      0, 0, 0, 1,
      5, 6, 7, 8,
    ])
  })

  it('keeps every production ichthyosaur bone continuous through the loop', async () => {
    await MeshoptDecoder.ready
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const document = await io.read(
      'src/content/animals/ichthyosaur/model/model.glb',
    )
    const animation = document.getRoot().listAnimations()[0]!
    expect(animation.getName()).toBe('Idle')

    const quaternionAngle = (left: number[], right: number[]) => {
      const dot = Math.abs(
        left.reduce(
          (total, value, index) => total + value * right[index]!,
          0,
        ),
      )
      return (
        2 *
        Math.acos(
          Math.min(1, dot / (Math.hypot(...left) * Math.hypot(...right))),
        )
      )
    }

    for (const channel of animation.listChannels()) {
      const sampler = channel.getSampler()!
      const input = sampler.getInput()!
      const output = sampler.getOutput()!
      expect(sampler.getInterpolation()).toBe('LINEAR')
      expect(input.getCount()).toBe(145)
      expect(output.getCount()).toBe(145)

      const quaternionAt = (index: number) =>
        output.getElement(index, [] as number[])
      let maximumStep = 0
      for (let index = 1; index < output.getCount(); index += 1) {
        maximumStep = Math.max(
          maximumStep,
          quaternionAngle(quaternionAt(index - 1), quaternionAt(index)),
        )
      }
      expect(maximumStep).toBeLessThan((2 * Math.PI) / 180)
      expect(
        quaternionAngle(
          quaternionAt(0),
          quaternionAt(output.getCount() - 1),
        ),
      ).toBeLessThan(1e-6)
    }
  })
})
