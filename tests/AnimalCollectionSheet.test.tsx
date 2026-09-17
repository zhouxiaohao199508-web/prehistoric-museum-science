import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  AnimalCollectionSheet,
  type CollectionAnimal,
} from '../src/components/AnimalCollectionSheet'
import { I18nProvider } from '../src/i18n/I18nProvider'

const mockAnimals: CollectionAnimal[] = [
  { id: 'stegosaurus', name: '剑龙', classification: '装甲类恐龙', thumbnail: '/stego.webp', habitat: 'land' },
  { id: 'tyrannosaurus-rex', name: '霸王龙', classification: '兽脚类恐龙', thumbnail: '/trex.webp', habitat: 'land' },
  { id: 'pteranodon', name: '无齿翼龙', classification: '翼龙目', thumbnail: '/pteranodon.webp', habitat: 'air' },
  { id: 'tupandactylus', name: '古神翼龙', classification: '翼龙目', thumbnail: '/tupan.webp', habitat: 'air' },
  { id: 'ichthyosaur', name: '鱼龙', classification: '鱼龙目', thumbnail: '/ichthyo.webp', habitat: 'water' },
  { id: 'mosasaurus', name: '沧龙', classification: '有鳞目海生爬行动物', thumbnail: '/mosa.webp', habitat: 'water' },
]

describe('AnimalCollectionSheet', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  function renderSheet(props: Partial<Parameters<typeof AnimalCollectionSheet>[0]> = {}) {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const returnFocusTo = { current: null }

    const result = render(
      <I18nProvider initialState={{ locale: 'zh-CN', preference: 'zh-CN' }}>
        <AnimalCollectionSheet
          animals={mockAnimals}
          currentAnimalId="stegosaurus"
          loadingAnimalId={null}
          loadingPhase={null}
          loadingPercent={null}
          onClose={onClose}
          onSelect={onSelect}
          open={true}
          returnFocusTo={returnFocusTo}
          {...props}
        />
      </I18nProvider>,
    )

    return { ...result, onSelect, onClose }
  }

  it('renders continuous ecological zones and altitude rail', () => {
    renderSheet()

    expect(screen.getByRole('heading', { name: '全馆图鉴' })).toBeInTheDocument()
    expect(screen.getByLabelText('史前地球垂直生态长卷')).toBeInTheDocument()
    expect(screen.getByLabelText('生态海拔升降梯操纵轨')).toBeInTheDocument()

    // Check elevator zones
    expect(screen.getByRole('heading', { name: /远古苍穹/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /原始大地/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /蔚蓝海洋/ })).toBeInTheDocument()

    // All 6 cards exist simultaneously without layout destruction
    const cards = screen.getAllByRole('button', { name: /展台/ })
    expect(cards).toHaveLength(6)

    // Living creature beacon exists
    expect(screen.getByLabelText(/当前生境/)).toBeInTheDocument()
  })

  it('intelligently initializes to water habitat when current animal is an ocean creature', () => {
    renderSheet({ currentAnimalId: 'ichthyosaur' })

    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveAttribute('data-habitat', 'water')
    expect(screen.getByLabelText(/当前生境：海洋游鱼/)).toBeInTheDocument()
  })

  it('switches living creature beacon when clicking habitat totem nodes', () => {
    renderSheet({ currentAnimalId: 'stegosaurus' })

    // Stegosaurus is land
    expect(screen.getByLabelText(/当前生境：大地剑龙/)).toBeInTheDocument()

    // Click Sea waypoint
    const seaNode = screen.getByRole('button', { name: /海洋/ })
    fireEvent.click(seaNode)

    expect(screen.getByLabelText(/当前生境：海洋游鱼/)).toBeInTheDocument()
  })

  it('calls onSelect when an animal card is clicked', () => {
    const { onSelect } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: /前往无齿翼龙展台/ }))
    expect(onSelect).toHaveBeenCalledWith('pteranodon')
  })

  it('synchronously aligns activeHabitat when opening with an ocean creature', () => {
    const { rerender } = render(
      <I18nProvider initialState={{ locale: 'zh-CN', preference: 'zh-CN' }}>
        <AnimalCollectionSheet
          animals={mockAnimals}
          currentAnimalId="ichthyosaur"
          loadingAnimalId={null}
          loadingPhase={null}
          loadingPercent={null}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          open={false}
          returnFocusTo={{ current: null }}
        />
      </I18nProvider>,
    )

    // Open sheet
    rerender(
      <I18nProvider initialState={{ locale: 'zh-CN', preference: 'zh-CN' }}>
        <AnimalCollectionSheet
          animals={mockAnimals}
          currentAnimalId="ichthyosaur"
          loadingAnimalId={null}
          loadingPhase={null}
          loadingPercent={null}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          open={true}
          returnFocusTo={{ current: null }}
        />
      </I18nProvider>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-habitat', 'water')
    expect(screen.getByLabelText(/当前生境：海洋游鱼/)).toBeInTheDocument()
  })
})
