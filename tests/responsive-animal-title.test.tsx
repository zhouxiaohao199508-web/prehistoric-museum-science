import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResponsiveAnimalTitle } from '../src/components/ResponsiveAnimalTitle'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ResponsiveAnimalTitle', () => {
  it('removes the English fitted size when the same title switches to Chinese', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: '40px',
    } as CSSStyleDeclaration)

    const { container, rerender } = render(
      <ResponsiveAnimalTitle locale="en">
        Pachycephalosaurus
      </ResponsiveAnimalTitle>,
    )
    const title = container.querySelector('h2')
    expect(title?.dataset.titleFitted).toBe('true')
    expect(title?.style.fontSize).toBe('19.7px')

    rerender(
      <ResponsiveAnimalTitle locale="zh-CN">肿头龙</ResponsiveAnimalTitle>,
    )

    expect(title?.dataset.titleFitted).toBeUndefined()
    expect(title?.style.fontSize).toBe('')
  })

  it('refits after a viewport resize finishes settling', () => {
    vi.useFakeTimers()
    let availableWidth = 200
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      () => availableWidth,
    )
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: '40px',
    } as CSSStyleDeclaration)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const { container } = render(
      <ResponsiveAnimalTitle locale="en">
        Pachycephalosaurus
      </ResponsiveAnimalTitle>,
    )
    const title = container.querySelector('h2')
    expect(title?.style.fontSize).toBe('19.7px')

    availableWidth = 400
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(title?.style.fontSize).toBe('')

    availableWidth = 200
    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(title?.style.fontSize).toBe('19.7px')
    expect(title?.dataset.titleFitted).toBe('true')
  })
})
