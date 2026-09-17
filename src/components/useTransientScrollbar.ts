import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'

const SCROLLBAR_IDLE_DELAY_MS = 480
const SCROLLBAR_TRACK_INSET_PX = 4
const SCROLLBAR_MIN_THUMB_PX = 36

export interface ScrollbarMetrics {
  readonly isScrollable: boolean
  readonly thumbOffset: number
  readonly thumbSize: number
}

const initialMetrics: ScrollbarMetrics = {
  isScrollable: false,
  thumbOffset: 0,
  thumbSize: SCROLLBAR_MIN_THUMB_PX,
}

function metricsAreEqual(left: ScrollbarMetrics, right: ScrollbarMetrics) {
  return (
    left.isScrollable === right.isScrollable &&
    left.thumbOffset === right.thumbOffset &&
    left.thumbSize === right.thumbSize
  )
}

export function useTransientScrollbar(open = true) {
  const hideTimerRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const [metrics, setMetrics] = useState<ScrollbarMetrics>(initialMetrics)

  const updateMetrics = useCallback((element = scrollRef.current) => {
    if (!element) {
      return
    }
    const trackSize = Math.max(
      0,
      element.clientHeight - SCROLLBAR_TRACK_INSET_PX * 2,
    )
    const scrollRange = Math.max(0, element.scrollHeight - element.clientHeight)
    const isScrollable = scrollRange > 2
    const thumbSize = isScrollable
      ? Math.max(
          SCROLLBAR_MIN_THUMB_PX,
          Math.round((element.clientHeight / element.scrollHeight) * trackSize),
        )
      : trackSize
    const thumbRange = Math.max(0, trackSize - thumbSize)
    const thumbOffset =
      scrollRange === 0
        ? 0
        : Math.round((element.scrollTop / scrollRange) * thumbRange)
    const nextMetrics = { isScrollable, thumbOffset, thumbSize }

    setMetrics((currentMetrics) =>
      metricsAreEqual(currentMetrics, nextMetrics)
        ? currentMetrics
        : nextMetrics,
    )
  }, [])

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      updateMetrics(event.currentTarget)
      setIsScrolling(true)
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null
        setIsScrolling(false)
      }, SCROLLBAR_IDLE_DELAY_MS)
    },
    [updateMetrics],
  )

  useEffect(() => {
    if (!open) {
      return
    }
    const scroll = scrollRef.current
    if (!scroll) {
      return
    }
    const handleResize = () => updateMetrics(scroll)
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(handleResize)

    updateMetrics(scroll)
    observer?.observe(scroll)
    if (scroll.firstElementChild) {
      observer?.observe(scroll.firstElementChild)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [open, updateMetrics])

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }
    },
    [],
  )

  return { handleScroll, isScrolling, metrics, scrollRef }
}
