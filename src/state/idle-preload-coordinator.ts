import type { ModelCache } from '../viewer/model-cache'

export const DEFAULT_IDLE_PRELOAD_DELAY_MS = 2_000

export interface IdlePreloadTarget {
  readonly id: string
  readonly imageUrls: readonly string[] | (() => readonly string[])
  readonly modelUrl: string
}

export interface IdlePreloadCoordinatorOptions {
  readonly idleDelayMs?: number
  readonly isImageInMemory?: (url: string) => boolean
  readonly modelCache: ModelCache
  readonly targets: readonly IdlePreloadTarget[]
}

interface NetworkInformation {
  readonly effectiveType?: string
  readonly saveData?: boolean
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformation
}

type PreloadTask =
  {
    readonly kind: 'image' | 'model'
    readonly url: string
  }

type OptionalPreloadPolicy = 'all' | 'images-only' | 'none'

function readOptionalPreloadPolicy(): OptionalPreloadPolicy {
  const connection = (navigator as NavigatorWithConnection).connection
  if (connection?.saveData === true) {
    return 'none'
  }
  return ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
    ? 'images-only'
    : 'all'
}

function adjacentTargets(
  targets: readonly IdlePreloadTarget[],
  animalId: string,
): IdlePreloadTarget[] {
  const currentIndex = targets.findIndex((target) => target.id === animalId)
  if (currentIndex < 0 || targets.length < 2) {
    return []
  }

  const ordered = [
    targets[(currentIndex + 1) % targets.length],
    targets[(currentIndex - 1 + targets.length) % targets.length],
  ]
  const seen = new Set<string>()
  return ordered.filter((target): target is IdlePreloadTarget => {
    if (target === undefined || target.id === animalId || seen.has(target.id)) {
      return false
    }
    seen.add(target.id)
    return true
  })
}

/**
 * Starts optional adjacent-asset work only after a committed presentation has
 * remained selected for the configured delay. Every task is cancellable and
 * each adjacent animal is completed in order at low browser priority.
 */
export class IdlePreloadCoordinator {
  private readonly idleDelayMs: number
  private readonly isImageInMemory: (url: string) => boolean
  private readonly modelCache: ModelCache
  private readonly targets: readonly IdlePreloadTarget[]
  private activeController: AbortController | null = null
  private delayTimer: number | null = null
  private destroyed = false
  private generation = 0
  private tasks: PreloadTask[] = []

  constructor(options: IdlePreloadCoordinatorOptions) {
    this.idleDelayMs =
      options.idleDelayMs ?? DEFAULT_IDLE_PRELOAD_DELAY_MS
    if (!Number.isFinite(this.idleDelayMs) || this.idleDelayMs < 0) {
      throw new RangeError('idleDelayMs must be a non-negative number')
    }
    this.isImageInMemory = options.isImageInMemory ?? (() => false)
    this.modelCache = options.modelCache
    this.targets = options.targets
  }

  scheduleAfterCommit(animalId: string): void {
    this.cancelAll()
    if (this.destroyed) {
      return
    }

    const generation = this.generation
    this.delayTimer = window.setTimeout(() => {
      this.delayTimer = null
      if (
        this.destroyed ||
        generation !== this.generation ||
        document.visibilityState === 'hidden'
      ) {
        return
      }
      this.beginPreloading(animalId, generation)
    }, this.idleDelayMs)
  }

  cancelAll(): void {
    this.generation += 1
    if (this.delayTimer !== null) {
      window.clearTimeout(this.delayTimer)
      this.delayTimer = null
    }
    this.activeController?.abort()
    this.activeController = null
    this.tasks = []
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.cancelAll()
  }

  private beginPreloading(animalId: string, generation: number): void {
    const policy = readOptionalPreloadPolicy()
    if (policy === 'none') {
      return
    }
    const seenUrls = new Set<string>()
    const tasks: PreloadTask[] = []
    const targets = adjacentTargets(this.targets, animalId)

    for (const target of targets) {
      if (policy === 'all' && !seenUrls.has(target.modelUrl)) {
        seenUrls.add(target.modelUrl)
        tasks.push({ kind: 'model', url: target.modelUrl })
      }
      const imageUrls =
        typeof target.imageUrls === 'function'
          ? target.imageUrls()
          : target.imageUrls
      for (const url of imageUrls) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          tasks.push({ kind: 'image', url })
        }
      }
    }

    if (tasks.length === 0) {
      return
    }
    this.tasks = tasks
    this.activeController = new AbortController()
    this.scheduleNextTask(generation)
  }

  private scheduleNextTask(generation: number): void {
    const controller = this.activeController
    if (
      controller === null ||
      controller.signal.aborted ||
      generation !== this.generation
    ) {
      return
    }

    const task = this.tasks.shift()
    if (task === undefined) {
      this.activeController = null
      return
    }

    void this.runTask(task, controller, generation)
  }

  private async runTask(
    task: PreloadTask,
    controller: AbortController,
    generation: number,
  ): Promise<void> {
    try {
      await this.preloadAsset(task.kind, task.url, controller, generation)
    } catch {
      // Adjacent preloading is optional. A later explicit selection performs
      // a fresh, user-visible load and reports any real failure.
    } finally {
      if (
        !controller.signal.aborted &&
        generation === this.generation &&
        !this.destroyed
      ) {
        this.scheduleNextTask(generation)
      }
    }
  }

  private async preloadAsset(
    kind: 'image' | 'model',
    url: string,
    controller: AbortController,
    generation: number,
  ): Promise<void> {
    // ModelCache covers the current tab's decoded-transfer buffer. On a miss,
    // a normal fetch lets the browser's HTTP cache satisfy the request before
    // any network transfer is attempted.
    if (kind === 'model' && this.modelCache.get(url) !== null) {
      return
    }
    if (kind === 'image' && this.isImageInMemory(url)) {
      return
    }
    const response = await fetch(url, {
      priority: 'low',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`预加载请求失败（${response.status}）：${url}`)
    }
    const buffer = await response.arrayBuffer()
    if (
      kind === 'model' &&
      !controller.signal.aborted &&
      generation === this.generation
    ) {
      this.modelCache.set(url, buffer)
    }
  }
}
