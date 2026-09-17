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
  id: 'spinosaurus',
  status: 'draft',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    cameraLightScale: 1.55,
    initialYawDegrees: -90,
    landscapeVerticalOffset: 0.08,
    portraitVerticalOffset: 0.06,
    portraitSafeAreaPadding: 0.18,
    safeAreaPadding: 0.12,
    preciseBounds: true,
    shadow: 'ground',
    shadowDepthScale: 1.1,
    shadowOpacity: 0.58,
    shadowScale: 0.38,
    toneMappingExposure: 1.35,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration,
  provenance: [],
  assets: {
    model: reviewAssetUrl('spinosaurus', 'model.glb'),
    modelBytes: 733_612,
    poster: reviewAssetUrl('spinosaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('spinosaurus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('spinosaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('spinosaurus', 'background-landscape'),
      portrait: reviewAssetUrl('spinosaurus', 'background-portrait'),
    },
    narration: {
      'zh-CN': {
        ...narration['zh-CN'],
        url: reviewAssetUrl('spinosaurus', 'narration.mp3'),
      },
      en: {
        ...narration.en,
        url: reviewAssetUrl('spinosaurus', 'narration.en.mp3'),
      },
    },
  },
  review: {
    badge: '已验收',
    status: '棘龙模型、场景、资料与双语旁白已全部验收',
    note:
      '已直接使用 Leon 选中的现成 CC BY 模型，没有重新生成图片或调用 Meshy。源 GLB 含 99 骨 rig 和三张内嵌 1K 贴图；本轮删除无绑定辅助球，在现有骨架上增强头颈、嘴部、躯干和尾部的八秒闭环动作，并重新生成前景泥滩、碎石和水边植物都保持清晰的北非河岸横竖场景，补齐中英文儿童资料与 Serena 双语旁白。产品负责人已于 2026-09-01 完成模型、美术场景、研究资料、双语文案与 Serena 双语旁白的完整评审并全部通过。',
    checks: [
      '先判断材质、细节和整体气质是否值得保留。',
      '完整观看两个八秒循环，检查尾、颈和背帆附近的权重是否拉裂或抖动。',
      '把高后肢、浅尾和上卷尾端视为较旧的艺术演绎，确认儿童仍能凭长吻与背帆正确识别棘龙，不在文案中把该版本说成唯一复原。',
      '分别完整听审 Serena 中文与英文候选，重点检查“棘龙”“白垩世”和 “Spinosaurus” 的发音、停顿与儿童友好度。',
    ],
    accent: { strong: '#9b4a39', soft: '#efb59a' },
    modelCredit: {
      attribution:
        '“Spinosaurus” by Pedro B. Goulart, CC BY 4.0; unbound helper removed and a project-authored eight-second skeletal Idle added for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Spinosaurus',
      sourceUrl:
        'https://sketchfab.com/3d-models/spinosaurus-2a325726dd7b4a7c888277f262fd09bc',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist，没有进入生产集合。',
    '不调用 Meshy；模型允许适度艺术演绎，但儿童层身份、分类和关键识别特征不能误导。',
    '双语内容和 Serena 双语旁白已经完成产品负责人评审并通过。',
    '本地评审门槛已经全部通过；是否晋升生产集合仍需单独执行生产资产安装。',
  ],
} satisfies CompleteDraftAnimalPackage
