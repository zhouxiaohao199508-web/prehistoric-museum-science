import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Stegosaurus',
  classificationLabel: 'Stegosaur dinosaur',
  visibleFeature:
    'Look at the two rows of plates along its back. Do they look like a line of little hills?',
  narration: {
    sentences: [
      'This is Stegosaurus, a plant-eating dinosaur from the Late Jurassic.',
      'Look at the two rows of plates along its back. Do they look like a line of little hills?',
    ],
    pronunciation: [
      {
        text: 'Stegosaurus',
        reading: 'STEG-oh-SOR-us',
      },
    ],
  },
  facts: {
    period: 'Late Jurassic',
    discoveryRegions: ['western North America'],
    size: {
      kind: 'body-length',
      minMeters: 6.5,
      maxMeters: 9,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Stegosaurus belonged to the stegosaurs, a branch of the ornithischian dinosaurs. The bony plates along its back and the spikes at the end of its tail are its easiest features to recognise.',
  sources: [
    {
      title: 'Stegosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html',
      accessedOn: '2026-07-27',
    },
    {
      title:
        'Stegosaurus stenops — Smithsonian National Museum of Natural History',
      url: 'https://naturalhistory.si.edu/education/teaching-resources/paleontology/stegosaurus-body',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The length is an approximate range suitable for family reading; estimates from different specimens are not presented as one exact measurement.',
      'Plate colours and sounds are not described as scientifically confirmed facts.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
