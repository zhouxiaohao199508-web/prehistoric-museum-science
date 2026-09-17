import { IdlePreloadCoordinator } from '../../src/state/idle-preload-coordinator'
import { ModelCache } from '../../src/viewer/model-cache'

const targets = [
  {
    id: 'stegosaurus',
    imageUrls: ['/stegosaurus-background.webp'],
    modelUrl: '/stegosaurus.glb',
  },
  {
    id: 'triceratops',
    imageUrls: ['/triceratops-background.webp'],
    modelUrl: '/triceratops.glb',
  },
  {
    id: 'mammoth',
    imageUrls: ['/mammoth-background.webp'],
    modelUrl: '/mammoth.glb',
  },
] as const

describe('IdlePreloadCoordinator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('waits for the committed animal, then fully preloads next before previous', async () => {
    vi.useFakeTimers()
    let resolveNextModel!: (response: Response) => void
    const nextModel = new Promise<Response>((resolve) => {
      resolveNextModel = resolve
    })
    const fetchMock = vi.fn<typeof fetch>((url) =>
      url === '/mammoth.glb'
        ? nextModel
        : Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cache = new ModelCache()
    const coordinator = new IdlePreloadCoordinator({
      idleDelayMs: 2_000,
      modelCache: cache,
      targets,
    })

    coordinator.scheduleAfterCommit('triceratops')

    await vi.advanceTimersByTimeAsync(1_999)
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/mammoth.glb'])

    resolveNextModel(new Response(new ArrayBuffer(8), { status: 200 }))
    await vi.runAllTimersAsync()

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/mammoth.glb',
      '/mammoth-background.webp',
      '/stegosaurus.glb',
      '/stegosaurus-background.webp',
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ priority: 'low' })
      expect(init?.cache).not.toBe('no-store')
      expect(init?.cache).not.toBe('reload')
    }
    expect(cache.get('/mammoth.glb')).not.toBeNull()
    expect(cache.get('/stegosaurus.glb')).not.toBeNull()

    coordinator.destroy()
  })

  it('checks app memory caches before relying on the browser cache', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cache = new ModelCache()
    cache.set('/mammoth.glb', new ArrayBuffer(16))
    const coordinator = new IdlePreloadCoordinator({
      idleDelayMs: 2_000,
      isImageInMemory: (url) => url === '/mammoth-background.webp',
      modelCache: cache,
      targets,
    })

    coordinator.scheduleAfterCommit('triceratops')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.runAllTimersAsync()

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/stegosaurus.glb',
      '/stegosaurus-background.webp',
    ])
    expect(cache.get('/mammoth.glb')?.byteLength).toBe(16)
    expect(cache.get('/stegosaurus.glb')).not.toBeNull()

    coordinator.destroy()
  })

  it('immediately aborts in-flight idle work when a user request takes priority', async () => {
    vi.useFakeTimers()
    const preloadSignals: AbortSignal[] = []
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const preloadSignal = init?.signal
          if (preloadSignal) {
            preloadSignals.push(preloadSignal)
          }
          preloadSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const coordinator = new IdlePreloadCoordinator({
      idleDelayMs: 2_000,
      modelCache: new ModelCache(),
      targets,
    })

    coordinator.scheduleAfterCommit('triceratops')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersToNextTimerAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(preloadSignals.every((signal) => !signal.aborted)).toBe(true)

    coordinator.cancelAll()

    expect(preloadSignals.every((signal) => signal.aborted)).toBe(true)
    await Promise.resolve()
    await vi.runAllTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    coordinator.destroy()
  })

  it('does not perform optional preloading when the user has enabled data saving', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      connection: { effectiveType: '4g', saveData: true },
    })
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cache = new ModelCache()
    const coordinator = new IdlePreloadCoordinator({
      idleDelayMs: 2_000,
      modelCache: cache,
      targets,
    })

    coordinator.scheduleAfterCommit('triceratops')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.runAllTimersAsync()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(cache.get('/mammoth.glb')).toBeNull()
    expect(cache.get('/stegosaurus.glb')).toBeNull()

    coordinator.destroy()
  })

  it('keeps image previews but skips models on a slow connection', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      connection: { effectiveType: '2g', saveData: false },
    })
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cache = new ModelCache()
    const coordinator = new IdlePreloadCoordinator({
      idleDelayMs: 2_000,
      modelCache: cache,
      targets,
    })

    coordinator.scheduleAfterCommit('triceratops')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.runAllTimersAsync()

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/mammoth-background.webp',
      '/stegosaurus-background.webp',
    ])
    expect(cache.get('/mammoth.glb')).toBeNull()
    expect(cache.get('/stegosaurus.glb')).toBeNull()

    coordinator.destroy()
  })

  it('preloads adjacent models and images on a 3g connection', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      connection: { effectiveType: '3g', saveData: false },
    })
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cache = new ModelCache()
    const coordinator = new IdlePreloadCoordinator({
      idleDelayMs: 2_000,
      modelCache: cache,
      targets,
    })

    coordinator.scheduleAfterCommit('triceratops')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.runAllTimersAsync()

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/mammoth.glb',
      '/mammoth-background.webp',
      '/stegosaurus.glb',
      '/stegosaurus-background.webp',
    ])
    expect(cache.get('/mammoth.glb')).not.toBeNull()
    expect(cache.get('/stegosaurus.glb')).not.toBeNull()

    coordinator.destroy()
  })
})
