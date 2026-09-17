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
      title: 'Gigantoraptor',
      author: 'seth the yutyrannus',
      url: 'https://sketchfab.com/3d-models/gigantoraptor-e51509d66d464104aef1b72c298a40cf',
      accessedOn: '2026-07-28',
      bytes: 4_608_244,
      sha256:
        '3ad3b375aecc4646fe776bd83f7cd916e4cadad7dd0f7a4e2a6aac4f1a76f531',
    },
    runtime: {
      bytes: 1_333_576,
      sha256:
        '26b137edc63f38defdf04d85903a30ad7817c83c5b3d5f5626a1fb2e6f216c0e',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Cleared zero-weight joint indices, deduplicated, pruned, and repacked the GLB.',
      'Authored a 6.5-second in-place museum Idle in Blender 5.2 using the existing 79-bone rig; after two local visual reviews, retained body, tail, and jaw motion at 225% of the authored base while increasing head and neck motion to 450% and both arms to 500%.',
      'Injected 29 rotation-only channels for the torso, neck, head, jaw, arms, and tail into the normalized base GLB while preserving its original mesh and skin hierarchy.',
      'Kept the root, hips, and legs stationary to avoid foot sliding.',
      'Validated and reviewed the self-contained derivative.',
    ],
  },
  derivedImagesGeneratedOn: '2026-07-29',
  thumbnailDerivation: recomposedCollectionThumbnailDerivation,
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.gigantoraptor.landscape,
      runtime: {
        bytes: 233_822,
        sha256:
          'bab0d551f20990e1230c0655cd6fe417e2fe6dd76a83e91f52d1b24ec220d054',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.gigantoraptor.portrait,
      runtime: {
        bytes: 202_316,
        sha256:
          '6bc8a4fce35567552a3fc232ccd21f366f112f3a9ea69d3bb9f3e0198d783964',
      },
    },
  },
  poster: {
    bytes: 59_750,
    sha256:
      'dea94a7fa22d9d52f20d4649b766ca18e48ce8027148d3e5f44c6b2beefe1272',
  },
  posterPortrait: {
    bytes: 22_098,
    sha256:
      '65f2bf3b10f3d20577b44fc0e0a0822816e190b074ee3cdfbd2e7bf7d1ef5324',
  },
  thumbnail: {
    bytes: 21_646,
    sha256:
      '2e9ab1baa6c9fc77e461065b481edee1a6a4afe0cbbcb6a02cd2eed3fc911470',
  },
  narration: {
    generatedOn: '2026-07-28',
    script: zhCN.narration.sentences.join(''),
    bytes: 110_925,
    sha256:
      'a341f9f162f939127d2fa30e3a505b8f40eac08b7850ac485838aab58215a405',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('gigantoraptor', en),
] as const
