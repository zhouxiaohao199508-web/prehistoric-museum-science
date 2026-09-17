import type { AnimalContentEn } from '../../types'

export const en = {
  name: 'Ichthyosaurs',
  classificationLabel: 'Marine reptiles',
  visibleFeature:
    'Look at its streamlined body and four flippers. Does it look like a little boat made for swimming?',
  narration: {
    sentences: [
      'This is an ichthyosaur. Ichthyosaurs were reptiles that lived in ancient seas.',
      'Look at its streamlined body and four flippers. Does it look like a little boat made for swimming?',
    ],
    pronunciation: [
      {
        text: 'Ichthyosaurs',
        reading: 'ICK-thee-uh-sawz',
      },
    ],
  },
  facts: {
    period: 'Triassic to Late Cretaceous',
    discoveryRegions: ['Ancient marine rocks around the world'],
    size: {
      kind: 'group-range',
      minMeters: 0.9,
      maxMeters: 25,
      note: 'Species varied greatly in size; this is not the length of the animal shown',
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    'Ichthyosaurs were a large group of reptiles adapted for life at sea, not dinosaurs. Different species varied greatly in size and diet. Fossils also show that they gave birth to live young in the water. The model source does not identify a genus or species, so this label stays at group level.',
  sources: [
    {
      title: 'What is an ichthyosaur? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/what-is-an-ichthyosaur.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Earliest ichthyosaur fossil discovered — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/news/2023/april/earliest-ichthyosaur-fossil-discovered-on-remote-arctic-island.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Earliest Triassic ichthyosaur fossils — Current Biology',
      url: 'https://pubmed.ncbi.nlm.nih.gov/36917937/',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      'The model is labelled only as an ichthyosaur, with no genus, species, rock layer or specimen number.',
      'The group-wide size range must not be read as the length of this particular model.',
      'Carnivore is a broad display-level summary and does not mean that every ichthyosaur ate the same food.',
    ],
    editedBy: 'Codex-assisted English adaptation',
    reviewedBy:
      'Independent Codex cross-review (factual fidelity, terminology and back-translation)',
    reviewedOn: '2026-08-07',
  },
} satisfies AnimalContentEn
