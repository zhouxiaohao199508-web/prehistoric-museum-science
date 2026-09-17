const modelPreviewModules = import.meta.glob<string>(
  '../content/animals/*/images/preview-*.webp',
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
)

export function modelPreviewFor(
  animalId: string,
  fileName: string,
): string | undefined {
  if (import.meta.env.MODE === 'review') {
    return `/__museum-review-assets/${animalId}/${fileName}`
  }
  return modelPreviewModules[
    `../content/animals/${animalId}/images/${fileName}`
  ]
}
