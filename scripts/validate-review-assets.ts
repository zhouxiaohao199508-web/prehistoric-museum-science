import { access, readFile, stat } from 'node:fs/promises'

import sharp from 'sharp'

import {
  modelPreviewProfiles,
} from '../src/viewer/model-preview-profiles'
import { inspectGlb, inspectWebp } from './content-validation'
import { localReviewAssetFiles } from './review-assets'
import {
  formatVisibleAlphaEdgeContacts,
  visibleAlphaEdgeContacts,
} from './transparent-image-edges'

const errors: string[] = []
let totalBytes = 0
const modelStillDimensions = new Map<string, readonly [number, number]>([
  ['poster.webp', [1200, 675]],
  ['poster-portrait.webp', [390, 844]],
  ...modelPreviewProfiles.map(
    ({ fileName, height, width }) =>
      [fileName, [width, height] as const] as const,
  ),
])

async function validateTransparentModelStill(
  buffer: Uint8Array,
  route: string,
): Promise<void> {
  const metadata = await sharp(buffer).metadata()
  const alpha = await sharp(buffer)
    .ensureAlpha()
    .extractChannel('alpha')
    .stats()
  const alphaChannel = alpha.channels[0]
  if (!metadata.hasAlpha || !alphaChannel || alphaChannel.min !== 0) {
    errors.push(`${route} 必须保留透明背景。`)
    return
  }
  if (alphaChannel.max <= 100 || alphaChannel.mean >= 120) {
    errors.push(`${route} 没有可用的透明模型轮廓。`)
  }
  const edgeContactSummary = formatVisibleAlphaEdgeContacts(
    await visibleAlphaEdgeContacts(buffer),
  )
  if (edgeContactSummary) {
    errors.push(`${route} 的可见模型像素接触图片边缘（${edgeContactSummary}）。`)
  }
}

for (const [route, absolutePath] of localReviewAssetFiles) {
  try {
    await access(absolutePath)
    const fileStat = await stat(absolutePath)
    totalBytes += fileStat.size
    if (!fileStat.isFile() || fileStat.size === 0) {
      errors.push(`${route} 不是非空普通文件。`)
      continue
    }

    const buffer = await readFile(absolutePath)
    const fileName = route.slice(route.lastIndexOf('/') + 1)
    const expectedModelStillDimensions = modelStillDimensions.get(fileName)
    if (route.endsWith('/model.glb')) {
      const inspection = inspectGlb(buffer)
      if (inspection.externalUris.length > 0) {
        errors.push(`${route} 仍引用外部 GLTF 资源。`)
      }
    } else if (
      expectedModelStillDimensions &&
      fileName.startsWith('preview-')
    ) {
      const dimensions = inspectWebp(buffer)
      if (
        dimensions.width !== expectedModelStillDimensions[0] ||
        dimensions.height !== expectedModelStillDimensions[1]
      ) {
        errors.push(
          `${route} 应为 ${expectedModelStillDimensions[0]}×${expectedModelStillDimensions[1]}，实际为 ${dimensions.width}×${dimensions.height}。`,
        )
      }
      await validateTransparentModelStill(buffer, route)
    } else if (route.endsWith('/poster-portrait.webp')) {
      const dimensions = inspectWebp(buffer)
      if (dimensions.width !== 390 || dimensions.height !== 844) {
        errors.push(
          `${route} 应为 390×844，实际为 ${dimensions.width}×${dimensions.height}。`,
        )
      }
      await validateTransparentModelStill(buffer, route)
    } else if (route.endsWith('/poster.webp')) {
      const dimensions = inspectWebp(buffer)
      const isLegacyReviewSize =
        dimensions.width === 960 && dimensions.height === 540
      const isRuntimeSize =
        dimensions.width === 1200 && dimensions.height === 675
      if (!isLegacyReviewSize && !isRuntimeSize) {
        errors.push(
          `${route} 应为 960×540 或 1200×675，实际为 ${dimensions.width}×${dimensions.height}。`,
        )
      }
      await validateTransparentModelStill(buffer, route)
    } else if (route.endsWith('/thumbnail.webp')) {
      const dimensions = inspectWebp(buffer)
      if (dimensions.width !== 320 || dimensions.height !== 320) {
        errors.push(
          `${route} 应为 320×320，实际为 ${dimensions.width}×${dimensions.height}。`,
        )
      }
    } else if (
      route.endsWith('/narration.mp3') ||
      route.endsWith('/narration.en.mp3')
    ) {
      const startsWithId3 = buffer.subarray(0, 3).toString('ascii') === 'ID3'
      const startsWithFrameSync =
        buffer.length >= 2 &&
        buffer[0] === 0xff &&
        (buffer[1] ?? 0) >>> 5 === 0b111
      if (!startsWithId3 && !startsWithFrameSync) {
        errors.push(`${route} 没有可识别的 MP3 文件头。`)
      }
      if (fileStat.size > 300 * 1024) {
        errors.push(`${route} 超过 300 KiB 本地评审上限。`)
      }
    } else if (absolutePath.endsWith('.png')) {
      const pngSignature = '89504e470d0a1a0a'
      if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
        errors.push(`${route} 没有有效的 PNG 文件头。`)
      }
    } else if (absolutePath.endsWith('.webp')) {
      inspectWebp(buffer)
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '未知文件读取错误'
    errors.push(`${route} → ${absolutePath}（${message}）`)
  }
}

if (errors.length > 0) {
  console.error('Local review assets are incomplete:')
  for (const entry of errors) {
    console.error(`- ${entry}`)
  }
  process.exitCode = 1
} else {
  console.log(
    `Local review assets: ${localReviewAssetFiles.size} route(s), ${totalBytes} byte(s), 0 missing.`,
  )
}
