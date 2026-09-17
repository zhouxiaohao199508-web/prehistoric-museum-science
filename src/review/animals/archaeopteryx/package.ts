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
  id: 'archaeopteryx',
  status: 'draft',
  kind: 'dinosaur',
  habitat: 'air',
  atmosphere: 'air',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    cameraLightScale: 1.08,
    initialYawDegrees: -90,
    portraitSafeAreaPadding: 0.03,
    safeAreaPadding: 0.12,
    preciseBounds: true,
    shadow: 'none',
    toneMappingExposure: 1.0,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration,
  provenance: [],
  assets: {
    model: reviewAssetUrl('archaeopteryx', 'model.glb'),
    modelBytes: 5_954_164,
    poster: reviewAssetUrl('archaeopteryx', 'poster.webp'),
    posterPortrait: reviewAssetUrl('archaeopteryx', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('archaeopteryx', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('archaeopteryx', 'background-landscape'),
      portrait: reviewAssetUrl('archaeopteryx', 'background-portrait'),
    },
    narration: {
      'zh-CN': {
        ...narration['zh-CN'],
        url: reviewAssetUrl('archaeopteryx', 'narration.mp3'),
      },
      en: {
        ...narration.en,
        url: reviewAssetUrl('archaeopteryx', 'narration.en.mp3'),
      },
    },
  },
  review: {
    badge: '已验收',
    status: '始祖鸟模型、场景、资料与双语旁白已全部验收',
    note:
      '羽毛是模型中的真实网格。左右羽翅使用作者原始动画中羽轴始终后掠、双翼始终离开躯干的安全展开区间，不对右翅做额外镜像；参考无齿翼龙的可读节奏，八秒 Idle 完成两次平缓但清晰的整翼扇动，并配合躯干、颈部、头部和尾部的轻微动作。羽片使用稳定的透明裁切，从侧面和斜后方观察时，两侧轮廓保持协调，重叠羽片不会因透明排序而闪烁。产品负责人已于 2026-09-01 完成模型、美术场景、研究资料、双语文案与 Serena 双语旁白的完整评审并全部通过。',
    checks: [
      '完整观看八秒 Idle，并从正侧面和斜后方确认左右羽翅完成两次同步扇动、始终充分展开、飞羽后掠且没有闪烁。',
      '确认双翼在整个循环中始终离开身体、尾部和另一侧翅膀，也不会在主视角遮住头部。',
      '确认明亮泻湖不会吃掉白色羽片，也不会让深褐羽毛显得过黑。',
      '分别完整听审 Serena 中文与英文候选，重点检查“始祖鸟”“侏罗世”和 “Archaeopteryx” 的发音、停顿与儿童友好度。',
    ],
    accent: { strong: '#a85d32', soft: '#e8c78c' },
    modelCredit: {
      attribution:
        '“Archaeopteryx” by khata, CC BY 4.0; supplied textures restored, the author-authored fully extended posterior-swept bilateral wing interval retained without manual mirroring, feather materials changed to stable alpha masking, and the paired wing, body, neck, head, and tail motion retimed into a project-authored eight-second two-flap skeletal Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Archaeopteryx',
      sourceUrl:
        'https://sketchfab.com/3d-models/archaeopteryx-cbec5591c584438392824d13fbef401b',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist，没有进入生产集合。',
    '当前 GLB 使用八秒闭环骨骼 Idle；左右羽翅始终充分展开并完成两次平缓扇动，躯干、颈部、头部与尾部同步保留轻微动作。',
    '双语内容和 Serena 双语旁白已经完成产品负责人评审并通过。',
    '本地评审门槛已经全部通过；是否晋升生产集合仍需单独执行生产资产安装。',
  ],
} satisfies CompleteDraftAnimalPackage
