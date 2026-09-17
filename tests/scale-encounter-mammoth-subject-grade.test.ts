import {
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'

import {
  MAMMOTH_SUBJECT_GRADE_REVISION,
  applyMammothSubjectGrade,
} from '../src/scale-encounter/environments/glacier/mammoth-subject-grade'

describe('mammoth subject grade', () => {
  it('lifts shared fur materials through one reversible shader grade', () => {
    const root = new Group()
    const sharedMaterial = new MeshStandardMaterial({ color: '#2f241b' })
    root.add(
      new Mesh(new SphereGeometry(1), sharedMaterial),
      new Mesh(new SphereGeometry(1), sharedMaterial),
    )
    const originalCompile = Reflect.get(sharedMaterial, 'onBeforeCompile')
    const originalCacheKey = Reflect.get(
      sharedMaterial,
      'customProgramCacheKey',
    )

    const lease = applyMammothSubjectGrade(root, {
      midtoneExponent: 0.62,
      minimumFill: 0.075,
      saturation: 1.08,
    })

    expect(lease.materialCount).toBe(1)
    const gradedCompile = Reflect.get(sharedMaterial, 'onBeforeCompile')
    const gradedCacheKey = Reflect.get(
      sharedMaterial,
      'customProgramCacheKey',
    )
    expect(gradedCompile).not.toBe(originalCompile)
    expect(gradedCacheKey.call(sharedMaterial)).toContain(
      MAMMOTH_SUBJECT_GRADE_REVISION,
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
