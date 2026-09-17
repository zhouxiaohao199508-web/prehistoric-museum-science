import {
  buildLocaleUrl,
  localeCookiePath,
  localePreferenceStorageKey,
  resolveLocale,
  serializeClearedLocaleCookie,
  serializeLocaleCookie,
  systemLocale,
} from '../src/i18n/locale'
import { formatSizeFact } from '../src/i18n/messages'

describe('locale negotiation', () => {
  it.each(['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-Hant-TW'])(
    'maps every Chinese system locale (%s) to Simplified Chinese',
    (language) => {
      expect(systemLocale([language])).toBe('zh-CN')
    },
  )

  it.each(['en', 'en-US', 'en-GB'])(
    'uses English for the supported system locale %s',
    (language) => {
      expect(systemLocale([language])).toBe('en')
    },
  )

  it('uses the first supported browser language and otherwise defaults to Chinese', () => {
    expect(systemLocale(['fr-FR', 'en-GB', 'zh-CN'])).toBe('en')
    expect(systemLocale(['fr-FR', 'ja-JP', ''])).toBe('zh-CN')
    expect(systemLocale([])).toBe('zh-CN')
  })

  it('lets an explicit locale path control only the current visit', () => {
    expect(
      resolveLocale({
        pathname: '/museum/en/',
        savedPreference: 'zh-CN',
        navigatorLanguages: ['zh-CN'],
      }),
    ).toEqual({ locale: 'en', source: 'path' })
    expect(
      resolveLocale({
        pathname: '/museum/en/index.html',
        savedPreference: 'zh-CN',
        navigatorLanguages: ['zh-CN'],
      }),
    ).toEqual({ locale: 'en', source: 'path' })
  })

  it('recognises the locale of a nested animal detail path', () => {
    expect(
      resolveLocale({
        pathname: '/museum/en/animals/mosasaurus/',
        savedPreference: 'zh-CN',
        navigatorLanguages: ['zh-CN'],
      }),
    ).toEqual({ locale: 'en', source: 'path' })
  })

  it('uses the saved manual choice at the root, then falls back to the system', () => {
    expect(
      resolveLocale({
        pathname: '/museum/',
        savedPreference: 'en',
        navigatorLanguages: ['zh-CN'],
      }),
    ).toEqual({ locale: 'en', source: 'saved' })

    expect(
      resolveLocale({
        pathname: '/museum/',
        savedPreference: null,
        navigatorLanguages: ['zh-HK'],
      }),
    ).toEqual({ locale: 'zh-CN', source: 'system' })
  })

  it('ignores corrupt stored values', () => {
    expect(
      resolveLocale({
        pathname: '/museum/',
        savedPreference: 'pirate',
        navigatorLanguages: ['de-DE'],
      }),
    ).toEqual({ locale: 'zh-CN', source: 'system' })
  })
})

describe('shareable locale URLs', () => {
  it('adds a locale path only for a manual language choice and preserves state', () => {
    expect(
      buildLocaleUrl(
        'https://example.test/museum/?animal=stegosaurus#viewer',
        'en',
      ),
    ).toBe('/museum/en/?animal=stegosaurus#viewer')
    expect(
      buildLocaleUrl(
        'https://example.test/museum/en/?animal=stegosaurus#viewer',
        'zh-CN',
      ),
    ).toBe('/museum/zh-CN/?animal=stegosaurus#viewer')
  })

  it('switches the locale of a nested animal detail path in place', () => {
    expect(
      buildLocaleUrl(
        'https://example.test/museum/en/animals/mosasaurus/#model',
        'zh-CN',
      ),
    ).toBe('/museum/zh-CN/animals/mosasaurus/#model')
  })

  it('removes the locale path when following the system', () => {
    expect(
      buildLocaleUrl(
        'https://example.test/museum/zh-CN/?animal=stegosaurus',
        'system',
      ),
    ).toBe('/museum/?animal=stegosaurus')
  })

  it('normalises explicit index documents before changing the language', () => {
    expect(
      buildLocaleUrl(
        'https://example.test/museum/index.html?animal=stegosaurus',
        'en',
      ),
    ).toBe('/museum/en/?animal=stegosaurus')
    expect(
      buildLocaleUrl(
        'https://example.test/museum/en/index.html?animal=stegosaurus',
        'zh-CN',
      ),
    ).toBe('/museum/zh-CN/?animal=stegosaurus')
    expect(
      buildLocaleUrl(
        'https://example.test/museum/zh-CN/index.html?animal=stegosaurus',
        'system',
      ),
    ).toBe('/museum/?animal=stegosaurus')
  })

  it('uses one stable persistence key', () => {
    expect(localePreferenceStorageKey).toBe('museum.locale')
  })

  it('scopes the language cookie to both forms of the museum entry', () => {
    expect(localeCookiePath('/museum/zh-CN/animals/mosasaurus/')).toBe(
      '/museum',
    )
    expect(localeCookiePath('/museum/en/')).toBe('/museum')
    expect(serializeLocaleCookie('en', '/museum/zh-CN/')).toBe(
      'museum_locale=en; Max-Age=31536000; Path=/museum; SameSite=Lax; Secure',
    )
    expect(serializeClearedLocaleCookie('/museum/en/')).toBe(
      'museum_locale=; Max-Age=0; Path=/museum; SameSite=Lax; Secure',
    )
  })
})

describe('locale-aware size facts', () => {
  it.each([
    [
      { kind: 'body-length', minMeters: 6.5, maxMeters: 9 } as const,
      'Body length',
      '6.5–9 m (about 21–30 ft)',
    ],
    [
      { kind: 'wingspan', minMeters: 1.5, maxMeters: 1.5 } as const,
      'Wingspan',
      '1.5 m (about 5 ft)',
    ],
    [
      { kind: 'shoulder-height', minMeters: 0.5, maxMeters: 0.5 } as const,
      'Shoulder height',
      '0.5 m (about 1.6 ft)',
    ],
  ])('puts metric first and approximate imperial second for %s', (size, label, value) => {
    expect(formatSizeFact(size, 'en')).toEqual({ label, value })
  })

  it('keeps a group-range note ahead of the bilingual measurement convention', () => {
    expect(
      formatSizeFact(
        {
          kind: 'group-range',
          minMeters: 1,
          maxMeters: 2,
          note: 'Different species varied in size',
        },
        'en',
      ),
    ).toEqual({
      label: 'Group size range',
      value: 'Different species varied in size; 1–2 m (about 3–7 ft)',
    })
  })

  it('keeps the Chinese display metric-only', () => {
    const result = formatSizeFact(
      { kind: 'body-length', minMeters: 6.5, maxMeters: 9 },
      'zh-CN',
    )
    expect(result).toEqual({ label: '体长', value: '6.5–9 米（约）' })
    expect(result.value).not.toContain('ft')
  })
})
