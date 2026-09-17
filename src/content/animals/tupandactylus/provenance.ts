import { createReviewedEnglishNarrationProvenance } from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  {
    "assetPath": "model/model.glb",
    "kind": "model",
    "source": {
      "type": "third-party",
      "title": "Tupandactylus",
      "author": "Paleo Modelist (@victory_)",
      "url": "https://sketchfab.com/3d-models/tupandactylus-4ea8f4466c2c4e61bc57c12af296d43a",
      "accessedOn": "2026-08-01",
      "sha256": "a4f733b83bdfb29a16c77dd140d921108b811a6f8dbe41fcec7ddeec4a5eba33",
      "bytes": 865680
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 1216972,
      "sha256": "e2c232534c909899d266fb75e1787117d7e17396d677a82e1a63a0872f2f385e"
    },
    "modifications": [
      "Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.",
      "Freeze the reviewed source pose and, when eligible, a source-rig partial mouth-close target before making morph animation deterministic. Operation: bake-and-join.",
      "Align length to X, center the visible bounds, and apply habitat grounding. Operation: canonical-transform.",
      "Export one traceable, closed-loop, in-place project Idle. Operation: replace-runtime-animation.",
      "Authored and validator-checked one closed eight-second flying-wing Idle for the shared museum viewer.",
      "Included the human-reviewed curated-components partial mouth relaxation in the same Idle loop."
    ],
    "attribution": "“Tupandactylus” by Paleo Modelist (@victory_), CC-BY-4.0; modified for the Prehistoric Animal Museum.",
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
      "title": "古神翼龙 reviewed habitat — landscape",
      "tool": "OpenAI built-in image_gen",
      "generatedOn": "2026-08-01",
      "prompt": "Wide Early Cretaceous Crato coastal lagoon with pale limestone shores and open blue-green sky, no animals or text.",
      "sha256": "c065afba930d87fda0ac729b1fcbc89f7b5dddb3ca319afd9366c1586ad3c097",
      "bytes": 2102519
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned ImageGen output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 162502,
      "sha256": "8315cf166e68d330585c1eb39dc51e0664e2fea9f99c6d9842d420b68e70fa73"
    },
    "modifications": [
      "Sharp deterministic cover resize and WebP encoding",
      "Removed ancillary metadata without applying a runtime tint or filter."
    ],
    "attribution": "Project-generated 古神翼龙 landscape background created with OpenAI ImageGen.",
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
      "title": "古神翼龙 reviewed habitat — portrait",
      "tool": "OpenAI built-in image_gen",
      "generatedOn": "2026-08-01",
      "prompt": "Portrait Early Cretaceous Crato lagoon channel with a broad open sky and pale limestone shoals, no animals or text.",
      "sha256": "3a52641c489fc233a2ad6a823fa0d3abbf204ac2c94aad3ac5b7ce3301c7a825",
      "bytes": 2133011
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned ImageGen output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 115988,
      "sha256": "3c1062e441dbff5da00332d4c06c91fc4a4cc15dd7acf27dbf5f888f1c8d1ebc"
    },
    "modifications": [
      "Sharp deterministic cover resize and WebP encoding",
      "Removed ancillary metadata without applying a runtime tint or filter."
    ],
    "attribution": "Project-generated 古神翼龙 portrait background created with OpenAI ImageGen.",
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
      "title": "古神翼龙 transparent model still",
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
      "bytes": 46006,
      "sha256": "41f1447307173eb5db19d4de22d55409e70af5b482e73654a74ef7b9cc93b8b6"
    },
    "modifications": [
      "Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.",
      "Encoded as lossless WebP without text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Tupandactylus” by Paleo Modelist (@victory_), CC-BY-4.0; modified for the Prehistoric Animal Museum.",
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
      "title": "古神翼龙 transparent portrait model still",
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
      "bytes": 26126,
      "sha256": "25ecd95f3157248de2e1e2e79548603fa1c79ca3fa80fc29729d4b1e6fd07a38"
    },
    "modifications": [
      "Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.",
      "Encoded as exact lossless WebP without text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Tupandactylus” by Paleo Modelist (@victory_), CC-BY-4.0; modified for the Prehistoric Animal Museum.",
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
      "title": "古神翼龙 collection thumbnail",
      "generatedOn": "2026-08-07",
      "inputAssetPaths": [
        "model/model.glb",
        "backgrounds/landscape.webp"
      ],
      "method": "Captured the current 1440 × 900 desktop presentation, cropped a clean 500 × 500 animal-and-habitat region outside the interface chrome, resized it to 320 × 320, and encoded it as WebP."
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 14316,
      "sha256": "e5cef97c3e3b558bdf7103feb799fc8814594c4fe07fe144f750363ef4e5cbaf"
    },
    "modifications": [
      "Selected a card-size crop that keeps the animal readable.",
      "Exported without embedded text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Tupandactylus” by Paleo Modelist (@victory_), CC-BY-4.0; modified for the Prehistoric Animal Museum. Scene art generated for this project.",
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
      "title": "古神翼龙 Mandarin narration",
      "tool": "Qwen3-TTS CustomVoice",
      "model": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
      "revision": "85e237c12c027371202489a0ec509ded67b5e4b5; Serena built-in voice",
      "generatedOn": "2026-08-01",
      "prompt": "这是古神翼龙，它是生活在早白垩世巴西的会飞爬行动物，不是恐龙。看看它没有牙齿的喙、巨大的头冠和展开的皮膜翅膀。",
      "sha256": "f63c87174b47b6d7c3bc3cf41c3deea32006658566aa41215939b2aefb722f06",
      "bytes": 108045
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned Qwen3-TTS output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 108045,
      "sha256": "f63c87174b47b6d7c3bc3cf41c3deea32006658566aa41215939b2aefb722f06"
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
  createReviewedEnglishNarrationProvenance('tupandactylus', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
