import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'gigantoraptor',
  status: 'published',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    initialYawDegrees: -90,
    safeAreaPadding: 0.14,
    shadow: 'ground',
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
    model: reviewAssetUrl('gigantoraptor', 'model.glb'),
    modelBytes: 1_333_576,
    poster: reviewAssetUrl('gigantoraptor', 'poster.webp'),
    posterPortrait: reviewAssetUrl('gigantoraptor', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('gigantoraptor', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('gigantoraptor', 'background-landscape'),
      portrait: reviewAssetUrl('gigantoraptor', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('gigantoraptor', 'narration.mp3'),
    },
  },
  review: {
    badge: '待复看',
    status: '头颈与双前爪加强版 Blender Idle 待复看',
    note:
      '产品负责人认为上一轮已经有明显 Idle，但双前爪和头颈转动仍偏小。本轮保留躯干、尾巴和下颌为基础动作的 225%，把七节颈骨与头部提高到 450%，双侧肩、臂、前臂和手部提高到 500%；根骨、髋部和腿部继续完全不动，以避免脚底滑动。模型的大眼、冠饰、颜色和羽毛分布仍被明确标记为具有很高科学不确定性的艺术复原。',
    checks: [
      '把大眼、头顶饰物、颜色和羽毛分布明确视为艺术推测，不让儿童误以为化石已经证明这些细节。',
      '完整观察两个加强版 Idle 循环，确认 450% 头颈转动与 500% 双前爪摆动清楚且自然，没有循环跳帧。',
      '确认根骨、髋部和腿部没有动画通道，脚底在整个 6.5 秒循环中保持稳定。',
      '模型约 8.4 万三角面、4.0 MiB；检查手机首次载入、旋转和连续切换时是否流畅。',
      '检查长颈、长尾、手指和脚部在整个动作中都能完整入镜。',
      '旁白中的“巨盗龙”“窃蛋龙类”与完整播放已通过本轮听审；只有重新生成音频时才重开该门槛。',
    ],
    accent: {
      strong: '#7f5b49',
      soft: '#ead8ca',
    },
    modelCredit: {
      attribution:
        '“Gigantoraptor” by seth the yutyrannus, CC BY 4.0; normalized and given a project-authored in-place museum Idle using the existing rig.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Gigantoraptor',
      sourceUrl:
        'https://sketchfab.com/3d-models/gigantoraptor-e51509d66d464104aef1b72c298a40cf',
    },
  },
  draftNotes: [
    '本包只在 npm run review 的所有者本地评审模式出现。',
    '评审路由直接读取当前生产模型，以验证 Blender 制作并注入原模型结构的 29 条骨骼旋转通道。',
    'Serena 旁白已完成人工听审并可在本地评审中点击播放；公开再分发权利决定仍未完成。',
  ],
} satisfies CompleteDraftAnimalPackage
