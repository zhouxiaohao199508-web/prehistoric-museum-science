/**
 * ElevatorContinuousView.tsx
 * Level 3: 空间连贯突破 —— 垂直生态升降梯 (Continuous Vertical Elevator)
 *
 * 核心设计哲学：
 * 1. 视窗定海神针 (Rock-Solid Fixed Stage)：外框高度恒定锁定，绝不因内容产生 1px 的高度晃动。
 * 2. 空间永续 (Spatial Permanence)：海陆空 24 只史前生物全部并存于地球垂直生态长卷中，零删卡、零卡片颠簸动效。
 * 3. 灵动生灵生态柱 (Living Creature Totem)：儿童视角直觉图标（☁️ 苍穹白云 / ⛰️ 原始大山 / 🌊 深海波浪），滑动信标随生境在飞鸟、剑龙、游鱼间优雅流转。
 * 4. 迟滞缓冲 (Hysteresis Tracking)：宽裕的视窗交叉判定，避免滑动几像素过早切出生境。
 * 5. 隐形自适应轻质滚动条 (Transient Scrollbar)：接入博物馆统一的平滑浮现与淡出滚动指示，随生境色彩自适应。
 * 6. 完整双语支持 (Bilingual i18n)：全馆多语言无缝切换。
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type UIEvent,
} from 'react'
import type { CollectionAnimal } from '../AnimalCollectionSheet'
import type { Habitat } from '../../content/types'
import { LivingCreatureBeacon } from './LivingCreatureBeacon'
import { useTransientScrollbar } from '../useTransientScrollbar'
import { TransientScrollbar } from '../TransientScrollbar'
import { useI18n } from '../../i18n/I18nProvider'

export interface ElevatorContinuousViewProps {
  readonly animals: readonly CollectionAnimal[]
  readonly currentAnimalId?: string | null
  readonly renderCard: (animal: CollectionAnimal, index?: number) => JSX.Element
  readonly onHabitatInViewChange?: (habitat: Habitat) => void
}

interface ElevationStationConfig {
  readonly id: Habitat
  readonly sectionId: string
  readonly glyph: string
}

const STATIONS: readonly ElevationStationConfig[] = [
  {
    id: 'air',
    sectionId: 'elevator-section-air',
    glyph: '☁️', // Child-friendly intuitive cloud
  },
  {
    id: 'land',
    sectionId: 'elevator-section-land',
    glyph: '⛰️', // Child-friendly primeval mountain
  },
  {
    id: 'water',
    sectionId: 'elevator-section-water',
    glyph: '🌊', // Child-friendly ocean wave
  },
]

export function ElevatorContinuousView({
  animals,
  currentAnimalId,
  renderCard,
  onHabitatInViewChange,
}: ElevatorContinuousViewProps) {
  const { messages } = useI18n()

  // Find current animal's habitat for initial intelligent location
  const currentAnimal = useMemo(
    () => (currentAnimalId ? animals.find((a) => a.id === currentAnimalId) : null),
    [animals, currentAnimalId],
  )
  const initialHabitat: Habitat = currentAnimal?.habitat || 'air'

  const [activeStation, setActiveStation] = useState<Habitat>(initialHabitat)
  const isProgrammaticScrollRef = useRef(false)
  const hasAutoScrolledRef = useRef(false)

  // Transient scrollbar integration
  const {
    handleScroll: handleTransientScroll,
    isScrolling,
    metrics,
    scrollRef,
  } = useTransientScrollbar(true)

  // Group animals by continuous vertical ecology
  const airAnimals = useMemo(
    () => animals.filter((a) => a.habitat === 'air'),
    [animals],
  )
  const landAnimals = useMemo(
    () => animals.filter((a) => a.habitat === 'land'),
    [animals],
  )
  const waterAnimals = useMemo(
    () => animals.filter((a) => a.habitat === 'water'),
    [animals],
  )

  // Smooth camera elevator scroll to target elevation station
  const scrollToStation = useCallback(
    (stationId: Habitat) => {
      const station = STATIONS.find((s) => s.id === stationId)
      if (!station) return

      const container = scrollRef.current
      if (!container) return

      const targetEl = container.querySelector<HTMLElement>(`#${station.sectionId}`)
      if (!targetEl) return

      isProgrammaticScrollRef.current = true
      setActiveStation(stationId)
      onHabitatInViewChange?.(stationId)

      // Calculate target offset within the scrollable container
      const targetOffset = targetEl.offsetTop > 0
        ? targetEl.offsetTop - 8
        : Math.max(0, targetEl.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8)

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: Math.max(0, targetOffset),
          behavior: 'smooth',
        })
      } else {
        container.scrollTop = Math.max(0, targetOffset)
      }

      // Reset programmatic flag after smooth animation
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 550)
    },
    [onHabitatInViewChange, scrollRef],
  )

  // Initial pre-paint instant scroll directly to current animal's card or habitat section
  useLayoutEffect(() => {
    if (hasAutoScrolledRef.current) return
    const container = scrollRef.current
    if (!container) return

    const station = STATIONS.find((s) => s.id === initialHabitat)
    if (!station) return

    const targetCard = currentAnimalId
      ? container.querySelector<HTMLElement>(`[data-collection-animal-id="${currentAnimalId}"]`)
      : null
    const targetSection = container.querySelector<HTMLElement>(`#${station.sectionId}`)

    if (targetCard || targetSection) {
      hasAutoScrolledRef.current = true
      isProgrammaticScrollRef.current = true
      setActiveStation(initialHabitat)

      const containerRect = container.getBoundingClientRect()
      let targetOffset = 0

      if (targetCard) {
        const cardRect = targetCard.getBoundingClientRect()
        const relativeCardTop = cardRect.top - containerRect.top + container.scrollTop
        // Center the target animal card vertically in the scroll container
        const idealCenter = relativeCardTop - (container.clientHeight - targetCard.clientHeight) / 2
        targetOffset = Math.max(0, idealCenter)
      } else if (targetSection) {
        targetOffset = targetSection.offsetTop > 0
          ? targetSection.offsetTop
          : Math.max(0, targetSection.getBoundingClientRect().top - containerRect.top + container.scrollTop)
      }

      // Ensure zero animated scrolling during initial positioning
      container.style.scrollBehavior = 'auto'
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: Math.max(0, targetOffset), behavior: 'instant' })
      } else {
        container.scrollTop = Math.max(0, targetOffset)
      }

      // Reinforce in case of any dynamic sub-pixel layout settling
      requestAnimationFrame(() => {
        if (!container) return
        const cRect = container.getBoundingClientRect()
        const card = currentAnimalId
          ? container.querySelector<HTMLElement>(`[data-collection-animal-id="${currentAnimalId}"]`)
          : null
        if (card) {
          const cardR = card.getBoundingClientRect()
          const rTop = cardR.top - cRect.top + container.scrollTop
          const ideal = Math.max(0, rTop - (container.clientHeight - card.clientHeight) / 2)
          if (Math.abs(container.scrollTop - ideal) > 2) {
            container.scrollTop = ideal
          }
        }
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false
        })
      })
    }
  }, [currentAnimalId, initialHabitat, scrollRef])

  // Scroll listener with hysteresis buffer: track active habitat without jitter
  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      handleTransientScroll(e)

      if (isProgrammaticScrollRef.current) return
      const container = scrollRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const vTop = containerRect.top
      const vBottom = containerRect.bottom
      const vHeight = containerRect.height

      // Measure visible overlap height of each section
      let dominantStation: Habitat = activeStation
      let maxOverlap = 0
      let currentActiveOverlap = 0

      for (const s of STATIONS) {
        const el = container.querySelector<HTMLElement>(`#${s.sectionId}`)
        if (!el) continue

        const rect = el.getBoundingClientRect()
        const overlapTop = Math.max(vTop, rect.top)
        const overlapBottom = Math.min(vBottom, rect.bottom)
        const visibleH = Math.max(0, overlapBottom - overlapTop)

        if (s.id === activeStation) {
          currentActiveOverlap = visibleH
        }

        if (visibleH > maxOverlap) {
          maxOverlap = visibleH
          dominantStation = s.id
        }
      }

      // Hysteresis threshold: if current active section still occupies >= 38% of viewport,
      // retain it to prevent premature flicking when slightly scrolling
      const currentActiveRatio = currentActiveOverlap / vHeight
      if (currentActiveRatio >= 0.38) {
        return
      }

      if (dominantStation !== activeStation) {
        setActiveStation(dominantStation)
        onHabitatInViewChange?.(dominantStation)
      }
    },
    [activeStation, handleTransientScroll, onHabitatInViewChange, scrollRef],
  )

  // Determine active index for beacon positioning (0: Air, 1: Land, 2: Water)
  const stationIndex = STATIONS.findIndex((s) => s.id === activeStation)

  const totemLabels: Record<Habitat, string> = {
    air: messages.collection.elevatorTotemAir,
    land: messages.collection.elevatorTotemLand,
    water: messages.collection.elevatorTotemWater,
  }

  return (
    <div className="elevator-layout">
      {/* 1. Continuous Vertical Strata Viewport with Transient Scrollbar */}
      <div className="elevator-viewport-wrapper">
        <div
          aria-label="史前地球垂直生态长卷"
          className="elevator-scrollable"
          onScroll={handleScroll}
          ref={scrollRef}
        >
          {/* +500m Sky Zone */}
          <section
            aria-labelledby="elevator-heading-air"
            className="elevator-zone elevator-zone--air"
            id="elevator-section-air"
          >
            <header className="elevator-zone__header">
              <div className="elevator-zone__badge">
                <span aria-hidden="true" className="elevator-zone__icon">🌤️</span>
                <h3 id="elevator-heading-air">{messages.collection.elevatorStrataSky}</h3>
              </div>
              <span className="elevator-zone__count">
                {messages.collection.elevatorAirCount(airAnimals.length)}
              </span>
            </header>
            <div className="collection-grid" data-habitat="air" role="list">
              {airAnimals.map((animal, idx) => renderCard(animal, idx))}
            </div>
          </section>

          {/* Strata Horizon Divider: Sky to Earth */}
          <div aria-hidden="true" className="elevator-strata-divider elevator-strata-divider--air-land">
            <span className="elevator-strata-line" />
            <span className="elevator-strata-tag">{messages.collection.elevatorHorizonSkyLand}</span>
            <span className="elevator-strata-line" />
          </div>

          {/* 0m Primeval Land Zone */}
          <section
            aria-labelledby="elevator-heading-land"
            className="elevator-zone elevator-zone--land"
            id="elevator-section-land"
          >
            <header className="elevator-zone__header">
              <div className="elevator-zone__badge">
                <span aria-hidden="true" className="elevator-zone__icon">⛰️</span>
                <h3 id="elevator-heading-land">{messages.collection.elevatorStrataLand}</h3>
              </div>
              <span className="elevator-zone__count">
                {messages.collection.elevatorLandCount(landAnimals.length)}
              </span>
            </header>
            <div className="collection-grid" data-habitat="land" role="list">
              {landAnimals.map((animal, idx) => renderCard(animal, idx))}
            </div>
          </section>

          {/* Strata Horizon Divider: Land to Sea */}
          <div aria-hidden="true" className="elevator-strata-divider elevator-strata-divider--land-water">
            <span className="elevator-strata-line" />
            <span className="elevator-strata-tag">{messages.collection.elevatorHorizonLandSea}</span>
            <span className="elevator-strata-line" />
          </div>

          {/* -200m Abyss Ocean Zone */}
          <section
            aria-labelledby="elevator-heading-water"
            className="elevator-zone elevator-zone--water"
            id="elevator-section-water"
          >
            <header className="elevator-zone__header">
              <div className="elevator-zone__badge">
                <span aria-hidden="true" className="elevator-zone__icon">🌊</span>
                <h3 id="elevator-heading-water">{messages.collection.elevatorStrataWater}</h3>
              </div>
              <span className="elevator-zone__count">
                {messages.collection.elevatorWaterCount(waterAnimals.length)}
              </span>
            </header>
            <div className="collection-grid" data-habitat="water" role="list">
              {waterAnimals.map((animal, idx) => renderCard(animal, idx))}
            </div>
          </section>
        </div>

        {/* Elegant Transient Scrollbar (fades in on scroll, out when idle, themed by habitat) */}
        <TransientScrollbar isScrolling={isScrolling} metrics={metrics} />
      </div>

      {/* 2. Kid-Friendly Living Creature Totem Guide (Intuitive Icons & Bilingual) */}
      <aside
        aria-label="生态海拔升降梯操纵轨"
        className="elevator-totem-shaft"
      >
        <div className="elevator-totem-shaft__track">
          {/* Moving Living Creature Beacon (Responsive slider driven by CSS custom property) */}
          <div
            className="elevator-totem-shaft__slider"
            style={
              {
                '--station-index': Math.max(0, stationIndex),
              } as React.CSSProperties
            }
          >
            <LivingCreatureBeacon currentHabitat={activeStation} />
          </div>

          {/* Habitat Waypoint Buttons */}
          <div className="elevator-totem-shaft__nodes">
            {STATIONS.map((station) => {
              const active = activeStation === station.id
              const label = totemLabels[station.id]

              return (
                <button
                  aria-current={active ? 'true' : undefined}
                  aria-label={`${messages.collection.filterByHabitat(label)}`}
                  className="elevator-totem-shaft__node-btn"
                  data-active={active}
                  key={station.id}
                  onClick={() => scrollToStation(station.id)}
                  title={label}
                  type="button"
                >
                  <span className="elevator-totem-shaft__node-glyph" aria-hidden="true">
                    {station.glyph}
                  </span>
                  <span className="elevator-totem-shaft__node-label">
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}
