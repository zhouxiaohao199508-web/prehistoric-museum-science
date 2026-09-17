import type { CompleteDraftAnimalPackage } from '../../types'
import { reviewAssetUrl } from '../../assets'
import { zhCN } from './content.zh-CN'

export const animal = {
  id: 'ichthyosaur',
  status: 'published',
  kind: 'marine-reptile',
  habitat: 'water',
  atmosphere: 'underwater',
  content: {
    'zh-CN': zhCN,
  },
  presentation: {
    initialYawDegrees: 0,
    landscapeHorizontalOffset: 0,
    portraitHorizontalOffset: 0,
    portraitSafeAreaPadding: 0.1,
    preciseBounds: true,
    safeAreaPadding: 0.1,
    shadow: 'none',
  },
  animation: {
    clip: 'Idle',
    loop: 'repeat',
    speed: 0.95,
  },
  narration: {
    status: 'ready',
    sourcePath: 'audio/narration.zh-CN.mp3',
    mimeType: 'audio/mpeg',
  },
  provenance: [],
  assets: {
    model: reviewAssetUrl('ichthyosaur', 'model.glb'),
    modelBytes: 10_709_576,
    poster: reviewAssetUrl('ichthyosaur', 'poster.webp'),
    posterPortrait: reviewAssetUrl('ichthyosaur', 'poster-portrait.webp'),
    thumbnail: reviewAssetUrl('ichthyosaur', 'thumbnail.webp'),
    backgrounds: {
      landscape: reviewAssetUrl('ichthyosaur', 'background-landscape'),
      portrait: reviewAssetUrl('ichthyosaur', 'background-portrait'),
    },
    narration: {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      url: reviewAssetUrl('ichthyosaur', 'narration.mp3'),
    },
  },
  review: {
    badge: '已验收',
    status: '替换模型、皮肤、Idle 与静态图已晋升生产',
    note:
      '已用 owner 选择的 Sketchfab 免费 CC BY 候选 B 完整替换旧几何。官方 1K GLB 的头身被焊接并封闭 12 条残余开口边，粉色伤痕与环状头部瑕疵已平滑；皮肤保留背深腹浅配色，并新增 2K 不规则色斑与切线法线、1K 粗糙度变化，形成比旧版更自然的细皱、微孔和破碎高光，但不做成鱼鳞。牙齿从 69,632 tris 降至约 12.5k，成品总计 80,398 tris。Blender 新建 14 骨骼和 6 秒原地 Idle：六段尾链完成两个连续行波，前鳍约 8°、后鳍约 4.5°，root 无位移；Khronos validator 为 0 error、0 warning。2026-08-04 负责人完成模型验收，2026-08-05 生产目录已安装经压缩的替换模型、缩略图和六套响应式静态预览。',
    checks: [
      '先做 360° 旋转，确认新体型、长吻、眼睛、四鳍比例和尾鳍轮廓适合亲子科普展示。',
      '近看皮肤：确认旧版粉色伤痕、头顶环状贴图和塑料高光已经消失；新细皱、微孔、色斑和粗糙度变化应自然，不像鱼鳞、砂纸或绒布。',
      '完整观察两个 6 秒循环，确认尾部行波明显而克制，root 不漂移，首尾没有跳帧。',
      '重点盯住左右前鳍根、后鳍根、头身接缝、尾柄和口腔，确认没有穿模、拉裂或可见空洞。',
      '分别在桌面和手机尺寸确认完整轮廓、初始朝向、加载速度与交互帧率。',
    ],
    accent: {
      strong: '#247581',
      soft: '#c2e5e3',
    },
    modelCredit: {
      attribution:
        '“ichthyosaurus” by Julian Johnson-Mortimer / FreddyFoxFreddy, CC BY 4.0; head and body welded, residual holes closed, source scars softened, re-UVed and given project-authored 2K aquatic base-colour and tangent-normal maps plus a 1K roughness map, teeth reduced, then rigged in Blender with a six-second in-place museum Idle for local review.',
      licenseName: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceTitle: 'ichthyosaurus',
      sourceUrl:
        'https://sketchfab.com/3d-models/ichthyosaurus-ef8609f5efa84984bc1800bdb36aac3c',
    },
  },
  draftNotes: [
    '本包保留在 npm run review 中，用于复核已晋升的生产模型与本地源证据。',
    '候选 B 原始 1K GLB、Blender 文件、2K 基础色与法线、1K 粗糙度贴图、生成报告、散列、五视角和动画采样证据保留在本地评审区；生产仓库只跟踪经审核和压缩的运行时衍生物与署名记录。',
    '生产版本使用相同的验收模型、构图契约和响应式静态预览，不再保留旧鱼龙模型。',
  ],
} satisfies CompleteDraftAnimalPackage
