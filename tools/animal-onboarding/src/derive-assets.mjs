import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const requireFromOnboarding = createRequire(
  new URL('../package.json', import.meta.url),
)
const sharp = requireFromOnboarding('sharp')

async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true })
}

async function imageEvidence(path) {
  const bytes = await readFile(path)
  const metadata = await sharp(bytes).metadata()
  return {
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  }
}

export async function convertBackgrounds(profile) {
  const candidateDirectory = dirname(
    dirname(resolve(profile.assets.backgroundLandscapePath)),
  )
  const base = resolve(candidateDirectory, 'working/backgrounds')
  const landscapeOutput = resolve(profile.assets.backgroundLandscapePath)
  const portraitOutput = resolve(profile.assets.backgroundPortraitPath)
  await ensureParent(landscapeOutput)
  await sharp(resolve(base, 'landscape-source.png'))
    .resize(1672, 941, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 6 })
    .toFile(landscapeOutput)
  await sharp(resolve(base, 'portrait-source.png'))
    .resize(941, 1672, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 6 })
    .toFile(portraitOutput)

  const evidencePath = resolve(profile.assets.backgroundEvidencePath)
  const existing = JSON.parse(await readFile(evidencePath, 'utf8'))
  const evidence = {
    ...existing,
    derivation: {
      method: 'Sharp deterministic cover resize and WebP encoding',
      landscape: {
        source: await imageEvidence(resolve(base, 'landscape-source.png')),
        runtime: await imageEvidence(landscapeOutput),
      },
      portrait: {
        source: await imageEvidence(resolve(base, 'portrait-source.png')),
        runtime: await imageEvidence(portraitOutput),
      },
    },
  }
  await ensureParent(evidencePath)
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return {
    landscape: landscapeOutput,
    portrait: portraitOutput,
    evidence: evidencePath,
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export async function pixelDifference(foreground, background) {
  const foregroundRaw = await sharp(foreground)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const backgroundRaw = await sharp(background).removeAlpha().raw().toBuffer()
  const { width, height, channels } = foregroundRaw.info
  let minimumX = width
  let minimumY = height
  let maximumX = -1
  let maximumY = -1
  let changedPixels = 0
  for (let index = 0; index < foregroundRaw.data.length; index += channels) {
    const difference =
      Math.abs(foregroundRaw.data[index] - backgroundRaw[index]) +
      Math.abs(foregroundRaw.data[index + 1] - backgroundRaw[index + 1]) +
      Math.abs(foregroundRaw.data[index + 2] - backgroundRaw[index + 2])
    if (difference < 34) continue
    const pixelIndex = index / channels
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    minimumX = Math.min(minimumX, x)
    minimumY = Math.min(minimumY, y)
    maximumX = Math.max(maximumX, x)
    maximumY = Math.max(maximumY, y)
    changedPixels += 1
  }
  return {
    width,
    height,
    changedPixels,
    ratio: changedPixels / (width * height),
    bbox:
      maximumX < 0
        ? null
        : {
            x: minimumX,
            y: minimumY,
            width: maximumX - minimumX + 1,
            height: maximumY - minimumY + 1,
          },
  }
}

export async function deriveReviewImages({
  profile,
  screenshotPath,
  modelBounds,
  portraitScreenshotPath,
}) {
  const screenshot = resolve(screenshotPath)
  const metadata = await sharp(screenshot).metadata()
  if (!metadata.width || !metadata.height || !modelBounds) {
    throw new Error('Cannot derive review images without screenshot bounds')
  }
  const centerX = modelBounds.x + modelBounds.width / 2
  const centerY = modelBounds.y + modelBounds.height / 2
  const posterContentWidth = modelBounds.width * 1.24
  const posterContentHeight = modelBounds.height * 1.5
  let posterCropWidth = Math.max(
    posterContentWidth,
    posterContentHeight * (16 / 9),
  )
  let posterCropHeight = posterCropWidth * (9 / 16)
  const posterScale = Math.min(
    1,
    metadata.width / posterCropWidth,
    metadata.height / posterCropHeight,
  )
  posterCropWidth = Math.max(1, Math.floor(posterCropWidth * posterScale))
  posterCropHeight = Math.max(1, Math.floor(posterCropHeight * posterScale))
  const posterLeft = Math.round(
    clamp(centerX - posterCropWidth / 2, 0, metadata.width - posterCropWidth),
  )
  const posterTop = Math.round(
    clamp(
      centerY - posterCropHeight / 2,
      0,
      metadata.height - posterCropHeight,
    ),
  )
  await ensureParent(resolve(profile.assets.posterPath))
  await sharp(screenshot)
    .extract({
      left: posterLeft,
      top: posterTop,
      width: posterCropWidth,
      height: posterCropHeight,
    })
    .resize(960, 540)
    .webp({ quality: 84, effort: 6 })
    .toFile(resolve(profile.assets.posterPath))
  if (!profile.assets.posterPortraitPath || !portraitScreenshotPath) {
    throw new Error(
      'Cannot derive complete review images without posterPortraitPath and a phone-portrait capture',
    )
  }
  await ensureParent(resolve(profile.assets.posterPortraitPath))
  await sharp(resolve(portraitScreenshotPath))
    .resize(390, 844, { fit: 'cover', position: 'centre' })
    .webp({ quality: 84, effort: 6 })
    .toFile(resolve(profile.assets.posterPortraitPath))
  const squareSide = Math.min(
    metadata.width,
    metadata.height,
    Math.ceil(
      Math.max(modelBounds.width * 1.16, modelBounds.height * 1.55),
    ),
  )
  const squareLeft = Math.round(
    clamp(centerX - squareSide / 2, 0, metadata.width - squareSide),
  )
  const squareTop = Math.round(
    clamp(centerY - squareSide / 2, 0, metadata.height - squareSide),
  )
  await sharp(screenshot)
    .extract({
      left: squareLeft,
      top: squareTop,
      width: squareSide,
      height: squareSide,
    })
    .resize(320, 320)
    .webp({ quality: 82, effort: 6 })
    .toFile(resolve(profile.assets.thumbnailPath))
}

export async function makeContactSheet(inputPaths, outputPath) {
  if (inputPaths.length === 0) throw new Error('No screenshots for contact sheet')
  const tileWidth = 360
  const tileHeight = 240
  const tiles = await Promise.all(
    inputPaths.map((path) =>
      sharp(resolve(path))
        .resize(tileWidth, tileHeight, {
          fit: 'contain',
          background: '#10221c',
        })
        .png()
        .toBuffer(),
    ),
  )
  const columns = 2
  const rows = Math.ceil(tiles.length / columns)
  await ensureParent(resolve(outputPath))
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: '#10221c',
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      })),
    )
    .png()
    .toFile(resolve(outputPath))
}

async function main() {
  const [command, profilePath] = process.argv.slice(2)
  if (command !== 'backgrounds' || !profilePath) {
    console.error('Usage: node derive-assets.mjs backgrounds <profile.json>')
    process.exitCode = 2
    return
  }
  const profile = JSON.parse(await readFile(resolve(profilePath), 'utf8'))
  console.log(JSON.stringify(await convertBackgrounds(profile), null, 2))
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  await main()
}
