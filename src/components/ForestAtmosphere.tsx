const dustCount = 12
const leafCount = 4

/**
 * Forest air keeps a little drifting life while diffuse-light habitats can
 * suppress the optional decorative beams authored for sunnier exhibits.
 */
export function ForestAtmosphere({
  diffuseLight = false,
}: {
  readonly diffuseLight?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className="scene-atmosphere forest-atmosphere"
    >
      {diffuseLight ? null : (
        <>
          <span className="forest-sunbeam forest-sunbeam--wide" />
          <span className="forest-sunbeam forest-sunbeam--narrow" />
        </>
      )}
      <span className="forest-dust">
        {Array.from({ length: dustCount }, (_, index) => (
          <span
            className="forest-dust-particle"
            key={`forest-dust-${index + 1}`}
          />
        ))}
      </span>
      <span className="forest-leaves">
        {Array.from({ length: leafCount }, (_, index) => (
          <span
            className="forest-leaf"
            key={`forest-leaf-${index + 1}`}
          />
        ))}
      </span>
    </div>
  )
}
