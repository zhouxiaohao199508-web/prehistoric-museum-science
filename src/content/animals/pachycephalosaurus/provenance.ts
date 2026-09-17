import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
  reviewedBackgroundSources,
} from '../../provenance-helpers'
import { en } from './content.en'
import { zhCN } from './content.zh-CN'

const baseProvenance = createPublishedAssetProvenance({
  animalName: zhCN.name,
  model: {
    source: {
      title: 'PBR Pachycephalasaurus Animated',
      author: 'Ferocious Industries',
      url: 'https://sketchfab.com/3d-models/pbr-pachycephalasaurus-animated-6eea5cee4afa4730bf75c6329a43e56d',
      accessedOn: '2026-07-26',
      bytes: 14_237_440,
      sha256:
        '4ded387365fb9005dc07516658b982001e6e5c2794d5211bd9885dd12d6ddefd',
    },
    runtime: {
      bytes: 4_079_428,
      sha256:
        'ac3539e1119aed28af89296f92f1bae02f0f5a796323bd1738f91c6b069dda48',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Converted legacy material data to metallic/roughness.',
      'Cleared zero-weight joint indices and retained the presentation-safe Idle clip.',
      'Deduplicated, pruned, repacked, validated, and reviewed the derivative.',
    ],
  },
  derivedImagesGeneratedOn: '2026-07-29',
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.pachycephalosaurus.landscape,
      runtime: {
        bytes: 367_396,
        sha256:
          'd75b12b1689c68ff0c878ea1c8f2c561f26bdbcc5b51f2c0898d9713a2a161f6',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.pachycephalosaurus.portrait,
      runtime: {
        bytes: 264_054,
        sha256:
          '21e18496811c876627a68d4335caac671e920a1300604050e80786a3ccfab6d2',
      },
    },
  },
  poster: {
    bytes: 83_738,
    sha256:
      '7344dbe2798e99e158a5aed5b38ce5038d619f689da0c550fda1b600eb49a2c7',
  },
  posterPortrait: {
    bytes: 25_622,
    sha256:
      'b2cfb7fdf43c532716ae609546db17a0c1c250128cacd2396a97c0a70b249b36',
  },
  thumbnail: {
    bytes: 22_934,
    sha256:
      'ef29131bb29b87321ab742f816f3f67c9e53cbb3905f4ebbfb786ec2cc7792d8',
  },
  narration: {
    generatedOn: '2026-07-27',
    script: zhCN.narration.sentences.join(''),
    bytes: 101_325,
    sha256:
      'dbf97da7d938cf41f28e060f3d7cffe898e0be2ffd3883af1211a4b878171de2',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('pachycephalosaurus', en),
] as const
