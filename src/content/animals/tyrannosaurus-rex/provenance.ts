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
      title: 'Tyrant King - Tyrannosaurus',
      author: 'Marcel Schanz',
      url: 'https://sketchfab.com/3d-models/tyrant-king-tyrannosaurus-6465a297fa784598adc49f6e0042d449',
      accessedOn: '2026-07-28',
      bytes: 9_556_672,
      sha256:
        '6d2dee6ffe15e8ea30a87d71a466c14db68220c97f1bed6a8800532196a64705',
    },
    runtime: {
      bytes: 6_304_976,
      sha256:
        'ea15319ca1fa3724f1a961515c36b4834446f5ac30a9b0de49b62881877efa54',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Normalized and repacked the self-contained 1K-texture GLB.',
      'Lifted the Body base-colour texture midtones with a 0.80 luminance gamma and a maximum 1.50 channel scale after a second owner review; mouth, normal, roughness, and other PBR textures were left unchanged.',
      'Re-encoded the adjusted 1K Body base-colour texture as high-quality 4:4:4 JPEG.',
      'Built a project-authored 13-bone Blender armature and deterministic skin weights, with stationary root and leg bones to keep both feet planted.',
      'Reassigned both detached fingernail components on each forelimb to the same arm bone as their corresponding fingers after close-up owner review.',
      'Authored an eight-second in-place Idle with visible spine, neck, head, arm, and four-bone tail motion plus a controlled two-pulse bite whose lower-jaw opening remains at or below approximately 4 degrees.',
      'Reweighted the integrated outer lower-jaw skin and split the shared mouth lining between head and jaw, with smooth hinge and mouth-edge transitions so the skin, lower teeth, and tongue remain together throughout both opening-and-closing pulses.',
      'Matched both 33-vertex hip seam rings to the torso spine weights, then blended each upper leg back to its stationary leg bone over 0.16 model units so the hips remain closed while both feet stay planted.',
      'Normalized the Blender export to one closed-loop Idle clip with ten rotation-only channels, then validator-checked and reviewed the derivative in the shared museum viewer.',
    ],
  },
  derivedImagesGeneratedOn: '2026-08-09',
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.tyrannosaurusRex.landscape,
      runtime: {
        bytes: 327_102,
        sha256:
          'a5e44c070c1915a08a09a4c40cffc6e62f56ac6455b771b396ea1f25418102c1',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.tyrannosaurusRex.portrait,
      runtime: {
        bytes: 284_798,
        sha256:
          '2c0a0969faf61d7f931f672a9add46ac597ac24643ef4728dffa1e9333c2cd1e',
      },
    },
  },
  poster: {
    bytes: 50_890,
    sha256:
      'cbce8194764c1bbc5d519600d46a03d8a7959092316834c713e3966367dd52e9',
  },
  posterPortrait: {
    bytes: 13_880,
    sha256:
      '4064ae7a5b0a32a8610d3da2040e3befe0ad9a6a39c29b0dab9c234d1f89bdaa',
  },
  thumbnail: {
    bytes: 25_592,
    sha256:
      '730afbc1056c1e541288b58017edf18a12b76e77847b324c120a43e8b1edffb3',
  },
  narration: {
    generatedOn: '2026-07-28',
    script: zhCN.narration.sentences.join(''),
    bytes: 106_605,
    sha256:
      '8453b238e6fdcf98fb1e592032c494c324c9b4a3ebc58085ea661e9aba5e4c8c',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('tyrannosaurus-rex', en),
] as const
