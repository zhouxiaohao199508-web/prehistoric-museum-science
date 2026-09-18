import { Bone, Eye, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface SkeletonViewerDrawerProps {
  readonly animalId: string
  readonly animalName: string
  readonly open: boolean
  readonly onClose: () => void
}

const TYRANNOSAURUS_SKELETON_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/6/68/Stan_T._rex_in_Oslo_white_background.jpg'
const TRICERATOPS_SKELETON_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/8/8e/Triceratops_Skeleton_Senckenberg_2a_White_Background.jpg'

const SKELETON_SOURCES: Record<string, { title: string; note: string; image: string; alt: string; credit: string }> = {
  'tyrannosaurus-rex': {
    title: '霸王龙骨骼 · 化石证据观察',
    note: '观察霸王龙的巨大头骨、脊柱、短小前肢、粗壮后肢和长尾。想一想：仅仅根据这些骨骼证据，你能推测出霸王龙原来的样子吗？',
    image: TYRANNOSAURUS_SKELETON_IMAGE,
    alt: '霸王龙骨骼化石侧面图',
    credit: '霸王龙骨骼参考图：Stan T. rex skeleton replica，Wikimedia Commons。',
  },
  triceratops: {
    title: '三角龙骨骼 · 化石证据观察',
    note: '观察三角龙的三只角、巨大颈盾、脊柱、肋骨和粗壮四肢。想一想：仅仅根据这些骨骼证据，你能推测出三角龙原来的样子吗？',
    image: TRICERATOPS_SKELETON_IMAGE,
    alt: '三角龙完整骨骼侧面图',
    credit: '三角龙骨骼参考图：Senckenberg Museum Triceratops skeleton，EvaK / Wikimedia Commons。',
  },
}

// eslint-disable-next-line react-refresh/only-export-components
export function hasSkeletonViewer(animalId: string) {
  return animalId in SKELETON_SOURCES
}

export function SkeletonViewerDrawer({ animalId, animalName, open, onClose }: SkeletonViewerDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const source = SKELETON_SOURCES[animalId]

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !source) return null

  return (
    <div className="skeleton-viewer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-label={`${animalName}骨骼观察`} aria-modal="true" className="skeleton-viewer-drawer" role="dialog">
        <header className="skeleton-viewer-header">
          <div>
            <div className="skeleton-viewer-eyebrow"><Bone aria-hidden="true" size={18} /> 化石证据</div>
            <h2>{source.title}</h2>
          </div>
          <button aria-label="关闭骨骼观察" className="skeleton-viewer-close" onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" /></button>
        </header>

        <div className="skeleton-viewer-teaching">
          <strong>从骨骼到复原</strong>
          <p>{source.note}</p>
          <div className="skeleton-viewer-process" aria-label="古生物复原过程">
            <span>① 发现化石</span><b>→</b><span>② 观察骨骼</span><b>→</b><span>③ 比较与推测</span><b>→</b><span>④ 复原形象</span>
          </div>
        </div>

        <div className="skeleton-viewer-frame-wrap" style={{ alignItems: 'center', background: '#fff', display: 'flex', justifyContent: 'center', minHeight: 360, overflow: 'hidden', padding: '10px 16px', position: 'relative' }}>
          <img
            alt={source.alt}
            src={source.image}
            style={{ display: 'block', height: 'auto', maxHeight: '56vh', maxWidth: '100%', objectFit: 'contain', width: '100%' }}
          />
        </div>

        <div className="skeleton-viewer-reveal">
          <div>
            <strong>你猜出它原来的样子了吗？</strong>
            <p>先根据骨骼说出你的推测，再揭晓古生物学家依据化石证据复原出的{animalName}形象。</p>
          </div>
          <button className="skeleton-viewer-reveal-button" onClick={onClose} type="button"><Eye aria-hidden="true" size={19} /> 揭晓复原形象</button>
        </div>

        <footer className="skeleton-viewer-footer">
          <span>{source.credit}</span>
        </footer>
      </section>
    </div>
  )
}
