import { onRequest } from '../functions/museum/index'

describe('Cloudflare museum entry', () => {
  it('redirects an English browser to the English static museum without cache sharing', () => {
    const response = onRequest({
      request: new Request('https://example.test/museum/?animal=stegosaurus', {
        headers: { 'Accept-Language': 'en-GB,en;q=0.9' },
      }),
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://example.test/museum/en/?animal=stegosaurus',
    )
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Cookie, Accept-Language')
  })

  it('redirects a Chinese browser to the Simplified Chinese static museum', () => {
    const response = onRequest({
      request: new Request('https://example.test/museum/', {
        headers: { 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.5' },
      }),
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://example.test/museum/zh-CN/',
    )
  })

  it('lets the saved museum locale override the browser language', () => {
    const response = onRequest({
      request: new Request('https://example.test/museum/', {
        headers: {
          'Accept-Language': 'zh-CN,zh;q=0.9',
          Cookie: 'session=opaque; museum_locale=en; theme=calm',
        },
      }),
    })

    expect(response.headers.get('Location')).toBe(
      'https://example.test/museum/en/',
    )
  })

  it('defaults unknown and malformed preferences to Simplified Chinese', () => {
    const response = onRequest({
      request: new Request('https://example.test/museum/', {
        headers: {
          'Accept-Language': 'fr-FR,ja;q=0.8,*;q=0.1',
          Cookie: 'museum_locale=pirate',
        },
      }),
    })

    expect(response.headers.get('Location')).toBe(
      'https://example.test/museum/zh-CN/',
    )
  })

  it('honours wildcard weights and explicit language exclusions', () => {
    const englishResponse = onRequest({
      request: new Request('https://example.test/museum', {
        headers: { 'Accept-Language': 'zh;q=0, *;q=1' },
      }),
    })
    const chineseResponse = onRequest({
      request: new Request('https://example.test/museum', {
        headers: { 'Accept-Language': '*;q=1, en;q=0.5' },
      }),
    })

    expect(englishResponse.headers.get('Location')).toBe(
      'https://example.test/museum/en/',
    )
    expect(chineseResponse.headers.get('Location')).toBe(
      'https://example.test/museum/zh-CN/',
    )
  })

  it('ignores invalid quality weights instead of promoting them', () => {
    const response = onRequest({
      request: new Request('https://example.test/museum', {
        headers: { 'Accept-Language': 'en;q=2, zh;q=0.5' },
      }),
    })

    expect(response.headers.get('Location')).toBe(
      'https://example.test/museum/zh-CN/',
    )
  })
})
