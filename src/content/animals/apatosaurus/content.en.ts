import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Apatosaurus',
  classificationLabel: 'Sauropod dinosaur',
  visibleFeature:
    'Look at its long neck, long tail and four sturdy, pillar-like legs.',
  narration: {
    sentences: [
      'This is Apatosaurus, a giant plant-eating dinosaur from the Late Jurassic.',
      'Look at its long neck, long tail and four sturdy, pillar-like legs.',
    ],
    pronunciation: [
      {
        text: 'Apatosaurus',
        reading: 'uh-PAT-uh-SOR-us',
      },
    ],
  },
  facts: {
    period: 'Late Jurassic (about 152–145 million years ago)',
    discoveryRegions: ['western United States, North America'],
    size: {
      kind: 'body-length',
      minMeters: 21,
      maxMeters: 24,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Apatosaurus was a sauropod on the diplodocoid branch of the dinosaur family tree. Four pillar-like legs supported its huge body, while its long neck and tail made a striking outline. Length estimates vary between species and individual fossils.',
  sources: [
    {
      title: 'Apatosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/apatosaurus.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Thoroughly Modern Apatosaurus — American Museum of Natural History',
      url: 'https://www.amnh.org/exhibitions/dinosaurs-ancient-fossils/sauropod-biomechanics/thoroughly-modern-apatosaurus',
      accessedOn: '2026-07-27',
    },
    {
      title: 'The Morrison Formation — U.S. National Park Service',
      url: 'https://www.nps.gov/subjects/fossils/the-morrison-formation.htm',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 21–24 metre range combines genus-level educational sources with estimates from different reconstructions; it does not identify this model with one specimen.',
      'Apatosaurus and Brontosaurus are presented as closely related but separate genera, in line with their usual modern treatment.',
      'The purpose of the tail and any group-living behaviour are not presented as settled facts.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
