import { forwardRef, useId, type ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  hideTooltipOnFocus?: boolean
  icon: LucideIcon
  label: string
  showLabel?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    className = '',
    hideTooltipOnFocus = false,
    icon: Icon,
    label,
    showLabel = false,
    type = 'button',
    ...buttonProps
  },
  ref,
) {
  const tooltipId = useId()

  return (
    <button
      {...buttonProps}
      aria-describedby={tooltipId}
      aria-label={label}
      className={`icon-button ${showLabel ? 'icon-button--labelled' : ''} ${
        hideTooltipOnFocus ? 'icon-button--quiet-focus' : ''
      } ${className}`.trim()}
      ref={ref}
      type={type}
    >
      <Icon aria-hidden="true" size={25} strokeWidth={2.15} />
      {showLabel ? <span className="icon-button__label">{label}</span> : null}
      <span className="icon-tooltip" id={tooltipId} role="tooltip">
        {label}
      </span>
    </button>
  )
})
