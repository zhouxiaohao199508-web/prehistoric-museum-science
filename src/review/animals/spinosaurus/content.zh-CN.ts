import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '棘龙',
  classificationLabel: '棘龙科大型兽脚类恐龙',
  visibleFeature:
    '看看它狭长的吻部、高高的背帆和长尾巴，你觉得哪些特征可能帮助它在水边生活？',
  narration: {
    sentences: [
      '这是棘龙，一种生活在晚白垩世早期北非的大型兽脚类恐龙。',
      '看看它狭长的吻部、高高的背帆和长尾巴，你觉得哪些特征可能帮助它在水边生活？',
    ],
    pronunciation: [
      { text: '棘龙', reading: 'jí lóng' },
      { text: '白垩世', reading: 'bái è shì' },
      { text: '兽脚类', reading: 'shòu jiǎo lèi' },
    ],
  },
  facts: {
    period: '晚白垩世早期（约 1 亿至 9300 万年前）',
    discoveryRegions: ['北非'],
    size: {
      kind: 'body-length',
      minMeters: 14,
      maxMeters: 15,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '棘龙属于兽脚类恐龙。化石支持它具有狭长吻部和高高的背帆，现有证据也说明它与水域关系密切；它怎样游泳、在水中停留多久以及具体步态仍有不同解释。尾部深度、后肢比例和常用姿态会随复原依据而变化。',
  sources: [
    {
      title: 'Spinosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/spinosaurus.html',
      accessedOn: '2026-08-29',
    },
    {
      title: 'Tail-propelled aquatic locomotion in a theropod dinosaur',
      url: 'https://doi.org/10.1038/s41586-020-2190-3',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '14–15 米是常见的近似估算，体长会随化石材料和复原方法变化。',
      '棘龙与水域关系密切，但它在水中的推进方式和活动范围仍有不同解释。',
      '尾部深度、后肢比例和常用姿态会随着研究材料与复原方法改变。',
    ],
    editedBy: 'Prehistoric Animal Museum candidate research',
    reviewedBy: 'Leon（产品负责人）',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentZhCN
