export const DEFAULT_MODEL_CACHE_MAX_ENTRIES = 3
export const DEFAULT_MODEL_CACHE_MAX_BYTES = 45 * 1024 * 1024

export interface ModelCacheOptions {
  readonly maxBytes?: number
  readonly maxEntries?: number
}

export class ModelCache {
  private readonly entries = new Map<string, ArrayBuffer>()
  private readonly maxBytes: number
  private readonly maxEntries: number
  private totalBytes = 0

  constructor(options: ModelCacheOptions = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MODEL_CACHE_MAX_BYTES
    this.maxEntries = options.maxEntries ?? DEFAULT_MODEL_CACHE_MAX_ENTRIES
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1) {
      throw new RangeError('maxBytes must be a positive safe integer')
    }
    if (!Number.isSafeInteger(this.maxEntries) || this.maxEntries < 1) {
      throw new RangeError('maxEntries must be a positive safe integer')
    }
  }

  get(url: string): ArrayBuffer | null {
    const buffer = this.entries.get(url)
    if (buffer === undefined) {
      return null
    }

    this.entries.delete(url)
    this.entries.set(url, buffer)
    return buffer
  }

  set(url: string, buffer: ArrayBuffer): void {
    const replaced = this.entries.get(url)
    if (replaced !== undefined) {
      this.entries.delete(url)
      this.totalBytes -= replaced.byteLength
    }
    if (buffer.byteLength > this.maxBytes) {
      return
    }

    this.entries.set(url, buffer)
    this.totalBytes += buffer.byteLength

    while (
      this.entries.size > this.maxEntries ||
      this.totalBytes > this.maxBytes
    ) {
      const oldestUrl = this.entries.keys().next().value
      if (oldestUrl === undefined) {
        break
      }
      const oldestBuffer = this.entries.get(oldestUrl)
      this.entries.delete(oldestUrl)
      this.totalBytes -= oldestBuffer?.byteLength ?? 0
    }
  }
}
