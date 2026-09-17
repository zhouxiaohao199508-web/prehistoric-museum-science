import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Tyrannosaurus rex',
  classificationLabel: 'Tyrannosaurid theropod dinosaur',
  visibleFeature:
    'Look at its huge head, powerful hind legs and two very short front limbs.',
  narration: {
    sentences: [
      'This is Tyrannosaurus rex, a meat-eating dinosaur from the Late Cretaceous.',
      'Look at its huge head, powerful hind legs and two very short front limbs.',
    ],
    pronunciation: [
      {
        text: 'Tyrannosaurus rex',
        reading: 'tie-RAN-oh-SOR-us reks',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous (about 68–66 million years ago)',
    discoveryRegions: ['western North America (United States and Canada)'],
    size: {
      kind: 'body-length',
      minMeters: 11.5,
      maxMeters: 13,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Tyrannosaurus rex was a giant theropod dinosaur. Fossils show a huge skull, robust teeth and short, two-fingered front limbs. Scientists still debate exactly how those front limbs were used. This exhibit focuses gently on the animal’s shape and does not show hunting.',
  sources: [
    {
      title: 'Tyrannosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/tyrannosaurus.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Tyrannosaurus rex fact sheet — Smithsonian Institution',
      url: 'https://www.si.edu/newsdesk/factsheets/tyrannosaurus-rex',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Tyrannosaurus rex — American Museum of Natural History',
      url: 'https://www.amnh.org/exhibitions/permanent/saurischian-dinosaurs/tyrannosaurus-rex',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 11.5–13 metre range is an approximation drawn from different large individuals and widely used estimates; it does not mean every Tyrannosaurus reached this length.',
      'The purpose of the front limbs is not presented as settled.',
      'The children’s layer avoids blood, chasing and descriptions of predation.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
