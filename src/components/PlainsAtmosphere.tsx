const seedCount = 10

/**
 * Sparse seeds trace the crosswind while broad translucent bands suggest
 * near-ground air movement without a video or backdrop-filter effect.
 */
export function PlainsAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="scene-atmosphere plains-atmosphere"
    >
      <span className="plains-haze plains-haze--far" />
      <span className="plains-haze plains-haze--near" />
      <span className="plains-seeds">
        {Array.from({ length: seedCount }, (_, index) => (
          <span
            className="plains-seed"
            key={`plains-seed-${index + 1}`}
          />
        ))}
      </span>
    </div>
  )
}
