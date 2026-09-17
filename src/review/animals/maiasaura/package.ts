import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'maiasaura',
  status: 'published',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 1.4,
    initialYawDegrees: -90,
    landscapeVerticalOffset: 0.04,
    portraitVerticalOffset: 0.04,
    portraitSafeAreaPadding: 0.12,
    safeAreaPadding: 0.14,
    preciseBounds: true,
    shadow: 'ground',
    shadowOpacity: 0.38,
    shadowScale: 0.32,
    shadowDepthScale: 0.8,
    shadowHorizontalOffset: -0.98,
    shadowYOffset: -0.04,
    toneMappingExposure: 1.08,
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
    model: reviewAssetUrl('maiasaura', 'model.glb'),
    modelBytes: 1_454_384,
    poster: reviewAssetUrl('maiasaura', 'poster.webp'),
    posterPortrait: reviewAssetUrl('maiasaura', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('maiasaura', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('maiasaura', 'background-landscape'),
      portrait: reviewAssetUrl('maiasaura', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('maiasaura', 'narration.mp3'),
    },
  },
  review: {
    badge: '已验收',
    status: '慈母龙模型、动画、语音与家长资料已通过本地评审',
    note:
      '第二轮保留原模型的 87 骨骼绑定和稳定四足接触点，将躯干、头颈、前肢与整条尾巴的摆动明显放大。原本偏玩具感的青橙贴图改为按颜色区域重绘的暖褐、浅腹与深色背纹，并叠加多尺度斑驳、较高粗糙度和更清楚的皮肤法线。本轮改为按 Idle 首帧的实际蒙皮轮廓计算居中、接地和缩放中心，并将阴影缩成脚群大小后向前后脚之间左移。产品负责人已于 2026-07-31 完整复看并确认当前模型、动画、构图、Serena 中文旁白和家长资料通过本地评审。',
    checks: [
      '完整观看两个 8 秒循环，确认躯干、头颈和整条尾巴的摆动足够明显，首尾无跳变。',
      '确认四足没有滑步、穿地或明显蒙皮拉伸；缩放围绕可见轮廓中心，紧凑接触阴影落在前后脚之间并与脚底留有轻微间隔。',
      '分别检查横屏和竖屏：林线较高、中央地面连续，头尾和脚掌均在安全区内。',
      '近看确认暖褐背部、浅色腹部、斑驳变化和皱褶法线不再呈现强烈青橙玩具感。',
    ],
    accent: {
      strong: '#826b34',
      soft: '#ead9a7',
    },
    modelCredit: {
      attribution:
        '“Maiasaura with rig” by Dino Dan, CC BY 4.0; normalized, colour-graded, and given a project-authored 8-second Idle for local museum review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Maiasaura with rig',
      sourceUrl:
        'https://sketchfab.com/3d-models/maiasaura-with-rig-3da9f211ae304bd0afd1d15a290eabbd',
    },
  },
  draftNotes: [
    '本地评审包复用已发布生产动物的审核展示配置。',
    'Blender 文件、背景源图、处理报告、哈希和检查渲染继续保留在被忽略的本地评审区。',
    '当前模型、动画、构图、Serena 旁白和家长资料已通过评审，并于 2026-07-31 接入生产集合。',
  ],
} satisfies CompleteDraftAnimalPackage
