import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const evidenceDirectory = path.resolve(
  process.argv[2] ??
    '.handoff/scale-encounter-multi-scene-integration-2026-08-16/evidence',
)
const contactSheetDirectory = path.join(evidenceDirectory, 'contact-sheets')

const sceneLabels = [
  'mammoth',
  'ocean',
  'sky',
  'forest-regression',
] as const
const viewportLabels = [
  'desktop-wide',
  'square',
  'portrait',
  'narrow',
] as const

interface BrowserEvidence {
  readonly consoleErrors: readonly string[]
  readonly pageErrors: readonly string[]
  readonly requestFailures: readonly unknown[]
  readonly responseErrors: readonly unknown[]
}

interface CaptureEvidence {
  readonly capturedAt: string
  readonly frameMetrics: {
    readonly droppedFrameRatio: number
    readonly framesPerSecond: number
    readonly p95FrameTimeMs: number
    readonly sampleCount: number
  }
  readonly scene: { readonly label: string }
  readonly stage: string
  readonly state: {
    readonly browserEvidence: BrowserEvidence
    readonly canvasDataset: {
      readonly scaleEncounterPerformance?: string
    }
    readonly renderer: {
      readonly unmaskedRenderer: string
      readonly unmaskedVendor: string
    }
    readonly resources: {
      readonly decodedBodyBytes: number
      readonly entryCount: number
      readonly transferBytes: number
    }
  }
  readonly viewport: { readonly label: string }
}

interface PerformancePayload {
  readonly renderer?: {
    readonly calls?: number
    readonly geometries?: number
    readonly textures?: number
    readonly triangles?: number
  }
  readonly scene?: {
    readonly estimatedGeometryBytes?: number
    readonly estimatedTextureBytes?: number
    readonly instanceCount?: number
    readonly transparentMaterialCount?: number
  }
}

function maximum(values: readonly number[]): number {
  return values.length > 0 ? Math.max(...values) : 0
}

function minimum(values: readonly number[]): number {
  return values.length > 0 ? Math.min(...values) : 0
}

function performanceFor(capture: CaptureEvidence): PerformancePayload {
  const raw = capture.state.canvasDataset.scaleEncounterPerformance
  if (!raw) return {}
  return JSON.parse(raw) as PerformancePayload
}

async function loadCaptures(): Promise<readonly CaptureEvidence[]> {
  const names = await readdir(evidenceDirectory)
  const captures: CaptureEvidence[] = []
  for (const name of names.sort()) {
    if (!name.endsWith('.json') || name === 'four-scene-switch-and-disposal.json') {
      continue
    }
    const parsed = JSON.parse(
      await readFile(path.join(evidenceDirectory, name), 'utf8'),
    ) as Partial<CaptureEvidence>
    if (parsed.frameMetrics && parsed.scene && parsed.viewport) {
      captures.push(parsed as CaptureEvidence)
    }
  }
  return captures
}

