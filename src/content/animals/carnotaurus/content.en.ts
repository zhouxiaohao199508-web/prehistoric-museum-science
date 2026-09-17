import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Carnotaurus',
  classificationLabel: 'Large abelisaurid theropod dinosaur',
  visibleFeature:
    'Look at the two horns above its eyes, short face and tiny arms. Which feature is easiest to recognise?',
  narration: {
    sentences: [
      'This is Carnotaurus, a large meat-eating dinosaur from Late Cretaceous South America.',
      'Look at the two horns above its eyes, short face and tiny arms. Which feature is easiest to recognise?',
    ],
    pronunciation: [
      { text: 'Carnotaurus', reading: 'kar-noh-TAW-rus' },
      { text: 'Cretaceous', reading: 'krih-TAY-shus' },
      { text: 'abelisaurid', reading: 'uh-BEL-ih-SOR-id' },
    ],
  },
  facts: {
    period: 'Late Cretaceous (about 71–69 million years ago)',
    discoveryRegions: ['Patagonia, Argentina'],
    size: {
      kind: 'body-length',
      minMeters: 8,
      maxMeters: 8,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Carnotaurus was an abelisaurid theropod with two horns above its eyes, a short narrow skull and extremely reduced arms. The type specimen also preserves extensive skin impressions with scales of different sizes. The exact function of its horns remains uncertain.',
  sources: [
    {
      title: 'Carnotaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/carnotaurus.html',
      accessedOn: '2026-08-29',
    },
    {
      title: 'The scaly skin of the abelisaurid Carnotaurus sastrei',
      url: 'https://doi.org/10.1016/j.cretres.2021.104994',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'About eight metres is a common length estimate; complete proportions require reconstruction of the incomplete tail and lower legs.',
      'The horns may have been used for display, recognition or physical interaction, but no single explanation is established.',
      'Fossils support scaly skin, but not a regular continuous row of long monster-like back spines.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy: 'Leon (product owner)',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentEn
