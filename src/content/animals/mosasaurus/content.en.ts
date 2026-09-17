import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Mosasaurus',
  classificationLabel: 'Large marine squamate reptile',
  visibleFeature:
    'Look at its flippers and powerful tail. Can you imagine its tail pushing it forwards while the flippers steer?',
  narration: {
    sentences: [
      'This is Mosasaurus, a huge sea reptile that lived during the Late Cretaceous. It was not a dinosaur.',
      'Look at its flippers and powerful tail. Can you imagine its tail pushing it forwards while the flippers steer?',
    ],
    pronunciation: [
      {
        text: 'Mosasaurus',
        reading: 'moh-zuh-SAW-rus',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous (about 82 million to 66 million years ago)',
    discoveryRegions: ['Europe', 'North America', 'Other Late Cretaceous seas'],
    size: {
      kind: 'body-length',
      minMeters: 10,
      maxMeters: 14,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Mosasaurus was not a dinosaur. It was a fully aquatic squamate reptile, on the branch of the family tree that also includes today\'s lizards and snakes. Its flippers helped it steer, while its tail provided most of the thrust. Soft-tissue evidence from other well-preserved mosasaurs supports a tail tip with an asymmetrical, two-lobed outline.',
  sources: [
    {
      title: 'What is a mosasaur? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/what-is-a-mosasaur.html',
      accessedOn: '2026-07-31',
    },
    {
      title: 'A new look at mosasaur locomotion as indicated by a well-preserved specimen of Prognathodon',
      url: 'https://www.nature.com/articles/ncomms3423',
      accessedOn: '2026-07-31',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The model title is not detailed enough to identify a species, so the label deliberately avoids a species-level claim.',
      'The 10–14 metre figure is an approximate display range for large mosasaurs; length estimates vary with the specimen and method.',
      'The tail-fin soft tissue, colour, open-mouth pose and swimming movement were manually checked for this display, but they remain cautious reconstructions informed partly by close relatives.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
