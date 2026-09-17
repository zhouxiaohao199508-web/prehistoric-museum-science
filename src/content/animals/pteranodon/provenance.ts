import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
  recomposedCollectionThumbnailDerivation,
  reviewedBackgroundSources,
} from '../../provenance-helpers'
import { en } from './content.en'
import { zhCN } from './content.zh-CN'

const baseProvenance = createPublishedAssetProvenance({
  animalName: zhCN.name,
  model: {
    source: {
      title: 'Pteranodon (Animated)',
      author: 'Chistodrako._. / Oscar López Riviello',
      url: 'https://sketchfab.com/3d-models/pteranodon-animated-7d7683df41d1405283f160e81a5dff1b',
      accessedOn: '2026-07-26',
      bytes: 7_485_240,
      sha256:
        '2a28d2d47b2fd85d5beffdee24c44a58541edefa40f5edc439270e55e38c44bf',
    },
    runtime: {
      bytes: 3_819_812,
      sha256:
        'abcde65b2ea29c6ae86d8232a5e1a604b05099deb34cebfb30495aff53f61af1',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Converted legacy material data and cleared zero-weight joint indices.',
      'Used Blender 5.2 to transfer the source flying action onto the normalized runtime rig, rebase the root to the museum rest origin, and reduce its translation to 3.5%.',
      'Retained the repaired in-place flight loop as the single Idle clip.',
      'Deduplicated, pruned, repacked, validated, and reviewed the derivative.',
    ],
  },
  derivedImagesGeneratedOn: '2026-07-29',
  thumbnailDerivation: recomposedCollectionThumbnailDerivation,
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.pteranodon.landscape,
      runtime: {
        bytes: 103_742,
        sha256:
          'c5c6d6b3cf886f229b3048af4da27f09abef8b28ef413d343fad9cb57817f902',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.pteranodon.portrait,
      runtime: {
        bytes: 105_390,
        sha256:
          '6badc6d22b404f6c11f6e4ff4bef8cdb28104a538d91d0d6124fe7d144c93e75',
      },
    },
  },
  poster: {
    bytes: 11_250,
    sha256:
      'a7de4a01c75ca4e565dc2bbdba4f2bebd64a6d1e114c66c41bc85c9db8f1c574',
  },
  posterPortrait: {
    bytes: 3_834,
    sha256:
      '3d22a12522c1147698b66e66f55531d7778bee69ff8e1412abb41de62c3e7c68',
  },
  thumbnail: {
    bytes: 7_058,
    sha256:
      'ee445591ed6f30e859e70a3bc15893e631f5a785a4f25acf866ce643365f8706',
  },
  narration: {
    generatedOn: '2026-07-27',
    script: zhCN.narration.sentences.join(''),
    bytes: 95_325,
    sha256:
      'e8fa6768126c25200fb3f1eb5aefb708e4fbf6b8636eacb1acc3a47425499d74',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('pteranodon', en),
] as const
