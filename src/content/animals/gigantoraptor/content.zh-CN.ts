import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '巨盗龙',
  classificationLabel: '大型窃蛋龙类恐龙',
  visibleFeature: '看看它长长的脖子、修长的腿和像鸟一样的身体轮廓。',
  narration: {
    sentences: [
      '这是巨盗龙，它是生活在晚白垩世的大型窃蛋龙类恐龙。',
      '看看它长长的脖子、修长的腿和像鸟一样的身体轮廓。',
    ],
    pronunciation: [
      {
        text: '巨盗龙',
        reading: 'jù dào lóng',
      },
      {
        text: '窃蛋龙类',
        reading: 'qiè dàn lóng lèi',
      },
    ],
  },
  facts: {
    period: '晚白垩世',
    discoveryRegions: ['中国内蒙古'],
    size: {
      kind: 'body-length',
      minMeters: 8,
      maxMeters: 8,
    },
    diet: 'unknown',
  },
  parentClassificationNote:
    '巨盗龙属于窃蛋龙类。正模化石来自中国内蒙古二连达布苏组，论文估算它体长约 8 米、体重约 1400 千克；现有证据不足以确定食性。当前模型的大眼、头顶饰物、颜色和羽毛分布都是艺术推测，不能当作化石已经证实的样子。',
  sources: [
    {
      title: 'A gigantic bird-like dinosaur from the Late Cretaceous of China — Nature',
      url: 'https://www.nature.com/articles/nature05849',
      accessedOn: '2026-07-28',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '已知化石材料不足以支持模型的大眼、头顶饰物、具体颜色或精确羽毛分布。',
      '食性保持“尚不确定”，不从窃蛋龙类名称或模型外观推断它吃什么。',
      '约 8 米是论文给出的整体估算，不代表当前模型经过了严格比例校准。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local Sketchfab candidate review',
    reviewedOn: '2026-07-28',
  },
} satisfies AnimalContentZhCN
