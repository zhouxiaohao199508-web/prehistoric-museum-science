import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import {
  allReadmeScreenshotTargets,
  readmeScreenshotOutputDirectory,
  readmeScreenshotLocales,
} from '../readme-screenshots'

const outputRoot = resolve(process.cwd(), readmeScreenshotOutputDirectory)

interface ScreenshotWebGlContext {
  getExtension(name: 'WEBGL_lose_context'): { loseContext(): void } | null
}

interface ScreenshotCanvas {
  getContext(kind: 'webgl2'): ScreenshotWebGlContext | null
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await Promise.all(
    readmeScreenshotLocales.map((locale) =>
      mkdir(resolve(outputRoot, locale), { recursive: true }),
    ),
  )
})

for (const target of allReadmeScreenshotTargets()) {
  test(`${target.locale} ${target.scene.key} reference capture`, async ({ page }) => {
    await page.setViewportSize(target.viewport)
    await page.addInitScript(() => {
      window.localStorage.removeItem('museum.locale')
      window.localStorage.setItem(
        'prehistoric-animal-museum:model-data-reminder:v1',
        'seen',
      )
      window.localStorage.setItem(
        'prehistoric-animal-museum:github-star-prompt:v1',
        'opened',
      )
    })

    const response = await page.goto(target.route, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.ok()).toBe(true)

    await expect(page.locator('html')).toHaveAttribute('lang', target.locale)
    await expect(
      page.getByRole('heading', {
        exact: true,
        level: 2,
        name: target.scene.heading[target.locale],
      }),
    ).toBeVisible()

    await expect(
      page.getByRole('button', {
        name:
          target.locale === 'zh-CN'
            ? '听它的介绍'
            : 'Listen to its introduction',
      }),
    ).toBeEnabled()

    const museum = page.locator('#museum-experience')
    await expect(museum).toHaveAttribute(
      'data-ready-animal-id',
      target.scene.animalId,
      { timeout: 30_000 },
    )
    const canvas = page.locator('.viewer-canvas')
    await expect(canvas).toHaveAttribute('data-first-frame-rendered', 'true')
    await expect(page.locator('.model-still')).toHaveCount(0, {
      timeout: 5_000,
    })
    await expect(page.locator('.scene-background--solo')).toHaveCount(1)

    await page.evaluate(async () => {
      await document.fonts.ready
      const images = [...document.images].filter(
        (image) => image.currentSrc || image.src,
      )
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((done) => {
              image.addEventListener('load', () => done(), { once: true })
              image.addEventListener('error', () => done(), { once: true })
            })
          }
          if (typeof image.decode === 'function') {
            await image.decode().catch(() => undefined)
          }
        }),
      )
    })

    const frozeModel = await canvas.evaluate(
      (element, animationTimeSeconds) => {
        const reviewCanvas = element as HTMLCanvasElement & {
          __museumReviewSetAnimationTime?: (time: number | null) => boolean
        }
        return (
          reviewCanvas.__museumReviewSetAnimationTime?.(
            animationTimeSeconds,
          ) ?? false
        )
      },
      target.animationTimeSeconds,
    )
    expect(frozeModel).toBe(true)
    await expect(canvas).toHaveAttribute('data-animation-paused', 'true')

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation: none !important;
          caret-color: transparent !important;
          transition: none !important;
        }
      `,
    })
    await page.evaluate(
      () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    )

    const withModel = await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      type: 'png',
    })
    await canvas.evaluate((element) => {
      element.style.visibility = 'hidden'
    })
    const withoutModel = await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      type: 'png',
    })
    await canvas.evaluate((element) => {
      element.style.visibility = ''
    })

    const [visibleFrame, hiddenFrame] = await Promise.all(
      [withModel, withoutModel].map((source) =>
        sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      ),
    )
    expect(visibleFrame.info).toEqual(hiddenFrame.info)
    let changedPixels = 0
    for (let index = 0; index < visibleFrame.data.length; index += 3) {
      if (
        Math.abs(visibleFrame.data[index] - hiddenFrame.data[index]) > 8 ||
        Math.abs(visibleFrame.data[index + 1] - hiddenFrame.data[index + 1]) > 8 ||
        Math.abs(visibleFrame.data[index + 2] - hiddenFrame.data[index + 2]) > 8
      ) {
        changedPixels += 1
      }
    }
    expect(changedPixels).toBeGreaterThan(1_000)
    await page.evaluate(
      () => new Promise<void>((done) => requestAnimationFrame(() => done())),
    )

    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: resolve(outputRoot, target.relativePath),
      quality: 90,
      type: 'jpeg',
    })

    await canvas.evaluate((element) => {
      const screenshotCanvas = element as unknown as ScreenshotCanvas
      screenshotCanvas
        .getContext('webgl2')
        ?.getExtension('WEBGL_lose_context')
        ?.loseContext()
    })
  })
}
