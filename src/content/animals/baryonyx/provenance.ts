import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
} from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  ...createPublishedAssetProvenance({
  "animalName": "重爪龙",
  "model": {
    "source": {
      "title": "Baryonyx",
      "author": "Paleo Modelist",
      "url": "https://sketchfab.com/3d-models/baryonyx-09b838e4bad84b33a647c647f42f4acd",
      "accessedOn": "2026-08-28",
      "sha256": "c61961addc938479f776eac7c7d8dc574836c809f81063a24b4552df3d0b38b7",
      "bytes": 9801706
    },
    "runtime": {
      "bytes": 822340,
      "sha256": "6bd4dbf4924e8b0c22e3687eaed30889d8bbf4f0463395cffc9e458d2688ffdc"
    },
    "modifications": [
      "Relinked and embedded the supplied textures, then compressed the runtime model for browser delivery.",
      "Retimed the source seamless motion into a deterministic closed Idle and preserved the reviewed long snout and hand claw."
    ]
  },
  "backgrounds": {
    "landscape": {
      "source": {
        "title": "Baryonyx Wealden wet-woodland habitat — landscape",
        "generatedOn": "2026-08-29",
        "prompt": "Bright, welcoming Early Cretaceous Wealden wet-woodland museum background with crisp river mud, puddles, stones, ferns, cycads, bark, rippled water and conifer branches; deep focus, quiet central model area, no animal, people, text, logo or watermark.",
        "bytes": 3310099,
        "sha256": "cb3dbc754c11d4d155f769f17b8cfdfb80f96e5d4e3d06df9f9d115bb79870b3"
      },
      "runtime": {
        "bytes": 854516,
        "sha256": "1b5ebdeff9a75fae21d0fe3c43102b0d5a73849add10b95b997567c0a49aa2a4"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to quality-96 WebP without post-process sharpening.",
        "Preserved the approved v5 ground detail and model-safe composition."
      ]
    },
    "portrait": {
      "source": {
        "title": "Baryonyx Wealden wet-woodland habitat — portrait",
        "generatedOn": "2026-08-29",
        "prompt": "Separately composed portrait companion of the bright Early Cretaceous Wealden wet woodland, with crisp river mud, puddles, stones, ferns, cycads, bark, water and conifers; quiet central model area, no animal, people, text, logo or watermark.",
        "bytes": 2988055,
        "sha256": "142615d2ee3cea2bf2f611767d5e73610b2a93275e90c6da6730330c10750894"
      },
      "runtime": {
        "bytes": 728982,
        "sha256": "e9d80b3bfe9aefc2ea93c2d3e2f909079e2ba1b25f1efee7cc1cf31f63a0ca85"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to quality-96 WebP without post-process sharpening.",
        "Preserved the approved v5 ground detail and portrait model-safe composition."
      ]
    }
  },
  "poster": {
    "bytes": 39084,
    "sha256": "c0f928317ae0f775ff5b05eff93630ccb0652deb4ae28a532b5cc86e2d4c0939"
  },
  "posterPortrait": {
    "bytes": 11522,
    "sha256": "3474707d8354dda26d5cee3808785a43ed10ee80c0c15c57b0f03d55faef81d2"
  },
  "thumbnail": {
    "bytes": 38316,
    "sha256": "392892710eb964b4acccf0c1d5c2a31a8a64af70c5fbf9ecab880f33e6e3cf14"
  },
  "thumbnailDerivation": {
    "generatedOn": "2026-08-30",
    "method": "Composited the accepted landscape background with the alpha-preserving transparent model still using the reviewed museum framing.",
    "modifications": [
      "Kept the complete animal silhouette readable at collection-card size.",
      "Encoded as 320 × 320 WebP without text, controls, labels, logos, or watermarks."
    ]
  },
  "derivedImagesGeneratedOn": "2026-08-30",
  "narration": {
    "generatedOn": "2026-09-01",
    "script": "这是重爪龙，一种生活在早白垩世欧洲的棘龙科兽脚类恐龙。看看它细长的吻部和手上的大爪，哪些特征可能帮助它抓住湿滑的猎物？",
    "bytes": 129405,
    "sha256": "bcfcf45d8ca4ffea0251f79932f53829f29791ea96b40a82ede7fc8d4e5fbfca"
  }
}),
  createReviewedEnglishNarrationProvenance('baryonyx', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
