import {
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from 'three'

export const MAMMOTH_SUBJECT_GRADE_REVISION =
  'glacier-mammoth-authored-albedo-lift-v1' as const

export interface MammothSubjectGradeLease {
  readonly materialCount: number
  restore(): void
}

export interface MammothSubjectGradeOptions {
  /** Values below one lift dark fur while keeping white and black anchored. */
  readonly midtoneExponent: number
  /** A subtle albedo-derived floor keeps the unlit flank from reading black. */
  readonly minimumFill: number
  /** A small value above one keeps the lifted fur recognisably brown. */
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

function finiteMinimumFill(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Lifts only the mammoth's authored base-colour midtones before PBR lighting.
 * The snowfield, sky and exposure remain unchanged, so the fur can read as
 * brown without bleaching the already-bright environment.
 */
export function applyMammothSubjectGrade(
  root: Object3D,
  options: MammothSubjectGradeOptions,
): MammothSubjectGradeLease {
  const saturation = finiteGradeValue(options.saturation, 1)
  const midtoneExponent = finiteGradeValue(options.midtoneExponent, 1)
  const minimumFill = finiteMinimumFill(options.minimumFill)
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
      const originalOnBeforeCompile = Reflect.get(entry, 'onBeforeCompile')
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
          float mammothSubjectLuma = dot(
            diffuseColor.rgb,
            vec3(0.2126, 0.7152, 0.0722)
          );
          float mammothSubjectLiftedLuma = pow(
            max(mammothSubjectLuma, 0.0),
            ${midtoneExponent.toFixed(4)}
          );
          float mammothSubjectGain = mammothSubjectLuma > 0.0001
            ? mammothSubjectLiftedLuma / mammothSubjectLuma
            : 1.0;
          vec3 mammothSubjectLifted = min(
            diffuseColor.rgb * mammothSubjectGain,
            vec3(1.0)
          );
          diffuseColor.rgb = mix(
            vec3(mammothSubjectLiftedLuma),
            mammothSubjectLifted,
            ${saturation.toFixed(4)}
          );`,
        )
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * ${minimumFill.toFixed(4)};`,
        )
      }
      entry.customProgramCacheKey = () =>
        `${originalProgramCacheKey.call(entry)}|${MAMMOTH_SUBJECT_GRADE_REVISION}|` +
        `${saturation.toFixed(4)}|${midtoneExponent.toFixed(4)}|` +
        `${minimumFill.toFixed(4)}`
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
