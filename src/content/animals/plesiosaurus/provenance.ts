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
      title: 'Plesiosaure',
      author: 'leo kerjean',
      url: 'https://sketchfab.com/3d-models/plesiosaure-2f59d503e0754c9d9e157a90ed415c38',
      accessedOn: '2026-07-30',
      bytes: 5_663_868,
      sha256:
        '56fe092e5b769fde877805e484fc4f077ac1e51ab31f6d0b34b0560857e5f94d',
    },
    runtime: {
      bytes: 2_519_664,
      sha256:
        '4edc54ab21f61eb7b5e38c3b5d87a1816621547a9e7fde33cfdf3efd93b788a8',
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Retained the source hierarchy and display scale while repacking the model as a self-contained runtime GLB.',
      'Applied a desaturated matte aquatic material treatment and added restrained eye sockets, amber irises, dark pupils, and small catchlights to the existing texture atlas.',
      'Authored four project morph targets that relax the permanently up-curved neck, add a head-to-shoulder elliptical neck motion, and move all four flippers independently.',
      'Built a single eight-second Idle at 24 frames per second with two complete swimming cycles, smooth phase transitions, and no locomotion.',
      'Validator-checked the result and reviewed the full neck, tail, eye, and flipper silhouettes in the shared museum viewer.',
    ],
  },
  derivedImagesGeneratedOn: '2026-07-31',
  thumbnailDerivation: recomposedCollectionThumbnailDerivation,
  backgrounds: {
    landscape: {
      source: reviewedBackgroundSources.plesiosaurus.landscape,
      runtime: {
        bytes: 42_220,
        sha256:
          '36cc7edcf6f34366420c7fe98ed064656cd265377fb18829e385124d53c3db9f',
      },
    },
    portrait: {
      source: reviewedBackgroundSources.plesiosaurus.portrait,
      runtime: {
        bytes: 62_060,
        sha256:
          'a36bdf51a3f4ccb72f6c9f97bf13fef2de1c62af6ebd531b0567667fc001986e',
      },
    },
  },
  poster: {
    bytes: 57_298,
    sha256:
      '33fa574cf2f476706dd77137dcff9edac0b1e816f6f075241bd02e4dc2b1f529',
  },
  posterPortrait: {
    bytes: 17_824,
    sha256:
      'e1a5604b3ebe56f005ee4c4fa92041639667850a6a42f940442732b48d578d66',
  },
  thumbnail: {
    bytes: 8_870,
    sha256:
      '695b4c2a0090b7783acee25a5802fce38e748f74ac6ade0f38305bf63b4e2309',
  },
  narration: {
    generatedOn: '2026-07-30',
    script: zhCN.narration.sentences.join(''),
    bytes: 137_325,
    sha256:
      '7f09a3074e675a5e0b5c30b7880af8e2b80acb20308e32356998169630dc9557',
  },
})

export const provenance = [
  ...baseProvenance,
  createReviewedEnglishNarrationProvenance('plesiosaurus', en),
] as const
