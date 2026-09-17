import {
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from 'three'

export const OCEAN_SUBJECT_GRADE_REVISION =
  'ocean-authored-albedo-grade-v1' as const

export interface OceanSubjectGradeLease {
  readonly materialCount: number
  restore(): void
}

export interface OceanSubjectGradeOptions {
  /** Exponent above one deepens pale midtones while leaving black and white anchored. */
  readonly midtoneExponent: number
  /** Values above one restore colour separation lost to underwater scattering. */
  readonly saturation: number
}

interface MaterialPatch {
  readonly material: MeshStandardMaterial
  readonly onBeforeCompile: MeshStandardMaterial['onBeforeCompile']
  readonly programCacheKey: Material['customProgramCacheKey']
}

function finiteGradeValue(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Applies a reversible, ocean-only albedo grade after the authored base-colour
 * texture is sampled and before PBR lighting. This keeps skin, cloth and animal
 * markings from being flattened toward pale cyan without darkening the water,
 * fog or exposure for the whole scene.
 */
export function applyOceanSubjectGrade(
  root: Object3D,
  options: OceanSubjectGradeOptions,
): OceanSubjectGradeLease {
  const saturation = finiteGradeValue(options.saturation, 1)
  const midtoneExponent = finiteGradeValue(options.midtoneExponent, 1)
  const patches: MaterialPatch[] = []
  const visited = new Set<MeshStandardMaterial>()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const entry of materials) {
      if (!(entry instanceof MeshStandardMaterial) || visited.has(entry)) {
        continue
      }
      visited.add(entry)
      const originalOnBeforeCompile = Reflect.get(
        entry,
        'onBeforeCompile',
      )
      const originalProgramCacheKey = Reflect.get(
        entry,
        'customProgramCacheKey',
      )
      patches.push({
        material: entry,
        onBeforeCompile: originalOnBeforeCompile,
        programCacheKey: originalProgramCacheKey,
      })
      entry.onBeforeCompile = function onBeforeCompile(shader, renderer) {
        originalOnBeforeCompile.call(this, shader, renderer)
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float oceanSubjectLuma = dot(
            diffuseColor.rgb,
            vec3(0.2126, 0.7152, 0.0722)
          );
          diffuseColor.rgb = mix(
            vec3(oceanSubjectLuma),
            diffuseColor.rgb,
            ${saturation.toFixed(4)}
          );
          diffuseColor.rgb = pow(
            max(diffuseColor.rgb, vec3(0.0)),
            vec3(${midtoneExponent.toFixed(4)})
          );`,
        )
      }
      entry.customProgramCacheKey = () =>
        `${originalProgramCacheKey.call(entry)}|${OCEAN_SUBJECT_GRADE_REVISION}|` +
        `${saturation.toFixed(4)}|${midtoneExponent.toFixed(4)}`
      entry.needsUpdate = true
    }
  })

  let restored = false
  return {
    materialCount: patches.length,
    restore: () => {
      if (restored) return
      restored = true
      for (const patch of patches) {
        patch.material.onBeforeCompile = patch.onBeforeCompile
        patch.material.customProgramCacheKey = patch.programCacheKey
        patch.material.needsUpdate = true
      }
    },
  }
}
