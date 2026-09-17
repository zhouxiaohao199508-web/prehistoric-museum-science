import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Pachycephalosaurus',
  classificationLabel: 'Dome-headed dinosaur',
  visibleFeature:
    'Look at its round, bony dome and the little bumps around it. Does it look like a small, round hat?',
  narration: {
    sentences: [
      'This is Pachycephalosaurus, a plant-eating dinosaur from the Late Cretaceous.',
      'Look at its round, bony dome and the little bumps around it. Does it look like a small, round hat?',
    ],
    pronunciation: [
      {
        text: 'Pachycephalosaurus',
        reading: 'PACK-ee-SEF-uh-loh-SOR-us',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous',
    discoveryRegions: ['United States and Canada, North America'],
    size: {
      kind: 'body-length',
      minMeters: 3,
      maxMeters: 4.5,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Pachycephalosaurus belonged to the dome-headed pachycephalosaurs, a group of ornithischian dinosaurs. Its thick bony dome is its most striking feature. The dome might have been used for display or in collisions between members of the same species, but exactly how it was used remains under study. It is usually described as a plant-eater, although its diet is not completely certain.',
  sources: [
    {
      title: 'Pachycephalosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/pachycephalosaurus',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Smithsonian acquires an exceptionally complete Pachycephalosaurus skull',
      url: 'https://www.si.edu/newsdesk/releases/smithsonian-acquires-exceptionally-complete-skull-iconic-dome-headed-dinosaur',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Cranial pathologies in dome-headed dinosaurs — PLOS ONE',
      url: 'https://doi.org/10.1371/journal.pone.0068620',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The length range combines estimates from different official institutions; it does not imply that every specimen falls within one exact range.',
      'Neither diet nor the dome’s purpose is presented to children as completely settled.',
      'High-speed, head-on butting is neither shown nor stated as fact.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
