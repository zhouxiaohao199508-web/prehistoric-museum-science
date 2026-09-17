import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Megalodon',
  classificationLabel: 'Prehistoric shark',
  visibleFeature:
    'Look at its streamlined body and rows of teeth. As its tail swishes, does it look like a giant submarine?',
  narration: {
    sentences: [
      'This is Megalodon, a giant prehistoric shark that once swam through warm seas around the world.',
      'Look at its streamlined body and rows of teeth. As its tail swishes, does it look like a giant submarine?',
    ],
    pronunciation: [
      {
        text: 'Megalodon',
        reading: 'MEG-uh-luh-don',
      },
    ],
  },
  facts: {
    period: 'Early Miocene to Early Pliocene (about 23 million to 3.6 million years ago)',
    discoveryRegions: ['Marine deposits around the world'],
    size: {
      kind: 'body-length',
      minMeters: 15,
      maxMeters: 18,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Megalodon was an extinct lamniform shark, not a dinosaur or marine reptile. Shark skeletons are mostly cartilage and rarely fossilise as complete bodies, so scientists estimate its length, shape and appearance from teeth, a small number of vertebrae and living relatives. This model should not be treated as an exact scientific portrait.',
  sources: [
    {
      title:
        'Megalodon: The truth about the largest shark that ever lived — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/megalodon--the-truth-about-the-largest-shark-that-ever-lived.html/',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Reassessment of the possible size, form, weight, cruising speed, and growth parameters of Otodus megalodon — Palaeontologia Electronica',
      url: 'https://palaeo-electronica.org/content/current-in-press-articles/5450-biology-of-otodus-megalodon',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'The Early Pliocene extinction of the mega-toothed shark Otodus megalodon — PeerJ',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6377595/',
      accessedOn: '2026-07-30',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The 15–18 metre range is a cautious estimate for large individuals, not a claim that every adult reached this size.',
      'Recent research has proposed a hypothetical maximum of about 24.3 metres, but this depends on several assumptions about body proportions, so it is not used in the child-facing summary.',
      'No complete fossil preserves the body proportions, dorsal-fin shape or colour; Megalodon should not simply be pictured as an enlarged great white shark.',
      'The youngest reliable fossil records currently recognised are about 3.6 million years old.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
