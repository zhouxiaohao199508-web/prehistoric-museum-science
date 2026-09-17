interface MuseumEntryContext {
  readonly request: Request
}

type MuseumLocale = 'zh-CN' | 'en'

function localeFromCookie(cookieHeader: string): MuseumLocale | null {
  const saved = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('museum_locale='))
    ?.slice('museum_locale='.length)
  return saved === 'zh-CN' || saved === 'en' ? saved : null
}

function localeFromAcceptLanguage(header: string): MuseumLocale | null {
  const preferences = header
    .split(',')
    .flatMap((entry, index) => {
      const [language = '', ...parameters] = entry.trim().split(';')
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith('q='),
      )
      const qualityValue = qualityParameter?.trim().slice(2)
      const quality = qualityValue === undefined ? 1 : Number(qualityValue)
      if (
        language.trim() === '' ||
        !Number.isFinite(quality) ||
        quality < 0 ||
        quality > 1
      ) {
        return []
      }
      return [{
        index,
        language: language.trim().toLowerCase(),
        quality,
      }]
    })

  const score = (locale: MuseumLocale) => {
    const family = locale === 'zh-CN' ? 'zh' : 'en'
    const explicit = preferences.filter(
      ({ language }) => language === family || language.startsWith(`${family}-`),
    )
    const matches =
      explicit.length > 0
        ? explicit
        : preferences.filter(({ language }) => language === '*')
    if (matches.length === 0) {
      return null
    }
    return matches.reduce((best, candidate) =>
      candidate.quality > best.quality ||
      (candidate.quality === best.quality && candidate.index < best.index)
        ? candidate
        : best,
    )
  }

  const candidates = (['zh-CN', 'en'] as const)
    .map((locale) => ({ locale, score: score(locale) }))
    .filter(
      (candidate): candidate is {
        locale: MuseumLocale
        score: { index: number; language: string; quality: number }
      } => candidate.score !== null && candidate.score.quality > 0,
    )
    .sort(
      (left, right) =>
        right.score.quality - left.score.quality ||
        left.score.index - right.score.index,
    )

  return candidates[0]?.locale ?? null
}

export function onRequest({ request }: MuseumEntryContext): Response {
  const target = new URL(request.url)
  const acceptedLanguage = request.headers.get('Accept-Language') ?? ''
  const locale =
    localeFromCookie(request.headers.get('Cookie') ?? '') ??
    localeFromAcceptLanguage(acceptedLanguage) ??
    'zh-CN'
  target.pathname = `/museum/${locale}/`

  return new Response(null, {
    status: 302,
    headers: {
      'Cache-Control': 'private, no-store',
      Location: target.href,
      Vary: 'Cookie, Accept-Language',
    },
  })
}
