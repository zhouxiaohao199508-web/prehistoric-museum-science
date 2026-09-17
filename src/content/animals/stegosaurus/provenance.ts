import { createReviewedEnglishNarrationProvenance } from '../../provenance-helpers'
import type { AssetProvenance } from '../../types'
import { en } from './content.en'

const modelLicense = {
  spdx: 'CC-BY-4.0',
  name: 'Creative Commons Attribution 4.0 International',
  url: 'https://creativecommons.org/licenses/by/4.0/',
} as const

const generatedImageLicense = {
  spdx: 'CC-BY-NC-SA-4.0',
  name: 'CC BY-NC-SA 4.0 project-owned ImageGen output',
  url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
} as const

const sharedBackgroundPrompt =
  'Precise edit of the accepted layered paper-cut and soft-gouache fern forest clearing; subtly raise the horizon and extend continuous level ground through the centred Stegosaurus staging zone; preserve the vegetation, palette, lighting, texture, and framing; no animal, person, text, UI, logo, watermark, or particles.'

const portraitBackgroundPrompt =
  'Precise portrait edit of the accepted layered paper-cut and soft-gouache fern forest clearing; change only the scene depth by moving the distant forest horizon and start of the open clearing upward about 8–10% of image height, extending continuous level ground behind a Stegosaurus whose feet sit around 61% image height; preserve the 9:16 framing, sky, warm haze, distant conifers, border trunks and ferns, foreground leaves, palette, lighting, paper texture, and perspective; no animal, person, text, UI, logo, watermark, particles, platform, ridge, ledge, hard seam, or new focal object.'

