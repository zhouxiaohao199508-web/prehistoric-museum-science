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
      title: 'ichthyosaurus',
      author: 'Julian Johnson-Mortimer / FreddyFoxFreddy',
      url: 'https://sketchfab.com/3d-models/ichthyosaurus-ef8609f5efa84984bc1800bdb36aac3c',
      accessedOn: '2026-08-04',
      bytes: 8_751_284,
      sha256:
        'cfeb3db3b31e36180249cffd9e435b3c6a01ad0075d31b7efb2bc1b9025368dc',
    },
    runtime: {
      bytes: 5_737_920,
      sha256:
        '226f5f6055656f10498c641f0aa5a124dcfffc228d945b0f7484bfd480817f31',
    },
    modifications: [
      'Made neighbouring quaternion keys hemisphere-continuous, then resampled the authored CUBICSPLINE bone rotations to 24 fps LINEAR tracks before high-precision Meshopt compression; this removes opposite-sign half-turn spikes and prevents the compression filter from treating spline tangents as normalized rotations. Converted embedded PNG textures to lossless WebP for browser delivery.',
      'Welded the source head and body, closed twelve residual boundary loops, softened the pink wound-like marks and ring-shaped head artifact, and preserved a complete mouth interior.',
      'Re-UVed the accepted body and authored a 2K dark-dorsal/light-ventral aquatic base colour with irregular mottling and tangent-space surface detail plus a 1K roughness map; the skin remains matte and does not imitate fish scales.',
      'Reduced the source teeth from approximately 69,632 triangles to approximately 12,500 while preserving their readable silhouette.',
      'Built a project-authored fourteen-bone Blender rig and one six-second in-place Idle: a six-segment tail chain carries two continuous travelling waves, the front fins move by approximately eight degrees, the rear fins by approximately 4.5 degrees, and the root remains stationary.',
      'Shifted the Idle to begin at exactly zero seconds, made every rotation track close on the same quaternion, and periodically smoothed the head, neck, and body tracks so loop wraparound cannot produce a sudden head shake.',
      'Cleared stale normalized flags after promoting repaired quaternion accessors to floating point so the runtime GLTF loader receives spec-valid animation data.',
      'Normalized the derivative to one closed-loop Idle, repacked it, validated it with zero Khronos errors and warnings before runtime compression, and reviewed it in the shared museum viewer.',
    ],
  },
  derivedImagesGeneratedOn: '2026-08-05',
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.ichthyosaur.landscape,
      runtime: {
        bytes: 140_068,
        sha256:
          '8bf2ad8aa97c77de62f077937f349c9ea46ba4594c7893051a20f9c613af29ec',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.ichthyosaur.portrait,
      runtime: {
        bytes: 170_770,
        sha256:
          '3ae5a51044ab7b19e5df36c3ed0276f70e003960bcb849a176ef50155ccc512f',
      },
    },
  },
  poster: {
    bytes: 28_482,
    sha256:
      '6fe4ed85e7caf25a502a7aae218de8a1e99662aeba2c3021ad607c42904ae4ec',
  },
  posterPortrait: {
    bytes: 8_834,
    sha256:
      '8c57dad6101d0086bb548f7bdead01b86d57d1155cedf4b61da67a625a204949',
  },
  thumbnail: {
    bytes: 11_002,
    sha256:
      '4cba08ca4c7e727b29b61a95dc5df76b3661a59726845df4f45212a14a20b98e',
  },
  narration: {
    generatedOn: '2026-07-27',
    script: zhCN.narration.sentences.join(''),
    bytes: 94_365,
    sha256:
      '5ab57bd9221ab75280f8020b5c01353447a345e1428d99b455bfdc71492a02a1',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('ichthyosaur', en),
] as const
