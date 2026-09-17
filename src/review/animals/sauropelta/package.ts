import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'sauropelta',
  status: 'draft',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    initialYawDegrees: 0,
    portraitSafeAreaPadding: 0.14,
    safeAreaPadding: 0.12,
    preciseBounds: true,
    shadow: 'ground',
    shadowOpacity: 0.32,
    shadowScale: 0.58,
    toneMappingExposure: 1.08,
  },
  animation: {
    clip: 'Idle',
    loop: 'repeat',
    speed: 1,
  },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('sauropelta', 'model.glb'),
    modelBytes: 8_876_228,
    poster: reviewAssetUrl('sauropelta', 'poster.webp'),
    posterPortrait: reviewAssetUrl('sauropelta', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('sauropelta', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('sauropelta', 'background-landscape'),
      portrait: reviewAssetUrl('sauropelta', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('sauropelta', 'narration.mp3'),
    },
  },
  review: {
    badge: '自动 QA 通过',
    status: '胄甲龙完整本地草稿，等待科学、视觉、动作与听审',
    note:
      '直接来源、CC BY 4.0、源档案、自包含 GLB、预算、Khronos validator、八秒 Idle、landmarks 和五视口证据由新增自动化核对。Blender 流程冻结源模型可见姿态、移除控制球辅助网格并生成单一 morph-target Idle；这些工程通过不等于产品负责人批准。',
    checks: [
      '人工核对肩刺、足部和装甲排列，不把作者的“scientifically accurate”当作科学批准。',
      '完整观看两个八秒循环，确认呼吸和尾端响应自然、四足无滑步或穿地。',
      '近看材质、眼睛与模型在两张早白垩世背景中的协调和真实感。',
      '完整听审 Qwen3-TTS Serena 中文候选旁白，特别检查“胄甲龙”和“白垩世”的发音。',
    ],
    accent: {
      strong: '#6e5c2e',
      soft: '#e4d2a0',
    },
    modelCredit: {
      attribution:
        '“Animated Sauropelta (Free)” by Anees Animates, CC BY 4.0; source pose baked, helper meshes removed, normalized, and given a project-authored eight-second morph-target Idle for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Animated Sauropelta (Free)',
      sourceUrl:
        'https://sketchfab.com/3d-models/animated-sauropelta-free-c6373f12f3954facb8d5fe48055c9161',
    },
  },
  draftNotes: [
    '仅存在于显式本地 review allowlist；没有进入 src/content/animals 或生产集合。',
    '自动 hard gates 已通过，但科学身份、解剖、材质、动作自然度、背景、中文内容、完整听审和生产决定全部仍是 human-only。',
    'promotion manifest 已预生成；没有新的明确授权时 promote dry-run 必须阻止安装。',
  ],
} satisfies CompleteDraftAnimalPackage
