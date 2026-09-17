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
  id: 'lystrosaurus',
  status: 'draft',
  kind: 'other-prehistoric-animal',
  habitat: 'land',
  atmosphere: 'plains',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    initialYawDegrees: -90,
    landscapeVerticalOffset: 0.06,
    portraitVerticalOffset: 0.05,
    portraitSafeAreaPadding: 0.17,
    safeAreaPadding: 0.14,
    preciseBounds: true,
    shadow: 'ground',
    shadowDepthScale: 0.9,
    shadowOpacity: 0.52,
    shadowScale: 0.46,
    toneMappingExposure: 0.98,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration,
  provenance: [],
  assets: {
    model: reviewAssetUrl('lystrosaurus', 'model.glb'),
    modelBytes: 339_248,
    poster: reviewAssetUrl('lystrosaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('lystrosaurus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('lystrosaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('lystrosaurus', 'background-landscape'),
      portrait: reviewAssetUrl('lystrosaurus', 'background-portrait'),
    },
    narration: {
      'zh-CN': {
        ...narration['zh-CN'],
        url: reviewAssetUrl('lystrosaurus', 'narration.mp3'),
      },
      en: {
        ...narration.en,
        url: reviewAssetUrl('lystrosaurus', 'narration.en.mp3'),
      },
    },
  },
  review: {
    badge: '已验收',
    status: '水龙兽模型、场景、资料与双语旁白已全部验收',
    note:
      '原包已有 70 骨 rig、32k 面和一张内嵌 1K 贴图，但没有动画。本轮删除无绑定辅助球，在现有骨架上加入更容易看见的头颈呼吸、闭嘴和前肢重心变化，把初始朝向修正为头朝左，并重新生成前景泥土、砂砾和低矮植物都保持清晰的暖红褐卡鲁河漫滩横竖场景，补齐中英文儿童资料与 Serena 双语旁白。“丑萌”轮廓作为儿童展陈的艺术复原保留。产品负责人已于 2026-09-01 完成模型、美术场景、研究资料、双语文案与 Serena 双语旁白的完整评审并全部通过。',
    checks: [
      '确认短脸、喙、两枚獠牙和敦实四肢足以让儿童记住水龙兽，同时允许软组织、体色和体态适度艺术化。',
      '完整观看两个八秒循环，确认四足不滑、颈部不塌、腹部和尾根没有权重破损。',
      '判断它作为非恐龙合弓类和大灭绝幸存者，是否比再增加一只大型兽脚类更有馆藏价值。',
      '分别完整听审 Serena 中文与英文候选，重点检查“水龙兽”“合弓动物”和 “Lystrosaurus” 的发音、停顿与儿童友好度。',
    ],
    accent: { strong: '#6f7151', soft: '#d9d4af' },
    modelCredit: {
      attribution:
        '“Lystrosaurus” by seth the yutyrannus, CC BY 4.0; unbound helper removed and a project-authored eight-second skeletal Idle added for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Lystrosaurus',
      sourceUrl:
        'https://sketchfab.com/3d-models/lystrosaurus-32ea6a3bedd948638f9add8da7483b28',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist，没有进入生产集合。',
    '初始朝向已改为头朝左，横竖屏仍需人工复看构图。',
    '双语内容和 Serena 双语旁白已经完成产品负责人评审并通过。',
    '本地评审门槛已经全部通过；是否晋升生产集合仍需单独执行生产资产安装。',
  ],
} satisfies CompleteDraftAnimalPackage
