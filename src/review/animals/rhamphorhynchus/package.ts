import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'rhamphorhynchus',
  status: 'draft',
  kind: 'pterosaur',
  habitat: 'air',
  atmosphere: 'air',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 1.45,
    initialYawDegrees: -15,
    portraitSafeAreaPadding: 0.12,
    preciseBounds: true,
    safeAreaPadding: 0.08,
    shadow: 'none',
    toneMappingExposure: 1.15,
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
    model: reviewAssetUrl('rhamphorhynchus', 'model.glb'),
    modelBytes: 5_627_724,
    poster: reviewAssetUrl('rhamphorhynchus', 'poster.webp'),
    posterPortrait: reviewAssetUrl(
      'rhamphorhynchus',
      'poster-portrait.webp',
    ),
    thumbnail: reviewAssetUrl('rhamphorhynchus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('rhamphorhynchus', 'background-landscape'),
      portrait: reviewAssetUrl('rhamphorhynchus', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('rhamphorhynchus', 'narration.mp3'),
    },
  },
  review: {
    badge: '自动 QA 通过',
    status: '喙嘴翼龙完整本地草稿，等待科学、视觉、动作与听审',
    note:
      '直接作者页、CC BY 4.0、原始 FBX 档案、自包含 GLB、资源预算、零错误零警告 Khronos validator、八秒闭环 Idle、landmarks 与五视口证据均由自动化核对。模型保留 Robear 的整体轮廓与配色基础，补齐原包贴图链接，以两级 Simple subdivision 提升形变密度，并加入克制的项目原创法线、粗糙度和基础色微细节；这些工程结果尚不代表产品负责人批准。',
    checks: [
      '360° 核对长吻、牙齿、眼睛、翼膜与后肢连接、长尾和尾帆，不把配色或固定尾帆形状当成化石事实。',
      '完整观看两个八秒循环，确认双翼 28° 大行程拍动清楚、左右连续，模型没有根位移、翼膜折断或橡胶般拉伸。',
      '分别在索伦霍芬横版与竖版背景复看浅色轮廓、翼尖、吻端和尾端的可读性，尤其检查手机竖屏安全区。',
      '完整听审 Qwen3-TTS Serena 中文候选旁白，重点检查“喙嘴翼龙”读作 huì zuǐ yì lóng，以及“侏罗世”和“皮膜翅膀”。',
    ],
    accent: {
      strong: '#32777e',
      soft: '#c9e8e1',
    },
    modelCredit: {
      attribution:
        '“Low-poly Rhamphorhynchus idle” by Robear (@xiaorobear), CC BY 4.0; archive textures resolved, deformation topology subdivided, surface maps subtly refined, visible pose baked and normalized, and the source animation replaced with a project-authored eight-second in-place morph-target Idle for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Low-poly Rhamphorhynchus idle',
      sourceUrl:
        'https://sketchfab.com/3d-models/low-poly-rhamphorhynchus-idle-c1e35c7ac4374c778f78025717694675',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist；没有进入 src/content/animals 或生产集合。',
    '自动 hard gates 已通过，但科学身份、解剖、材质、动作自然度、背景、中文内容、完整听审和公开分发决定全部仍是 human-only。',
    '只有产品负责人明确批准后才能记录 approval 并执行生产晋升。',
  ],
} satisfies CompleteDraftAnimalPackage
