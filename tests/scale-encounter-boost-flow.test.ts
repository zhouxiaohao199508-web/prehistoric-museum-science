import {
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
  type LineBasicMaterial,
  type LineSegments,
  type Points,
  type PointsMaterial,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createScaleEncounterBoostFlowEffect } from '../src/viewer/scale-encounter-boost-flow'

describe('scale encounter boost flow', () => {
  it('does not allocate a flow layer for land encounters', () => {
    expect(createScaleEncounterBoostFlowEffect('land')).toBeNull()
  })

  it('emits paired bubbles and water streaks from the animated fin directions', () => {
    const effect = createScaleEncounterBoostFlowEffect('water')!
    const scene = new Scene()
    const avatarRoot = new Group()
    avatarRoot.position.set(2.5, 1.2, -0.8)
    avatarRoot.rotation.y = 0.35
    const visual = new Group()
    const leftFoot = new Group()
    leftFoot.name = 'LeftFoot'
    leftFoot.position.set(-0.16, -0.08, 0)
    const leftToe = new Group()
    leftToe.name = 'LeftToeBase'
    leftToe.position.set(0, 0, 0.3)
    leftFoot.add(leftToe)
    const rightFoot = new Group()
    rightFoot.name = 'RightFoot'
    rightFoot.position.set(0.16, 0.08, 0)
    const rightToe = new Group()
    rightToe.name = 'RightToeBase'
    rightToe.position.set(0, 0, 0.3)
    rightFoot.add(rightToe)
    visual.add(leftFoot, rightFoot)
    avatarRoot.add(visual)
    const avatar = {
      eyeAnchor: new Group(),
      root: avatarRoot,
      visual,
    }
    scene.add(avatarRoot, effect.root)
    scene.updateMatrixWorld(true)
    const camera = new PerspectiveCamera()
    camera.position.set(3, 2, -4)
    camera.rotation.set(0.1, -0.35, 0)
    camera.updateMatrixWorld(true)

    const bubbles = effect.root.getObjectByName(
      'scale-encounter-water-boost-bubbles',
    ) as Points
    const streams = effect.root.getObjectByName(
      'scale-encounter-water-boost-streams',
    ) as LineSegments
    expect(bubbles.userData.scaleEncounterBoostParticleCount).toBe(48)
    expect(streams.userData.scaleEncounterBoostStreamCount).toBe(18)
    expect(effect.root.userData.scaleEncounterBoostFlowModel).toBe(
      'paired-fin-anchored-flutter-wakes',
    )
    const bubbleMaterial = bubbles.material as PointsMaterial
    const streamMaterial = streams.material as LineBasicMaterial
    const positionsBefore = Array.from(
      bubbles.geometry.getAttribute('position').array,
    )

    effect.update(1 / 60, camera, false, avatar)
    expect(effect.root.visible).toBe(false)
    effect.setIntensity(1)
    effect.update(0.1, camera, false, avatar)

    expect(effect.root.visible).toBe(true)
    expect(effect.root.position.toArray()).toEqual([0, 0, 0])
    expect(effect.root.userData.scaleEncounterWaterWakeAnchorNames).toEqual([
      'LeftToeBase',
      'RightToeBase',
    ])
    expect(bubbleMaterial.opacity).toBeCloseTo(0.72, 6)
    expect(streamMaterial.opacity).toBeCloseTo(0.13, 6)
    expect(
      Array.from(bubbles.geometry.getAttribute('position').array),
    ).not.toEqual(positionsBefore)
    const leftToeWorld = leftToe.getWorldPosition(new Vector3())
    const rightToeWorld = rightToe.getWorldPosition(new Vector3())
    const bubblePositions = bubbles.geometry.getAttribute('position')
    for (let index = 0; index < bubblePositions.count; index += 1) {
      const position = new Vector3().fromBufferAttribute(bubblePositions, index)
      expect(
        Math.min(
          position.distanceTo(leftToeWorld),
          position.distanceTo(rightToeWorld),
        ),
      ).toBeLessThan(1.2)
    }

    const directionsBefore = effect.root.userData
      .scaleEncounterWaterWakeDirections as number[][]
    leftToe.position.y += 0.12
    scene.updateMatrixWorld(true)
    effect.update(1 / 30, camera, false, avatar)
    expect(
      effect.root.userData.scaleEncounterWaterWakeDirections,
    ).not.toEqual(directionsBefore)

    effect.update(0.1, camera, true, avatar)
    expect(effect.root.visible).toBe(false)
    expect(bubbleMaterial.opacity).toBe(0)
    expect(streamMaterial.opacity).toBe(0)

    const bubbleGeometryDispose = vi.spyOn(bubbles.geometry, 'dispose')
    const streamGeometryDispose = vi.spyOn(streams.geometry, 'dispose')
    effect.dispose()
    expect(effect.root.parent).toBeNull()
    expect(effect.root.children).toHaveLength(0)
    expect(bubbleGeometryDispose).toHaveBeenCalledOnce()
    expect(streamGeometryDispose).toHaveBeenCalledOnce()
  })

  it('keeps the sky treatment to sparse, low-opacity airflow lines', () => {
    const effect = createScaleEncounterBoostFlowEffect('air')!
    const camera = new PerspectiveCamera()
    camera.position.set(-2, 4, 8)
    camera.updateMatrixWorld(true)
    const streams = effect.root.getObjectByName(
      'scale-encounter-air-boost-streams',
    ) as LineSegments

    expect(
      effect.root.getObjectByName('scale-encounter-water-boost-bubbles'),
    ).toBeUndefined()
    expect(streams.userData.scaleEncounterBoostStreamCount).toBe(20)
    effect.setIntensity(0.6)
    effect.update(0.1, camera, false)

    expect(effect.root.visible).toBe(true)
    expect((streams.material as LineBasicMaterial).opacity).toBeCloseTo(
      0.114,
      6,
    )
    effect.dispose()
  })
})
