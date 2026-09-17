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
      title: '3D High-poly Baby Woolly Mammoth',
      author: 'SDPM Esare',
      url: 'https://sketchfab.com/3d-models/3d-high-poly-baby-woolly-mammoth-fce1c86ccedf47a5b9627098be6719d5',
      accessedOn: '2026-07-28',
      bytes: 2_987_840,
      sha256:
        '8f46db6e2ba44c109fdc115506e1048212a876b51060930d0e20a8bd9f472aea',
    },
    runtime: {
      bytes: 1_198_456,
      sha256:
        '623a62621f1c6f2955fd3fe6442be8dfd34cdc94064e1bbb0c5e43e8970a1ece',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Used the original creator’s CC BY 4.0 source rather than the submitted CC BY-NC-SA derivative.',
      'Normalized and repacked the self-contained 1K-texture GLB.',
      'Built a project-authored 8-bone Blender armature with deterministic head, body, four-leg, and two-bone tail weights.',
      'Matched the head and body blend across the disconnected neck surfaces and held the tail root stationary after close-up owner review, preventing either junction from opening during motion.',
      'Authored an eight-second in-place Idle with an approximately 7-degree head pitch and 4-degree turn so the long tusks move clearly, plus a larger distal tail swing.',
      'Normalized the Blender export to one closed-loop Idle clip with two rotation-only channels, then validator-checked and reviewed the derivative in the shared museum viewer.',
    ],
  },
  derivedImagesGeneratedOn: '2026-07-30',
  thumbnailDerivation: {
    ...recomposedCollectionThumbnailDerivation,
    generatedOn: '2026-08-16',
  },
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.mammoth.landscape,
      runtime: {
        bytes: 420_388,
        sha256:
          '2b23ceaf9e6b7f6d270dcb327254f5be27fb764fc2a845c627fa928aa3c01eb4',
      },
      runtimeModifications: [
        'Downscaled the reviewed 4096 × 2304 clarity derivative to 2048 × 1152 with Sharp Lanczos3 resampling.',
        'Encoded as WebP at quality 82 and effort 6 with ancillary metadata removed and no runtime tint or blur.',
      ],
    },
    portrait: {
      source: reviewedBackgroundSources.mammoth.portrait,
      runtime: {
        bytes: 268_126,
        sha256:
          '3b5e795c4abe470c1ca0cfba9d7834397080b76cb261e2ea1d3f1757f0482335',
      },
      runtimeModifications: [
        'Downscaled the reviewed 2304 × 4096 clarity derivative to 1152 × 2048 with Sharp Lanczos3 resampling.',
        'Encoded as WebP at quality 82 and effort 6 with ancillary metadata removed and no runtime tint or blur.',
      ],
    },
  },
  poster: {
    bytes: 81_384,
    sha256:
      'd542ad735c863ba82de7c05c2a34210182459d9e0c6e3a54166cdc6a83165fb5',
  },
  posterPortrait: {
    bytes: 29_570,
    sha256:
      '60535ab5da8eeef84e24fd72eace080c929809a53210ac2d2ba8c0b030d1f82a',
  },
  thumbnail: {
    bytes: 21_440,
    sha256:
      '0d726c166a98708572f559b612068fc7d21d11067d3af94ddf32b9c3f0b73880',
  },
  narration: {
    generatedOn: '2026-07-28',
    script: zhCN.narration.sentences.join(''),
    bytes: 116_925,
    sha256:
      'a771ac8784719d2e1629742f303f6c6c808c88b2a02bfb0b2122b9b96ece52a6',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('mammoth', en),
] as const
