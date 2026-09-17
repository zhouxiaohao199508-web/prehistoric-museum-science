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
  id: 'baryonyx',
  status: 'draft',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    initialYawDegrees: 90,
    landscapeVerticalOffset: 0.08,
    portraitVerticalOffset: 0.06,
    portraitSafeAreaPadding: 0.18,
    safeAreaPadding: 0.13,
    preciseBounds: true,
    shadow: 'ground',
    shadowDepthScale: 1.1,
    shadowOpacity: 0.58,
    shadowScale: 0.38,
    toneMappingExposure: 0.96,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration,
  provenance: [],
  assets: {
    model: reviewAssetUrl('baryonyx', 'model.glb'),
    modelBytes: 822_340,
    poster: reviewAssetUrl('baryonyx', 'poster.webp'),
    posterPortrait: reviewAssetUrl('baryonyx', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('baryonyx', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('baryonyx', 'background-landscape'),
      portrait: reviewAssetUrl('baryonyx', 'background-portrait'),
    },
    narration: {
      'zh-CN': {
        ...narration['zh-CN'],
        url: reviewAssetUrl('baryonyx', 'narration.mp3'),
      },
      en: {
        ...narration.en,
        url: reviewAssetUrl('baryonyx', 'narration.en.mp3'),
      },
    },
  },
  review: {
    badge: '已验收',
    status: '重爪龙模型、场景、资料与双语旁白已全部验收',
    note:
      '原 FBX 包含 88 骨 rig、六个已蒙皮网格和三张贴图。唯一 60 帧动作首尾姿势逐值一致，本轮重连并内嵌贴图，增强头颈、躯干和尾部的动作幅度，把速度调整为约七秒循环并命名 Idle；同时重新生成前景河泥、湿石和水边植物都保持清晰的威尔登河岸横竖场景，补齐中英文儿童资料与 Serena 双语旁白。产品负责人已于 2026-09-01 完成模型、美术场景、研究资料、双语文案与 Serena 双语旁白的完整评审并全部通过。',
    checks: [
      '确认长吻和手部大爪足以让儿童一眼认成重爪龙；鼻孔、吻端和局部比例允许艺术化，但不在文案中宣称精确。',
      '完整观看两个循环，检查脚滑、四肢权重、尾部摆动和首尾衔接。',
      '判断偏浅的旧式贴图与模型精细度是否达到馆内标准，以及它是否与棘龙过度重复。',
      '分别完整听审 Serena 中文与英文候选，重点检查“重爪龙”“棘龙科”和 “Baryonyx” 的发音、停顿与儿童友好度。',
    ],
    accent: { strong: '#557a72', soft: '#c9ddd4' },
    modelCredit: {
      attribution:
        '“Baryonyx” by Paleo Modelist, CC BY 4.0; source textures relinked and embedded, and the source seamless loop retimed and named Idle for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Baryonyx',
      sourceUrl:
        'https://sketchfab.com/3d-models/baryonyx-09b838e4bad84b33a647c647f42f4acd',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist，没有进入生产集合。',
    '现阶段不把页面的 CC BY 标签等同于已核验原创链，公开分发前必须补证据。',
    '双语内容和 Serena 双语旁白已经完成产品负责人评审并通过。',
    '本地评审门槛已经全部通过；是否晋升生产集合仍需单独执行生产资产安装。',
  ],
} satisfies CompleteDraftAnimalPackage
