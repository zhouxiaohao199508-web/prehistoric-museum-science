import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
} from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  ...createPublishedAssetProvenance({
  "animalName": "始祖鸟",
  "model": {
    "source": {
      "title": "Archaeopteryx",
      "author": "khata",
      "url": "https://sketchfab.com/3d-models/archaeopteryx-cbec5591c584438392824d13fbef401b",
      "accessedOn": "2026-08-28",
      "sha256": "749d31141a63a89a8e939842c98bad0d12cd1168114a9bc51937046c8255252e",
      "bytes": 66720542
    },
    "runtime": {
      "bytes": 5954164,
      "sha256": "bf3e125a0b834202ba4a3709788375165d68bcd79691692a17debc22702e89da"
    },
    "modifications": [
      "Restored supplied textures, compressed the runtime model, and changed feather transparency to stable alpha masking.",
      "Retained the author-authored fully extended wing interval and retimed paired wing, body, neck, head and tail motion into a closed eight-second two-flap Idle."
    ]
  },
  "backgrounds": {
    "landscape": {
      "source": {
        "title": "Archaeopteryx Solnhofen lagoon habitat — landscape",
        "generatedOn": "2026-08-29",
        "prompt": "Crisp high-resolution Late Jurassic Solnhofen lagoon museum background with a high shoreline, broad pale limestone foreground, turquoise lagoon, edge vegetation and bright morning light; quiet model area, no animal, people, text, logo or watermark.",
        "bytes": 3196227,
        "sha256": "c52db27a669facd56c6d43a0765016c0cddf71b205737415ccbae19112a25fe5"
      },
      "runtime": {
        "bytes": 665874,
        "sha256": "a20650760ab07b5859567f5d71d2f034b4fbb60860db440124b1af5c65bd6931"
      },
      "runtimeModifications": [
        "Converted the accepted source to quality-92 WebP with mild sigma-0.45 sharpening.",
        "Preserved the approved v2 high-horizon model-safe composition."
      ]
    },
    "portrait": {
      "source": {
        "title": "Archaeopteryx Solnhofen lagoon habitat — portrait",
        "generatedOn": "2026-08-29",
        "prompt": "Separately composed crisp portrait companion of the Late Jurassic Solnhofen lagoon, with a high shoreline, broad pale limestone foreground, turquoise lagoon, edge vegetation and bright morning light; quiet model area, no animal, people, text, logo or watermark.",
        "bytes": 3342094,
        "sha256": "932a83a0396e1cb1e4e59b8b57f25d0ee8f6ef457e80aebbdcace01ebc1fdac1"
      },
      "runtime": {
        "bytes": 711456,
        "sha256": "fbbad2b996d6115d0b5b95fc30093599c80eeb62c590cb5124315cd7906ab5c5"
      },
      "runtimeModifications": [
        "Converted the accepted source to quality-92 WebP with mild sigma-0.45 sharpening.",
        "Preserved the approved v2 high-horizon portrait composition."
      ]
    }
  },
  "poster": {
    "bytes": 57524,
    "sha256": "8317b82b3447ae2a08aca52d9054ee0bfd25aae2045aec9e8a41b53228d21d83"
  },
  "posterPortrait": {
    "bytes": 22770,
    "sha256": "f35ef600486746fa5dbfa180326467f145b52595c2780f23f967f4e8c0d88ffa"
  },
  "thumbnail": {
    "bytes": 35960,
    "sha256": "ad2118c1f284a830d003d04701803aa3b06395428d48a7c226bc05a74d11743c"
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
    "script": "这是始祖鸟，一种生活在晚侏罗世德国的小型有羽毛恐龙。看看它的羽毛、翅膀爪和长尾巴，哪些地方像鸟，哪些地方又像恐龙？",
    "bytes": 129645,
    "sha256": "8bae3d056d4e92a5a2059a2502d9c6b97069e95ae80b13cc14dc9fd6c4c3e91a"
  }
}),
  createReviewedEnglishNarrationProvenance('archaeopteryx', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
