import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Meganeura',
  classificationLabel: 'Giant griffinfly',
  visibleFeature:
    'Look at its four vein-covered wings, six legs and two enormous compound eyes.',
  narration: {
    sentences: [
      'This is Meganeura. It lived about 300 million years ago and was a distant relative of today\'s dragonflies.',
      'Look at its four vein-covered wings, six legs and two enormous compound eyes.',
    ],
    pronunciation: [
      {
        text: 'Meganeura',
        reading: 'meg-uh-NYOOR-uh',
      },
    ],
  },
  facts: {
    period: 'Late Carboniferous (about 300 million years ago)',
    discoveryRegions: ['Europe (Commentry, France)'],
    size: {
      kind: 'wingspan',
      minMeters: 0.7,
      maxMeters: 0.7,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Meganeura was a giant extinct griffinfly related to modern dragonflies, but it was not a true modern dragonfly. Late Carboniferous fossils from Commentry, France, indicate a wingspan of about 70 centimetres, and the wing veins preserved in the type specimen guide the four-wing reconstruction. Strong spines on the legs of close relatives suggest that they could bring all six legs together as a basket for catching prey in the air, but little of Meganeura\'s complete body is preserved. Its yellow-and-black colour, translucent wing membranes, exact vein branches, number of leg spines and wing beats are cautious artistic reconstructions guided by the evidence.',
  sources: [
    {
      title: 'Meganeura monyi, libellule géante — Muséum national d’Histoire naturelle',
      url: 'https://www.mnhn.fr/fr/meganeura-monyi-libellule-geante',
      accessedOn: '2026-08-01',
    },
    {
      title: 'The winged insects of the Carboniferous and their predatory leg basket',
      url: 'https://doi.org/10.1038/s41598-018-30629-w',
      accessedOn: '2026-08-01',
    },
    {
      title: 'New imaging and wing venation of the Meganeura monyi holotype',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10548097/',
      accessedOn: '2026-08-01',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'Meganeura belonged to an extinct griffinfly group related to dragonflies; it was not a true modern dragonfly.',
      'About 0.7 metres describes the wingspan, not the body length.',
      'The wing-vein evidence is strong, while the complete soft body, body colour, eye colour and exact number of leg spines are poorly known.',
      'High oxygen levels may have helped insects grow large, but they are not proven to be the only cause.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
