export const ANIMAL_LOADING_LABEL_DELAY_MS = 300

export type AnimalLoadPhase = 'idle' | 'loading' | 'failed'

export interface AnimalLoadFailure {
  readonly animalId: string
  readonly requestToken: number
  readonly error: unknown
}

export interface AnimalLoadSnapshot {
  /**
   * The presentation that is still fully committed and safe to interact with.
   * It deliberately does not change while a different animal is loading.
   */
  readonly readyAnimalId: string | null
  /** The most recent non-deduplicated selection. */
  readonly requestedAnimalId: string | null
  /** Monotonically increases for every new (non-deduplicated) request. */
  readonly requestToken: number
  readonly phase: AnimalLoadPhase
  /** Becomes true only after the latest request has loaded for the configured delay. */
  readonly showDelayedLabel: boolean
  /** Present only for a failure belonging to the latest request. */
  readonly failure: AnimalLoadFailure | null
}

export interface AnimalLoadContext {
  readonly animalId: string
  readonly requestToken: number
  readonly signal: AbortSignal
}

export interface AnimalCommitContext {
  readonly animalId: string
  readonly requestToken: number
  readonly previousReadyAnimalId: string | null
}

export type AnimalLoadResult =
  | {
      readonly status: 'committed'
      readonly animalId: string
      readonly requestToken: number
    }
  | {
      readonly status: 'stale'
      readonly animalId: string
      readonly requestToken: number
    }
  | {
      readonly status: 'failed'
      readonly animalId: string
      readonly requestToken: number
      readonly error: unknown
    }
  | {
      readonly status: 'already-ready'
      readonly animalId: string
      readonly requestToken: number
    }

export interface AnimalLoadCoordinatorOptions<TLoaded> {
  readonly initialReadyAnimalId?: string | null
  /** Continue a token sequence when the owning viewer must be recreated. */
  readonly initialRequestToken?: number
  readonly loadingLabelDelayMs?: number
  /**
   * Load into an uncommitted staging value. Loaders should observe `signal`,
   * though late values are still handled safely if cancellation is impossible.
   */
  readonly load: (
    animalId: string,
    context: AnimalLoadContext,
  ) => Promise<TLoaded> | TLoaded
  /**
   * Atomically install every presentation concern (viewer, content, background,
   * and narration ownership). This callback must be synchronous.
   */
  readonly commit: (loaded: TLoaded, context: AnimalCommitContext) => void
  /** Release an uncommitted value returned by a stale or failed request. */
  readonly dispose: (
    loaded: TLoaded,
    context: AnimalLoadContext,
  ) => Promise<void> | void
  /** Optional diagnostics only; disposal errors never become visible load failures. */
  readonly onDisposeError?: (error: unknown, context: AnimalLoadContext) => void
}

interface ActiveRequest<TLoaded> {
  readonly animalId: string
  readonly requestToken: number
  readonly controller: AbortController
  promise: Promise<AnimalLoadResult> | null
  loaded: TLoaded | null
}

type Listener = () => void

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined
  let rejectPromise: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  }
}

/**
 * A small external store that coordinates animal presentation loads.
 *
 * `subscribe` and `getSnapshot` are bound properties so the instance can be
 * passed directly to React's `useSyncExternalStore`.
 */
export class AnimalLoadCoordinator<TLoaded> {
  readonly getSnapshot = (): AnimalLoadSnapshot => this.snapshot

  readonly getServerSnapshot = (): AnimalLoadSnapshot => this.snapshot

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private snapshot: AnimalLoadSnapshot
  private readonly listeners = new Set<Listener>()
  private readonly options: AnimalLoadCoordinatorOptions<TLoaded>
  private readonly loadingLabelDelayMs: number
  private nextRequestToken: number
  private activeRequest: ActiveRequest<TLoaded> | null = null
  private loadingLabelTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(options: AnimalLoadCoordinatorOptions<TLoaded>) {
    this.options = options
    this.loadingLabelDelayMs =
      options.loadingLabelDelayMs ?? ANIMAL_LOADING_LABEL_DELAY_MS

    if (
      !Number.isFinite(this.loadingLabelDelayMs) ||
      this.loadingLabelDelayMs < 0
    ) {
      throw new RangeError('loadingLabelDelayMs must be a non-negative number')
    }

    const initialReadyAnimalId = options.initialReadyAnimalId ?? null
    const initialRequestToken = options.initialRequestToken ?? 0
    if (!Number.isSafeInteger(initialRequestToken) || initialRequestToken < 0) {
      throw new RangeError('initialRequestToken must be a non-negative safe integer')
    }
    this.nextRequestToken = initialRequestToken
    this.snapshot = {
      readyAnimalId: initialReadyAnimalId,
      requestedAnimalId: initialReadyAnimalId,
      requestToken: initialRequestToken,
      phase: 'idle',
      showDelayedLabel: false,
      failure: null,
    }
  }

