import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { en } from './content.en'
import { zhCN } from './content.zh-CN'

const narration = {
  'zh-CN': {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
    speaker: 'Serena',
    language: 'Chinese',
    humanReviewStatus: 'approved',
  },
  en: {
    status: 'ready',
    sourcePath: 'audio/narration.en.mp3',
    mimeType: 'audio/mpeg',
    speaker: 'Serena',
    language: 'English',
    humanReviewStatus: 'approved',
  },
} as const

export const animal = {
  id: 'anomalocaris',
  status: 'draft',
  kind: 'other-prehistoric-animal',
  habitat: 'water',
  atmosphere: 'underwater',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    cameraLightScale: 1.16,
    initialYawDegrees: 180,
    portraitSafeAreaPadding: 0.03,
    safeAreaPadding: 0.1,
    preciseBounds: true,
    shadow: 'none',
    toneMappingExposure: 1.0,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration,
  provenance: [],
  assets: {
    model: reviewAssetUrl('anomalocaris', 'model.glb'),
    modelBytes: 1_811_652,
    poster: reviewAssetUrl('anomalocaris', 'poster.webp'),
    posterPortrait: reviewAssetUrl('anomalocaris', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('anomalocaris', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('anomalocaris', 'background-landscape'),
      portrait: reviewAssetUrl('anomalocaris', 'background-portrait'),
    },
    narration: {
      'zh-CN': {
        ...narration['zh-CN'],
        url: reviewAssetUrl('anomalocaris', 'narration.mp3'),
      },
      en: {
        ...narration.en,
        url: reviewAssetUrl('anomalocaris', 'narration.en.mp3'),
      },
    },
  },
  review: {
    badge: '已验收',
    status: '奇虾模型、场景、资料与双语旁白已全部验收',
    note:
      '身体两侧 14 对游泳叶分别由 28 根骨骼控制。八秒 Idle 使用前后错开的行波、左右轻微错相和大小不一的摆幅，并以更密的平滑关键帧连接，让游泳叶像水中依次推水与回收。两条捕食附肢由分节骨骼链带动，身体也有很轻的漂游；腹面口器、眼柄和尾扇保持原貌。初始主视角头部朝左。产品负责人已于 2026-09-01 完成模型、美术场景、研究资料、双语文案与 Serena 双语旁白的完整评审并全部通过。',
    checks: [
      '完整观看八秒游动 Idle，确认游泳叶形成连续而不完全同步的推水行波，两条捕食附肢能清楚完成向前收拢的动作。',
      '从腹面和正面检查游泳叶、圆形口器、捕食附肢和尾扇，确认没有尖角、拉伸或分节脱离。',
      '确认减面后侧叶、眼柄和表面贴图没有明显破损，浏览器旋转时不会暴露技术切块。',
      '分别完整听审 Serena 中文与英文候选，重点检查“奇虾”“放射齿类”和 “Anomalocaris” 的发音、停顿与儿童友好度。',
    ],
    accent: { strong: '#bb5b31', soft: '#7dcbd1' },
    modelCredit: {
      attribution:
        '“Anomalocaris 3D Model” by Skache, CC BY 4.0; textures compressed, 28 rigid swimming-flap bones and two segmented frontal-appendage chains added, with a varied metachronal wave, subtle body drift, and smooth dense keys authored for the eight-second swimming Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Anomalocaris 3D Model',
      sourceUrl:
        'https://sketchfab.com/3d-models/anomalocaris-3d-model-dad76e60589a41e18a42db1e979f81f8',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist，没有进入生产集合。',
    '当前 GLB 使用八秒闭环骨骼游泳 Idle；游泳叶采用左右错相、前后传递且摆幅略有差异的行波，两条捕食附肢由独立骨骼链驱动。',
    '双语内容和 Serena 双语旁白已经完成产品负责人评审并通过。',
    '本地评审门槛已经全部通过；是否晋升生产集合仍需单独执行生产资产安装。',
  ],
} satisfies CompleteDraftAnimalPackage
