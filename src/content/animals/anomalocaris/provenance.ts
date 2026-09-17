import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
} from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  ...createPublishedAssetProvenance({
  "animalName": "奇虾",
  "model": {
    "source": {
      "title": "Anomalocaris 3D Model",
      "author": "Skache",
      "url": "https://sketchfab.com/3d-models/anomalocaris-3d-model-dad76e60589a41e18a42db1e979f81f8",
      "accessedOn": "2026-08-28",
      "sha256": "6b919aefeb953803eb8e0afebeb2b29bf5e4e60ceed63057bc2fada35d3356a1",
      "bytes": 28849420
    },
    "runtime": {
      "bytes": 1811652,
      "sha256": "147de95a18c771739f918e8ce0319c00fba560d6f415305f57fddc97b96f661a"
    },
    "modifications": [
      "Compressed textures and geometry and added 28 rigid swimming-flap bones plus two segmented frontal-appendage chains.",
      "Authored a varied metachronal flap wave, subtle body drift and frontal-appendage motion as a smooth closed eight-second swimming Idle."
    ]
  },
  "backgrounds": {
    "landscape": {
      "source": {
        "title": "Anomalocaris Cambrian marine habitat — landscape",
        "generatedOn": "2026-08-29",
        "prompt": "Naturalistic middle Cambrian Burgess Shale marine museum background with clear teal water, filtered daylight, a quiet carbonate-platform slope, low silty seafloor and sparse early sponge-like life at the margins; open swimming corridor, no animal, modern reef, text, logo or watermark.",
        "bytes": 2128112,
        "sha256": "b83f860d22b711a80b39be8ea27599409383aba0eeb7c8bc54a8b16414647b42"
      },
      "runtime": {
        "bytes": 273724,
        "sha256": "6c724dfea63bb6d15371e7988eadcff797f7377cdd25488661bbbf54339986fc"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to responsive WebP.",
        "Removed ancillary metadata without adding a runtime tint or filter."
      ]
    },
    "portrait": {
      "source": {
        "title": "Anomalocaris Cambrian marine habitat — portrait",
        "generatedOn": "2026-08-29",
        "prompt": "Separately composed portrait companion of the middle Cambrian marine habitat, with clear teal water, filtered daylight, low silty seafloor and sparse early life at the margins; open central swimming space, no animal, modern reef, text, logo or watermark.",
        "bytes": 1984757,
        "sha256": "795bd9d8ec5375203586b91126ff40ca0c2b313170743c2eaaaeb19475e893ed"
      },
      "runtime": {
        "bytes": 227810,
        "sha256": "fd9cdd5c11b4fa68926b7a00102952603bd20d290d801bcb86dd1ba35e004ce2"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to responsive WebP.",
        "Removed ancillary metadata without adding a runtime tint or filter."
      ]
    }
  },
  "poster": {
    "bytes": 33814,
    "sha256": "a0d729fd6ce565eb96890a077d12083de6631e34774f7a6d73302632f0709829"
  },
  "posterPortrait": {
    "bytes": 14214,
    "sha256": "ae2f76f99ccea6569304cecba85bcda98a2135a9af12108467ede04d7b2436cc"
  },
  "thumbnail": {
    "bytes": 19876,
    "sha256": "8b1b54c271904e12836c6a596220ba9b3f3db75b5c72cd99efd854e14d719939"
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
    "script": "这是奇虾，一种生活在寒武纪海洋里的游泳猎手。看看它两侧一排排的游泳叶、柄眼和前方的捕食附肢，哪一部分最特别？",
    "bytes": 108525,
    "sha256": "a493f6f7e3eda0d5e09698527178a42f8fa6ff14f885c6142d65ab641cbaed99"
  }
}),
  createReviewedEnglishNarrationProvenance('anomalocaris', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
