import type { CSSProperties } from 'react'
import type { ScrollbarMetrics } from './useTransientScrollbar'

interface ScrollbarVisualStyle extends CSSProperties {
  '--museum-scrollbar-thumb-offset': string
  '--museum-scrollbar-thumb-size': string
}

interface TransientScrollbarProps {
  readonly isScrolling: boolean
  readonly metrics: ScrollbarMetrics
}

export function TransientScrollbar({
  isScrolling,
  metrics,
}: TransientScrollbarProps) {
  const style: ScrollbarVisualStyle = {
    '--museum-scrollbar-thumb-offset': `${metrics.thumbOffset}px`,
    '--museum-scrollbar-thumb-size': `${metrics.thumbSize}px`,
  }

  return (
    <div
      aria-hidden="true"
      className="museum-scrollbar-visual"
      data-scrollable={metrics.isScrollable}
      data-visible={metrics.isScrollable && isScrolling}
      style={style}
    >
      <span />
    </div>
  )
}
