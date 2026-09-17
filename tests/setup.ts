import '@testing-library/jest-dom/vitest'

const localStorageValues = new Map<string, string>()
const sessionStorageValues = new Map<string, string>()

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => localStorageValues.clear(),
      getItem: (key: string) => localStorageValues.get(key) ?? null,
      key: (index: number) => Array.from(localStorageValues.keys())[index] ?? null,
      get length() {
        return localStorageValues.size
      },
      removeItem: (key: string) => localStorageValues.delete(key),
      setItem: (key: string, value: string) => {
        localStorageValues.set(key, String(value))
      },
    } satisfies Storage,
  })

  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      clear: () => sessionStorageValues.clear(),
      getItem: (key: string) => sessionStorageValues.get(key) ?? null,
      key: (index: number) =>
        Array.from(sessionStorageValues.keys())[index] ?? null,
      get length() {
        return sessionStorageValues.size
      },
      removeItem: (key: string) => sessionStorageValues.delete(key),
      setItem: (key: string, value: string) => {
        sessionStorageValues.set(key, String(value))
      },
    } satisfies Storage,
  })

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
}
