import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Plesiosaurs',
  classificationLabel: 'Marine reptiles',
  visibleFeature:
    'Look at its long neck and four flippers. All four could work together like wings under the water.',
  narration: {
    sentences: [
      'This is a plesiosaur. Plesiosaurs were sea reptiles that lived alongside dinosaurs, but they were not dinosaurs.',
      'Look at its long neck and four flippers. All four could work together like wings under the water.',
    ],
    pronunciation: [
      {
        text: 'Plesiosaurs',
        reading: 'PLEE-zee-uh-sawz',
      },
    ],
  },
  facts: {
    period: 'Late Triassic to Late Cretaceous',
    discoveryRegions: ['Ancient marine rocks around the world'],
    size: {
      kind: 'group-range',
      minMeters: 1.5,
      maxMeters: 13,
      note: 'Plesiosaurs varied greatly in size; this is not the length of the animal shown',
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Plesiosaurs were a large group of extinct marine reptiles, not dinosaurs. Some had a long neck and small head, while others had a shorter neck and larger head. Their unusual four-flipper arrangement may have allowed all four limbs to help provide steady thrust. The model source gives no genus, species or specimen, so this label stays at group level.',
  sources: [
    {
      title: 'What is a plesiosaur? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/what-is-a-plesiosaur.html',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'The four-flipper swimming method of plesiosaurs enabled efficient and effective locomotion — Proceedings of the Royal Society B',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5577481/',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Rethinking the four-wing problem in plesiosaur swimming using bio-inspired decentralized control — Scientific Reports',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11519978/',
      accessedOn: '2026-07-30',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The model source says only “Plesiosaure” and provides no genus, species, rock layer or specimen number.',
      'The 1.5–13 metre range is a rough span across many plesiosaur species and must not be read as the length of this model.',
      'Flipper timing would have varied with body shape and swimming speed; this model\'s idle animation is only a slow display reconstruction.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
