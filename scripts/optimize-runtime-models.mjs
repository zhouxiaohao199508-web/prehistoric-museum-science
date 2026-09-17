import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { resampleCubicRotationTracks } from './resample-cubic-rotation-tracks.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const animalsRoot = join(repositoryRoot, 'src/content/animals')
const cli = join(repositoryRoot, 'node_modules/.bin/gltf-transform')

function readGlbJson(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('Expected a binary glTF file.')
  }
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength))
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

const animalIds = (await readdir(animalsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const animalId of animalIds) {
  const modelPath = join(animalsRoot, animalId, 'model/model.glb')
  let original
  try {
    original = await readFile(modelPath)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      continue
    }
    throw error
  }

  const json = readGlbJson(original)
  const extensions = new Set(json.extensionsUsed ?? [])
  const containsPng = (json.images ?? []).some(
    (image) => image.mimeType === 'image/png',
  )
  if (extensions.has('EXT_meshopt_compression') && !containsPng) {
    console.log(`${animalId}: already optimized`)
    continue
  }

  const scratch = await mkdtemp(join(tmpdir(), `museum-${animalId}-`))
  const webpPath = join(scratch, 'textures-webp.glb')
  const animationSafePath = join(scratch, 'animation-safe.glb')
  const optimizedPath = join(scratch, 'optimized.glb')
  try {
    let meshoptInput = modelPath
    if (containsPng) {
      execFileSync(
        cli,
        [
          'webp',
          modelPath,
          webpPath,
          '--formats',
          'png',
          '--lossless',
        ],
        { cwd: repositoryRoot, stdio: 'inherit' },
      )
      meshoptInput = webpPath
    }
    const resampledTracks = await resampleCubicRotationTracks(
      meshoptInput,
      animationSafePath,
    )
    if (resampledTracks > 0) {
      meshoptInput = animationSafePath
      console.log(
        `${animalId}: resampled ${resampledTracks} cubic rotation track(s) before Meshopt compression`,
      )
    }
    execFileSync(
      cli,
      [
        'meshopt',
        meshoptInput,
        optimizedPath,
        '--level',
        'high',
        '--quantize-position',
        '16',
        '--quantize-normal',
        '12',
        '--quantize-texcoord',
        '14',
        '--quantize-weight',
        '12',
      ],
      { cwd: repositoryRoot, stdio: 'inherit' },
    )
    execFileSync(cli, ['validate', optimizedPath], {
      cwd: repositoryRoot,
      stdio: 'inherit',
    })

    const optimized = await readFile(optimizedPath)
    if (optimized.byteLength >= original.byteLength) {
      console.log(`${animalId}: kept original because compression was not smaller`)
      continue
    }

    const nextPath = `${modelPath}.next`
    await copyFile(optimizedPath, nextPath)
    await rename(nextPath, modelPath)
    const modelStat = await stat(modelPath)
    console.log(
      JSON.stringify({
        animalId,
        beforeBytes: original.byteLength,
        bytes: modelStat.size,
        savedPercent: Number(
          ((1 - modelStat.size / original.byteLength) * 100).toFixed(1),
        ),
        sha256: sha256(optimized),
      }),
    )
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
