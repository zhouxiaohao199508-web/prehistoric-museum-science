import {
  ANIMAL_LOADING_LABEL_DELAY_MS,
  AnimalLoadCoordinator,
  type AnimalLoadContext,
} from '../src/state'

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

interface PreparedAnimal {
  readonly id: string
  readonly instance: number
}

interface PendingLoad {
  readonly context: AnimalLoadContext
  readonly deferred: Deferred<PreparedAnimal>
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

function createHarness(options: { commitThrows?: Error } = {}) {
  const pending = new Map<string, PendingLoad[]>()
  const committed: PreparedAnimal[] = []
  const disposed: PreparedAnimal[] = []
  const commitSnapshots: Array<{
    readyAnimalId: string | null
    requestedAnimalId: string | null
  }> = []
  const coordinatorReference: {
    current: AnimalLoadCoordinator<PreparedAnimal> | null
  } = { current: null }

  const load = vi.fn(
    (animalId: string, context: AnimalLoadContext) => {
      const loadDeferred = deferred<PreparedAnimal>()
      const entries = pending.get(animalId) ?? []
      entries.push({ context, deferred: loadDeferred })
      pending.set(animalId, entries)
      return loadDeferred.promise
    },
  )
  const commit = vi.fn((loaded: PreparedAnimal) => {
    const currentSnapshot = coordinatorReference.current?.getSnapshot()
    if (currentSnapshot === undefined) {
      throw new Error('Coordinator was not initialized')
    }
    commitSnapshots.push({
      readyAnimalId: currentSnapshot.readyAnimalId,
      requestedAnimalId: currentSnapshot.requestedAnimalId,
    })
    if (options.commitThrows !== undefined) {
      throw options.commitThrows
    }
    committed.push(loaded)
  })
  const dispose = vi.fn((loaded: PreparedAnimal) => {
    disposed.push(loaded)
  })

  const coordinator = new AnimalLoadCoordinator({
    initialReadyAnimalId: 'stegosaurus',
    load,
    commit,
    dispose,
  })
  coordinatorReference.current = coordinator

  const getPending = (animalId: string, occurrence = 0): PendingLoad => {
    const entry = pending.get(animalId)?.[occurrence]
    if (entry === undefined) {
      throw new Error(`No pending load for ${animalId} #${occurrence}`)
    }
    return entry
  }

  return {
    coordinator,
    load,
    commit,
    dispose,
    committed,
    disposed,
    commitSnapshots,
    getPending,
  }
}

describe('AnimalLoadCoordinator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('continues a monotonic token sequence after an owning viewer is recreated', () => {
    const coordinator = new AnimalLoadCoordinator({
      initialReadyAnimalId: 'stegosaurus',
      initialRequestToken: 41,
      load: () => new Promise<PreparedAnimal>(() => undefined),
      commit: () => undefined,
      dispose: () => undefined,
    })

    void coordinator.request('triceratops')
    expect(coordinator.getSnapshot().requestToken).toBe(42)
    coordinator.destroy()
  })

  it('keeps the ready presentation and delays the playful loading label by 300 ms', async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    const notifications = vi.fn()
    harness.coordinator.subscribe(notifications)

    const result = harness.coordinator.request('triceratops')
    const pending = harness.getPending('triceratops')

    expect(harness.coordinator.getSnapshot()).toEqual({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'triceratops',
      requestToken: 1,
      phase: 'loading',
      showDelayedLabel: false,
      failure: null,
    })

    await vi.advanceTimersByTimeAsync(ANIMAL_LOADING_LABEL_DELAY_MS - 1)
    expect(harness.coordinator.getSnapshot().showDelayedLabel).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.coordinator.getSnapshot().showDelayedLabel).toBe(true)

    pending.deferred.resolve({ id: 'triceratops', instance: 1 })
    await expect(result).resolves.toEqual({
      status: 'committed',
      animalId: 'triceratops',
      requestToken: 1,
    })

    expect(harness.commitSnapshots).toEqual([
      {
        readyAnimalId: 'stegosaurus',
        requestedAnimalId: 'triceratops',
      },
    ])
    expect(harness.coordinator.getSnapshot()).toEqual({
      readyAnimalId: 'triceratops',
      requestedAnimalId: 'triceratops',
      requestToken: 1,
      phase: 'idle',
      showDelayedLabel: false,
      failure: null,
    })
    expect(notifications).toHaveBeenCalledTimes(3)
  })

  it('deduplicates an identical in-flight selection without consuming a token', async () => {
    const harness = createHarness()

    const first = harness.coordinator.request('ankylosaurus')
    const duplicate = harness.coordinator.request('ankylosaurus')

    expect(duplicate).toBe(first)
    expect(harness.load).toHaveBeenCalledTimes(1)
    expect(harness.coordinator.getSnapshot().requestToken).toBe(1)

    harness
      .getPending('ankylosaurus')
      .deferred.resolve({ id: 'ankylosaurus', instance: 1 })
    await expect(first).resolves.toMatchObject({ status: 'committed' })
  })

  it('does not start a request superseded synchronously by a store subscriber', async () => {
    const harness = createHarness()
    let replacementResult: Promise<unknown> | null = null
    const unsubscribe = harness.coordinator.subscribe(() => {
      const snapshot = harness.coordinator.getSnapshot()
      if (
        snapshot.phase === 'loading' &&
        snapshot.requestedAnimalId === 'ankylosaurus'
      ) {
        replacementResult = harness.coordinator.request('triceratops')
      }
    })

    const supersededResult = harness.coordinator.request('ankylosaurus')
    unsubscribe()

    expect(harness.load).toHaveBeenCalledTimes(1)
    expect(harness.load).toHaveBeenCalledWith(
      'triceratops',
      expect.objectContaining({ requestToken: 2 }),
    )
    await expect(supersededResult).resolves.toEqual({
      status: 'stale',
      animalId: 'ankylosaurus',
      requestToken: 1,
    })

    harness
      .getPending('triceratops')
      .deferred.resolve({ id: 'triceratops', instance: 1 })
    await expect(replacementResult).resolves.toMatchObject({
      status: 'committed',
      requestToken: 2,
    })
  })

  it('aborts a superseded load, disposes its late success, and commits only the latest', async () => {
    const harness = createHarness()

    const firstResult = harness.coordinator.request('ankylosaurus')
    const first = harness.getPending('ankylosaurus')
    const secondResult = harness.coordinator.request('triceratops')
    const second = harness.getPending('triceratops')

    expect(first.context.signal.aborted).toBe(true)
    expect(second.context.signal.aborted).toBe(false)
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'triceratops',
      requestToken: 2,
      phase: 'loading',
    })

    const staleValue = { id: 'ankylosaurus', instance: 1 }
    first.deferred.resolve(staleValue)
    await expect(firstResult).resolves.toEqual({
      status: 'stale',
      animalId: 'ankylosaurus',
      requestToken: 1,
    })
    expect(harness.disposed).toEqual([staleValue])
    expect(harness.commit).not.toHaveBeenCalled()
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      requestedAnimalId: 'triceratops',
      phase: 'loading',
      failure: null,
    })

    const latestValue = { id: 'triceratops', instance: 2 }
    second.deferred.resolve(latestValue)
    await expect(secondResult).resolves.toMatchObject({
      status: 'committed',
      requestToken: 2,
    })
    expect(harness.committed).toEqual([latestValue])
    expect(harness.disposed).toEqual([staleValue])
  })

  it('makes a superseded failure invisible while the latest load continues', async () => {
    vi.useFakeTimers()
    const harness = createHarness()

    const staleResult = harness.coordinator.request('ankylosaurus')
    const stale = harness.getPending('ankylosaurus')
    const latestResult = harness.coordinator.request('triceratops')
    const latest = harness.getPending('triceratops')

    stale.deferred.reject(new Error('old request failed'))
    await expect(staleResult).resolves.toEqual({
      status: 'stale',
      animalId: 'ankylosaurus',
      requestToken: 1,
    })
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'triceratops',
      requestToken: 2,
      phase: 'loading',
      failure: null,
    })

    await vi.advanceTimersByTimeAsync(ANIMAL_LOADING_LABEL_DELAY_MS)
    expect(harness.coordinator.getSnapshot().showDelayedLabel).toBe(true)

    latest.deferred.resolve({ id: 'triceratops', instance: 1 })
    await latestResult
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      readyAnimalId: 'triceratops',
      phase: 'idle',
      failure: null,
    })
  })

  it('preserves the ready animal on latest failure and retries with a fresh token', async () => {
    const harness = createHarness()
    const failure = new Error('the model got lost')

    const failedResult = harness.coordinator.request('triceratops')
    harness.getPending('triceratops').deferred.reject(failure)
    await expect(failedResult).resolves.toEqual({
      status: 'failed',
      animalId: 'triceratops',
      requestToken: 1,
      error: failure,
    })
    expect(harness.coordinator.getSnapshot()).toEqual({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'triceratops',
      requestToken: 1,
      phase: 'failed',
      showDelayedLabel: false,
      failure: {
        animalId: 'triceratops',
        requestToken: 1,
        error: failure,
      },
    })

    const retryResult = harness.coordinator.retry()
    expect(retryResult).not.toBeNull()
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'triceratops',
      requestToken: 2,
      phase: 'loading',
      failure: null,
    })

    const retryValue = { id: 'triceratops', instance: 2 }
    harness.getPending('triceratops', 1).deferred.resolve(retryValue)
    await expect(retryResult).resolves.toEqual({
      status: 'committed',
      animalId: 'triceratops',
      requestToken: 2,
    })
    expect(harness.committed).toEqual([retryValue])
  })

  it('invalidates a pending selection when the user returns to the ready animal', async () => {
    const harness = createHarness()

    const staleResult = harness.coordinator.request('triceratops')
    const stale = harness.getPending('triceratops')
    const readyResult = harness.coordinator.request('stegosaurus')

    expect(stale.context.signal.aborted).toBe(true)
    await expect(readyResult).resolves.toEqual({
      status: 'already-ready',
      animalId: 'stegosaurus',
      requestToken: 2,
    })
    expect(harness.coordinator.getSnapshot()).toEqual({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'stegosaurus',
      requestToken: 2,
      phase: 'idle',
      showDelayedLabel: false,
      failure: null,
    })

    const staleValue = { id: 'triceratops', instance: 1 }
    stale.deferred.resolve(staleValue)
    await expect(staleResult).resolves.toMatchObject({ status: 'stale' })
    expect(harness.disposed).toEqual([staleValue])
    expect(harness.commit).not.toHaveBeenCalled()
  })

  it('can explicitly reload a ready animal with a fresh token', async () => {
    const harness = createHarness()

    const result = harness.coordinator.reload('stegosaurus')
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'stegosaurus',
      requestToken: 1,
      phase: 'loading',
    })
    expect(harness.load).toHaveBeenCalledTimes(1)

    const replacement = { id: 'stegosaurus', instance: 2 }
    harness.getPending('stegosaurus').deferred.resolve(replacement)
    await expect(result).resolves.toMatchObject({
      status: 'committed',
      requestToken: 1,
    })
    expect(harness.committed).toEqual([replacement])
  })

  it('treats a throwing atomic commit as the latest failure and disposes its staging value', async () => {
    const commitFailure = new Error('viewer commit failed')
    const harness = createHarness({ commitThrows: commitFailure })
    const result = harness.coordinator.request('triceratops')
    const value = { id: 'triceratops', instance: 1 }

    harness.getPending('triceratops').deferred.resolve(value)
    await expect(result).resolves.toEqual({
      status: 'failed',
      animalId: 'triceratops',
      requestToken: 1,
      error: commitFailure,
    })
    expect(harness.disposed).toEqual([value])
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      readyAnimalId: 'stegosaurus',
      requestedAnimalId: 'triceratops',
      phase: 'failed',
      failure: { error: commitFailure },
    })
  })

  it('aborts on destroy and disposes a value that arrives afterwards', async () => {
    const harness = createHarness()
    const result = harness.coordinator.request('triceratops')
    const pending = harness.getPending('triceratops')
    const value = { id: 'triceratops', instance: 1 }

    harness.coordinator.destroy()
    expect(pending.context.signal.aborted).toBe(true)
    pending.deferred.resolve(value)

    await expect(result).resolves.toMatchObject({ status: 'stale' })
    expect(harness.disposed).toEqual([value])
    expect(harness.commit).not.toHaveBeenCalled()
    expect(() => harness.coordinator.request('stegosaurus')).toThrow(
      'AnimalLoadCoordinator has been destroyed',
    )
  })
})
