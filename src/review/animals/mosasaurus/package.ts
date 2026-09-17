import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'mosasaurus',
  status: 'draft',
  kind: 'marine-reptile',
  habitat: 'water',
  atmosphere: 'underwater',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    initialYawDegrees: 0,
    portraitSafeAreaPadding: 0.14,
    safeAreaPadding: 0.1,
    preciseBounds: true,
    shadow: 'none',
    toneMappingExposure: 1.16,
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
    model: reviewAssetUrl('mosasaurus', 'model.glb'),
    modelBytes: 5_525_476,
    poster: reviewAssetUrl('mosasaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl('mosasaurus', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('mosasaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('mosasaurus', 'background-landscape'),
      portrait: reviewAssetUrl('mosasaurus', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('mosasaurus', 'narration.mp3'),
    },
  },
  review: {
    badge: '自动 QA 通过',
    status: '沧龙完整本地草稿，等待科学、视觉、动作与听审',
    note:
      '作者课程作业声明、CC BY 4.0、源档案、自包含 GLB、预算、Khronos validator、八秒 Idle、landmarks、无陆地阴影策略和五视口证据由自动化核对。尾端位移约束为头部的八倍以上；源模型唯一的下颌骨和三段舌骨链还被烘焙成每八秒一次的缓慢局部闭合再张开。动作、牙齿间隙、舌头跟随和口腔软组织仍须人工完整观看。',
    checks: [
      '核对头、鳍状肢、尾鳍和身体比例；模型只表达沧龙范围，不自动断言具体种。',
      '完整观看两个八秒循环，确认尾部驱动、头部幅度较小、首尾闭环且没有整体漂移；在四秒附近近看下颌闭合时牙齿不穿插、舌头跟随且嘴角连续。',
      '横竖屏确认长轮廓和四肢完整留在安全区，同时没有陆地接触阴影。',
      '复看张口和牙齿是否成为过度怪兽化的视觉中心。',
      '完整听审 Qwen3-TTS Serena 中文候选旁白，特别检查“沧龙”“有鳞类”和“鳍状肢”。',
    ],
    accent: {
      strong: '#24758a',
      soft: '#b8e0e5',
    },
    modelCredit: {
      attribution:
        '“Mosasaurus” by Lukiethewesly13, CC BY 4.0; source pose and a source-rig partial jaw target baked, helper controls removed, normalized, and given a project-authored eight-second tail-driven morph-target Idle with jaw relaxation for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Mosasaurus',
      sourceUrl:
        'https://sketchfab.com/3d-models/mosasaurus-fe0c25c4ed4e4d4aa05312121e2f68df',
    },
  },
  draftNotes: [
    '仅存在于显式本地 review allowlist；没有进入 src/content/animals 或生产集合。',
    '自动 hard gates 已通过，但科学身份、解剖、材质、动作自然度、背景、中文内容、完整听审和生产决定全部仍是 human-only。',
    'promotion manifest 已预生成；没有新的明确授权时 promote dry-run 必须阻止安装。',
  ],
} satisfies CompleteDraftAnimalPackage
