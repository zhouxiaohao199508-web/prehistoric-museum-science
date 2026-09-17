import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Rhamphorhynchus',
  classificationLabel: 'Long-tailed pterosaur (flying reptile)',
  visibleFeature:
    'Look at its long tail, the little sail at its tip and its outstretched wings made from skin membranes.',
  narration: {
    sentences: [
      'This is Rhamphorhynchus, a flying reptile from the Late Jurassic. It was not a dinosaur.',
      'Look at its long tail, the little sail at its tip and its outstretched wings made from skin membranes.',
    ],
    pronunciation: [
      {
        text: 'Rhamphorhynchus',
        reading: 'RAM-foh-RINK-us',
        note: 'The “rh” at the beginning sounds like an “r”.',
      },
    ],
  },
  facts: {
    period: 'Late Jurassic (about 150 million years ago)',
    discoveryRegions: ['southern Germany, Europe'],
    size: {
      kind: 'wingspan',
      minMeters: 1,
      maxMeters: 1.8,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Rhamphorhynchus was a pterosaur, a flying reptile rather than a dinosaur or a bird. Late Jurassic fossils from southern Germany preserve wing membranes and soft tissue from the sail at the end of the tail. Fish remains in the stomach show that small fish were among its foods. A cephalopod fossil marked by a Rhamphorhynchus tooth may record an unsuccessful attack. The shape of the tail sail changed as the animal grew, while its colours, complete wing outline and exact flight movements remain careful artistic reconstructions.',
  sources: [
    {
      title:
        'Intraspecific variation in the pterosaur Rhamphorhynchus muensteri—implications for flight and socio-sexual signaling',
      url: 'https://doi.org/10.7717/peerj.17524',
      accessedOn: '2026-07-31',
    },
    {
      title:
        'A specimen of Rhamphorhynchus with soft tissue preservation, stomach contents and a putative coprolite',
      url: 'https://doi.org/10.7717/peerj.1191',
      accessedOn: '2026-07-31',
    },
    {
      title: 'Pterosaurs ate soft-bodied cephalopods (Coleoidea)',
      url: 'https://doi.org/10.1038/s41598-020-57731-2',
      accessedOn: '2026-07-31',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The source model is labelled only as Rhamphorhynchus, so the copy does not assign it to a species, age or sex.',
      'The 1–1.8 metre figure runs from near-adult representative specimens to the largest known specimen; it is not the full growth range including juveniles.',
      'Fish in the diet are supported by stomach contents. The cephalopod evidence records an association with an attack, not the proportion of cephalopods in its diet.',
      'The tail sail and wing membrane have direct soft-tissue evidence, but the sail changed shape as the animal grew. Colour, skin texture, membrane tension and the exact flight movement remain artistic reconstructions.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
