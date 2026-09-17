import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'plesiosaurus',
  status: 'published',
  kind: 'marine-reptile',
  habitat: 'water',
  atmosphere: 'underwater',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 2.2,
    initialYawDegrees: -90,
    landscapeHorizontalOffset: -0.04,
    landscapeVerticalOffset: 0.065,
    portraitHorizontalOffset: -0.04,
    portraitSafeAreaPadding: 0.05,
    portraitVerticalOffset: 0,
    safeAreaPadding: 0.09,
    shadow: 'none',
    toneMappingExposure: 1.3,
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
    model: reviewAssetUrl('plesiosaurus', 'model.glb'),
    modelBytes: 2_519_664,
    poster: reviewAssetUrl('plesiosaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('plesiosaurus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('plesiosaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('plesiosaurus', 'background-landscape'),
      portrait: reviewAssetUrl('plesiosaurus', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('plesiosaurus', 'narration.mp3'),
    },
  },
  review: {
    badge: '已验收',
    status: '蛇颈龙类模型、动画、语音与家长资料已通过本地评审',
    note:
      '第四轮在保留四鳍独立划水的基础上，将源模型永久上弯的头颈中心线适度放平，并加入从头端向肩部衰减的椭圆形摆动，使脖子不再固定成同一条曲线。缩略图改用独立方形裁切，让身体避开底部草稿徽章。眼窝、琥珀色虹膜、深色瞳孔与小面积眼神光继续保留。产品负责人已于 2026-07-31 完整复看并确认当前模型、动画、构图、Serena 中文旁白和家长资料通过本地评审。',
    checks: [
      '完整观看两个 8 秒循环，确认每个循环内有两次清楚划水，形态阶段平滑衔接且首尾无跳变。',
      '逐一确认前后左右四只鳍都有上下和前后行程，能读成主动划水而不是整片身体被动抖动。',
      '确认头颈摆动连续可辨，没有橡胶般拉伸、穿模或异常体积变化。',
      '确认两只眼睛在横竖屏都能辨认出眼窝、虹膜和瞳孔，同时颜色仍融入真实皮肤。',
      '分别检查横屏和竖屏：竖屏模型已适度上移到可视舞台中部，长颈、尾部与四鳍仍完整可见。',
      '确认动物选择栏的小图中，头颈和躯干位于徽章上方的清晰区域。',
      '确认较亮的哑光表面在蓝绿色场景中仍有清楚的头、颈、躯干和鳍轮廓。',
    ],
    accent: {
      strong: '#2b7b88',
      soft: '#c1e7e4',
    },
    modelCredit: {
      attribution:
        '“Plesiosaure” by leo kerjean, CC BY 4.0; normalized, material-adjusted, and given a project-authored 8-second morph-target swimming Idle for local museum review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Plesiosaure',
      sourceUrl:
        'https://sketchfab.com/3d-models/plesiosaure-2f59d503e0754c9d9e157a90ed415c38',
    },
  },
  draftNotes: [
    '本地评审包复用已发布生产动物的审核展示配置。',
    'Blender 文件、背景源图、处理报告、哈希和检查渲染继续保留在被忽略的本地评审区。',
    '源模型无法可靠落到属种，展签故意使用“蛇颈龙类”；当前模型、动画、构图、旁白和家长资料已通过评审，并于 2026-07-31 接入生产集合。',
  ],
} satisfies CompleteDraftAnimalPackage
