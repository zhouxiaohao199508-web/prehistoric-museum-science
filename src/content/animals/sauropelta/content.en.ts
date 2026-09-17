import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Sauropelta',
  classificationLabel: 'Nodosaurid armoured dinosaur',
  visibleFeature:
    'Look at the bony armour on its back and the big spikes by its shoulders. Does it look as though it is wearing a strong protective coat?',
  narration: {
    sentences: [
      'This is Sauropelta, a plant-eating armoured dinosaur from Early Cretaceous North America.',
      'Look at the bony armour on its back and the big spikes by its shoulders. Does it look as though it is wearing a strong protective coat?',
    ],
    pronunciation: [
      {
        text: 'Sauropelta',
        reading: 'SOR-oh-PEL-tuh',
      },
    ],
  },
  facts: {
    period: 'Early Cretaceous (about 115–105 million years ago)',
    discoveryRegions: ['western North America'],
    size: {
      kind: 'body-length',
      minMeters: 5,
      maxMeters: 6,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Sauropelta was a nodosaurid, a kind of armoured dinosaur without a tail club. Bony armour covered its low body, and large spikes stood out along its neck and shoulders. In life, the spikes may also have had keratin coverings, making their outline more complex than the bare fossils alone can show.',
  sources: [
    {
      title: 'Sauropelta — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/sauropelta.html',
      accessedOn: '2026-07-31',
    },
    {
      title: 'The armored dinosaur Sauropelta — Canadian Journal of Earth Sciences',
      url: 'https://doi.org/10.1139/e84-154',
      accessedOn: '2026-07-31',
    },
    {
      title:
        'An exceptionally preserved armored dinosaur reveals the morphology and allometry of osteoderms and their horny epidermal coverings',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5712211/',
      accessedOn: '2026-07-31',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 5–6 metre figure is an approximate adult length range for family reading; it does not tie the current model to one specimen.',
      'The model’s armour arrangement, the length of its keratin coverings, its colour and other soft tissues are cautious artistic reconstructions.',
      'The label stays at the genus level, Sauropelta, without making a species-level claim. The display name and shoulder spikes have been checked for this exhibition.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
