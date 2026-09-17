import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Pteranodon',
  classificationLabel: 'Pterosaur (flying reptile)',
  visibleFeature:
    'Look at its long toothless beak, the crest behind its head and its broad, outstretched wings.',
  narration: {
    sentences: [
      'This is Pteranodon, a flying reptile that lived during the Late Cretaceous.',
      'Look at its long toothless beak, the crest behind its head and its broad, outstretched wings.',
    ],
    pronunciation: [
      {
        text: 'Pteranodon',
        reading: 'teh-RAN-uh-don',
        note: 'The first “p” is silent.',
      },
    ],
  },
  facts: {
    period: 'Late Cretaceous',
    discoveryRegions: ['North America (United States)'],
    size: {
      kind: 'wingspan',
      minMeters: 6,
      maxMeters: 8,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Pteranodon was a pterosaur, a flying reptile rather than a dinosaur. It had no teeth. Fossilised fish remains found in the stomach area show that fish were part of its diet, and the wingspans of larger specimens could exceed 6 metres.',
  sources: [
    {
      title: 'Pterosaur — Kansas Geological Survey',
      url: 'https://geokansas.ku.edu/pterosaur',
      accessedOn: '2026-07-27',
    },
    {
      title: 'The truth about pterosaurs — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/the-truth-about-pterosaurs.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Taxonomy and systematics of Pteranodon — University of Kansas',
      url: 'https://www.biodiversitylibrary.org/part/23017',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The model is labelled only as Pteranodon, so the copy does not assign it to a particular species or sex.',
      'The 6–8 metre figure is a wingspan, not a body length.',
      'The static display does not suggest that the model animation reconstructs real flight.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
