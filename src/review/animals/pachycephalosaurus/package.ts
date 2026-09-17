import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'pachycephalosaurus',
  status: 'published',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'forest',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    initialYawDegrees: -90,
    landscapeVerticalOffset: 0.05,
    portraitVerticalOffset: 0.07,
    safeAreaPadding: 0.1,
    shadow: 'ground',
    shadowOpacity: 0.6,
    shadowScale: 0.6,
  },
  animation: {
    clip: 'Idle',
    loop: 'repeat',
    speed: 0.8,
  },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('pachycephalosaurus', 'model.glb'),
    modelBytes: 8_310_424,
    poster: reviewAssetUrl('pachycephalosaurus', 'poster.webp'),
    posterPortrait: reviewAssetUrl(
      'pachycephalosaurus',
      'poster-portrait.webp',
    ),
    thumbnail: reviewAssetUrl('pachycephalosaurus', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl(
        'pachycephalosaurus',
        'background-landscape',
      ),
      portrait: reviewAssetUrl(
        'pachycephalosaurus',
        'background-portrait',
      ),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('pachycephalosaurus', 'narration.mp3'),
    },
  },
  review: {
    badge: '已验收',
    status: '本地展示已通过',
    note:
      '产品负责人已检查模型、场景、文案和完整 Serena 旁白并批准进入生产集合。眼睛与面部材质仍可在后续美术迭代中继续柔化。',
    checks: [
      '圆形骨穹、脸部和四肢是否清楚且不显凶。',
      'Idle 是否自然、重置后构图是否完整。',
      '完整听完旁白，检查“肿头龙”“白垩世”和漏字、停顿、杂音。',
    ],
    accent: {
      strong: '#76566f',
      soft: '#ead8e4',
    },
    modelCredit: {
      attribution:
        '“PBR Pachycephalasaurus Animated” by Ferocious Industries, CC BY 4.0; normalized for local museum review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'PBR Pachycephalasaurus Animated',
      sourceUrl:
        'https://sketchfab.com/3d-models/pbr-pachycephalasaurus-animated-6eea5cee4afa4730bf75c6329a43e56d',
    },
  },
  draftNotes: [
    '本包只在 npm run review 的本地评审模式出现。',
    '模型、背景、渲染图和旁白仍是被忽略的评审素材，不进入生产构建。',
  ],
} satisfies CompleteDraftAnimalPackage
