import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'meganeura',
  status: 'draft',
  kind: 'other-prehistoric-animal',
  habitat: 'air',
  atmosphere: 'air',
  content: { 'zh-CN': zhCN },
  presentation: {
    cameraLightScale: 1.15,
    initialYawDegrees: -18,
    portraitSafeAreaPadding: 0.18,
    preciseBounds: true,
    safeAreaPadding: 0.1,
    shadow: 'none',
    toneMappingExposure: 0.9,
  },
  animation: { clip: 'Idle', loop: 'repeat', speed: 1 },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('meganeura', 'model.glb'),
    modelBytes: 5_695_048,
    poster: reviewAssetUrl('meganeura', 'poster.webp'),
    posterPortrait: reviewAssetUrl('meganeura', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('meganeura', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('meganeura', 'background-landscape'),
      portrait: reviewAssetUrl('meganeura', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('meganeura', 'narration.mp3'),
    },
  },
  review: {
    badge: '自动 QA 通过',
    status: '巨脉蜻蜓完整本地草稿，等待科学、视觉、动作与听审',
    note:
      '已弃用被视觉评审否决的玩具感程序化低模，改用 Nobilis the Palaeovespa 直接发布的 CC BY 4.0 高细节模型。原始压缩包、许可文本、公开元数据、固定调色、姿态烘焙与模型散列均已保留；51.5k 三角形、四翼密集翅脉、六足、复眼、分节腹部、零 Khronos 错误、八秒闭环快速拍翼 Idle、landmarks 与五视口证据均由自动化核对。',
    checks: [
      '360° 核对四片翅膀彼此分开、六足齐全、双复眼和分节腹部清楚，不把配色或精确翅脉分叉当成化石事实。',
      '完整观看两个八秒循环，确认昆虫专用 34° 行程在八秒内完成 19 次可读拍翼，翅脉与翼膜同步，没有翼根折断、穿插或扑脸感。',
      '在晚石炭世森林横版与竖版背景复看半透明翼膜、深色翅脉、触角和腹端的对比度。',
      '完整听审 Serena 中文旁白，重点检查“巨脉蜻蜓”“石炭世”和“复眼”。',
    ],
    accent: { strong: '#557a55', soft: '#d9c897' },
    modelCredit: {
      attribution:
        'Based on “Meganeura Dinoraul but it is a bit accurate” by Nobilis the Palaeovespa (@nobilishornet), licensed under CC BY 4.0. Modified by the Prehistoric Animal Museum project: source pose baked, helper rig removed, materials colour-graded and de-glared, normalized, and given a project-authored eight-second in-place flying-insect morph-target Idle.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'Meganeura Dinoraul but it is a bit accurate',
      sourceUrl:
        'https://sketchfab.com/3d-models/meganeura-dinoraul-but-it-is-a-bit-accurate-1aaab4a72fbc42b4901d5f1dde12a281',
    },
  },
  draftNotes: [
    '仅加入显式本地 review allowlist；没有进入 src/content/animals 或生产集合。',
    '自动 hard gates 已通过，但科学身份、解剖、材质、动作自然度、背景、中文内容、完整听审和公开分发决定仍是 human-only。',
    '只有产品负责人明确批准后才能记录 approval 并执行生产晋升。',
  ],
} satisfies CompleteDraftAnimalPackage
