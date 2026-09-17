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
      title: 'Maiasaura With Rig',
      author: 'Dino Dan',
      url: 'https://sketchfab.com/3d-models/maiasaura-with-rig-3da9f211ae304bd0afd1d15a290eabbd',
      accessedOn: '2026-07-26',
      bytes: 2_290_700,
      sha256:
        'd9d33b82d3dbfb2b813dcd09f63644bae7d28523e16a0ae8d867638a84a1dfa5',
    },
    runtime: {
      bytes: 1_454_384,
      sha256:
        '31dca5fff3c4c361153385ac6e603c8f6916c26576bb4b8bae4db4f735b6fd27',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Normalized and repacked the self-contained GLB while retaining the source 87-bone rig.',
      'Replaced the cyan-orange toy-like colour treatment with a project-authored warm brown back, pale underside, dark dorsal markings, multiscale mottling, higher roughness, and a clearer skin normal surface.',
      'Authored an eight-second in-place Idle at 24 frames per second with visibly increased torso, head, neck, forelimb, and full-tail motion while retaining stable four-foot contact.',
      'Exported a single closed-loop Idle, validator-checked the result, and reviewed the animated skinned bounds in the shared museum viewer.',
    ],
  },
  derivedImagesGeneratedOn: '2026-08-05',
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.maiasaura.landscape,
      runtime: {
        bytes: 336_442,
        sha256:
          '57da28e0040da8a8dcc53779a1fa1d43f68a76930ef75cdb6ea57a07b013b4d3',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.maiasaura.portrait,
      runtime: {
        bytes: 265_958,
        sha256:
          'd615b288525fc0d144b5a3a0bb17a17439fa81f68323861e9378fd206105fd58',
      },
    },
  },
  poster: {
    bytes: 44_594,
    sha256:
      'e1299d0ff814fa351a168766d85603c0d826f12ffd67d992ed43af12c309b727',
  },
  posterPortrait: {
    bytes: 14_376,
    sha256:
      '6e98b0707b8d4760a1f905f944469ea8511d7c8b8f881c449544e36e09447411',
  },
  thumbnail: {
    bytes: 17_338,
    sha256:
      '25668d76310ee5f0b437c9029f6b2d469aff5b809303ea9fea93b6b54986c7d3',
  },
  narration: {
    generatedOn: '2026-07-30',
    script: zhCN.narration.sentences.join(''),
    bytes: 120_525,
    sha256:
      'c5d2a33d9dab17e968e5e87e40b4f2ff7d0d2e82ee0da3b8d46091da0c1dc970',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('maiasaura', en),
] as const
