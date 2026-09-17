import { Bone, Eye, Rotate3D, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

interface SkeletonViewerDrawerProps {
  readonly animalId: string
  readonly animalName: string
  readonly open: boolean
  readonly onClose: () => void
}

const SKELETON_MODEL_URL = 'https://zenodo.org/records/21530057/files/e9fa58a7f25645db99b9519073c88b40_normalized-0.100.glb?download=1'

const SKELETON_SOURCES: Record<string, { title: string; note: string }> = {
  'tyrannosaurus-rex': {
    title: '霸王龙骨骼 · 站内3D观察',
    note: '观察霸王龙的头骨、脊柱、短小前肢和粗壮后肢。拖动模型，从不同方向寻找能帮助古生物学家复原身体外形的骨骼证据。',
  },
  triceratops: {
    title: '三角龙骨骼 · 站内3D观察',
    note: '观察三角龙的三只角、巨大颈盾、脊柱和四肢。拖动模型，想一想：哪些骨骼特征最能帮助我们认出三角龙？',
  },
}

// eslint-disable-next-line react-refresh/only-export-components
export function hasSkeletonViewer(animalId: string) {
  return animalId in SKELETON_SOURCES
}

function SkeletonCanvas({ active }: { readonly active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!active || !hostRef.current) return
    const host = hostRef.current
    setStatus('loading')

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf1eee5)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000)
    camera.position.set(0, 1.6, 7)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45

    scene.add(new THREE.HemisphereLight(0xffffff, 0x665544, 2.2))
    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(4, 8, 5)
    scene.add(key)

    const resize = () => {
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let disposed = false
    let frame = 0
    const loader = new GLTFLoader()
    loader.load(
      SKELETON_MODEL_URL,
      (gltf) => {
        if (disposed) return
        const model = gltf.scene
        scene.add(model)
        model.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        const maxDim = Math.max(size.x, size.y, size.z)
        const distance = maxDim > 0 ? maxDim * 1.35 : 7
        camera.position.set(distance * 0.35, distance * 0.18, distance)
        camera.near = Math.max(distance / 1000, 0.01)
        camera.far = distance * 20
        camera.updateProjectionMatrix()
        controls.target.set(0, 0, 0)
        controls.update()
        setStatus('ready')
      },
      undefined,
      () => {
        if (!disposed) setStatus('error')
      },
    )

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      // Three.js Mesh material/geometry runtime types are safe to dispose here.
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material?.dispose())
        }
      })
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    }
  }, [active])

  return (
    <div ref={hostRef} style={{ height: '100%', minHeight: 360, position: 'relative', width: '100%' }}>
      {status === 'loading' && <div style={{ inset: 0, display: 'grid', placeItems: 'center', position: 'absolute', zIndex: 2, fontWeight: 700 }}>正在加载3D骨骼，请稍候…</div>}
      {status === 'error' && <div style={{ inset: 0, display: 'grid', placeItems: 'center', padding: 24, position: 'absolute', zIndex: 2, textAlign: 'center' }}>骨骼模型暂时没有加载成功，请检查网络后重新打开。比赛前打开一次可提前确认网络环境。</div>}
    </div>
  )
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
        <div className="skeleton-viewer-frame-wrap" style={{ minHeight: 360, position: 'relative' }}>
          <SkeletonCanvas active={open} />
          <div style={{ alignItems: 'center', background: 'rgba(255,255,255,.82)', borderRadius: 999, bottom: 12, display: 'flex', fontSize: 13, gap: 6, left: '50%', padding: '7px 12px', position: 'absolute', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}><Rotate3D aria-hidden="true" size={16} /> 鼠标拖动旋转 · 滚轮缩放</div>
        </div>
        <div className="skeleton-viewer-reveal">
          <div>
            <strong>你猜出它原来的样子了吗？</strong>
            <p>先根据骨骼说出你的推测，再揭晓古生物学家依据化石证据复原出的恐龙形象。</p>
          </div>
          <button className="skeleton-viewer-reveal-button" onClick={onClose} type="button"><Eye aria-hidden="true" size={19} /> 揭晓复原形象</button>
        </div>
        <footer className="skeleton-viewer-footer">
          <span>3D骨骼资料：Smithsonian Digitization Program Office 数据的教育展示版本；用于非商业科学教学。</span>
        </footer>
      </section>
    </div>
  )
}
