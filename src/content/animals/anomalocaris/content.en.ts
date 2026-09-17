import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Anomalocaris',
  classificationLabel: 'Cambrian marine radiodont',
  visibleFeature:
    'Look at the rows of swimming flaps, stalked eyes and frontal grasping appendages. Which part looks most unusual?',
  narration: {
    sentences: [
      'This is Anomalocaris, a swimming hunter from the Cambrian seas.',
      'Look at its rows of swimming flaps, stalked eyes and frontal grasping appendages. Which part looks most unusual?',
    ],
    pronunciation: [
      { text: 'Anomalocaris', reading: 'uh-NOM-uh-loh-KAIR-iss' },
      { text: 'Cambrian', reading: 'KAM-bree-un' },
      { text: 'radiodont', reading: 'RAY-dee-oh-dont' },
    ],
  },
  facts: {
    period: 'Middle Cambrian (about 505 million years ago)',
    discoveryRegions: ['British Columbia, Canada'],
    size: {
      kind: 'body-length',
      minMeters: 0.25,
      maxMeters: 1,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Anomalocaris was a radiodont from Cambrian seas. Rows of side flaps propelled it through the water, large eyes helped it find prey, and spiny frontal appendages grasped softer animals. Its underside mouth, frontal appendages and tail fan are also important identifying structures.',
  sources: [
    {
      title: 'Anomalocaris canadensis — Royal Ontario Museum Burgess Shale',
      url: 'https://burgess-shale.rom.on.ca/fossils/anomalocaris-canadensis/',
      accessedOn: '2026-08-29',
    },
    {
      title: 'Anomalocaris canadensis was a fast and agile nektonic predator',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10320336/',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'More complete specimens are about 25 centimetres long; the possible one-metre maximum is inferred from isolated fossils.',
      'Functional studies better support pursuit and capture of softer prey than specialised crushing of hard trilobite shells.',
      'Body colour is not preserved directly, so the model’s orange-brown palette is an artistic reconstruction.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy: 'Leon (product owner)',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentEn
