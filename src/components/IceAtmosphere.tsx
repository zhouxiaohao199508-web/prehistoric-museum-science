const crystalCount = 9

/**
 * A quiet cold-air layer: nine crystals, two low haze bands, and one fixed
 * wash of blue-white dawn light.
 */
export function IceAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="scene-atmosphere ice-atmosphere"
    >
      <span className="ice-sunlight" />
      <span className="ice-ground-haze ice-ground-haze--far" />
      <span className="ice-ground-haze ice-ground-haze--near" />
      <span className="ice-crystals">
        {Array.from({ length: crystalCount }, (_, index) => (
          <span
            className="ice-crystal"
            key={`ice-crystal-${index + 1}`}
          />
        ))}
      </span>
    </div>
  )
}
