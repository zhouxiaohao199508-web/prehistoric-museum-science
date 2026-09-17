import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Spinosaurus',
  classificationLabel: 'Large spinosaurid theropod dinosaur',
  visibleFeature:
    'Look at its long narrow snout, tall sail and long tail. Which parts look useful for life near the water?',
  narration: {
    sentences: [
      'This is Spinosaurus, a large theropod dinosaur that lived in North Africa during the early Late Cretaceous.',
      'Look at its long narrow snout, tall sail and long tail. Which parts look useful for life near the water?',
    ],
    pronunciation: [
      { text: 'Spinosaurus', reading: 'SPY-no-SOR-us' },
      { text: 'Cretaceous', reading: 'krih-TAY-shus' },
      { text: 'theropod', reading: 'THEER-uh-pod' },
    ],
  },
  facts: {
    period: 'Early Late Cretaceous (about 100–93 million years ago)',
    discoveryRegions: ['North Africa'],
    size: {
      kind: 'body-length',
      minMeters: 14,
      maxMeters: 15,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Spinosaurus was a theropod dinosaur with a long narrow snout and a tall sail on its back. Fossils also show several features linked with life around water, but scientists still debate how it swam, how much time it spent in water and exactly how it walked. Tail depth, hind-leg proportions and habitual posture vary between reconstructions.',
  sources: [
    {
      title: 'Spinosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/spinosaurus.html',
      accessedOn: '2026-08-29',
    },
    {
      title: 'Tail-propelled aquatic locomotion in a theropod dinosaur',
      url: 'https://doi.org/10.1038/s41586-020-2190-3',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 14–15 metre figure is a common approximation and varies with the fossil material and reconstruction method.',
      'Spinosaurus was closely associated with water, but how it propelled itself and ranged through aquatic habitats remains debated.',
      'Tail depth, hind-leg proportions and habitual posture change with the evidence and reconstruction method used.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy: 'Leon (product owner)',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentEn
