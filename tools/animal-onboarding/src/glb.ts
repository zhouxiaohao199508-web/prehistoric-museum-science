import { readFile } from 'node:fs/promises'

import type { GlbInspection } from './types'

function records(value: unknown): ReadonlyArray<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null && !Array.isArray(entry),
      )
    : []
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function inspectGlbBytes(buffer: Buffer): GlbInspection {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('not a GLB container')
  }
  const version = buffer.readUInt32LE(4)
  const declaredBytes = buffer.readUInt32LE(8)
  const jsonBytes = buffer.readUInt32LE(12)
  if (
    version !== 2 ||
    declaredBytes !== buffer.length ||
    buffer.readUInt32LE(16) !== 0x4e4f534a
  ) {
    throw new Error('invalid glTF 2 GLB header')
  }
  const root = JSON.parse(
    buffer
      .toString('utf8', 20, 20 + jsonBytes)
      .replaceAll(String.fromCharCode(0), '')
      .trimEnd(),
  ) as Record<string, unknown>
  const accessors = records(root.accessors)
  let triangles = 0
  let drawCalls = 0
  const materialIndices = new Set<number>()
  for (const mesh of records(root.meshes)) {
    for (const primitive of records(mesh.primitives)) {
      drawCalls += 1
      const material = numberValue(primitive.material)
      if (material !== undefined) materialIndices.add(material)
      const attributes =
        typeof primitive.attributes === 'object' &&
        primitive.attributes !== null &&
        !Array.isArray(primitive.attributes)
          ? (primitive.attributes as Record<string, unknown>)
          : {}
      const accessorIndex =
        numberValue(primitive.indices) ?? numberValue(attributes.POSITION)
      const accessor =
        accessorIndex === undefined ? undefined : accessors[accessorIndex]
      const count = numberValue(accessor?.count)
      const mode = numberValue(primitive.mode) ?? 4
      if (count === undefined) continue
      triangles +=
        mode === 4
          ? Math.floor(count / 3)
          : mode === 5 || mode === 6
            ? Math.max(0, count - 2)
            : 0
    }
  }
  const animations = records(root.animations)
  const animationDurations = animations.map((animation) => {
    let maximum = 0
    for (const sampler of records(animation.samplers)) {
      const inputIndex = numberValue(sampler.input)
      const accessor =
        inputIndex === undefined ? undefined : accessors[inputIndex]
      const max = Array.isArray(accessor?.max)
        ? numberValue(accessor.max[0])
        : undefined
      if (max !== undefined) maximum = Math.max(maximum, max)
    }
    return maximum
  })
  const externalUris = [...records(root.buffers), ...records(root.images)]
    .map((entry) => stringValue(entry.uri))
    .filter(
      (uri): uri is string =>
        uri !== undefined && !uri.startsWith('data:'),
    )
  return {
    version,
    declaredBytes,
    animationNames: animations.map(
      (animation, index) =>
        stringValue(animation.name) ?? `animation-${index}`,
    ),
    animationDurations,
    externalUris,
    triangles,
    drawCalls,
    materials: materialIndices.size,
    bones: records(root.skins).reduce(
      (maximum, skin) =>
        Math.max(
          maximum,
          Array.isArray(skin.joints) ? skin.joints.length : 0,
        ),
      0,
    ),
    meshes: records(root.meshes).length,
    textures: records(root.textures).length,
  }
}

export async function inspectGlbFile(path: string): Promise<GlbInspection> {
  return inspectGlbBytes(await readFile(path))
}
