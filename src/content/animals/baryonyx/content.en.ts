import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Baryonyx',
  classificationLabel: 'Spinosaurid theropod dinosaur',
  visibleFeature:
    'Look at its long narrow snout and huge hand claw. Which features might have helped it catch slippery prey?',
  narration: {
    sentences: [
      'This is Baryonyx, a spinosaurid theropod dinosaur that lived in Europe during the Early Cretaceous.',
      'Look at its long narrow snout and huge hand claw. Which features might have helped it catch slippery prey?',
    ],
    pronunciation: [
      { text: 'Baryonyx', reading: 'BAIR-ee-ON-iks' },
      { text: 'spinosaurid', reading: 'SPY-no-SOR-id' },
      { text: 'Cretaceous', reading: 'krih-TAY-shus' },
    ],
  },
  facts: {
    period: 'Early Cretaceous (about 130–125 million years ago)',
    discoveryRegions: ['United Kingdom', 'Europe'],
    size: {
      kind: 'body-length',
      minMeters: 7.5,
      maxMeters: 10,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Baryonyx had a long low snout, nostrils set farther back and an enormous hand claw. Fish scales and iguanodont bones found around the type specimen’s belly show that it ate fish, but they do not prove it ate only fish or lived exactly like a modern crocodile. Snout width, nostril position and thumb-claw proportions vary slightly with the fossil material and reconstruction method used.',
  sources: [
    {
      title: 'How did Baryonyx change what we knew about spinosaurs? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/how-did-baryonyx-change-what-we-knew-about-spinosaurs.html',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 7.5–10 metre figure is an approximate range; estimates differ between the type specimen and a fully grown animal.',
      'Evidence that it ate fish does not mean it ate only fish or was fully aquatic.',
      'Snout width, nostril position and hand-claw proportions vary slightly between reconstructions.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy: 'Leon (product owner)',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentEn
