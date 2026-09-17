import type { AnimalContentEn } from '../../../content/types'

export const en = {
  name: 'Tupandactylus',
  classificationLabel: 'Toothless pterosaur with a huge head crest',
  visibleFeature:
    'Look at its toothless beak, enormous head crest and outstretched wings made from skin membranes.',
  narration: {
    sentences: [
      'This is Tupandactylus, a flying reptile from Early Cretaceous Brazil. It was not a dinosaur.',
      'Look at its toothless beak, enormous head crest and outstretched wings made from skin membranes.',
    ],
    pronunciation: [
      {
        text: 'Tupandactylus',
        reading: 'too-pan-DAK-tih-lus',
      },
    ],
  },
  facts: {
    period: 'Early Cretaceous',
    discoveryRegions: ['north-eastern Brazil, South America'],
    size: {
      kind: 'wingspan',
      minMeters: 2.7,
      maxMeters: 2.7,
    },
    diet: 'unknown',
  },
  parentClassificationNote:
    'Tupandactylus was a pterosaur, a flying reptile rather than a dinosaur or a bird. Fossils from Brazil’s Crato Formation preserve a toothless beak and an enormous crest made from bony supports and soft tissue. One nearly complete adult Tupandactylus specimen had an estimated wingspan of about 2.7 metres. Some studies have suggested that it ate plants or that its huge crest was better suited to shorter flights, but these ideas are not direct evidence of its food or behaviour. The model’s crest colours, wing patterns and exact flapping movement are scientifically informed artistic reconstructions.',
  sources: [
    {
      title:
        'Osteology of an exceptionally well-preserved tapejarid skeleton from Brazil',
      url: 'https://doi.org/10.1371/journal.pone.0254789',
      accessedOn: '2026-08-01',
    },
    {
      title:
        'New information on Tupandactylus imperator and tapejarid relationships',
      url: 'https://doi.org/10.4202/app.2010.0057',
      accessedOn: '2026-08-01',
    },
    {
      title: 'New tapejarine pterosaur from the Early Cretaceous of Brazil',
      url: 'https://doi.org/10.1371/journal.pone.0162692',
      accessedOn: '2026-08-01',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The model page identifies only the genus Tupandactylus, so the copy does not infer a species, age or sex from the crest shape.',
      'The approximately 2.7 metre wingspan comes from one nearly complete adult T. navigans specimen; it is not a precise minimum and maximum for the whole genus.',
      'The toothless beak and huge soft-tissue crest have fossil evidence, but the crest’s colours, patterns and display role are unknown.',
      'Plant-eating and limits on flight distance are proposed interpretations, not facts presented as certain to children.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
