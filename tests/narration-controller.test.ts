import {
  NARRATION_UNAVAILABLE_LABEL,
  NarrationController,
  getNarrationControlLabel,
  type NarrationMedia,
} from '../src/audio'

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

class FakeMedia implements NarrationMedia {
  currentTime = 17
  error: unknown
  readonly play = vi.fn<() => Promise<void>>(() => Promise.resolve())
  readonly pause = vi.fn<() => void>()
  private readonly listeners = new Map<'ended' | 'error', Set<() => void>>()

  addEventListener(type: 'ended' | 'error', listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: 'ended' | 'error', listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: 'ended' | 'error'): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener()
    }
  }

  listenerCount(type: 'ended' | 'error'): number {
    return this.listeners.get(type)?.size ?? 0
  }
}

function createHarness() {
  const media: FakeMedia[] = []
  const sources: string[] = []
  const createMedia = vi.fn((source: string) => {
    sources.push(source)
    const nextMedia = new FakeMedia()
    media.push(nextMedia)
    return nextMedia
  })
  const controller = new NarrationController({ createMedia })
  return { controller, createMedia, media, sources }
}

describe('NarrationController', () => {
  it('uses the non-blocking preparation state when narration is missing', async () => {
    const harness = createHarness()

    harness.controller.commit({ animalId: 'stegosaurus', source: null })

    expect(harness.createMedia).not.toHaveBeenCalled()
    expect(harness.controller.getSnapshot()).toEqual({
      animalId: 'stegosaurus',
      source: null,
      availability: 'missing',
      playback: 'stopped',
      error: null,
    })
    expect(getNarrationControlLabel(harness.controller.getSnapshot())).toBe(
      NARRATION_UNAVAILABLE_LABEL,
    )
    await expect(harness.controller.play()).resolves.toEqual({
      status: 'unavailable',
      availability: 'missing',
      error: null,
    })
  })

  it('never autoplays on commit and supports explicit play, pause, and reset', async () => {
    const harness = createHarness()
    const notifications = vi.fn()
    harness.controller.subscribe(notifications)

    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/stegosaurus.mp3',
    })

    expect(harness.sources).toEqual([])
    expect(harness.controller.prepare()).toBe(true)
    expect(harness.controller.prepare()).toBe(true)
    const media = harness.media[0]!
    expect(harness.sources).toEqual(['/audio/stegosaurus.mp3'])
    expect(harness.createMedia).toHaveBeenCalledTimes(1)
    expect(media.play).not.toHaveBeenCalled()
    expect(harness.controller.getSnapshot().playback).toBe('stopped')
    expect(getNarrationControlLabel(harness.controller.getSnapshot())).toBe(
      '听它的介绍',
    )

    await expect(harness.controller.play()).resolves.toEqual({
      status: 'playing',
    })
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(harness.controller.getSnapshot().playback).toBe('playing')
    expect(getNarrationControlLabel(harness.controller.getSnapshot())).toBe(
      '暂停介绍',
    )

    harness.controller.pause()
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(harness.controller.getSnapshot().playback).toBe('paused')

    media.currentTime = 9
    harness.controller.reset()
    expect(media.pause).toHaveBeenCalledTimes(2)
    expect(media.currentTime).toBe(0)
    expect(harness.controller.getSnapshot().playback).toBe('stopped')
    expect(notifications).toHaveBeenCalledTimes(4)
  })

  it('deduplicates a pending play and ignores its completion after pause', async () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/stegosaurus.mp3',
    })
    harness.controller.prepare()
    const media = harness.media[0]!
    const playDeferred = deferred<void>()
    media.play.mockReturnValueOnce(playDeferred.promise)

    const first = harness.controller.play()
    const duplicate = harness.controller.play()
    expect(duplicate).toBe(first)
    expect(harness.controller.getSnapshot().playback).toBe('playing')

    harness.controller.pause()
    playDeferred.resolve(undefined)
    await expect(first).resolves.toEqual({ status: 'stale' })
    expect(harness.controller.getSnapshot().playback).toBe('paused')
  })

  it('stops and rewinds old narration when a new animal is committed', async () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/stegosaurus.mp3',
    })
    harness.controller.prepare()
    const oldMedia = harness.media[0]!
    const oldPlay = deferred<void>()
    oldMedia.play.mockReturnValueOnce(oldPlay.promise)
    const oldResult = harness.controller.play()
    oldMedia.currentTime = 8

    harness.controller.commit({
      animalId: 'triceratops',
      source: '/audio/triceratops.mp3',
    })
    expect(harness.media).toHaveLength(1)
    harness.controller.prepare()
    const newMedia = harness.media[1]!

    expect(oldMedia.pause).toHaveBeenCalledTimes(1)
    expect(oldMedia.currentTime).toBe(0)
    expect(oldMedia.listenerCount('ended')).toBe(0)
    expect(oldMedia.listenerCount('error')).toBe(0)
    expect(newMedia.play).not.toHaveBeenCalled()
    expect(harness.controller.getSnapshot()).toEqual({
      animalId: 'triceratops',
      source: '/audio/triceratops.mp3',
      availability: 'available',
      playback: 'stopped',
      error: null,
    })

    oldPlay.resolve(undefined)
    await expect(oldResult).resolves.toEqual({ status: 'stale' })
    expect(harness.controller.getSnapshot().animalId).toBe('triceratops')
  })

  it('committing a missing track stops old audio without blocking the new content', () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/stegosaurus.mp3',
    })
    harness.controller.prepare()
    const oldMedia = harness.media[0]!
    oldMedia.currentTime = 5

    harness.controller.commit({ animalId: 'triceratops' })

    expect(oldMedia.pause).toHaveBeenCalledTimes(1)
    expect(oldMedia.currentTime).toBe(0)
    expect(harness.controller.getSnapshot()).toMatchObject({
      animalId: 'triceratops',
      availability: 'missing',
      playback: 'stopped',
    })
    expect(getNarrationControlLabel(harness.controller.getSnapshot())).toBe(
      '介绍准备中',
    )
  })

  it('turns a rejected play into an undecodable preparation state', async () => {
    const harness = createHarness()
    const decodeFailure = new DOMException(
      'The media could not be decoded',
      'NotSupportedError',
    )
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/broken.mp3',
    })
    harness.controller.prepare()
    const media = harness.media[0]!
    media.play.mockRejectedValueOnce(decodeFailure)

    await expect(harness.controller.play()).resolves.toEqual({
      status: 'unavailable',
      availability: 'undecodable',
      error: decodeFailure,
    })
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(media.currentTime).toBe(0)
    expect(harness.controller.getSnapshot()).toEqual({
      animalId: 'stegosaurus',
      source: '/audio/broken.mp3',
      availability: 'undecodable',
      playback: 'stopped',
      error: decodeFailure,
    })
    expect(getNarrationControlLabel(harness.controller.getSnapshot())).toBe(
      '介绍准备中',
    )
  })

  it('does not overwrite a synchronous media error with playing state', async () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/broken-immediately.mp3',
    })
    harness.controller.prepare()
    const media = harness.media[0]!
    const decodeFailure = new Error('synchronous decode failure')
    media.play.mockImplementationOnce(() => {
      media.error = decodeFailure
      media.emit('error')
      return Promise.resolve()
    })

    await expect(harness.controller.play()).resolves.toEqual({
      status: 'stale',
    })
    expect(harness.controller.getSnapshot()).toMatchObject({
      availability: 'undecodable',
      playback: 'stopped',
      error: decodeFailure,
    })
  })

  it('handles a media decode error event and ignores detached old events', () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/first.mp3',
    })
    harness.controller.prepare()
    const first = harness.media[0]!

    harness.controller.commit({
      animalId: 'triceratops',
      source: '/audio/second.mp3',
    })
    harness.controller.prepare()
    const second = harness.media[1]!
    first.error = new Error('stale decode error')
    first.emit('error')
    expect(harness.controller.getSnapshot().availability).toBe('available')

    const latestError = new Error('latest decode error')
    second.error = latestError
    second.emit('error')
    expect(harness.controller.getSnapshot()).toMatchObject({
      animalId: 'triceratops',
      availability: 'undecodable',
      playback: 'stopped',
      error: latestError,
    })
    expect(second.listenerCount('error')).toBe(0)
  })

  it('rewinds after playback ends and releases media on destroy', () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/stegosaurus.mp3',
    })
    harness.controller.prepare()
    const media = harness.media[0]!
    media.currentTime = 12
    media.emit('ended')

    expect(media.currentTime).toBe(0)
    expect(harness.controller.getSnapshot().playback).toBe('stopped')

    media.currentTime = 4
    harness.controller.destroy()
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(media.currentTime).toBe(0)
    expect(media.listenerCount('ended')).toBe(0)
    expect(() => harness.controller.play()).toThrow(
      'NarrationController has been destroyed',
    )
  })

  it('creates and plays media immediately when clicked before idle preparation', async () => {
    const harness = createHarness()
    harness.controller.commit({
      animalId: 'stegosaurus',
      source: '/audio/stegosaurus.mp3',
    })

    expect(harness.createMedia).not.toHaveBeenCalled()
    await expect(harness.controller.play()).resolves.toEqual({
      status: 'playing',
    })

    expect(harness.createMedia).toHaveBeenCalledTimes(1)
    expect(harness.media[0]?.play).toHaveBeenCalledTimes(1)
  })
})
