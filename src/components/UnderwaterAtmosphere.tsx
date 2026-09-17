const bubbleCount = 12

/**
 * A deliberately lightweight scene layer: the bubbles and broad current bands
 * are CSS-only, so water scenes do not wait for another image or video asset.
 */
export function UnderwaterAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="scene-atmosphere underwater-atmosphere"
    >
      <span className="underwater-current underwater-current--near" />
      <span className="underwater-current underwater-current--far" />
      <span className="underwater-bubbles">
        {Array.from({ length: bubbleCount }, (_, index) => (
          <span
            className="underwater-bubble"
            key={`underwater-bubble-${index + 1}`}
          />
        ))}
      </span>
    </div>
  )
}
