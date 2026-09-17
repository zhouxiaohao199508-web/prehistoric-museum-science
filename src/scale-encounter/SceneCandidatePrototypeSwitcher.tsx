import { useEffect } from 'react'

import {
  SCALE_ENCOUNTER_DEFINITIONS,
  type ScaleEncounterAnimalId,
} from '../viewer/scale-encounter'
import type { ScaleEncounterSceneCandidateVariant } from './environments/scene-candidate'

// PROTOTYPE — candidate environment architectures on the existing scale
// encounter route, shareable through ?scene-variant=. The switcher is
// deliberately unavailable in production builds.
interface SceneCandidatePrototypeSwitcherProps {
  readonly animalId: ScaleEncounterAnimalId
  readonly current: Exclude<ScaleEncounterSceneCandidateVariant, 'off'>
  readonly locale: 'en' | 'zh-CN'
  readonly onChange: (
    variant: Exclude<ScaleEncounterSceneCandidateVariant, 'off'>,
  ) => void
}

const mammothVariants = ['A', 'B', 'C', 'E'] as const
const radianceVariants = ['A', 'B', 'C', 'D'] as const

const mammothLabels = {
  A: { en: 'A — Photo baseline', 'zh-CN': 'A — 当前照片基线' },
  B: { en: 'B — Staggered ranges', 'zh-CN': 'B — 多层山系' },
  C: { en: 'C — Snow-valley depth', 'zh-CN': 'C — 雪谷纵深' },
  E: { en: 'E — Real DEM snow valley', 'zh-CN': 'E — 真实高程雪谷' },
} as const

const oceanLabels = {
  A: { en: 'A — Open-water backdrop', 'zh-CN': 'A — 开放水体背景' },
  B: { en: 'B — Water surface', 'zh-CN': 'B — 水面与体积' },
  C: { en: 'C — Current ocean', 'zh-CN': 'C — 当前海洋基线' },
  D: { en: 'D — One coherent water body', 'zh-CN': 'D — 同源水体纵深' },
} as const

const skyLabels = {
  A: { en: 'A — Clear-sky backdrop', 'zh-CN': 'A — 晴空背景' },
  B: { en: 'B — Flight volume', 'zh-CN': 'B — 飞行空间与远海' },
  C: { en: 'C — Accepted coastal sky', 'zh-CN': 'C — 已验收天空基线' },
  D: { en: 'D — One coherent sky light', 'zh-CN': 'D — 同源天空光照' },
} as const

function switcherLabel(
  animalId: ScaleEncounterAnimalId,
  variant: Exclude<ScaleEncounterSceneCandidateVariant, 'off'>,
  locale: 'en' | 'zh-CN',
): string {
  const radianceVariant = variant === 'E' ? 'D' : variant
  const theme = SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme
  if (theme === 'ocean') return oceanLabels[radianceVariant][locale]
  if (theme === 'sky') return skyLabels[radianceVariant][locale]
  return mammothLabels[variant === 'D' ? 'C' : variant === 'E' ? 'E' : variant][locale]
}

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.matches('input, textarea, select, [contenteditable="true"]') ||
    target.closest('[contenteditable="true"]') !== null
  )
}

export function SceneCandidatePrototypeSwitcher({
  animalId,
  current,
  locale,
  onChange,
}: SceneCandidatePrototypeSwitcherProps) {
  const prototypeEnabled =
    import.meta.env.MODE === 'development' || import.meta.env.MODE === 'e2e'
  const variants: readonly Exclude<
    ScaleEncounterSceneCandidateVariant,
    'off'
  >[] =
    SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme === 'glacier'
      ? mammothVariants
      : radianceVariants
  const currentIndex = variants.indexOf(current)
  const cycle = (direction: -1 | 1) => {
    const nextIndex =
      (currentIndex + direction + variants.length) % variants.length
    const next = variants[nextIndex]
    if (next) onChange(next)
  }

  useEffect(() => {
    if (!prototypeEnabled) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editableTarget(event.target)) return
      const direction =
        event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null
      if (direction === null) return
      event.preventDefault()
      const nextIndex =
        (currentIndex + direction + variants.length) % variants.length
      const next = variants[nextIndex]
      if (next) onChange(next)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, onChange, prototypeEnabled, variants])

  if (!prototypeEnabled) return null

  return (
    <div
      aria-label={
        locale === 'zh-CN'
          ? '三维环境候选方案'
          : '3D environment candidates'
      }
      className="scale-encounter-variant-switcher"
      role="group"
    >
      <button
        aria-label={locale === 'zh-CN' ? '上一个背景方案' : 'Previous background'}
        onClick={() => cycle(-1)}
        type="button"
      >
        ←
      </button>
      <span aria-live="polite">
        {switcherLabel(animalId, current, locale)}
      </span>
      <button
        aria-label={locale === 'zh-CN' ? '下一个背景方案' : 'Next background'}
        onClick={() => cycle(1)}
        type="button"
      >
        →
      </button>
    </div>
  )
}
