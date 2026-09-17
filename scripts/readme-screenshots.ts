import type { Locale } from '../src/i18n/locale'

export const readmeScreenshotOutputDirectory =
  '.handoff/readme-screenshots' as const

export const readmeScreenshotLocales = ['zh-CN', 'en'] as const satisfies
  readonly Locale[]

export interface ReadmeScreenshotScene {
  readonly animationTimeSeconds: number
  readonly animalId: string
  readonly fileName: string
  readonly heading: Readonly<Record<Locale, string>>
  readonly key: 'land' | 'sea' | 'air'
  readonly viewport: {
    readonly height: number
    readonly width: number
  }
}

const desktopViewport = { height: 900, width: 1440 } as const

export const readmeScreenshotScenes = [
  {
    animationTimeSeconds: 1.25,
    animalId: 'stegosaurus',
    fileName: 'museum-land-stegosaurus.jpg',
    heading: { 'zh-CN': '剑龙', en: 'Stegosaurus' },
    key: 'land',
    viewport: desktopViewport,
  },
  {
    animationTimeSeconds: 1.75,
    animalId: 'mosasaurus',
    fileName: 'museum-sea-mosasaurus.jpg',
    heading: { 'zh-CN': '沧龙', en: 'Mosasaurus' },
    key: 'sea',
    viewport: desktopViewport,
  },
  {
    animationTimeSeconds: 2.25,
    animalId: 'tupandactylus',
    fileName: 'museum-air-tupandactylus.jpg',
    heading: { 'zh-CN': '古神翼龙', en: 'Tupandactylus' },
    key: 'air',
    viewport: desktopViewport,
  },
] as const satisfies readonly ReadmeScreenshotScene[]

export function readmeScreenshotRoute(
  locale: Locale,
  scene: ReadmeScreenshotScene,
): string {
  return `${locale}/?animal=${scene.animalId}`
}

export function readmeScreenshotRelativePath(
  locale: Locale,
  scene: ReadmeScreenshotScene,
): string {
  return `${locale}/${scene.fileName}`
}

export function allReadmeScreenshotTargets() {
  return readmeScreenshotLocales.flatMap((locale) =>
    readmeScreenshotScenes.map((scene) => ({
      animationTimeSeconds: scene.animationTimeSeconds,
      locale,
      relativePath: readmeScreenshotRelativePath(locale, scene),
      route: readmeScreenshotRoute(locale, scene),
      scene,
      viewport: scene.viewport,
    })),
  )
}
