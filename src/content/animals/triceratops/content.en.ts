import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Triceratops',
  classificationLabel: 'Ceratopsian dinosaur',
  visibleFeature:
    'Look at the two long horns above its eyes, the little horn on its nose and the wide frill behind its head.',
  narration: {
    sentences: [
      'This is Triceratops, a plant-eating dinosaur from the Late Cretaceous.',
      'Look at the two long horns above its eyes, the little horn on its nose and the wide frill behind its head.',
    ],
    pronunciation: [
      {
        text: 'Triceratops',
        reading: 'try-SERR-uh-tops',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous (about 68–66 million years ago)',
    discoveryRegions: ['North America (United States and Canada)'],
    size: {
      kind: 'body-length',
      minMeters: 8,
      maxMeters: 9,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Triceratops was a ceratopsian dinosaur. The front of its mouth formed a beak, while the teeth further back helped it process plants. Its three striking horns and broad frill may have helped with display, recognising members of the same species or protection, but no single purpose is treated as the only answer.',
  sources: [
    {
      title: 'Triceratops — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/triceratops.html',
      accessedOn: '2026-07-27',
    },
    {
      title:
        'Triceratops fossil skeleton — American Museum of Natural History',
      url: 'https://www.amnh.org/exhibitions/permanent/ornithischian-dinosaurs/triceratops',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Fossil Planet educator guide — Royal Tyrrell Museum',
      url: 'https://www.tyrrellmuseum.com/sites/default/files/media/DL_FP-AG.pdf',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 8–9 metre figure is an approximate family-reading range; estimates vary among individuals and reconstructions.',
      'The frill and horns may have had several roles, so the children’s layer does not say they were used only for fighting or defence.',
      'The model is not treated as scientific evidence for the reconstruction of one particular species or specimen.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