function svgLabel(label: string, width: number, height: number): Buffer {
  const escaped = label
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#101a22"/>
      <text x="18" y="27" fill="#f6f1e7" font-family="Arial, sans-serif" font-size="17" font-weight="600">${escaped}</text>
    </svg>`,
  )
}

async function contactSheet(
  outputName: string,
  cells: readonly { readonly file: string; readonly label: string }[],
  columns: number,
): Promise<void> {
  const availableCells = (
    await Promise.all(
      cells.map(async (cell) => {
        try {
          await access(path.join(evidenceDirectory, cell.file))
          return cell
        } catch {
          return null
        }
      }),
    )
  ).filter((cell): cell is { readonly file: string; readonly label: string } =>
    cell !== null,
  )
  if (availableCells.length === 0) return
  const cellWidth = 420
  const imageHeight = 260
  const labelHeight = 40
  const cellHeight = imageHeight + labelHeight
  const rows = Math.ceil(availableCells.length / columns)
  const composites: sharp.OverlayOptions[] = []

  for (const [index, cell] of availableCells.entries()) {
    const left = (index % columns) * cellWidth
    const top = Math.floor(index / columns) * cellHeight
    const image = await sharp(path.join(evidenceDirectory, cell.file))
      .resize(cellWidth, imageHeight, {
        background: '#d6e3e8',
        fit: 'contain',
        position: 'centre',
      })
      .jpeg({ quality: 90 })
      .toBuffer()
    composites.push({ input: image, left, top })
    composites.push({
      input: svgLabel(cell.label, cellWidth, labelHeight),
      left,
      top: top + imageHeight,
    })
  }

  await sharp({
    create: {
      background: '#101a22',
      channels: 3,
      height: rows * cellHeight,
      width: columns * cellWidth,
    },
  })
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(contactSheetDirectory, outputName))
}

async function buildContactSheets(): Promise<void> {
  await mkdir(contactSheetDirectory, { recursive: true })
  for (const scene of sceneLabels) {
    await contactSheet(
      `${scene}.jpg`,
      [
        ...viewportLabels.map((viewport) => ({
          file: `${scene}-${viewport}-overview-default.jpg`,
          label: `${viewport} · overview`,
        })),
        {
          file: `${scene}-desktop-wide-transition-full-body.jpg`,
          label: 'desktop-wide · full-body stage',
        },
        {
          file: `${scene}-portrait-transition-full-body.jpg`,
          label: 'portrait · full-body stage',
        },
        {
          file: `${scene}-desktop-wide-pov-default.jpg`,
          label: 'desktop-wide · POV',
        },
        {
          file: `${scene}-portrait-pov-default.jpg`,
          label: 'portrait · POV',
        },
      ],
      4,
    )
  }

  await contactSheet(
    'all-scenes-overview.jpg',
    sceneLabels.flatMap((scene) =>
      viewportLabels.map((viewport) => ({
        file: `${scene}-${viewport}-overview-default.jpg`,
        label: `${scene} · ${viewport}`,
      })),
    ),
    4,
  )
}

async function buildSummary(captures: readonly CaptureEvidence[]): Promise<void> {
  const browserErrors = captures.flatMap((capture) => [
    ...capture.state.browserEvidence.consoleErrors,
    ...capture.state.browserEvidence.pageErrors,
  ])
  const requestFailureCount = captures.reduce(
    (sum, capture) => sum + capture.state.browserEvidence.requestFailures.length,
    0,
  )
  const responseErrorCount = captures.reduce(
    (sum, capture) => sum + capture.state.browserEvidence.responseErrors.length,
    0,
  )
  const renderers = [
    ...new Set(captures.map((capture) => capture.state.renderer.unmaskedRenderer)),
  ]
  const vendors = [
    ...new Set(captures.map((capture) => capture.state.renderer.unmaskedVendor)),
  ]

  const byScene = Object.fromEntries(
    sceneLabels.map((scene) => {
      const sceneCaptures = captures.filter((capture) => capture.scene.label === scene)
      const performances = sceneCaptures.map(performanceFor)
      return [
        scene,
        {
          captureCount: sceneCaptures.length,
          frameSampling: {
            maximumDroppedFrameRatio: maximum(
              sceneCaptures.map((capture) => capture.frameMetrics.droppedFrameRatio),
            ),
            maximumP95FrameTimeMs: maximum(
              sceneCaptures.map((capture) => capture.frameMetrics.p95FrameTimeMs),
            ),
            minimumFramesPerSecond: minimum(
              sceneCaptures.map((capture) => capture.frameMetrics.framesPerSecond),
            ),
            sampleCountPerCapture: [
              ...new Set(
                sceneCaptures.map((capture) => capture.frameMetrics.sampleCount),
              ),
            ],
          },
          rendererMaximums: {
            calls: maximum(performances.map((value) => value.renderer?.calls ?? 0)),
            geometries: maximum(
              performances.map((value) => value.renderer?.geometries ?? 0),
            ),
            textures: maximum(
              performances.map((value) => value.renderer?.textures ?? 0),
            ),
            triangles: maximum(
              performances.map((value) => value.renderer?.triangles ?? 0),
            ),
          },
          resourceMaximums: {
            decodedBodyBytes: maximum(
              sceneCaptures.map((capture) => capture.state.resources.decodedBodyBytes),
            ),
            entryCount: maximum(
              sceneCaptures.map((capture) => capture.state.resources.entryCount),
            ),
            transferBytes: maximum(
              sceneCaptures.map((capture) => capture.state.resources.transferBytes),
            ),
          },
          sceneEstimateMaximums: {
            geometryBytes: maximum(
              performances.map(
                (value) => value.scene?.estimatedGeometryBytes ?? 0,
              ),
            ),
            instanceCount: maximum(
              performances.map((value) => value.scene?.instanceCount ?? 0),
            ),
            textureBytes: maximum(
              performances.map(
                (value) => value.scene?.estimatedTextureBytes ?? 0,
              ),
            ),
            transparentMaterialCount: maximum(
              performances.map(
                (value) => value.scene?.transparentMaterialCount ?? 0,
              ),
            ),
          },
        },
      ]
    }),
  )

  const summary = {
    browserGate: {
      browserErrorCount: browserErrors.length,
      requestFailureCount,
      responseErrorCount,
    },
    byScene,
    captureCount: captures.length,
    capturedAtRange: {
      first: captures.map((capture) => capture.capturedAt).sort().at(0) ?? null,
      last: captures.map((capture) => capture.capturedAt).sort().at(-1) ?? null,
    },
    notes: [
      'Frame samples are 45-frame hardware-Chrome review samples, not absolute device guarantees.',
      'Resource values are browser Performance API observations for each isolated page context.',
      'Real iOS/Android device validation remains open.',
    ],
    renderers,
    vendors,
  }
  await writeFile(
    path.join(evidenceDirectory, 'evidence-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
}

const captures = await loadCaptures()
await buildSummary(captures)
await buildContactSheets()

console.log(
  `Built ${captures.length} evidence summaries and 5 contact sheets in ${evidenceDirectory}`,
)
