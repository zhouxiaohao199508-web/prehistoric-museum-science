import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTransientScrollbar } from '../src/components/useTransientScrollbar'

function TransientScrollbarFixture() {
  const { handleScroll, isScrolling, scrollRef } = useTransientScrollbar()

  return (
    <div
      data-scrolling={isScrolling}
      data-testid="scroll-container"
      onScroll={handleScroll}
      ref={scrollRef}
    />
  )
}

describe('useTransientScrollbar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows while scrolling and hides after the idle delay', () => {
    vi.useFakeTimers()
    render(<TransientScrollbarFixture />)
    const scrollContainer = screen.getByTestId('scroll-container')

    expect(scrollContainer).toHaveAttribute('data-scrolling', 'false')

    fireEvent.scroll(scrollContainer)
    expect(scrollContainer).toHaveAttribute('data-scrolling', 'true')

    act(() => {
      vi.advanceTimersByTime(479)
    })
    expect(scrollContainer).toHaveAttribute('data-scrolling', 'true')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(scrollContainer).toHaveAttribute('data-scrolling', 'false')
  })
})
