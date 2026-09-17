import { Bone, ExternalLink, Eye, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface SkeletonViewerDrawerProps {
  readonly animalId: string
  readonly animalName: string
  readonly open: boolean
  readonly onClose: () => void
}

const SKELETON_SOURCES: Record<string, { title: string; url: string; note: string }> = {
  'tyrannosaurus-rex': {
    title: '霸王龙骨骼 · Smithsonian 3D',
    url: 'https://3d.si.edu/object/3d/tyrannosaurus-and-triceratops%3Ad8c62d28-4ebc-11ea-b77f-2e728ce88125',
    note: '观察头骨、脊柱、前肢和粗壮的后肢。想一想：古生物学家能从这些骨骼中推测出霸王龙身体的哪些特点？',
  },
  triceratops: {
    title: '三角龙骨骼 · Smithsonian 3D',
    url: 'https://3d.si.edu/object/3d/triceratops-horridus-marsh-1889%3Ad8c623be-4ebc-11ea-b77f-2e728ce88125',
    note: '观察三只角、巨大的颈盾、脊柱和四肢。想一想：哪些骨骼证据能帮助古生物学家复原三角龙的外形？',
  },
}

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
    <div className="skeleton-viewer-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
        <div className="skeleton-viewer-frame-wrap">
          <iframe allow="fullscreen; xr-spatial-tracking" className="skeleton-viewer-frame" loading="lazy" src={source.url} title={source.title} />
        </div>
        <div className="skeleton-viewer-reveal">
          <div>
            <strong>你猜出它原来的样子了吗？</strong>
            <p>先根据骨骼说出你的推测，再揭晓古生物学家依据化石证据复原出的恐龙形象。</p>
          </div>
          <button className="skeleton-viewer-reveal-button" onClick={onClose} type="button">
            <Eye aria-hidden="true" size={19} />
            揭晓复原形象
          </button>
        </div>
        <footer className="skeleton-viewer-footer">
          <span>3D骨骼资料来源：Smithsonian 3D（史密森尼学会）</span>
          <a href={source.url} rel="noreferrer" target="_blank">如果上方模型未显示，点击打开官方3D骨骼 <ExternalLink aria-hidden="true" size={16} /></a>
        </footer>
      </section>
    </div>
  )
}
