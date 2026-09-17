import {
  createPublishedAssetProvenance,
  createReviewedEnglishNarrationProvenance,
} from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  ...createPublishedAssetProvenance({
  "animalName": "棘龙",
  "model": {
    "source": {
      "title": "Spinosaurus",
      "author": "Pedro B. Goulart",
      "url": "https://sketchfab.com/3d-models/spinosaurus-2a325726dd7b4a7c888277f262fd09bc",
      "accessedOn": "2026-08-28",
      "sha256": "a4b9f40d35c78e6cb30ac1f4666f5ed1e204332e8ae2a35ff5e91c98b19da8b4",
      "bytes": 7181248
    },
    "runtime": {
      "bytes": 733612,
      "sha256": "b4b97f2df0acc376495689351bc2c5e1067ab17bd2cd5f8ce4be83e3213d4c84"
    },
    "modifications": [
      "Compressed geometry and embedded textures for browser delivery.",
      "Retimed the source motion into a deterministic closed eight-second in-place Idle and preserved the reviewed full-body pose."
    ]
  },
  "backgrounds": {
    "landscape": {
      "source": {
        "title": "Spinosaurus North African river-delta habitat — landscape",
        "generatedOn": "2026-08-29",
        "prompt": "Bright, welcoming Late Cretaceous North African river-delta museum background with crisp warm-ochre mud, stones, shallow water, sparse cycads and palms, blue-grey water and humid clouds; deep focus, quiet central model area, no animal, people, text, logo or watermark.",
        "bytes": 2627150,
        "sha256": "43168cb9a07d842854aee4f3f94f7622ca13d1204330c1189b879ca667a51ea0"
      },
      "runtime": {
        "bytes": 590984,
        "sha256": "922eb9a2c76bf236773a0ffac8d57006780a631333a04fd7b783d114bb934539"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to quality-96 WebP without post-process sharpening.",
        "Preserved the approved v5 ground detail and model-safe composition."
      ]
    },
    "portrait": {
      "source": {
        "title": "Spinosaurus North African river-delta habitat — portrait",
        "generatedOn": "2026-08-29",
        "prompt": "Separately composed portrait companion of the bright Late Cretaceous North African river delta, with crisp mud, stones, shallow water, cycads, palms and humid clouds; quiet central model area, no animal, people, text, logo or watermark.",
        "bytes": 2829994,
        "sha256": "d0d99cb1da73a9aa63860878fc9eff187391ad9bade86639dd45641ff6eed8b8"
      },
      "runtime": {
        "bytes": 662930,
        "sha256": "094c2707fa3f6aa2aa252b39ce4ba18acb79eaa6f3e343988af94fff40b35519"
      },
      "runtimeModifications": [
        "Converted the accepted exact-size source to quality-96 WebP without post-process sharpening.",
        "Preserved the approved v5 ground detail and portrait model-safe composition."
      ]
    }
  },
  "poster": {
    "bytes": 44268,
    "sha256": "2128be78534751d9d071b1f25c26105359a4a16a5a245073f126322b21a49344"
  },
  "posterPortrait": {
    "bytes": 10686,
    "sha256": "45d1103373529bd5bdd3020da3b801f3da36904f34ad13fe3248c901a9977cf6"
  },
  "thumbnail": {
    "bytes": 28886,
    "sha256": "442c7f423170d5b691357dfb496bd264aed934f24e07973c6246931842ee340b"
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
    "script": "这是棘龙，一种生活在晚白垩世早期北非的大型兽脚类恐龙。看看它狭长的吻部、高高的背帆和长尾巴，你觉得哪些特征可能帮助它在水边生活？",
    "bytes": 142125,
    "sha256": "d2e5fce062d7da5f1a63b0e1773f62402dca56042a5fdf43131587a5f3f26fc0"
  }
}),
  createReviewedEnglishNarrationProvenance('spinosaurus', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
