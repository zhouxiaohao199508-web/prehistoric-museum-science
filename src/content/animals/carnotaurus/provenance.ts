import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
} from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  ...createPublishedAssetProvenance({
  "animalName": "食肉牛龙",
  "model": {
    "source": {
      "title": "CARNOTAURUS DİNOSAUR",
      "author": "Cenker Turhan",
      "url": "https://sketchfab.com/3d-models/carnotaurus-dinosaur-548c9a0575b14deaae1f12ca9a6c31ca",
      "accessedOn": "2026-08-28",
      "sha256": "c960105d905c1f445b11593beb6c387bbb2e77e87b5b19cef519ce8898cea78b",
      "bytes": 31681816
    },
    "runtime": {
      "bytes": 4173696,
      "sha256": "e66ebb901782706aadd2a054bd7965f1c819ead52f73baa5fcf34ca3427265f8"
    },
    "modifications": [
      "Removed the separate rock, calibrated both feet to a grounded pose, and compressed the model for browser delivery.",
      "Retained the original left forelimb, adjusted the original right forelimb, bound lower teeth to the jaw, kept the tongue independent, and authored a closed eight-second jaw-and-tail Idle."
    ]
  },
  "backgrounds": {
    "landscape": {
      "source": {
        "title": "Carnotaurus Patagonian estuary habitat — landscape",
        "generatedOn": "2026-08-29",
        "prompt": "Naturalistic Late Cretaceous Patagonian estuary and tidal-flat museum background with open warm-taupe mud, shallow reflective channels, sparse conifers, cycads and distant hills; bright diffuse light, clean model contact area, no animal, people, text, logo or watermark.",
        "bytes": 2413816,
        "sha256": "cf6bee657567766323c9fd2817e752efd272209de29270374f5e478473a21434"
      },
      "runtime": {
        "bytes": 399550,
        "sha256": "0468967d20f22c1a8ec2ac4b28b9631ece1c5d7abd8bb73a4a2c8fa8d835485a"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to responsive WebP.",
        "Removed ancillary metadata without adding a runtime tint or filter."
      ]
    },
    "portrait": {
      "source": {
        "title": "Carnotaurus Patagonian estuary habitat — portrait",
        "generatedOn": "2026-08-29",
        "prompt": "Separately composed portrait companion of the Late Cretaceous Patagonian estuary and tidal flat, with open warm-taupe mud, reflective channels, sparse non-flowering vegetation and diffuse daylight; no animal, people, text, logo or watermark.",
        "bytes": 2461650,
        "sha256": "e163236025401ab5763d1cf763ed009d1e5e67bb7def3203a69ea9d763354717"
      },
      "runtime": {
        "bytes": 399238,
        "sha256": "362a75eafe77e5f8a8de47f36e588f870302970f3006fdf996b1e8f6787bcf1a"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to responsive WebP.",
        "Removed ancillary metadata without adding a runtime tint or filter."
      ]
    }
  },
  "poster": {
    "bytes": 63544,
    "sha256": "4148a50ab7d8d95392524ec51fe1fce44e79966c0507c1dbec0dd36c5b171b2d"
  },
  "posterPortrait": {
    "bytes": 20586,
    "sha256": "bae0b5a35f917517bc4c04499e5f1f313b0d6903ad93e4a4be5348bd8d2774ee"
  },
  "thumbnail": {
    "bytes": 25004,
    "sha256": "ba63abedd4add5e03b22a7bad465e64b1535d657625b7d60317836234d0a284c"
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
    "generatedOn": "2026-08-31",
    "script": "这是食肉牛龙，一种生活在晚白垩世南美洲的大型肉食恐龙。看看它眼睛上方的双角、短脸和小小的前肢，哪一个特征最容易认出来？",
    "bytes": 132765,
    "sha256": "214732f97ecfc4ec0ceb55ea53f4af1436009fae18a471297f3dfd2887fb984b"
  }
}),
  createReviewedEnglishNarrationProvenance('carnotaurus', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
