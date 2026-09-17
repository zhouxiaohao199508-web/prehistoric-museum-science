import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'tupandactylus',
  status: 'draft',
  kind: 'pterosaur',
  habitat: 'air',
  atmosphere: 'air',
  content: { 'zh-CN': zhCN },
  presentation: {
    cameraLightScale: 1.45,
    initialYawDegrees: -15,
    portraitSafeAreaPadding: 0.16,
    preciseBounds: true,
    safeAreaPadding: 0.1,
    shadow: 'none',
    toneMappingExposure: 1.25,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('tupandactylus', 'model.glb'),
    modelBytes: 4_149_232,
    poster: reviewAssetUrl('tupandactylus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('tupandactylus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('tupandactylus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('tupandactylus', 'background-landscape'),
      portrait: reviewAssetUrl('tupandactylus', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('tupandactylus', 'narration.mp3'),
    },
  },
  review: {
    badge: '自动 QA 通过',
    status: '古神翼龙完整本地草稿，等待科学、视觉、动作与听审',
    note:
      '直接作者页、CC BY 4.0、原始 GLB 与平台元数据、资源预算、零错误零警告 Khronos validator、八秒闭环 Idle、landmarks、五视口与嘴部近景证据均由自动化核对。模型保留 Paleo Modelist 的彩色头冠与整体轮廓，冻结可读飞行姿态、合并两组视觉网格、增加两级形变拓扑，并加入克制的项目原创法线、粗糙度与项目制作的 12° 下颌开合形变；这些工程结果尚不代表产品负责人批准。',
    checks: [
      '360° 核对无齿喙、巨大头冠、眼睛、短尾、四肢和连续翼膜，不把冠饰颜色或花纹当成化石事实。',
      '完整观看两个八秒循环，确认 28° 双翼大行程自然、左右连续，没有翼根折断、穿插、根位移或橡胶拉伸。',
      '近距离检查嘴部由张开到部分闭合再回到张开的循环，确认只有下颌和口腔软组织跟随，没有上喙变形、裂缝或穿插。',
      '在克拉图组横版与竖版背景复看头冠、翼尖、喙端和后肢的安全区与对比度。',
      '完整听审 Serena 中文旁白，重点检查“古神翼龙”“白垩世”和“皮膜翅膀”。',
    ],
    accent: { strong: '#b75b37', soft: '#f2d0a2' },
    modelCredit: {
      attribution:
        '“Tupandactylus” by Paleo Modelist (@victory_), CC BY 4.0; visible source pose baked, textured meshes joined, deformation topology subdivided, restrained surface response added, transforms normalized, and the source animation replaced with a project-authored eight-second in-place morph-target Idle including a conservative lower-jaw close/open cycle for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Tupandactylus',
      sourceUrl:
        'https://sketchfab.com/3d-models/tupandactylus-4ea8f4466c2c4e61bc57c12af296d43a',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist；没有进入 src/content/animals 或生产集合。',
    '自动 hard gates 已通过，但科学身份、解剖、材质、动作自然度、背景、中文内容、完整听审和公开分发决定仍是 human-only。',
    '只有产品负责人明确批准后才能记录 approval 并执行生产晋升。',
  ],
} satisfies CompleteDraftAnimalPackage
