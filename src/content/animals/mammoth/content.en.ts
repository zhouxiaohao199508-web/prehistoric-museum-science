import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Woolly mammoth',
  classificationLabel: 'Prehistoric mammal in the elephant family',
  visibleFeature:
    'Look at its thick, shaggy coat, small ears and long tusks that curve forwards.',
  narration: {
    sentences: [
      'This shaggy animal is a woolly mammoth, a prehistoric relative of elephants that lived on the open lands of the cold north.',
      'Look at its thick, shaggy coat, small ears and long tusks that curve forwards.',
    ],
    pronunciation: [
      {
        text: 'Woolly mammoth',
        reading: 'WULL-ee MAM-uth',
      },
    ],
  },
  facts: {
    period:
      'Pleistocene to early Holocene (about 800,000–4,000 years ago)',
    discoveryRegions: ['northern Eurasia', 'northern North America'],
    size: {
      kind: 'shoulder-height',
      minMeters: 3,
      maxMeters: 3.5,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'The woolly mammoth (Mammuthus primigenius) belonged to the elephant family. It was a close relative of modern elephants, not their ancestor. Woolly mammoths were adapted to cold conditions, but they often lived on open land rich in plants rather than in deep snow. Adults stood about 3–3.5 metres high at the shoulder. Although the source model is titled “Baby”, its tusks and body proportions do not reliably show its age.',
  sources: [
    {
      title: 'Were all mammoths woolly? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/were-all-mammoths-woolly.html',
      accessedOn: '2026-07-28',
    },
    {
      title: 'Mammuthus primigenius (Blumbach) — Smithsonian Institution',
      url: 'https://www.si.edu/object/nmnhpaleobiology_3447777',
      accessedOn: '2026-07-28',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 3–3.5 metre figure is the shoulder-height range for adult woolly mammoths, not a measurement of the current “Baby” model.',
      'The source title calls the model a baby, but its long tusks do not fit that description clearly, so the display does not claim that it is a young animal.',
      'Coat colour, the amount of fur and other soft-tissue details are artistic reconstructions. The Ice Age setting is a picture-book reconstruction rather than one particular fossil site.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
