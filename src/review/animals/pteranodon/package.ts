import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'pteranodon',
  status: 'published',
  kind: 'pterosaur',
  habitat: 'air',
  atmosphere: 'air',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 1.5,
    initialYawDegrees: -20,
    safeAreaPadding: 0.05,
    shadow: 'none',
    toneMappingExposure: 1.35,
  },
  animation: {
    clip: 'Idle',
    loop: 'repeat',
    speed: 0.7,
  },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('pteranodon', 'model.glb'),
    modelBytes: 3_819_812,
    poster: reviewAssetUrl('pteranodon', 'poster.webp'),
    posterPortrait: reviewAssetUrl('pteranodon', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('pteranodon', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('pteranodon', 'background-landscape'),
      portrait: reviewAssetUrl('pteranodon', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('pteranodon', 'narration.mp3'),
    },
  },
  review: {
    badge: '已验收',
    status: 'Blender Idle 已通过本地评审',
    note:
      '原始飞行动作会把模型带出展台；Blender 修复已把根位置归零并把平移幅度压到 3.5%，保留为稳定的原地飞行 Idle。产品负责人已复看并明确认为动作效果非常好。',
    checks: [
      '完整 Idle 循环、翅膀动作以及长嘴和头冠始终完整入镜，均已通过产品负责人复看。',
      '没有地面阴影时是否仍有空间层次，旋转背面是否清楚。',
      '完整听完旁白，检查“无齿翼龙”“白垩世”和漏字、停顿、杂音。',
    ],
    accent: {
      strong: '#447d9d',
      soft: '#cde4ee',
    },
    modelCredit: {
      attribution:
        '“Pteranodon (Animated)” by Chistodrako._. / Oscar López Riviello, CC BY 4.0; root motion repaired in Blender for an in-place museum Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Pteranodon (Animated)',
      sourceUrl:
        'https://sketchfab.com/3d-models/pteranodon-animated-7d7683df41d1405283f160e81a5dff1b',
    },
  },
  draftNotes: [
    '本包只在 npm run review 的本地评审模式出现。',
    '模型、背景、渲染图和旁白仍是被忽略的评审素材，不进入生产构建。',
  ],
} satisfies CompleteDraftAnimalPackage
