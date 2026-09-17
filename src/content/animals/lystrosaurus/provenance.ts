import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
} from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  ...createPublishedAssetProvenance({
  "animalName": "水龙兽",
  "model": {
    "source": {
      "title": "Lystrosaurus",
      "author": "seth the yutyrannus",
      "url": "https://sketchfab.com/3d-models/lystrosaurus-32ea6a3bedd948638f9add8da7483b28",
      "accessedOn": "2026-08-28",
      "sha256": "3ca04784949e0c28f648090a23b0eb0d3de49a369d9f27803e00153451272db0",
      "bytes": 2472111
    },
    "runtime": {
      "bytes": 339248,
      "sha256": "f3edc52dc7bbfec681cb7b30b8246f65b84f2980b6bd04f8eee46e5f6a62551a"
    },
    "modifications": [
      "Removed an unbound helper object and compressed geometry and textures for browser delivery.",
      "Authored a deterministic closed eight-second skeletal Idle with stable four-foot grounding."
    ]
  },
  "backgrounds": {
    "landscape": {
      "source": {
        "title": "Lystrosaurus Karoo floodplain habitat — landscape",
        "generatedOn": "2026-08-29",
        "prompt": "Bright, welcoming latest-Permian Karoo floodplain museum background with crisp red-brown silt, small stones, shallow channels, horsetails, seed ferns, bare wood and low eroded hills; deep focus, quiet central model area, no animal, people, text, logo or watermark.",
        "bytes": 2805839,
        "sha256": "e7f8358df801894b7f9b3b6ce6b780d2871ea8dd8b7cbd3de36234fd0141ab0f"
      },
      "runtime": {
        "bytes": 667130,
        "sha256": "6a04c7334312694b553a3430126590a92d11378d18e64710ec450e7b9f02364d"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to quality-96 WebP without post-process sharpening.",
        "Preserved the approved v5 ground detail and model-safe composition."
      ]
    },
    "portrait": {
      "source": {
        "title": "Lystrosaurus Karoo floodplain habitat — portrait",
        "generatedOn": "2026-08-29",
        "prompt": "Separately composed portrait companion of the bright latest-Permian Karoo floodplain, with crisp red-brown silt, stones, shallow channels, horsetails, seed ferns, bare wood and low hills; quiet central model area, no animal, people, text, logo or watermark.",
        "bytes": 3063012,
        "sha256": "73eca79e9c219de9cae41b9aecadef8be0eface6f18799074fc0fadecd483a32"
      },
      "runtime": {
        "bytes": 788862,
        "sha256": "55e46d34fe7b7f6b9f3bee16c01e77960e44b8f2473b847ed5cfd620220b69c7"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to quality-96 WebP without post-process sharpening.",
        "Preserved the approved v5 ground detail and portrait model-safe composition."
      ]
    }
  },
  "poster": {
    "bytes": 42016,
    "sha256": "28a16389d34ce48d72fd015b3be1b1b08a33ee1fa20effa34fd3cb1577833e1e"
  },
  "posterPortrait": {
    "bytes": 12392,
    "sha256": "299cfa842bea6778dd85ead0eca2becbc0139d441ebc2952ad8ab7ddbb958311"
  },
  "thumbnail": {
    "bytes": 30456,
    "sha256": "09d628f086d1a4c47f7d8fc16da378ff1828394db3fe37cbb0d9168d0a76670c"
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
    "generatedOn": "2026-08-29",
    "script": "这是水龙兽，一种生活在二叠纪末到三叠纪初的植食性合弓动物，它不是恐龙。看看它短短的脸、像喙一样的嘴和两枚獠牙，难怪让人一眼就记住。",
    "bytes": 145485,
    "sha256": "736427a33d71f4a5af235961f4daba968d2e84e3068611660785f39c735cb20f"
  }
}),
  createReviewedEnglishNarrationProvenance('lystrosaurus', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
