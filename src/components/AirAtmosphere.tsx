const streamlineCount = 3
const silhouetteCount = 2

/**
 * High-altitude motion stays intentionally sparse so the hovering model
 * remains the focal point. Every moving part is a transform/opacity-only CSS
 * layer and therefore adds no extra scene asset request.
 */
export function AirAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="scene-atmosphere air-atmosphere"
    >
      <span className="air-sunflare" />
      <span className="air-cloud air-cloud--far" />
      <span className="air-cloud air-cloud--near" />
      <span className="air-streamlines">
        {Array.from({ length: streamlineCount }, (_, index) => (
          <span
            className="air-streamline"
            key={`air-streamline-${index + 1}`}
          />
        ))}
      </span>
      <span className="air-silhouettes">
        {Array.from({ length: silhouetteCount }, (_, index) => (
          <span
            className="air-silhouette"
            key={`air-silhouette-${index + 1}`}
          />
        ))}
      </span>
    </div>
  )
}
