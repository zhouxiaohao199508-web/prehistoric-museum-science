import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Maiasaura',
  classificationLabel: 'Duck-billed dinosaur',
  visibleFeature:
    'Look at its broad beak and strong hind legs. Can you imagine it walking slowly near a nesting ground?',
  narration: {
    sentences: [
      'This is Maiasaura, a plant-eating, duck-billed dinosaur from Late Cretaceous North America.',
      'Look at its broad beak and strong hind legs. Can you imagine it walking slowly near a nesting ground?',
    ],
    pronunciation: [
      {
        text: 'Maiasaura',
        reading: 'my-uh-SOR-uh',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous (about 80–75 million years ago)',
    discoveryRegions: [
      'Two Medicine Formation, Montana, United States',
    ],
    size: {
      kind: 'body-length',
      minMeters: 7,
      maxMeters: 9,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Maiasaura was a hadrosaur, or duck-billed dinosaur. It could walk on its hind legs or move on all fours. Fossilised nests, eggs, young animals and adults make it important for studying how dinosaurs reproduced and grew. Claims that adults fed their young for a long time are still scientific interpretations and should be treated with care.',
  sources: [
    {
      title: 'Maiasaura — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/maiasaura.html',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Egg Mountain, the Two Medicine, and the Caring Mother Dinosaur — U.S. National Park Service',
      url: 'https://www.nps.gov/articles/mesozoic-egg-mountain-dawson-2014.htm',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Maiasaura, a model organism for extinct vertebrate population biology — Paleobiology',
      url: 'https://www.cambridge.org/core/journals/paleobiology/article/maiasaura-a-model-organism-for-extinct-vertebrate-population-biology-a-large-sample-statistical-assessment-of-growth-dynamics-and-survivorship/288407BA0A91914480A0531529F050EF',
      accessedOn: '2026-07-30',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 7–9 metre range is an approximation for adults or large individuals; this model does not represent one particular specimen.',
      'The nesting sites strongly support group nesting, while the method and duration of parental feeding remain debated.',
      'The model’s colour and soft tissues are cautious artistic reconstructions.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
