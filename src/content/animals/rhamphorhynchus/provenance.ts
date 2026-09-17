import { createReviewedEnglishNarrationProvenance } from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

export const provenance = [
  {
    "assetPath": "model/model.glb",
    "kind": "model",
    "source": {
      "type": "third-party",
      "title": "Low-poly Rhamphorhynchus idle",
      "author": "Robear (@xiaorobear)",
      "url": "https://sketchfab.com/3d-models/low-poly-rhamphorhynchus-idle-c1e35c7ac4374c778f78025717694675",
      "accessedOn": "2026-07-31",
      "sha256": "d454ee25a6165bd41852a58fdceae978bd59bd284879ec0692e820a57c8a4c2b",
      "bytes": 2336520
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 2398216,
      "sha256": "16b5ab37ac44e177c3e12c229e6f0b27fab669c3d6e74e5b5bdf54ed3a68a935"
    },
    "modifications": [
      "Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.",
      "Freeze the reviewed source pose and, when eligible, a source-rig partial mouth-close target before making morph animation deterministic. Operation: bake-and-join.",
      "Align length to X, center the visible bounds, and apply habitat grounding. Operation: canonical-transform.",
      "Export one traceable, closed-loop, in-place project Idle. Operation: replace-runtime-animation.",
      "Authored and validator-checked one closed eight-second flying-wing Idle for the shared museum viewer."
    ],
    "attribution": "“Low-poly Rhamphorhynchus idle” by Robear (@xiaorobear), CC-BY-4.0; modified for the Prehistoric Animal Museum.",
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
      "title": "喙嘴翼龙 reviewed habitat — landscape",
      "tool": "OpenAI built-in image_gen",
      "generatedOn": "2026-07-31",
      "prompt": "Wide Late Jurassic Solnhofen limestone archipelago and shallow lagoon, low horizon with an open blue-teal central flight area, museum environment art, no animals or text.",
      "sha256": "928495d01c4fd003c0f8e4ae6f1c117382d3d8fbc810b4b9dd8543be720ba927",
      "bytes": 1983510
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned ImageGen output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 112736,
      "sha256": "418379f31b603ab69ed302f025c200d7f33ec1547d726369fc029fcc7a846d2b"
    },
    "modifications": [
      "Sharp deterministic cover resize and WebP encoding",
      "Removed ancillary metadata without applying a runtime tint or filter."
    ],
    "attribution": "Project-generated 喙嘴翼龙 landscape background created with OpenAI ImageGen.",
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
      "title": "喙嘴翼龙 reviewed habitat — portrait",
      "tool": "OpenAI built-in image_gen",
      "generatedOn": "2026-07-31",
      "prompt": "Portrait Late Jurassic Solnhofen lagoon channel with a broad open blue-teal sky and low limestone islands, museum environment art, no animals or text.",
      "sha256": "b3e5f1340547a64788b523204244e508ecba350d4bf1f036867f39ae29e5d04d",
      "bytes": 2171737
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned ImageGen output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 121212,
      "sha256": "4f761bca9892888876cef2dd8220484c755ac6804dc5d67277775c10c51de9f2"
    },
    "modifications": [
      "Sharp deterministic cover resize and WebP encoding",
      "Removed ancillary metadata without applying a runtime tint or filter."
    ],
    "attribution": "Project-generated 喙嘴翼龙 portrait background created with OpenAI ImageGen.",
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
      "title": "喙嘴翼龙 transparent model still",
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
      "bytes": 21166,
      "sha256": "e0e930d6fd2c1305ca7206054fe9780931797d04861e184f7bfb49c2ba048a58"
    },
    "modifications": [
      "Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.",
      "Encoded as lossless WebP without text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Low-poly Rhamphorhynchus idle” by Robear (@xiaorobear), CC-BY-4.0; modified for the Prehistoric Animal Museum.",
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
      "title": "喙嘴翼龙 transparent portrait model still",
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
      "bytes": 7180,
      "sha256": "7c213881b97eff917d5d0f4a31c659b40e9446fe5d1c24156326a3cddc857ab8"
    },
    "modifications": [
      "Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.",
      "Encoded as exact lossless WebP without text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Low-poly Rhamphorhynchus idle” by Robear (@xiaorobear), CC-BY-4.0; modified for the Prehistoric Animal Museum.",
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
      "title": "喙嘴翼龙 collection thumbnail",
      "generatedOn": "2026-08-01",
      "inputAssetPaths": [
        "images/poster.webp"
      ],
      "method": "Cropped the reviewed poster to a readable 320 × 320 WebP collection image."
    },
    "license": {
      "spdx": "CC-BY-4.0",
      "name": "Creative Commons Attribution 4.0 International",
      "url": "https://creativecommons.org/licenses/by/4.0/"
    },
    "runtime": {
      "bytes": 8706,
      "sha256": "f5d34e955c8401fdb2708ff7c94ac99e35950de22d77ab8a57fe4a66990d5a64"
    },
    "modifications": [
      "Selected a card-size crop that keeps the animal readable.",
      "Exported without embedded text, controls, labels, logos, or watermarks."
    ],
    "attribution": "“Low-poly Rhamphorhynchus idle” by Robear (@xiaorobear), CC-BY-4.0; modified for the Prehistoric Animal Museum. Scene art generated for this project.",
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
      "title": "喙嘴翼龙 Mandarin narration",
      "tool": "Qwen3-TTS CustomVoice",
      "model": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
      "revision": "85e237c12c027371202489a0ec509ded67b5e4b5; Serena built-in voice",
      "generatedOn": "2026-08-01",
      "prompt": "这是喙嘴翼龙，它是生活在晚侏罗世、会飞的爬行动物，不是恐龙。看看它长长的尾巴、尾巴末端的小帆和展开的皮膜翅膀。",
      "sha256": "11dc961e14dfd934f1577ec041d5704e23d235524500d7cbb9b18cef4f18750b",
      "bytes": 109725
    },
    "license": {
      "spdx": "CC-BY-NC-SA-4.0",
      "name": "CC BY-NC-SA 4.0 project-owned Qwen3-TTS output",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    },
    "runtime": {
      "bytes": 109725,
      "sha256": "11dc961e14dfd934f1577ec041d5704e23d235524500d7cbb9b18cef4f18750b"
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
  createReviewedEnglishNarrationProvenance('rhamphorhynchus', en),
] as const satisfies readonly [AssetProvenance, ...AssetProvenance[]]
