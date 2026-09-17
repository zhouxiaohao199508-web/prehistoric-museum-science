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
  id: 'carnotaurus',
  status: 'draft',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'plains',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    cameraLightScale: 1.22,
    initialYawDegrees: -90,
    landscapeVerticalOffset: 0.1,
    portraitVerticalOffset: 0.08,
    portraitSafeAreaPadding: 0.03,
    safeAreaPadding: 0.12,
    preciseBounds: true,
    shadow: 'ground',
    shadowDepthOffset: -0.5,
    shadowOpacity: 0.62,
    shadowScale: 0.36,
    toneMappingExposure: 1.08,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration,
  provenance: [],
  assets: {
    model: reviewAssetUrl('carnotaurus', 'model.glb'),
    modelBytes: 4_173_696,
    poster: reviewAssetUrl('carnotaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('carnotaurus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('carnotaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('carnotaurus', 'background-landscape'),
      portrait: reviewAssetUrl('carnotaurus', 'background-portrait'),
    },
    narration: {
      'zh-CN': {
        ...narration['zh-CN'],
        url: reviewAssetUrl('carnotaurus', 'narration.mp3'),
      },
      en: {
        ...narration.en,
        url: reviewAssetUrl('carnotaurus', 'narration.en.mp3'),
      },
    },
  },
  review: {
    badge: '已验收',
    status: '食肉牛龙模型、场景、资料与双语旁白已全部验收',
    note:
      '石头已经完整移除，两只脚的脚底高度已重新校准为稳定站姿；原始左前肢保持不变，原始右前肢在保留贴图、手指和皮肤轮廓的前提下补充分段并向身体前方调整，模型中不再叠加复制的前肢。八秒 Idle 的嘴部动作只驱动下颌和下排牙齿，上颌皮肤保持原形，舌头作为独立软组织不再跟随下颌回缩或上抬；尾巴从根部到末端逐渐加大摆幅，形成连续、缓慢的自然摇动。初始主视角头部朝左。产品负责人已于 2026-09-01 完成模型、美术场景、研究资料、双语文案与 Serena 双语旁白的完整评审并全部通过。',
    checks: [
      '确认石头已经完全消失，两只脚都稳定落在同一地面，前肢在侧面和斜侧面更容易辨认，身体、脚爪、牙齿和贴图没有缺块。',
      '完整观看八秒闭嘴与摆尾 Idle，确认上颌皮肤不凹陷、下排牙齿始终贴着牙床、舌头不随下颌回缩或上抬，尾部从根部到末端连续过渡。',
      '把规则背刺视为艺术演绎，确认眼上双角、短脸和极短前肢仍是儿童最先看到的识别特征。',
      '分别完整听审 Serena 中文与英文候选，重点检查“食肉牛龙”“阿贝力龙科”和 “Carnotaurus” 的发音、停顿与儿童友好度。',
    ],
    accent: { strong: '#8d4039', soft: '#d6aa86' },
    modelCredit: {
      attribution:
        '“CARNOTAURUS DİNOSAUR” by Cenker Turhan, CC BY 4.0; the separate rock mesh was removed, both feet were calibrated to a grounded standing pose, the original left forelimb was retained while the original right forelimb was locally subdivided and posed forward with a two-bone authoring rig, the lower teeth were bound to lower-jaw motion while the tongue was kept independent, and a progressive tail sway was authored for the eight-second Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'CARNOTAURUS DİNOSAUR',
      sourceUrl:
        'https://sketchfab.com/3d-models/carnotaurus-dinosaur-548c9a0575b14deaae1f12ca9a6c31ca',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist，没有进入生产集合。',
    '石头已删除，两只脚已校准为稳定站姿；原始左前肢保持不变，原始右前肢在保留贴图的两骨骼作者文件中向前调整，且没有复制前肢几何体；当前 GLB 使用上颌稳定、下颌与下排牙齿同步、舌头独立、尾部渐进摆动的八秒闭环 Idle。',
    '双语内容和 Serena 双语旁白已经完成产品负责人评审并通过。',
    '本地评审门槛已经全部通过；是否晋升生产集合仍需单独执行生产资产安装。',
  ],
} satisfies CompleteDraftAnimalPackage
