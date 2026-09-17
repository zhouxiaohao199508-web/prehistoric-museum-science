import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Lystrosaurus',
  classificationLabel: 'Dicynodont synapsid',
  visibleFeature:
    'Look at its short face, beak-like mouth and two tusks; this funny little animal is hard to forget!',
  narration: {
    sentences: [
      'This is Lystrosaurus, a plant-eating synapsid from the Late Permian and Early Triassic, not a dinosaur.',
      'Look at its short face, beak-like mouth and two tusks; this funny little animal is hard to forget!',
    ],
    pronunciation: [
      { text: 'Lystrosaurus', reading: 'LISS-troh-SOR-us' },
      { text: 'synapsid', reading: 'sih-NAP-sid' },
      { text: 'Permian', reading: 'PUR-mee-un' },
      { text: 'Triassic', reading: 'try-ASS-ik' },
    ],
  },
  facts: {
    period: 'Late Permian to Early Triassic (about 255–247 million years ago)',
    discoveryRegions: [
      'Southern Africa',
      'Antarctica',
      'India',
      'Asia',
    ],
    size: {
      kind: 'body-length',
      minMeters: 0.6,
      maxMeters: 2.5,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    'Lystrosaurus was not a dinosaur. It was a dicynodont synapsid from the broad evolutionary branch that also includes mammals. Its short deep skull, downturned snout, beak and pair of tusks really do give living reconstructions a funny, memorable look. Skin, colour, body fat and any sparse hair-like covering cannot be determined directly from the known fossils.',
  sources: [
    {
      title: 'Evolve or Perish guide — Smithsonian National Museum of Natural History',
      url: 'https://www.naturalhistory.si.edu/sites/default/files/media/file/evolve-or-perish-guidebook-3-12-20.pdf',
      accessedOn: '2026-08-29',
    },
    {
      title: 'The paleobiology and paleoecology of South African Lystrosaurus',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7694564/',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The size range summarises differences among species and individuals within the genus Lystrosaurus.',
      'Lystrosaurus may have burrowed or spent most of its time on land; studies do not yet agree on how closely it was associated with water.',
      'Soft tissue, grey-green colour and a stout body shape are parts of a living reconstruction that fossils cannot determine directly.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy: 'Leon (product owner)',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentEn
