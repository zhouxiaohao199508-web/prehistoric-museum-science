export const animalSeoDescriptionMaxLength = 160

export function animalSeoDescription(
  narrationSentences: readonly string[],
): string {
  const sentences = narrationSentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  const completeDescription = sentences.join(' ')

  if (completeDescription.length <= animalSeoDescriptionMaxLength) {
    return completeDescription
  }

  return sentences[0] ?? ''
}
