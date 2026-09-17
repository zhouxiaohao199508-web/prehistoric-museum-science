import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '始祖鸟',
  classificationLabel: '有鸟样特征的小型兽脚类恐龙',
  visibleFeature:
    '看看它的羽毛、翅膀爪和长尾巴，哪些地方像鸟，哪些地方又像恐龙？',
  narration: {
    sentences: [
      '这是始祖鸟，一种生活在晚侏罗世德国的小型有羽毛恐龙。',
      '看看它的羽毛、翅膀爪和长尾巴，哪些地方像鸟，哪些地方又像恐龙？',
    ],
    pronunciation: [
      { text: '始祖鸟', reading: 'shǐ zǔ niǎo' },
      { text: '侏罗世', reading: 'zhū luó shì' },
      { text: '兽脚类', reading: 'shòu jiǎo lèi' },
    ],
  },
  facts: {
    period: '晚侏罗世（约 1.49 亿至 1.45 亿年前）',
    discoveryRegions: ['德国巴伐利亚'],
    size: {
      kind: 'body-length',
      minMeters: 0.5,
      maxMeters: 0.5,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '始祖鸟是小型有羽毛兽脚类恐龙。它有宽阔羽翼，也保留牙齿、翅膀爪和长骨质尾等与现代鸟不同的特征。翼骨研究支持它能够主动拍翼，但飞行方式和活动范围与现代鸟并不相同。',
  sources: [
    {
      title: 'Archaeopteryx — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/archaeopteryx',
      accessedOn: '2026-08-29',
    },
    {
      title: 'New specimen of Archaeopteryx provides insights into the evolution of pennaceous feathers',
      url: 'https://doi.org/10.1038/nature13467',
      accessedOn: '2026-08-29',
    },
    {
      title: 'Wing bone geometry reveals active flight in Archaeopteryx',
      url: 'https://doi.org/10.1038/s41467-018-03296-8',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '“第一只鸟”是常见的历史称呼；始祖鸟在鸟类早期演化树上的具体位置仍会随着新研究调整。',
      '翼骨支持主动拍翼飞行，但它能飞多远、怎样起飞以及更常在地面还是树上活动仍有不同解释。',
      '羽毛的具体颜色和花纹无法从这件模型所依据的材料中完整确定。',
    ],
    editedBy: 'Prehistoric Animal Museum candidate research',
    reviewedBy: 'Leon（产品负责人）',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentZhCN
