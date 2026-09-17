import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'mammoth',
  status: 'published',
  kind: 'other-prehistoric-animal',
  habitat: 'land',
  atmosphere: 'ice',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    cameraLightScale: 2.2,
    initialYawDegrees: -35,
    safeAreaPadding: 0.12,
    shadow: 'ground',
    toneMappingExposure: 1.75,
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
    model: reviewAssetUrl('mammoth', 'model.glb'),
    modelBytes: 1_198_456,
    poster: reviewAssetUrl('mammoth', 'poster.webp'),
    posterPortrait: reviewAssetUrl('mammoth', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('mammoth', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('mammoth', 'background-landscape'),
      portrait: reviewAssetUrl('mammoth', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('mammoth', 'narration.mp3'),
    },
  },
  review: {
    badge: '待复看',
    status: '头部长牙与尾部 Blender Idle 待复看',
    note:
      '已验收的 SDPM Esare 上游模型、场景、文案和“身披长毛”cháng máo 旁白保持不变。根据近景截图统一头部与身体两块表面的颈部渐变，并固定尾根，消除两处露底；头部仍有约 7°俯仰和约 4°转动，长牙位移清楚，摆动集中到远端尾骨并适当加大。',
    checks: [
      '确认署名指向 SDPM Esare 的上游原作，而不是 kenchoo 上传的衍生版本。',
      '观看完整循环，确认头部、象鼻和两根长牙作为整体自然移动，颈背没有开缝。',
      '确认尾部摆动清楚但不过快，四脚固定且毛发表面没有拉伸。',
      '模型约 5.7 万三角面、3.1 MiB；检查手机首次载入、动画、毛发表面旋转和连续切换时是否流畅。',
      '把 3–3.5 米明确解释为成年肩高，不把上游“Baby”标题当成模型年龄已经核实。',
      '修正版 Serena 旁白已确认“身披长毛”中的“长”读 cháng；只有重新生成音频时才重开该听审门槛。',
    ],
    accent: {
      strong: '#6f655b',
      soft: '#e2dad0',
    },
    modelCredit: {
      attribution:
        '“3D High-poly Baby Woolly Mammoth” by SDPM Esare, CC BY 4.0; normalized and rigged in Blender with repaired neck weights and an in-place head-and-tail museum Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: '3D High-poly Baby Woolly Mammoth',
      sourceUrl:
        'https://sketchfab.com/3d-models/3d-high-poly-baby-woolly-mammoth-fce1c86ccedf47a5b9627098be6719d5',
    },
  },
  draftNotes: [
    '本包只在 npm run review 的所有者本地评审模式出现。',
    'Blender 工作文件、权重报告和离线检查图保留在忽略的本地评审区；生产目录只保留优化后的运行模型与衍生图。',
    '修正版 Serena 旁白已完成人工复听并可在本地评审中点击播放；公开再分发权利决定仍未完成。',
  ],
} satisfies CompleteDraftAnimalPackage
