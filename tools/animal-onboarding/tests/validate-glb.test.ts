import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateGlbFile } from '../src/validate-glb.mjs'

function jsonOnlyGlb(json: Record<string, unknown>): Buffer {
  const rawJson = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPadding = Buffer.alloc((4 - (rawJson.length % 4)) % 4, 0x20)
  const jsonChunk = Buffer.concat([rawJson, jsonPadding])
  const output = Buffer.alloc(20 + jsonChunk.length)
  output.write('glTF', 0, 'ascii')
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(output.length, 8)
  output.writeUInt32LE(jsonChunk.length, 12)
  output.writeUInt32LE(0x4e4f534a, 16)
  jsonChunk.copy(output, 20)
  return output
}

describe('local Khronos GLB validator', () => {
  it('validates through the tracked onboarding runtime', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'onboarding-validator-'))
    const modelPath = join(directory, 'minimal.glb')
    await writeFile(
      modelPath,
      jsonOnlyGlb({ asset: { version: '2.0' }, scene: 0, scenes: [{}] }),
    )

    await expect(validateGlbFile(modelPath)).resolves.toMatchObject({
      input: modelPath,
      validation: {
        errors: 0,
        warnings: 0,
      },
    })
  })
})
