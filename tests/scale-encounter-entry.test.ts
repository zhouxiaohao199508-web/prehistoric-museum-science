import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadDirectScaleEncounter } from 'virtual:scale-encounter-entry'

describe('scale encounter module boundary', () => {
  it('loads the real encounter entry in test mode', async () => {
    expect(loadDirectScaleEncounter).not.toBeNull()

    const module = await loadDirectScaleEncounter?.()

    expect(module?.DirectScaleEncounter).toBeTypeOf('function')
  })

  it('uses the museum primary green for every animal entry button', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
    const entryRule = styles.match(/\.scale-encounter-entry \{([\s\S]*?)\n\}/)?.[1]

    expect(entryRule).toContain('var(--leaf)')
    expect(entryRule).not.toContain('var(--animal-accent)')
  })

  it('pins the mobile playback panel inside both viewport edges', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
    const mobileStart = styles.indexOf('@media (max-width: 720px)')
    const mobileEnd = styles.indexOf(
      '@media (max-height: 620px)',
      mobileStart,
    )
    const mobileStyles = styles.slice(mobileStart, mobileEnd)
    const panelRule = mobileStyles.match(
      /\.scale-encounter-playback-panel \{([\s\S]*?)\n[ ]{2}\}/,
    )?.[1]

    expect(mobileStart).toBeGreaterThanOrEqual(0)
    expect(mobileEnd).toBeGreaterThan(mobileStart)
    expect(panelRule).toContain('position: fixed')
    expect(panelRule).toContain('right: max(12px, env(safe-area-inset-right))')
    expect(panelRule).toContain('left: max(12px, env(safe-area-inset-left))')
    expect(panelRule).toContain('width: auto')
    expect(panelRule).toContain('overflow-y: auto')
  })
})