export const provenance = [
  {
    assetPath: 'model/model.glb',
    kind: 'model',
    source: {
      type: 'third-party',
      title: 'PBR Stegasaurus (Animated)',
      author: 'Ferocious Industries',
      url: 'https://sketchfab.com/3d-models/pbr-stegasaurus-animated-ec254ea1554941fe8a131f62db0faf3d',
      accessedOn: '2026-07-26',
      sha256:
        '611aa55ad61025a5ec6391081f70bb916e60909b73361e5919f73acfa9012d75',
      bytes: 8_026_408,
    },
    license: modelLicense,
    runtime: {
      sha256:
        '2f1564c1f3f07e41ddb21b1f190621baba2ea5ea9c97c36cd89256ff60bddcea',
      bytes: 3_884_968,
    },
    modifications: [
      'Compressed geometry and animation with high-precision Meshopt and converted embedded PNG textures to lossless WebP for browser delivery.',
      'Downloaded as the converted GLB with 1K textures.',
      'Converted legacy specular/glossiness materials to metallic/roughness.',
      'Cleared zero-weight joint indices.',
      'Retained IdleA only, renamed it Idle, pruned unused data, and repacked the GLB.',
      'Corrected the project-facing animal name from “Stegasaurus” to “Stegosaurus”.',
    ],
    attribution:
      '“PBR Stegasaurus (Animated)” by Ferocious Industries, CC BY 4.0; modified for the Prehistoric Animal Museum.',
    redistributionAllowed: true,
    evidencePaths: [
      'provenance/LICENSES/model-license.txt',
      'provenance/LICENSES/model-source.txt',
    ],
  },
  {
    assetPath: 'backgrounds/landscape.webp',
    kind: 'background',
    source: {
      type: 'generated',
      title: 'Stegosaurus prehistoric forest — landscape',
      tool: 'OpenAI built-in image_gen',
      generatedOn: '2026-07-29',
      prompt: `${sharedBackgroundPrompt} Subtle 16:9 correction from roughly 62% to about 55% image height.`,
      sha256:
        '508cfc15ccd3f0620e05f183110bfd70db7139bee60856d269657a8093badbed',
      bytes: 2_956_941,
    },
    license: generatedImageLicense,
    runtime: {
      sha256:
        '9a1990a3f554b0e237b57298a8495cf4ba7f7db450c1d4795cd9d6a4221e64e4',
      bytes: 345_538,
    },
    modifications: [
      'Converted the selected 1672 × 941 PNG candidate to lossy WebP at quality 82.',
      'Removed ancillary metadata without applying a runtime tint, filter, or colour overlay.',
    ],
    attribution:
      'Project-generated Stegosaurus landscape created with OpenAI ImageGen.',
    redistributionAllowed: true,
    evidencePaths: ['provenance/LICENSES/background-generation.txt'],
  },
  {
    assetPath: 'backgrounds/portrait.webp',
    kind: 'background',
    source: {
      type: 'generated',
      title: 'Stegosaurus prehistoric forest — portrait',
      tool: 'OpenAI built-in image_gen',
      generatedOn: '2026-07-31',
      prompt: portraitBackgroundPrompt,
      sha256:
        'e042dd7de1e9ad6d2f3703d51640af5d1fbf3bcd1a9ba2b3e55e76f956277a47',
      bytes: 2_815_335,
    },
    license: generatedImageLicense,
    runtime: {
      sha256:
        '7b432f99dab96bb76bc4563776c7b84b03766d128eb0afcc024a10be7a4894ed',
      bytes: 315_482,
    },
    modifications: [
      'Converted the selected 941 × 1672 PNG candidate to lossy WebP at quality 82.',
      'Removed ancillary metadata without applying a runtime tint, filter, or colour overlay.',
    ],
    attribution:
      'Project-generated Stegosaurus portrait created with OpenAI ImageGen.',
    redistributionAllowed: true,
    evidencePaths: ['provenance/LICENSES/background-generation.txt'],
  },
  {
    assetPath: 'images/poster.webp',
    kind: 'poster',
    source: {
      type: 'derived',
      title: 'Stegosaurus transparent model still',
      generatedOn: '2026-08-05',
      inputAssetPaths: ['model/model.glb'],
      method:
        'Rendered the deterministic first animation frame at the normal 1200 × 675 landscape runtime camera, composition, size, pose, and lighting; preserved transparent pixels outside the model and contact shadow.',
    },
    license: modelLicense,
    runtime: {
      sha256:
        '93838fb6e2f8cb857f47184b21e6c1ad181cea69890c577ed9ab1e64345ace81',
      bytes: 112_482,
    },
    modifications: [
      'Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.',
      'Encoded as exact lossless WebP without text, controls, labels, logos, or watermarks.',
    ],
    attribution:
      '“PBR Stegasaurus (Animated)” by Ferocious Industries, CC BY 4.0; modified for the Prehistoric Animal Museum.',
    redistributionAllowed: true,
    evidencePaths: [
      'provenance/LICENSES/model-license.txt',
      'provenance/LICENSES/derived-images.txt',
    ],
  },
  {
    assetPath: 'images/poster-portrait.webp',
    kind: 'poster',
    source: {
      type: 'derived',
      title: 'Stegosaurus transparent portrait model still',
      generatedOn: '2026-08-05',
      inputAssetPaths: ['model/model.glb'],
      method:
        'Rendered the deterministic first animation frame at the normal 390 × 844 portrait runtime camera, composition, size, pose, and lighting; preserved transparent pixels outside the model and contact shadow.',
    },
    license: modelLicense,
    runtime: {
      sha256:
        '512caefd3317382cb020dd1ce4fbf57573b6f7a6965f032d59bea0f3f024417b',
      bytes: 27_998,
    },
    modifications: [
      'Removed the habitat composite and all interface chrome; kept only the model and contact shadow on a transparent background.',
      'Encoded as exact lossless WebP without text, controls, labels, logos, or watermarks.',
    ],
    attribution:
      '“PBR Stegasaurus (Animated)” by Ferocious Industries, CC BY 4.0; modified for the Prehistoric Animal Museum.',
    redistributionAllowed: true,
    evidencePaths: [
      'provenance/LICENSES/model-license.txt',
      'provenance/LICENSES/derived-images.txt',
    ],
  },
  {
    assetPath: 'images/thumbnail.webp',
    kind: 'thumbnail',
    source: {
      type: 'derived',
      title: 'Stegosaurus collection thumbnail',
      generatedOn: '2026-08-07',
      inputAssetPaths: ['model/model.glb', 'backgrounds/landscape.webp'],
      method:
        'Captured the current 1440 × 900 desktop presentation in model focus mode, cropped a clean 900 × 900 animal-and-habitat region, resized it to 320 × 320, and encoded it as WebP.',
    },
    license: modelLicense,
    runtime: {
      sha256:
        'de3175b49c1342759d7de8b987f927b09da0e3c0441e7ce76009308ebe694ad9',
      bytes: 33_072,
    },
    modifications: [
      'Replaced the letterboxed overview with a closer crop that keeps the head and back plates readable at card size.',
      'Exported a 320 × 320 WebP without embedded text, controls, or labels.',
    ],
    attribution:
      'Thumbnail includes “PBR Stegasaurus (Animated)” by Ferocious Industries, CC BY 4.0; scene art generated for this project.',
    redistributionAllowed: true,
    evidencePaths: [
      'provenance/LICENSES/model-license.txt',
      'provenance/LICENSES/derived-images.txt',
    ],
  },
  {
    assetPath: 'audio/narration.zh-CN.mp3',
    kind: 'narration',
    source: {
      type: 'generated',
      title: 'Stegosaurus Mandarin narration',
      tool: 'Qwen3-TTS CustomVoice',
      model: 'Qwen3-TTS-12Hz-0.6B-CustomVoice',
      revision: 'Serena built-in voice; deterministic local generation',
      generatedOn: '2026-07-27',
      prompt:
        '这是剑龙，它是一种生活在晚侏罗世的食草恐龙。看看它背上的两排骨板，像不像一列起伏的小山？',
      sha256:
        '675f68b9f019f5b913089a864803ddc69676c505deee289f4b6ea7641cde6464',
      bytes: 85_725,
    },
    license: {
      spdx: 'CC-BY-NC-SA-4.0',
      name: 'CC BY-NC-SA 4.0 project-owned Qwen3-TTS output',
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    },
    runtime: {
      sha256:
        '675f68b9f019f5b913089a864803ddc69676c505deee289f4b6ea7641cde6464',
      bytes: 85_725,
    },
    modifications: [
      'Generated offline from the exact reviewed two-sentence script.',
      'Normalized to a reviewed 48 kHz mono MP3 without runtime synthesis.',
    ],
    attribution:
      'Project-generated Mandarin narration produced locally with Qwen3-TTS 0.6B CustomVoice (Serena).',
    redistributionAllowed: true,
    evidencePaths: ['provenance/LICENSES/narration-rights.txt'],
  },
  createReviewedEnglishNarrationProvenance('stegosaurus', en),
] satisfies readonly [
  AssetProvenance,
  ...AssetProvenance[],
]
