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
      title: 'Triceratops dinosaur',
      author: 'wojciechmiedziocha',
      url: 'https://sketchfab.com/3d-models/triceratops-dinosaur-87527079bad44917ab1b98a456b46c7e',
      accessedOn: '2026-07-28',
      bytes: 4_463_796,
      sha256:
        '4ba06e329788e30c166b22edb1a92f68c6220aafa891d7fbdaca577e34c49460',
    },
    runtime: {
      bytes: 3_178_460,
      sha256:
        'e51eeb1c3b9c890cdef1f78c65a74179f2da6d4ed899b32e8833b87d2777cf33',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Normalized and repacked the self-contained 1K-texture GLB.',
      'Built a project-authored 10-bone Blender armature and deterministic skin weights, including stationary four-leg bones.',
      'Authored an eight-second in-place Idle with an approximately 11-degree side-to-side head turn, a subtle nod, and a progressive distal tail wave while the tail root remains stationary over the hips.',
      'Repaired the rear-leg and tail-root junction after close-up owner review by extending the stationary pelvis weights through the disconnected skin overlap.',
      'Normalized the Blender export to one closed-loop Idle clip with four rotation-only channels, then validator-checked and reviewed the derivative in the shared museum viewer.',
    ],
  },
  derivedImagesGeneratedOn: '2026-07-30',
  thumbnailDerivation: recomposedCollectionThumbnailDerivation,
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.triceratops.landscape,
      runtime: {
        bytes: 275_156,
        sha256:
          'bcccc2b41059d1a9b93c7f76193ff5d83c7fa0627c1945bd3c2c30c4a7b6a051',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.triceratops.portrait,
      runtime: {
        bytes: 195_746,
        sha256:
          '1c79aacc9a55f44e630965168b88e15c2f662092ff503210157eb348588598c1',
      },
    },
  },
  poster: {
    bytes: 87_148,
    sha256:
      'e1e40c7eb807ad374b9a822101c93b7f088f72e2f17cebbd3a53b61ad124bf8b',
  },
  posterPortrait: {
    bytes: 24_436,
    sha256:
      'bb4d9d99916de0328dd706d40bb8eac0f7c2ba991c577e4e7e08792a303b2700',
  },
  thumbnail: {
    bytes: 17_936,
    sha256:
      'f8da987a692eb1ab24fda0606c34de788077ce0de7b3686124a017efa62977be',
  },
  narration: {
    generatedOn: '2026-07-28',
    script: zhCN.narration.sentences.join(''),
    bytes: 95_565,
    sha256:
      '2b4c55c486e1050dc28a0d715d88b8b6d7f78ce9215ca9fe8b6451ea2a92a25f',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('triceratops', en),
] as const