  /**
   * Select an animal. Re-selecting the exact request that is already loading
   * returns the same promise and does not consume another request token.
   */
  request(animalId: string): Promise<AnimalLoadResult> {
    this.assertUsable()
    this.assertAnimalId(animalId)

    const activeRequest = this.activeRequest
    if (
      activeRequest?.animalId === animalId &&
      activeRequest.promise !== null
    ) {
      return activeRequest.promise
    }

    return this.startRequest(animalId, false)
  }

  /**
   * Explicitly stage the animal again even when it is already ready or already
   * loading. This is useful when a committed viewer resource is lost while the
   * surrounding content remains usable.
   */
  reload(animalId: string): Promise<AnimalLoadResult> {
    this.assertUsable()
    this.assertAnimalId(animalId)
    return this.startRequest(animalId, true)
  }

  /**
   * Retry the latest failed animal. The retry is always a fresh request with a
   * new token, even if the failed ID also happens to be the ready ID.
   */
  retry(): Promise<AnimalLoadResult> | null {
    this.assertUsable()
    const { failure, requestedAnimalId } = this.snapshot
    if (failure === null || requestedAnimalId === null) {
      return null
    }

    return this.startRequest(requestedAnimalId, true)
  }

  /**
   * Stop coordinating. Any loader that still resolves afterwards is treated as
   * stale and its staging value is disposed.
   */
  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.clearLoadingLabelTimer()
    this.activeRequest?.controller.abort()
    this.activeRequest = null
    this.listeners.clear()
  }

  private startRequest(
    animalId: string,
    forceReload: boolean,
  ): Promise<AnimalLoadResult> {
    this.activeRequest?.controller.abort()
    this.activeRequest = null
    this.clearLoadingLabelTimer()

    const requestToken = ++this.nextRequestToken

    if (!forceReload && animalId === this.snapshot.readyAnimalId) {
      this.setSnapshot({
        ...this.snapshot,
        requestedAnimalId: animalId,
        requestToken,
        phase: 'idle',
        showDelayedLabel: false,
        failure: null,
      })
      return Promise.resolve({
        status: 'already-ready',
        animalId,
        requestToken,
      })
    }

    const activeRequest: ActiveRequest<TLoaded> = {
      animalId,
      requestToken,
      controller: new AbortController(),
      promise: null,
      loaded: null,
    }
    this.activeRequest = activeRequest
    const deferredResult = createDeferred<AnimalLoadResult>()
    activeRequest.promise = deferredResult.promise
    this.scheduleLoadingLabel(activeRequest)

    this.setSnapshot({
      ...this.snapshot,
      requestedAnimalId: animalId,
      requestToken,
      phase: 'loading',
      showDelayedLabel: false,
      failure: null,
    })

    // A store subscriber is allowed to synchronously issue another request.
    // In that case this request has already become stale and its loader should
    // never start.
    if (!this.isLatest(activeRequest)) {
      deferredResult.resolve(this.staleResult(activeRequest))
      return deferredResult.promise
    }

    void this.runRequest(activeRequest).then(
      deferredResult.resolve,
      deferredResult.reject,
    )
    return deferredResult.promise
  }

  private async runRequest(
    request: ActiveRequest<TLoaded>,
  ): Promise<AnimalLoadResult> {
    const context: AnimalLoadContext = {
      animalId: request.animalId,
      requestToken: request.requestToken,
      signal: request.controller.signal,
    }

    let loaded: TLoaded
    try {
      loaded = await this.options.load(request.animalId, context)
      request.loaded = loaded
    } catch (error: unknown) {
      if (!this.isLatest(request)) {
        return this.staleResult(request)
      }

      this.clearLoadingLabelTimer()
      this.activeRequest = null
      this.setSnapshot({
        ...this.snapshot,
        phase: 'failed',
        showDelayedLabel: false,
        failure: {
          animalId: request.animalId,
          requestToken: request.requestToken,
          error,
        },
      })
      return {
        status: 'failed',
        animalId: request.animalId,
        requestToken: request.requestToken,
        error,
      }
    }

    if (!this.isLatest(request)) {
      await this.disposeLoaded(loaded, context)
      request.loaded = null
      return this.staleResult(request)
    }

    this.clearLoadingLabelTimer()
    const previousReadyAnimalId = this.snapshot.readyAnimalId
    try {
      this.options.commit(loaded, {
        animalId: request.animalId,
        requestToken: request.requestToken,
        previousReadyAnimalId,
      })
    } catch (error: unknown) {
      const stillLatest = this.isLatest(request)
      if (stillLatest) {
        this.activeRequest = null
        this.setSnapshot({
          ...this.snapshot,
          phase: 'failed',
          showDelayedLabel: false,
          failure: {
            animalId: request.animalId,
            requestToken: request.requestToken,
            error,
          },
        })
      }
      await this.disposeLoaded(loaded, context)
      request.loaded = null

      if (!stillLatest) {
        return this.staleResult(request)
      }
      return {
        status: 'failed',
        animalId: request.animalId,
        requestToken: request.requestToken,
        error,
      }
    }

    // Ownership moved to the commit callback, so this value must never be
    // disposed by the coordinator from this point onward.
    request.loaded = null

    if (this.isLatest(request)) {
      this.activeRequest = null
      this.setSnapshot({
        readyAnimalId: request.animalId,
        requestedAnimalId: request.animalId,
        requestToken: request.requestToken,
        phase: 'idle',
        showDelayedLabel: false,
        failure: null,
      })
    } else if (!this.destroyed) {
      // A commit callback may synchronously initiate the next request. The
      // committed presentation becomes ready without disturbing that newer
      // request's loading state.
      this.setSnapshot({
        ...this.snapshot,
        readyAnimalId: request.animalId,
      })
    }

    return {
      status: 'committed',
      animalId: request.animalId,
      requestToken: request.requestToken,
    }
  }

  private scheduleLoadingLabel(request: ActiveRequest<TLoaded>): void {
    this.loadingLabelTimer = setTimeout(() => {
      this.loadingLabelTimer = null
      if (!this.isLatest(request) || this.snapshot.phase !== 'loading') {
        return
      }
      this.setSnapshot({
        ...this.snapshot,
        showDelayedLabel: true,
      })
    }, this.loadingLabelDelayMs)
  }

  private clearLoadingLabelTimer(): void {
    if (this.loadingLabelTimer === null) {
      return
    }
    clearTimeout(this.loadingLabelTimer)
    this.loadingLabelTimer = null
  }

  private isLatest(request: ActiveRequest<TLoaded>): boolean {
    return (
      !this.destroyed &&
      this.activeRequest === request &&
      this.snapshot.requestToken === request.requestToken
    )
  }

  private async disposeLoaded(
    loaded: TLoaded,
    context: AnimalLoadContext,
  ): Promise<void> {
    try {
      await this.options.dispose(loaded, context)
    } catch (error: unknown) {
      try {
        this.options.onDisposeError?.(error, context)
      } catch {
        // Diagnostics must never alter user-visible request state.
      }
    }
  }

  private staleResult(
    request: ActiveRequest<TLoaded>,
  ): Extract<AnimalLoadResult, { status: 'stale' }> {
    return {
      status: 'stale',
      animalId: request.animalId,
      requestToken: request.requestToken,
    }
  }

  private setSnapshot(snapshot: AnimalLoadSnapshot): void {
    if (this.destroyed) {
      return
    }
    this.snapshot = snapshot
    for (const listener of this.listeners) {
      listener()
    }
  }

  private assertUsable(): void {
    if (this.destroyed) {
      throw new Error('AnimalLoadCoordinator has been destroyed')
    }
  }

  private assertAnimalId(animalId: string): void {
    if (animalId.trim().length === 0) {
      throw new TypeError('animalId must not be empty')
    }
  }
}
