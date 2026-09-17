import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Dilophosaurus',
  classificationLabel: 'Early theropod dinosaur',
  visibleFeature:
    'Can you spot the two thin crests side by side on its head? Now look for curved teeth and powerful hind legs.',
  narration: {
    sentences: [
      'This is Dilophosaurus, a meat-eating dinosaur that lived in North America during the Early Jurassic.',
      'Can you spot the two thin crests side by side on its head? Now look for curved teeth and powerful hind legs.',
    ],
    pronunciation: [
      {
        text: 'Dilophosaurus',
        reading: 'dye-LOF-oh-SOR-us',
      },
    ],
  },
  facts: {
    period: 'Early Jurassic (about 193 million years ago)',
    discoveryRegions: [
      'Kayenta Formation, Arizona, United States',
    ],
    size: {
      kind: 'body-length',
      minMeters: 6,
      maxMeters: 7,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Dilophosaurus was an early large theropod, about 6–7 metres long, that walked on two strong hind legs. Its pair of thin head crests is distinctive. Their colour and exact purpose remain unknown, although they may have helped animals recognise one another or attract mates.',
  sources: [
    {
      title: 'Dilophosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/dilophosaurus.html',
      accessedOn: '2026-07-31',
    },
    {
      title:
        'A comprehensive anatomical and phylogenetic evaluation of Dilophosaurus wetherilli',
      url: 'https://www.cambridge.org/core/journals/journal-of-paleontology/article/comprehensive-anatomical-and-phylogenetic-evaluation-of-dilophosaurus-wetherilli-dinosauria-theropoda-with-descriptions-of-new-specimens-from-the-kayenta-formation-of-northern-arizona/39C2921EDC6E951AC9F94A22158CA4E5',
      accessedOn: '2026-07-31',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 6–7 metre figure is an approximate range for an adult animal.',
      'There is not enough evidence to determine the crests’ colour, their soft tissues, the animal’s body colour or the crests’ exact purpose.',
      'The model’s skull, shoulder girdle, hands, hind limbs and gently open mouth were reviewed for this exhibit; soft-tissue details remain a cautious artistic reconstruction.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
