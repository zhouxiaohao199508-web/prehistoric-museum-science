import {
  animalSeoDescription,
  animalSeoDescriptionMaxLength,
} from '../src/content/animal-seo'

describe('animal SEO descriptions', () => {
  it('keeps complete narration when it fits the search-summary budget', () => {
    expect(animalSeoDescription(['A short fact.', 'Another short fact.'])).toBe(
      'A short fact. Another short fact.',
    )
  })

  it('uses a complete first sentence instead of cutting long text mid-sentence', () => {
    const firstSentence = 'A'.repeat(90)
    const secondSentence = 'B'.repeat(90)

    expect(animalSeoDescription([firstSentence, secondSentence])).toBe(
      firstSentence,
    )
    expect(firstSentence.length).toBeLessThanOrEqual(
      animalSeoDescriptionMaxLength,
    )
  })
})
