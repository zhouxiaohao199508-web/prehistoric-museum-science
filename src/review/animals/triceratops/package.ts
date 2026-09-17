import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'triceratops',
  status: 'published',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 1.25,
    initialYawDegrees: -90,
    safeAreaPadding: 0.1,
    shadow: 'ground',
    toneMappingExposure: 1.1,
  },
  animation: {
    clip: 'Idle',
    loop: 'repeat',
    speed: 0.9,
  },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('triceratops', 'model.glb'),
    modelBytes: 3_178_460,
    poster: reviewAssetUrl('triceratops', 'poster.webp'),
    posterPortrait: reviewAssetUrl('triceratops', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('triceratops', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('triceratops', 'background-landscape'),
      portrait: reviewAssetUrl('triceratops', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('triceratops', 'narration.mp3'),
    },
  },
  review: {
    badge: '待复看',
    status: '头部与尾部 Blender Idle 待复看',
    note:
      '已验收的 wojciechmiedziocha CC BY 4.0 PBR 外观保持不变；本轮新增 10 骨骼、四脚固定的确定性权重和 8 秒原地 Idle。根据近景截图把尾根到髋部的蒙皮改为固定桥接，摆动从第二段尾骨开始逐渐放大，头部仍左右转动约 11°并带轻微点头。',
    checks: [
      '观看完整循环，确认三只角、颈盾与头部同步转动，没有脱离或穿过身体。',
      '确认尾部从根到尖连续摆动，四脚始终固定，肩部、髋部和尾根没有开缝。',
      '模型约 1.26 万三角面、4.2 MiB、1 个绘制批次；检查手机首次载入、动画、旋转和连续切换。',
      '复核前肢姿态、角和颈盾比例；皮肤纹理与颜色应标为艺术复原，不作为化石已经证明的细节。',
      '专属草地背景与模型颜色、接触阴影是否协调，并确认静态展示不会被误认为仍在加载。',
      '旁白中的“三角龙”“颈盾”与完整播放已通过本轮听审；只有重新生成音频时才重开该门槛。',
    ],
    accent: {
      strong: '#98604c',
      soft: '#efd8ca',
    },
    modelCredit: {
      attribution:
        '“Triceratops dinosaur” by wojciechmiedziocha, CC BY 4.0; Sketchfab 1K GLB converted, normalized, and rigged in Blender with repaired weights and an in-place head-and-tail museum Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Triceratops dinosaur',
      sourceUrl:
        'https://sketchfab.com/3d-models/triceratops-dinosaur-87527079bad44917ab1b98a456b46c7e',
    },
  },
  draftNotes: [
    '本包只在 npm run review 的本地评审模式出现。',
    '高质量替换外观已通过本地评审；本轮新增的骨架、权重和 Idle 等待复看。',
    '公开使用时必须展示作者、Sketchfab 来源、CC BY 4.0 链接及项目所做修改。',
  ],
} satisfies CompleteDraftAnimalPackage
