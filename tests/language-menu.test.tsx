import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageMenu } from '../src/components/LanguageMenu'
import { I18nProvider, useI18n } from '../src/i18n/I18nProvider'
import { localePreferenceStorageKey } from '../src/i18n/locale'

function LocaleProbe() {
  const { locale, preference } = useI18n()
  return <output>{`${locale}:${preference}`}</output>
}

function renderLanguageMenu() {
  return render(
    <I18nProvider>
      <LanguageMenu />
      <LocaleProbe />
    </I18nProvider>,
  )
}

describe('LanguageMenu', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/museum/')
    document.cookie = 'museum_locale=; Max-Age=0; Path=/museum'
    document.documentElement.removeAttribute('data-locale')
    document.documentElement.lang = ''
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('supports radio-menu keyboard navigation, Escape, and focus return', async () => {
    window.localStorage.setItem(localePreferenceStorageKey, 'zh-CN')
    const user = userEvent.setup()
    renderLanguageMenu()

    const trigger = screen.getByRole('button', {
      name: '切换语言，当前简体中文',
    })
    trigger.focus()
    await user.keyboard('{ArrowDown}')

    const menu = screen.getByRole('menu', { name: '选择界面语言' })
    const system = within(menu).getByRole('menuitemradio', {
      name: /^跟随系统（当前：/,
    })
    const chinese = within(menu).getByRole('menuitemradio', {
      name: '简体中文',
    })
    const english = within(menu).getByRole('menuitemradio', {
      name: 'English',
    })
    expect(system).toHaveFocus()
    expect(chinese).toHaveAttribute('aria-checked', 'true')
    expect(chinese.querySelector('[lang="zh-CN"]')).toHaveTextContent(
      '简体中文',
    )
    expect(english.querySelector('[lang="en"]')).toHaveTextContent('English')
    expect(system.querySelector('[lang="en"]')).toBeInTheDocument()

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(english).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps the portalled menu inside a narrow viewport', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(568)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains('language-menu__trigger')) {
          return DOMRect.fromRect({ x: 198, y: 20, width: 52, height: 52 })
        }
        if (this.classList.contains('language-menu__popover')) {
          return DOMRect.fromRect({ width: 296, height: 160 })
        }
        return DOMRect.fromRect()
      },
    )
    const user = userEvent.setup()
    renderLanguageMenu()

    await user.click(
      screen.getByRole('button', {
        name: 'Change language, current English',
      }),
    )

    const menu = screen.getByRole('menu', {
      name: 'Choose interface language',
    })
    await waitFor(() => expect(menu).toHaveAttribute('data-positioned', 'true'))
    expect(menu.parentElement).toBe(document.body)
    expect(menu.style.left).toBe('12px')
    expect(menu.style.top).toBe('81px')
    expect(menu.style.width).toBe('296px')
  })

  it('closes on Tab and Shift+Tab while preserving the browser focus order', async () => {
    window.localStorage.setItem(localePreferenceStorageKey, 'zh-CN')
    const user = userEvent.setup()
    const tabDefaultPrevented: boolean[] = []
    render(
      <div
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            tabDefaultPrevented.push(event.defaultPrevented)
          }
        }}
      >
        <I18nProvider>
          <LanguageMenu />
          <button type="button">After language menu</button>
        </I18nProvider>
      </div>,
    )

    const trigger = screen.getByRole('button', {
      name: '切换语言，当前简体中文',
    })
    const afterMenu = screen.getByRole('button', {
      name: 'After language menu',
    })

    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitemradio', { name: /^跟随系统（当前：/ }),
    ).toHaveFocus()

    await user.tab()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(afterMenu).toHaveFocus()
    expect(tabDefaultPrevented).toEqual([true])

    trigger.focus()
    await user.keyboard('{ArrowUp}')
    expect(
      screen.getByRole('menuitemradio', { name: 'English' }),
    ).toHaveFocus()

    await user.tab({ shift: true })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(tabDefaultPrevented).toEqual([true, true])
  })

  it('contains Escape so parent keyboard handlers do not close another layer', async () => {
    window.localStorage.setItem(localePreferenceStorageKey, 'zh-CN')
    const user = userEvent.setup()
    const parentKeyDown = vi.fn()
    render(
      <div onKeyDown={parentKeyDown}>
        <I18nProvider>
          <LanguageMenu />
        </I18nProvider>
      </div>,
    )

    const trigger = screen.getByRole('button', {
      name: '切换语言，当前简体中文',
    })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    parentKeyDown.mockClear()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(parentKeyDown).not.toHaveBeenCalled()
  })

  it('persists a manual language and keeps the equivalent nested route', async () => {
    const cookieSetter = vi.spyOn(document, 'cookie', 'set')
    window.history.replaceState(
      {},
      '',
      '/museum/zh-CN/animals/mosasaurus/?view=model#sources',
    )
    const user = userEvent.setup()
    renderLanguageMenu()

    await user.click(
      screen.getByRole('button', {
        name: '切换语言，当前简体中文',
      }),
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: 'English' }),
    )

    expect(window.location.pathname).toBe('/museum/en/animals/mosasaurus/')
    expect(window.location.search).toBe('?view=model')
    expect(window.location.hash).toBe('#sources')
    expect(cookieSetter).toHaveBeenCalledWith(
      'museum_locale=en; Max-Age=31536000; Path=/museum; SameSite=Lax; Secure',
    )
  })

  it('still writes the language cookie when local storage is unavailable', async () => {
    const cookieSetter = vi.spyOn(document, 'cookie', 'set')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError')
    })
    window.history.replaceState({}, '', '/museum/zh-CN/')
    const user = userEvent.setup()
    renderLanguageMenu()

    await user.click(
      screen.getByRole('button', {
        name: '切换语言，当前简体中文',
      }),
    )
    await user.click(
      screen.getByRole('menuitemradio', { name: 'English' }),
    )

    expect(cookieSetter).toHaveBeenCalledWith(
      'museum_locale=en; Max-Age=31536000; Path=/museum; SameSite=Lax; Secure',
    )
  })

  it('follows the system without returning to the edge entry route', async () => {
    const cookieSetter = vi.spyOn(document, 'cookie', 'set')
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-TW'])
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-TW')
    window.localStorage.setItem(localePreferenceStorageKey, 'en')
    window.history.replaceState({}, '', '/museum/en/?animal=stegosaurus#model')
    const user = userEvent.setup()
    renderLanguageMenu()

    await user.click(
      screen.getByRole('button', {
        name: 'Change language, current English',
      }),
    )
    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Follow system (currently 简体中文)',
      }),
    )

    expect(window.localStorage.getItem(localePreferenceStorageKey)).toBeNull()
    expect(window.location.pathname).toBe('/museum/zh-CN/')
    expect(window.location.search).toBe('?animal=stegosaurus')
    expect(window.location.hash).toBe('#model')
    expect(cookieSetter).toHaveBeenCalledWith(
      'museum_locale=; Max-Age=0; Path=/museum; SameSite=Lax; Secure',
    )
    expect(screen.getByText('zh-CN:system')).toBeVisible()
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
      expect(document.documentElement).toHaveAttribute(
        'data-locale',
        'zh-CN',
      )
    })
  })

  it('lets a direct locale path control the visit without changing a saved choice', () => {
    window.localStorage.setItem(localePreferenceStorageKey, 'zh-CN')
    window.history.replaceState({}, '', '/museum/en/')

    renderLanguageMenu()

    expect(screen.getByText('en:en')).toBeVisible()
    expect(window.localStorage.getItem(localePreferenceStorageKey)).toBe(
      'zh-CN',
    )
  })

  it('follows a system-language change while the system preference is active', async () => {
    let languages: string[] = ['en-GB']
    vi.spyOn(window.navigator, 'languages', 'get').mockImplementation(
      () => languages,
    )
    vi.spyOn(window.navigator, 'language', 'get').mockImplementation(
      () => languages[0] ?? '',
    )
    renderLanguageMenu()
    expect(screen.getByText('en:system')).toBeVisible()

    languages = ['zh-HK']
    window.dispatchEvent(new Event('languagechange'))

    await waitFor(() => {
      expect(screen.getByText('zh-CN:system')).toBeVisible()
      expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
    })
    expect(window.location.pathname).toBe('/museum/zh-CN/')
    expect(window.localStorage.getItem(localePreferenceStorageKey)).toBeNull()
  })

  it('keeps following the system after refreshing a prerendered locale URL', async () => {
    let languages: string[] = ['en-GB']
    vi.spyOn(window.navigator, 'languages', 'get').mockImplementation(
      () => languages,
    )
    vi.spyOn(window.navigator, 'language', 'get').mockImplementation(
      () => languages[0] ?? '',
    )
    window.localStorage.setItem(localePreferenceStorageKey, 'en')
    window.history.replaceState({}, '', '/museum/en/')
    const firstRender = renderLanguageMenu()
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', {
        name: 'Change language, current English',
      }),
    )
    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Follow system (currently English)',
      }),
    )
    firstRender.unmount()

    render(
      <I18nProvider
        initialState={{ locale: 'en', preference: 'en' }}
      >
        <LocaleProbe />
      </I18nProvider>,
    )

    expect(screen.getByText('en:system')).toBeVisible()

    languages = ['zh-HK']
    window.dispatchEvent(new Event('languagechange'))

    await waitFor(() => {
      expect(screen.getByText('zh-CN:system')).toBeVisible()
    })
    expect(window.location.pathname).toBe('/museum/zh-CN/')
  })
})
