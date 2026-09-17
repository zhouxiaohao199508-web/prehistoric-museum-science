/**
 * LivingCreatureBeacon.tsx
 * Level 3 空间连贯方案：灵动生态生灵信标 (Living Creature Beacon)
 *
 * 核心设计哲学：
 * 1. 拟生隐喻：用儿童一目了然的史前生物剪影（苍穹飞鸟、大地剑龙、深渊游鱼）替代枯燥的 SaaS 文字与冰冷参数。
 * 2. 流动演化：伴随生境切换，生灵在信标内产生流体姿态变化与环境微光（气流/大地/水纹）。
 * 3. 极简自然：融入博物馆暖纸质感与多语言无障碍标签。
 */

import type { Habitat } from '../../content/types'
import { useI18n } from '../../i18n/I18nProvider'

export interface LivingCreatureBeaconProps {
  readonly currentHabitat: Habitat
  readonly className?: string
}

export function LivingCreatureBeacon({
  currentHabitat,
  className = '',
}: LivingCreatureBeaconProps) {
  const { messages } = useI18n()

  const beaconLabel =
    currentHabitat === 'air'
      ? messages.collection.elevatorBeaconAir
      : currentHabitat === 'land'
        ? messages.collection.elevatorBeaconLand
        : messages.collection.elevatorBeaconWater

  return (
    <div
      aria-label={beaconLabel}
      className={`living-creature-beacon ${className}`.trim()}
      data-habitat={currentHabitat}
    >
      <div className="living-creature-beacon__halo" aria-hidden="true" />
      <div className="living-creature-beacon__vessel">
        {/* 1. Air Habitat: Soaring Bird / Pterosaur with unmistakable outstretched wings */}
        <div
          aria-hidden={currentHabitat !== 'air'}
          className="creature-figure creature-figure--air"
          data-active={currentHabitat === 'air'}
        >
          <svg
            className="creature-svg creature-svg--bird"
            viewBox="0 0 64 64"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Wind breeze trail */}
            <path
              className="creature-air-wind"
              d="M8 20 C18 17, 28 22, 38 19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.4"
            />
            <path
              className="creature-air-wind creature-air-wind--delay"
              d="M12 44 C22 41, 32 46, 42 43"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.3"
            />

            {/* Recognizable Soaring Bird Silhouette */}
            {/* Head & Beak pointing up-forward */}
            <path
              d="M32 12 C34 12, 37 14, 40 17 L48 18 C45 21, 41 22, 38 23 C37 25, 36 28, 35 32 C35 37, 36 43, 37 48 L32 54 L27 48 C28 43, 29 37, 29 32 C28 28, 27 25, 26 23 C23 22, 19 21, 16 18 L24 17 C27 14, 30 12, 32 12 Z"
            />
            {/* Left Outspread Wing with layered feathers */}
            <path
              d="M27 25 C20 19, 11 16, 5 18 C3 23, 7 30, 15 34 C20 36, 25 36, 28 34 Z"
            />
            <path
              d="M6 19 C10 24, 15 28, 22 30"
              fill="none"
              stroke="#fffdf7"
              strokeWidth="1.2"
              opacity="0.4"
            />
            {/* Right Outspread Wing with layered feathers */}
            <path
              d="M37 25 C44 19, 53 16, 59 18 C61 23, 57 30, 49 34 C44 36, 39 36, 36 34 Z"
            />
            <path
              d="M58 19 C54 24, 49 28, 42 30"
              fill="none"
              stroke="#fffdf7"
              strokeWidth="1.2"
              opacity="0.4"
            />
            {/* Eye points */}
            <circle cx="34" cy="18" r="1.3" fill="#fffdf7" />
          </svg>
        </div>

        {/* 2. Land Habitat: Walking Stegosaurus with Dorsal Plates */}
        <div
          aria-hidden={currentHabitat !== 'land'}
          className="creature-figure creature-figure--land"
          data-active={currentHabitat === 'land'}
        >
          <svg
            className="creature-svg creature-svg--stegosaurus"
            viewBox="0 0 64 64"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ground ripples / mountain ridge */}
            <path
              d="M8 50 C18 49, 46 49, 56 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.3"
            />
            {/* Dorsal Plates (dermal armor) */}
            <path
              d="M20 25 L23 16 L27 24 M27 23 L31 13 L36 22 M36 23 L41 15 L45 25 M15 28 L17 21 L20 27"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Stegosaurus stout body */}
            <ellipse cx="32" cy="34" rx="17" ry="11" />
            {/* Small head & neck */}
            <path
              d="M45 32 C48 31, 53 32, 57 34 C58 35, 57 38, 54 38 C50 38, 47 36, 44 36 Z"
            />
            <circle cx="53" cy="34" r="1.2" fill="#fffdf7" />
            {/* Sturdy legs */}
            <path
              d="M21 41 L20 48 M27 41 L27 48 M37 41 L37 48 M43 41 L44 48"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Tail & Thagomizer spikes */}
            <path
              d="M17 33 C12 34, 8 36, 6 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M8 35 L5 32 M8 38 L4 41"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* 3. Water Habitat: Robust Majestic Ichthyosaur / Ancient Marine Giant */}
        <div
          aria-hidden={currentHabitat !== 'water'}
          className="creature-figure creature-figure--water"
          data-active={currentHabitat === 'water'}
        >
          <svg
            className="creature-svg creature-svg--ichthyosaur"
            viewBox="0 0 64 64"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Water wake & bubble currents */}
            <path
              className="creature-water-wave"
              d="M4 48 C15 44, 25 51, 38 46 C48 42, 56 46, 60 44"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.35"
            />
            <circle cx="56" cy="18" r="1.5" opacity="0.3" />
            <circle cx="60" cy="24" r="1" opacity="0.4" />

            {/* Robust, Muscular Marine Body (Fuller proportions matching Bird and Stegosaurus) */}
            <path
              d="M58 29 C54 24, 46 19, 36 20 C24 21, 16 28, 11 31 C8 26, 5 19, 3 17 C4 26, 5 37, 3 46 C6 44, 8 37, 12 36 C17 36, 24 43, 35 43 C47 43, 54 36, 58 29 Z"
            />
            {/* Majestic Dorsal Fin */}
            <path
              d="M28 20 L33 10 L38 20 Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Broad Front Pectoral Flipper */}
            <path
              d="M37 36 C40 44, 38 52, 33 54 C32 52, 33 45, 35 37 Z"
              opacity="0.95"
            />
            {/* Rear Pelvic Flipper */}
            <path
              d="M20 37 C21 43, 20 48, 17 50 C16 48, 17 43, 19 37 Z"
              opacity="0.85"
            />
            {/* Powerful Crescent Tail Fluke */}
            <path
              d="M12 33 C8 31, 4 23, 2 18 C4 26, 5 36, 3 45 C5 41, 9 35, 12 34 Z"
              opacity="0.95"
            />
            {/* Luminous Eye Point */}
            <circle cx="49" cy="27" r="1.6" fill="#fffdf7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
