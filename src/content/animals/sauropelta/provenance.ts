import { createReviewedEnglishNarrationProvenance } from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  {
    "assetPath": "model/model.glb",
    "kind": "model",
    "source": {
      "type": "third-party",
      "title": "Animated Sauropelta (Free)",
      "author": "Anees Animates",
      "url": "https://sketchfab.com/3d-models/animated-sauropelta-free-c6373f12f3954facb8d5fe48055c9161",
      "accessedOn": "2026-07-31",
      "sha256": "52732b040837bf747ad489a4a6555467e902eaf791cd1af6de919d7585da7b11",
      "bytes": 8701604
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 3591444,
      "sha256": "ef283def4b17e92122442c8cfb617dce7abecf0bdc1962dc2ff1f18835e7a58c"
    },
    "modifications": [
      "Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.",
      "Freeze the reviewed source pose and, when eligible, a source-rig partial mouth-close target before making morph animation deterministic. Operation: bake-and-join.",
      "Align length to X, center the visible bounds, and apply habitat grounding. Operation: canonical-transform.",
      "Export one traceable, closed-loop, in-place project Idle. Operation: replace-runtime-animation.",
      "Authored and validator-checked one closed eight-second land-breathe-tail Idle for the shared museum viewer."
    ],
    "attribution": "“Animated Sauropelta (Free)” by Anees Animates, CC-BY-4.0; modified for the Prehistoric Animal Museum.",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/model-license.txt",
      "provenance/LICENSES/model-source.txt"
    ]
  },
  {
    "assetPath": "backgrounds/landscape.webp",
    "kind": "background",
    "source": {
      "type": "generated",
      "title": "胄甲龙 reviewed habitat — landscape",
      "tool": "OpenAI built-in image_gen",
      "generatedOn": "2026-07-31",
      "prompt": "Empty Early Cretaceous western North American fern floodplain, true 16:9, open central ground stage, museum gouache/matte-painting hybrid, no animals or text.",
      "sha256": "dc398272e2e58882d87209be400232300164c85330e5156afa5feba693b64b31",
      "bytes": 2867381
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned ImageGen output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 287382,
      "sha256": "03c2e212e57c9c6a6e246c3af723fa150d3d1a22ff4091e008ccb271d4ffec1d"
    },
    "modifications": [
      "Sharp deterministic cover resize and WebP encoding",
      "Removed ancillary metadata without applying a runtime tint or filter."
    ],
    "attribution": "Project-generated 胄甲龙 landscape background created with OpenAI ImageGen.",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/background-generation.txt"
    ]
  },
  {
    "assetPath": "backgrounds/portrait.webp",
    "kind": "background",
    "source": {
      "type": "generated",
      "title": "胄甲龙 reviewed habitat — portrait",
      "tool": "OpenAI built-in image_gen",
      "generatedOn": "2026-07-31",
      "prompt": "Portrait companion of the same Early Cretaceous fern floodplain, true 9:16, open central stage, no animals or text.",
      "sha256": "f638d3b24c3d814e9103941ac2ac5fc5d366fb380f47ceefde94c9778097f882",
      "bytes": 3030138
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned ImageGen output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 346800,
      "sha256": "7b524977921b8dcee435ce597c022051fed7f76ac77bbf597b6f0660d8d3fabc"
    },
    "modifications": [
      "Sharp deterministic cover resize and WebP encoding",
      "Removed ancillary metadata without applying a runtime tint or filter."
    ],
    "attribution": "Project-generated 胄甲龙 portrait background created with OpenAI ImageGen.",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/background-generation.txt"
    ]
  },
  {
    "assetPath": "images/poster.webp",
    "kind": "poster",
    "source": {
      "type": "derived",
      "title": "胄甲龙 transparent model still",
      "generatedOn": "2026-08-05",
      "inputAssetPaths": [
        "model/model.glb"
      ],
      "method": "Rendered the deterministic first animation frame at the normal 1200 × 675 landscape runtime camera, composition, size, pose, and lighting; preserved transparent pixels outside the model and contact shadow."
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 59128,
      "sha256": "9aec380ff5e37d85fca6c784ab8c305a032b8ef8e81f04ab897a8b5a1e682dd6"
    },
    "modifications": [
      "Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.",
      "Encoded as lossless WebP without text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Animated Sauropelta (Free)” by Anees Animates, CC-BY-4.0; modified for the Prehistoric Animal Museum.",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/model-license.txt",
      "provenance/LICENSES/model-source.txt",
      "provenance/LICENSES/derived-images.txt"
    ]
  },
  {
    "assetPath": "images/poster-portrait.webp",
    "kind": "poster",
    "source": {
      "type": "derived",
      "title": "胄甲龙 transparent portrait model still",
      "generatedOn": "2026-08-05",
      "inputAssetPaths": [
        "model/model.glb"
      ],
      "method": "Rendered the deterministic first animation frame at the normal 390 × 844 portrait runtime camera, composition, size, pose, and lighting; preserved transparent pixels outside the model and contact shadow."
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 16328,
      "sha256": "6a2c51e29d879ab86d269fd70094fcdbcbf2c4c99a9ae602359bcb72e0b5ff52"
    },
    "modifications": [
      "Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.",
      "Encoded as exact lossless WebP without text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Animated Sauropelta (Free)” by Anees Animates, CC-BY-4.0; modified for the Prehistoric Animal Museum.",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/model-license.txt",
      "provenance/LICENSES/model-source.txt",
      "provenance/LICENSES/derived-images.txt"
    ]
  },
  {
    "assetPath": "images/thumbnail.webp",
    "kind": "thumbnail",
    "source": {
      "type": "derived",
      "title": "胄甲龙 collection thumbnail",
      "generatedOn": "2026-08-01",
      "inputAssetPaths": [
        "model/model.glb",
        "backgrounds/landscape.webp"
      ],
      "method": "Deterministic square crop from the accepted desktop review presentation after hiding all interface chrome."
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 18116,
      "sha256": "120cfba9e90c7701e140616c24c651e43a2f727f79340db9549e1143aba73f9d"
    },
    "modifications": [
      "Selected a card-size crop that keeps the animal readable.",
      "Exported without embedded text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Animated Sauropelta (Free)” by Anees Animates, CC-BY-4.0; modified for the Prehistoric Animal Museum. Scene art generated for this project.",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/model-license.txt",
      "provenance/LICENSES/model-source.txt",
      "provenance/LICENSES/derived-images.txt"
    ]
  },
  {
    "assetPath": "audio/narration.zh-CN.mp3",
    "kind": "narration",
    "source": {
      "type": "generated",
      "title": "胄甲龙 Mandarin narration",
      "tool": "Qwen3-TTS CustomVoice",
      "model": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
      "revision": "85e237c12c027371202489a0ec509ded67b5e4b5; Serena built-in voice",
      "generatedOn": "2026-07-31",
      "prompt": "这是胄甲龙，一种生活在早白垩世北美洲的植食性甲龙类恐龙。看看它背上的骨质护甲和肩部的大刺，像不像穿着一件结实的防护外套？",
      "sha256": "baee6b0e3d30264dab55b2dda1396715ed3757281feab3ee19106b98f98bdc28",
      "bytes": 134445
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned Qwen3-TTS output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 134445,
      "sha256": "baee6b0e3d30264dab55b2dda1396715ed3757281feab3ee19106b98f98bdc28"
    },
    "modifications": [
      "Generated offline from the exact reviewed two-sentence script with the pinned Serena voice.",
      "Normalized to a reviewed 48 kHz mono MP3 without runtime synthesis."
    ],
    "attribution": "Project-generated Mandarin narration produced locally with Qwen3-TTS 0.6B CustomVoice (Serena).",
    "redistributionAllowed": true,
    "evidencePaths": [
      "provenance/LICENSES/narration-rights.txt"
    ]
  },
  createReviewedEnglishNarrationProvenance('sauropelta', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
