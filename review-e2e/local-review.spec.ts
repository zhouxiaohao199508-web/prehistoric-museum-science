import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { modelPreviewProfiles } from '../src/viewer/model-preview-profiles'

const reviewAnimals = [
  { id: 'stegosaurus', name: '剑龙', narrationReady: true },
  { id: 'pteranodon', name: '无齿翼龙', narrationReady: true },
  { id: 'pachycephalosaurus', name: '肿头龙', narrationReady: true },
  { id: 'ichthyosaur', name: '鱼龙类', narrationReady: true },
  { id: 'tyrannosaurus-rex', name: '霸王龙', narrationReady: true },
  { id: 'rhamphorhynchus', name: '喙嘴翼龙', narrationReady: true },
  { id: 'triceratops', name: '三角龙', narrationReady: true },
  { id: 'apatosaurus', name: '迷惑龙', narrationReady: true },
  { id: 'plesiosaurus', name: '蛇颈龙类', narrationReady: true },
  { id: 'gigantoraptor', name: '巨盗龙', narrationReady: true },
  { id: 'tupandactylus', name: '古神翼龙', narrationReady: true },
  { id: 'mammoth', name: '长毛猛犸象', narrationReady: true },
  { id: 'megalodon', name: '巨齿鲨', narrationReady: true },
  { id: 'maiasaura', name: '慈母龙', narrationReady: true },
  { id: 'sauropelta', name: '胄甲龙', narrationReady: true },
  { id: 'meganeura', name: '巨脉蜻蜓', narrationReady: true },
  { id: 'dilophosaurus', name: '双冠龙', narrationReady: true },
  { id: 'mosasaurus', name: '沧龙', narrationReady: true },
] as const

const firstFrameViewports = modelPreviewProfiles.map((profile) => ({
  fileName: profile.fileName,
  height: profile.referenceHeight,
  key: profile.key,
  width: profile.referenceWidth,
}))

