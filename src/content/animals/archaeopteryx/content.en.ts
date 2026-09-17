import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Archaeopteryx',
  classificationLabel: 'Small bird-like theropod dinosaur',
  visibleFeature:
    'Look at its feathers, wing claws and long tail. Which parts look bird-like, and which look dinosaur-like?',
  narration: {
    sentences: [
      'This is Archaeopteryx, a small feathered dinosaur from Late Jurassic Germany.',
      'Look at its feathers, wing claws and long tail. Which parts look bird-like, and which look dinosaur-like?',
    ],
    pronunciation: [
      { text: 'Archaeopteryx', reading: 'ar-kee-OP-ter-iks' },
      { text: 'Jurassic', reading: 'juh-RASS-ik' },
      { text: 'theropod', reading: 'THEER-uh-pod' },
    ],
  },
  facts: {
    period: 'Late Jurassic (about 149–145 million years ago)',
    discoveryRegions: ['Bavaria, Germany'],
    size: {
      kind: 'body-length',
      minMeters: 0.5,
      maxMeters: 0.5,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Archaeopteryx was a small feathered theropod dinosaur. It had broad feathered wings, along with teeth, wing claws and a long bony tail unlike those of modern birds. Wing-bone research supports active flapping flight, although its flight style and range were not the same as those of modern birds.',
  sources: [
    {
      title: 'Archaeopteryx — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/archaeopteryx',
      accessedOn: '2026-08-29',
    },
    {
      title: 'New specimen of Archaeopteryx provides insights into the evolution of pennaceous feathers',
      url: 'https://doi.org/10.1038/nature13467',
      accessedOn: '2026-08-29',
    },
    {
      title: 'Wing bone geometry reveals active flight in Archaeopteryx',
      url: 'https://doi.org/10.1038/s41467-018-03296-8',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '“The first bird” is a familiar historical label, while Archaeopteryx’s exact place in early bird evolution continues to be refined.',
      'Its wing bones support active flapping flight, but flight distance, take-off style and the balance between ground and tree activity remain uncertain.',
      'Its complete feather colours and patterns are not known from the evidence represented by this model.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy: 'Leon (product owner)',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentEn
