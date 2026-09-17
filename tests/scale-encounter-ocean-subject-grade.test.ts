import {
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import {
  OCEAN_SUBJECT_GRADE_REVISION,
  applyOceanSubjectGrade,
} from '../src/scale-encounter/environments/ocean/ocean-subject-grade'

describe('ocean subject grade', () => {
  it('adds and restores one reversible authored-albedo shader grade', () => {
    const root = new Group()
    const sharedMaterial = new MeshStandardMaterial({ color: '#ffffff' })
    root.add(
      new Mesh(new SphereGeometry(1), sharedMaterial),
      new Mesh(new SphereGeometry(1), sharedMaterial),
    )
    const originalCompile = Reflect.get(
      sharedMaterial,
      'onBeforeCompile',
    )
    const originalCacheKey = Reflect.get(
      sharedMaterial,
      'customProgramCacheKey',
    )

    const lease = applyOceanSubjectGrade(root, {
      midtoneExponent: 1.08,
      saturation: 1.18,
    })

    expect(lease.materialCount).toBe(1)
    const gradedCompile = Reflect.get(
      sharedMaterial,
      'onBeforeCompile',
    )
    const gradedCacheKey = Reflect.get(
      sharedMaterial,
      'customProgramCacheKey',
    )
    expect(gradedCompile).not.toBe(originalCompile)
    expect(gradedCacheKey.call(sharedMaterial)).toContain(
      OCEAN_SUBJECT_GRADE_REVISION,
    )

    lease.restore()
    expect(Reflect.get(sharedMaterial, 'onBeforeCompile')).toBe(originalCompile)
    expect(Reflect.get(sharedMaterial, 'customProgramCacheKey')).toBe(
      originalCacheKey,
    )
    lease.restore()

    sharedMaterial.dispose()
    root.children.forEach((child) => {
      if (child instanceof Mesh && child.geometry instanceof SphereGeometry) {
        child.geometry.dispose()
      }
    })
  })
})