async function alphaMaskMismatchRatio(
  firstPng: Buffer,
  secondPng: Buffer,
): Promise<{
  readonly geometryDelta: number
  readonly mismatchRatio: number
}> {
  const [first, second] = await Promise.all([
    sharp(firstPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(secondPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ])
  expect(first.info.width).toBe(second.info.width)
  expect(first.info.height).toBe(second.info.height)
  let union = 0
  let mismatch = 0
  const firstGeometry = {
    count: 0,
    maxX: 0,
    maxY: 0,
    minX: first.info.width,
    minY: first.info.height,
    sumX: 0,
    sumY: 0,
  }
  const secondGeometry = { ...firstGeometry }
  for (let offset = 3; offset < first.data.length; offset += 4) {
    const firstVisible = (first.data[offset] ?? 0) > 24
    const secondVisible = (second.data[offset] ?? 0) > 24
    const pixelIndex = (offset - 3) / 4
    const x = pixelIndex % first.info.width
    const y = Math.floor(pixelIndex / first.info.width)
    for (const [visible, geometry] of [
      [firstVisible, firstGeometry],
      [secondVisible, secondGeometry],
    ] as const) {
      if (!visible) continue
      geometry.count += 1
      geometry.minX = Math.min(geometry.minX, x)
      geometry.maxX = Math.max(geometry.maxX, x)
      geometry.minY = Math.min(geometry.minY, y)
      geometry.maxY = Math.max(geometry.maxY, y)
      geometry.sumX += x
      geometry.sumY += y
    }
    if (firstVisible || secondVisible) {
      union += 1
    }
    if (firstVisible !== secondVisible) {
      mismatch += 1
    }
  }
  const normalizedGeometry = (
    geometry: typeof firstGeometry,
  ): readonly number[] => [
    geometry.minX / first.info.width,
    geometry.maxX / first.info.width,
    geometry.minY / first.info.height,
    geometry.maxY / first.info.height,
    geometry.sumX / Math.max(geometry.count, 1) / first.info.width,
    geometry.sumY / Math.max(geometry.count, 1) / first.info.height,
  ]
  const firstNormalized = normalizedGeometry(firstGeometry)
  const secondNormalized = normalizedGeometry(secondGeometry)
  return {
    geometryDelta: Math.max(
      ...firstNormalized.map((value, index) =>
        Math.abs(value - (secondNormalized[index] ?? value)),
      ),
    ),
    mismatchRatio: mismatch / Math.max(union, 1),
  }
}

test('keeps every animal static preview aligned with its deterministic WebGL frame', async ({
  page,
  request,
}) => {
  test.setTimeout(360_000)
  for (const [animalIndex, { id: animalId }] of reviewAnimals.entries()) {
    const viewportProfile =
      firstFrameViewports[animalIndex % firstFrameViewports.length]
    let releaseModel: () => void = () => {}
    const modelGate = new Promise<void>((resolve) => {
      releaseModel = resolve
    })
    const modelPattern = `**/__museum-review-assets/${animalId}/model.glb`
    await page.route(modelPattern, async (route) => {
      await modelGate
      await route.continue()
    })

    await page.setViewportSize({
      height: viewportProfile.height,
      width: viewportProfile.width,
    })
    await page.goto(`/?animal=${animalId}`, { waitUntil: 'domcontentloaded' })
    const still = page.locator('.model-still img')
    await expect(still).toBeVisible()
    await expect(page.locator('.model-viewport')).toHaveAttribute(
      'data-preview-profile',
      viewportProfile.key,
    )
    await expect
      .poll(async () => {
        const currentSource = await page.evaluate<string>(
          `document.querySelector('.model-still img')?.currentSrc ?? ''`,
        )
        return currentSource ? new URL(currentSource).pathname : ''
      })
      .toBe(
        `/__museum-review-assets/${animalId}/${viewportProfile.fileName}`,
      )
    await page.addStyleTag({
      content: `
        html,
        body,
        #root,
        .museum-experience,
        .stage-panel,
        .viewer-stage,
        .model-viewport,
        .viewer-host {
          background: transparent !important;
        }

        .museum-experience > :not(.stage-panel),
        .stage-panel > :not(.viewer-stage),
        .model-viewport > :not(.model-still):not(.viewer-host) {
          visibility: hidden !important;
        }

      `,
    })
    const viewport = page.locator('.model-viewport')
    const staticFrame = await viewport.screenshot({
      animations: 'disabled',
      omitBackground: true,
      type: 'png',
    })

    releaseModel()
    await expect(page.locator('#museum-experience')).toHaveAttribute(
      'data-ready-animal-id',
      animalId,
      { timeout: 30_000 },
    )
    const frozenAtFirstFrame = await page.evaluate<boolean>(
      `document.querySelector('.viewer-canvas')?.__museumReviewSetAnimationTime?.(0) ?? false`,
    )
    expect(frozenAtFirstFrame).toBe(true)
    await expect(still).toHaveCount(0)
    await page.waitForTimeout(180)
    const webglFrame = await viewport.screenshot({
      animations: 'disabled',
      omitBackground: true,
      type: 'png',
    })
    const continuity = await alphaMaskMismatchRatio(staticFrame, webglFrame)
    expect(
      continuity.geometryDelta,
      `${animalId}/${viewportProfile.key} geometry`,
    ).toBeLessThan(0.006)
    expect(
      continuity.mismatchRatio,
      `${animalId}/${viewportProfile.key} silhouette`,
    ).toBeLessThan(0.06)

    const manifestResponse = await request.get(
      `/__museum-review-assets/${animalId}/model-preview.manifest.json`,
    )
    expect(manifestResponse.ok()).toBe(true)
    const manifest = (await manifestResponse.json()) as {
      readonly presentationSignature: string
    }
    await expect(page.locator('.viewer-canvas')).toHaveAttribute(
      'data-preview-presentation-signature',
      manifest.presentationSignature,
    )
    await page.unroute(modelPattern)
  }
})

test('reviews every visual presentation and keeps narration user-triggered', async ({
  page,
  request,
}) => {
  const requestedReviewAssets = new Set<string>()
  page.on('request', (browserRequest) => {
    const pathname = new URL(browserRequest.url()).pathname
    if (pathname.startsWith('/__museum-review-assets/')) {
      requestedReviewAssets.add(pathname)
    }
  })
  await page.addInitScript(`
    window.__museumReviewAudio = { pauseCalls: 0, playCalls: 0 }
    HTMLMediaElement.prototype.play = function () {
      window.__museumReviewAudio.playCalls += 1
      return Promise.resolve()
    }
    HTMLMediaElement.prototype.pause = function () {
      window.__museumReviewAudio.pauseCalls += 1
    }
  `)

  await page.goto('/')
  const museum = page.locator('#museum-experience')
  await expect(museum).toHaveAttribute('data-review-mode', 'true')
  await expect(
    page.getByRole('region', { name: '本地评审动物选择' }),
  ).toBeVisible()
  await expect(page.locator('[data-animal-id]')).toHaveCount(
    reviewAnimals.length,
  )
  await expect(museum).toHaveAttribute('data-ready-animal-id', 'stegosaurus', {
    timeout: 20_000,
  })
  await page.waitForTimeout(350)
  expect(
    requestedReviewAssets.has(
      `/__museum-review-assets/${reviewAnimals[1].id}/background-landscape`,
    ),
  ).toBe(false)
  expect(
    requestedReviewAssets.has(
      `/__museum-review-assets/${reviewAnimals[1].id}/poster.webp`,
    ),
  ).toBe(false)
  const initialNarrationButton = page.getByRole('button', {
    name: '听它的介绍',
  })
  const initialWave = initialNarrationButton.locator('.narration-wave')
  await expect(initialNarrationButton).toBeEnabled()
  await expect(initialNarrationButton).toHaveAttribute(
    'data-playback',
    'stopped',
  )
  await expect(initialWave).toHaveCount(0)
  expect(
    await page.evaluate<number>('window.__museumReviewAudio.playCalls'),
  ).toBe(0)

  for (const privatePath of [
    '/.handoff/collection-review/audio/pachycephalosaurus.mp3',
    '/assets/candidates/second-pass-sketchfab/normalized-glb/pachycephalosaurus.glb',
    '/assets/candidates/quaternius-animated-dinosaurs/normalized-glb/trex.glb',
    '/assets/candidates/sketchfab-round2-2026-07/normalized-glb/tyrannosaurus-marcel-schanz.glb',
    '/assets/candidates/user-sketchfab-review-2026-07/normalized-glb/gigantoraptor.glb',
    '/prototypes/background-art-directions/assets/a-gouache-land-landscape.png',
  ]) {
    const directAsset = await request.get(privatePath, {
      headers: { Range: 'bytes=0-31' },
    })
    expect(directAsset.status()).toBe(404)
  }

  await initialNarrationButton.click()
  const playingNarrationButton = page.getByRole('button', {
    name: '暂停介绍',
  })
  await expect(playingNarrationButton).toBeVisible()
  await expect(playingNarrationButton).toHaveAttribute(
    'data-playback',
    'playing',
  )
  await expect(playingNarrationButton.locator('.narration-wave')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(
    playingNarrationButton.locator('.narration-wave > span'),
  ).toHaveCount(4)
  await expect(
    playingNarrationButton.locator('.narration-wave > span').first(),
  ).toHaveCSS('animation-name', 'narration-wave')
  expect(
    await page.evaluate<number>('window.__museumReviewAudio.playCalls'),
  ).toBe(1)

  let releaseIchthyosaurPoster: () => void = () => {}
  const ichthyosaurPosterGate = new Promise<void>((resolve) => {
    releaseIchthyosaurPoster = resolve
  })
  await page.route(
    '**/__museum-review-assets/ichthyosaur/poster.webp',
    async (route) => {
      await ichthyosaurPosterGate
      await route.continue()
    },
  )

  for (const animal of reviewAnimals.slice(1)) {
    await page.locator(`[data-animal-id="${animal.id}"]`).click()
    await expect(museum).toHaveAttribute('data-ready-animal-id', animal.id, {
      timeout: animal.id === 'ichthyosaur' ? 10_000 : 20_000,
    })
    if (animal.id === 'ichthyosaur') {
      expect(
        requestedReviewAssets.has(
          '/__museum-review-assets/ichthyosaur/poster.webp',
        ),
      ).toBe(true)
      releaseIchthyosaurPoster()
    }
    await expect(
      page.getByRole('heading', { level: 1, name: animal.name }),
    ).toBeVisible()
    await expect(page.locator('.viewer-canvas')).toHaveAttribute(
      'aria-label',
      `${animal.name}三维模型，可拖动旋转并缩放`,
    )

    if (!animal.narrationReady) {
      const pendingNarrationButton = page.getByRole('button', {
        name: '介绍准备中',
      })
      await expect(pendingNarrationButton).toBeDisabled()
      await expect(pendingNarrationButton).toHaveAttribute(
        'data-playback',
        'stopped',
      )
      const missingAudio = await request.get(
        `/__museum-review-assets/${animal.id}/narration.mp3`,
      )
      expect(missingAudio.status()).toBe(404)
      continue
    }

    const narrationButton = page.getByRole('button', {
      name: '听它的介绍',
    })
    await expect(narrationButton).toBeEnabled()
    await expect(narrationButton).toHaveAttribute('data-playback', 'stopped')
    await expect(narrationButton.locator('.narration-wave')).toHaveCount(0)

    const audio = await request.get(
      `/__museum-review-assets/${animal.id}/narration.mp3`,
      { headers: { Range: 'bytes=0-31' } },
    )
    expect(audio.status()).toBe(206)
    expect(audio.headers()['content-type']).toContain('audio/mpeg')
    expect((await audio.body()).byteLength).toBe(32)

    await narrationButton.click()
    await expect(
      page.getByRole('button', { name: '暂停介绍' }),
    ).toHaveAttribute('data-playback', 'playing')
  }

  expect(
    await page.evaluate<number>('window.__museumReviewAudio.playCalls'),
  ).toBe(reviewAnimals.filter(({ narrationReady }) => narrationReady).length)
  expect(
    await page.evaluate<number>('window.__museumReviewAudio.pauseCalls'),
  ).toBeGreaterThanOrEqual(3)

  await page.locator('[data-animal-id="mammoth"]').click()
  await expect(museum).toHaveAttribute('data-ready-animal-id', 'mammoth', {
    timeout: 20_000,
  })

  await page.getByRole('button', { name: '给家长的资料' }).click()
  const drawer = page.getByRole('dialog', { name: '给家长的资料' })
  await expect(drawer).toBeVisible()
  const reviewRecord = drawer.getByRole('region', {
    name: '本地评审记录',
  })
  const reviewDetails = reviewRecord.locator('details')
  await expect(reviewRecord).toBeVisible()
  await expect(reviewDetails).not.toHaveAttribute('open', '')
  await expect(reviewRecord.locator('.review-note__body')).toBeHidden()
  await reviewRecord.locator('summary').click()
  await expect(reviewDetails).toHaveAttribute('open', '')
  await expect(reviewRecord.locator('.review-note__body')).toBeVisible()
  await expect(drawer.getByText('肩高', { exact: true })).toBeVisible()
  await expect(drawer.getByText('3-3.5 米（约）', { exact: true })).toBeVisible()
  const scrollCue = drawer.locator('.drawer-scroll-cue')
  await expect(scrollCue).toHaveAttribute('data-visible', 'true')
  await expect(scrollCue).toHaveCSS('opacity', '1')
  const drawerBox = await drawer.boundingBox()
  const scrollCueBox = await scrollCue.boundingBox()
  expect(drawerBox).not.toBeNull()
  expect(scrollCueBox).not.toBeNull()
  expect(scrollCueBox?.x ?? -1).toBeGreaterThanOrEqual(drawerBox?.x ?? 0)
  expect(scrollCueBox?.y ?? -1).toBeGreaterThanOrEqual(drawerBox?.y ?? 0)
  expect(
    (scrollCueBox?.x ?? 0) + (scrollCueBox?.width ?? 0),
  ).toBeLessThanOrEqual(
    (drawerBox?.x ?? 0) + (drawerBox?.width ?? 0) + 1,
  )
  expect(
    (scrollCueBox?.y ?? 0) + (scrollCueBox?.height ?? 0),
  ).toBeLessThanOrEqual(
    (drawerBox?.y ?? 0) + (drawerBox?.height ?? 0) + 1,
  )
  await page.evaluate(`(() => {
    const scroll = document.querySelector('.drawer-scroll')
    if (scroll) {
      scroll.scrollTop = scroll.scrollHeight
    }
  })()`)
  await expect(scrollCue).toHaveAttribute('data-visible', 'false')
  await expect(scrollCue).toHaveCSS('opacity', '0')
  await page.getByRole('button', { name: '关闭家长资料' }).click()

  await page.getByRole('button', { name: '专注看模型' }).click()
  const focusExit = page.getByRole('button', {
    name: '退出模型专注模式',
  })
  const canvas = page.locator('.viewer-canvas')
  await expect(focusExit).toBeVisible()
  await expect(page.getByText('轻点画面即可返回')).toBeVisible()
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  if (!canvasBox) {
    throw new Error('Review canvas did not have a layout box')
  }
  const gestureX = canvasBox.x + Math.min(48, canvasBox.width * 0.12)
  const gestureY = canvasBox.y + canvasBox.height * 0.72
  await page.mouse.move(gestureX, gestureY)
  await page.mouse.down()
  await page.mouse.move(gestureX + 36, gestureY + 12, { steps: 3 })
  await page.mouse.up()
  await expect(focusExit).toBeVisible()

  await page.mouse.click(gestureX, gestureY)
  await expect(focusExit).toHaveCount(0)
  await expect(
    page.getByRole('heading', { level: 1, name: '长毛猛犸象' }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    '已经回到完整的博物馆界面。',
  )

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    const widths = await page.evaluate<{
      body: number
      document: number
      viewport: number
    }>(`({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    })`)
    expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1)
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1)
    await expect(museum).toHaveAttribute(
      'data-ready-animal-id',
      'mammoth',
    )
    await expect(page.locator('.viewer-canvas')).toBeVisible()
  }
})
