import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'megalodon',
  status: 'published',
  kind: 'other-prehistoric-animal',
  habitat: 'water',
  atmosphere: 'underwater',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 2.1,
    initialYawDegrees: -90,
    landscapeHorizontalOffset: 0,
    landscapeVerticalOffset: 0.04,
    portraitHorizontalOffset: 0,
    portraitSafeAreaPadding: 0.16,
    portraitVerticalOffset: 0.04,
    safeAreaPadding: 0.12,
    preciseBounds: true,
    shadow: 'none',
    toneMappingExposure: 1.34,
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
    model: reviewAssetUrl('megalodon', 'model.glb'),
    modelBytes: 155_328,
    poster: reviewAssetUrl('megalodon', 'poster.webp'),
    posterPortrait: reviewAssetUrl('megalodon', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('megalodon', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('megalodon', 'background-landscape'),
      portrait: reviewAssetUrl('megalodon', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('megalodon', 'narration.mp3'),
    },
  },
  review: {
    badge: '已验收',
    status: '巨齿鲨模型、动画、语音与家长资料已通过本地评审',
    note:
      '第三轮复核并纠正了原模型的骨骼方向：正 Y 链才是尾部，负 Y 链才是头部。头部四段只保留每节 0.15–0.30 度的轻微稳定补偿，推进波从尾根到尾端逐级增加为每节 1.2–8.5 度，胸鳍同步调姿，让游动明确由身体后半段和尾鳍驱动。本轮进一步改为按 Idle 首帧的实际蒙皮轮廓计算中心、构图和缩放支点，移除原先为错误 bind-space 边界设置的左移与大幅下移补偿；缩略图仍使用独立方形裁切。产品负责人已于 2026-07-31 完整复看并确认当前模型、动画、构图、Serena 中文旁白和家长资料通过本地评审。',
    checks: [
      '完整观看两个 8 秒循环，确认吻端和头部基本稳定，不再靠夸张甩头制造游动感。',
      '确认推进波从尾根连续传到尾端并逐级放大，尾鳍和胸鳍动作清楚，首尾无跳变或蒙皮折断。',
      '分别检查横屏和竖屏：鲨鱼围绕实际轮廓中心缩放并位于展台视觉中心，轮廓完整，深蓝背景没有吞掉背部和尾鳍。',
      '确认动物选择栏的小图中，背部、腹部和尾柄位于徽章上方的清晰区域。',
    ],
    accent: {
      strong: '#1d6790',
      soft: '#b7dce9',
    },
    modelCredit: {
      attribution:
        '“Otodus Megalodon updated animations” by CanYuTsai, CC BY 4.0; normalized, material-adjusted, and given a project-authored 8-second full-body swimming Idle for local museum review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Otodus Megalodon updated animations',
      sourceUrl:
        'https://sketchfab.com/3d-models/otodus-megalodon-updated-animations-7e65b8c51251440e9aca8385f286714f',
    },
  },
  draftNotes: [
    '本地评审包复用已发布生产动物的审核展示配置。',
    'Blender 文件、背景源图、处理报告、哈希和检查渲染继续保留在被忽略的本地评审区。',
    '当前模型、动画、构图、Serena 旁白和家长资料已通过评审，并于 2026-07-31 接入生产集合。',
  ],
} satisfies CompleteDraftAnimalPackage
