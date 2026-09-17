import { render, screen } from '@testing-library/react'
import { UnderwaterAtmosphere } from '../src/components/UnderwaterAtmosphere'

describe('UnderwaterAtmosphere', () => {
  it('is decorative, non-interactive, and uses a bounded set of CSS bubbles', () => {
    const { container } = render(<UnderwaterAtmosphere />)
    const atmosphere = container.querySelector('.underwater-atmosphere')

    expect(atmosphere).toHaveAttribute('aria-hidden', 'true')
    expect(atmosphere).not.toHaveAttribute('role')
    expect(container.querySelectorAll('.underwater-current')).toHaveLength(2)
    expect(container.querySelectorAll('.underwater-bubble')).toHaveLength(12)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
