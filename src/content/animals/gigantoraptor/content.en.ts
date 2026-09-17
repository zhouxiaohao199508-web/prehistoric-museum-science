import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Gigantoraptor',
  classificationLabel: 'Large oviraptorosaur dinosaur',
  visibleFeature:
    'Look at its long neck, slender legs and bird-like body shape.',
  narration: {
    sentences: [
      'This is Gigantoraptor, a huge, bird-like dinosaur from the Late Cretaceous.',
      'Look at its long neck, slender legs and bird-like body shape.',
    ],
    pronunciation: [
      {
        text: 'Gigantoraptor',
        reading: 'jy-GAN-toh-RAP-tor',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous',
    discoveryRegions: ['Inner Mongolia, China'],
    size: {
      kind: 'body-length',
      minMeters: 8,
      maxMeters: 8,
    },
    diet: 'unknown',
  },
  parentClassificationNote:
    'Gigantoraptor belonged to the oviraptorosaurs. Its type fossil came from the Iren Dabasu Formation in Inner Mongolia, China. The scientific description estimated a length of about 8 metres and a mass of about 1,400 kilograms. The available evidence does not tell us exactly what it ate. This model’s large eyes, head ornament, colours and feather pattern are artistic ideas rather than features confirmed by fossils.',
  sources: [
    {
      title: 'A gigantic bird-like dinosaur from the Late Cretaceous of China — Nature',
      url: 'https://www.nature.com/articles/nature05849',
      accessedOn: '2026-07-28',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The known fossils do not support the model’s large eyes, head ornament, exact colours or precise feather pattern.',
      'Diet remains unknown; it is not inferred from the oviraptorosaur name or from the model’s appearance.',
      'About 8 metres is the paper’s whole-animal estimate and does not mean this model has been calibrated to exact fossil proportions.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
