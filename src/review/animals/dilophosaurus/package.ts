import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'dilophosaurus',
  status: 'draft',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    initialYawDegrees: 180,
    landscapeHorizontalOffset: -0.03,
    landscapeVerticalOffset: 0.1,
    portraitVerticalOffset: 0.08,
    portraitSafeAreaPadding: 0.16,
    safeAreaPadding: 0.14,
    preciseBounds: true,
    shadow: 'ground',
    shadowOpacity: 0.58,
    shadowScale: 0.38,
    shadowDepthScale: 1.15,
    shadowHorizontalOffset: -0.45,
    toneMappingExposure: 1.05,
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
    model: reviewAssetUrl('dilophosaurus', 'model.glb'),
    modelBytes: 12_396_544,
    poster: reviewAssetUrl('dilophosaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('dilophosaurus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('dilophosaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('dilophosaurus', 'background-landscape'),
      portrait: reviewAssetUrl('dilophosaurus', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('dilophosaurus', 'narration.mp3'),
    },
  },
  review: {
    badge: '自动 QA 通过',
    status: '双冠龙完整本地草稿，等待科学、视觉、动作与听审',
    note:
      '作者创作链、CC BY 4.0、源档案、自包含 GLB、预算、Khronos validator、可见八秒 Idle、初始头部朝左、landmarks 和五视口证据由自动化核对。Idle 每八秒包含一次由精确组件和下颌软权重区域驱动的低幅张合；模型已移到峡谷中央的连续亮色地面，接触阴影按旋转后的实测双脚位置加宽、加强并覆盖足底，避免深色灌木边缘造成悬浮感。模型仍需人工确认头冠、腕手、后肢、牙齿间隙、舌头和嘴角观感。',
    checks: [
      '恢复初始视角，确认头部清楚位于画面左侧；再 360° 核对头冠、头骨、肩带、腕手和后肢。',
      '完整观看两个八秒循环，确认双足接触稳定、尾部动作不造成橡胶般拉伸，并在四秒附近近看下颌缓慢局部闭合时牙齿、舌头和嘴角没有穿插或断裂。',
      '在凯恩塔组横竖背景中复看材质、眼睛、轮廓和红色喉部是否过度戏剧化。',
      '完整听审 Qwen3-TTS Serena 中文候选旁白，特别检查“双冠龙”“侏罗世”和“北美洲”。',
    ],
    accent: {
      strong: '#8b4933',
      soft: '#efc5a7',
    },
    modelCredit: {
      attribution:
        '“Dilophosaurus” by Marcel Schanz, CC BY 4.0; visible meshes baked and joined, normalized, and given a project-authored eight-second morph-target Idle with a curated low-amplitude jaw relaxation for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Dilophosaurus',
      sourceUrl:
        'https://sketchfab.com/3d-models/dilophosaurus-d09b3aa874db4e1cbf29a14797ca351f',
    },
  },
  draftNotes: [
    '仅存在于显式本地 review allowlist；没有进入 src/content/animals 或生产集合。',
    '自动 hard gates 已通过，但科学身份、解剖、材质、动作自然度、背景、中文内容、完整听审和生产决定全部仍是 human-only。',
    'promotion manifest 已预生成；没有新的明确授权时 promote dry-run 必须阻止安装。',
  ],
} satisfies CompleteDraftAnimalPackage
