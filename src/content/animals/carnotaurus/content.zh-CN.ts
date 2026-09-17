import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '食肉牛龙',
  classificationLabel: '阿贝力龙科大型兽脚类恐龙',
  visibleFeature:
    '看看它眼睛上方的双角、短脸和小小的前肢，哪一个特征最容易认出来？',
  narration: {
    sentences: [
      '这是食肉牛龙，一种生活在晚白垩世南美洲的大型肉食恐龙。',
      '看看它眼睛上方的双角、短脸和小小的前肢，哪一个特征最容易认出来？',
    ],
    pronunciation: [
      { text: '食肉牛龙', reading: 'shí ròu niú lóng' },
      { text: '白垩世', reading: 'bái è shì' },
      { text: '阿贝力龙科', reading: 'ā bèi lì lóng kē' },
    ],
  },
  facts: {
    period: '晚白垩世（约 7100 万至 6900 万年前）',
    discoveryRegions: ['阿根廷巴塔哥尼亚'],
    size: {
      kind: 'body-length',
      minMeters: 8,
      maxMeters: 8,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '食肉牛龙属于阿贝力龙科兽脚类。它有眼睛上方的双角、短而窄的头部和极度缩短的前肢。正模还保存了大片皮肤印痕，显示大小不同的鳞片；双角的具体用途仍不清楚。',
  sources: [
    {
      title: 'Carnotaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/carnotaurus.html',
      accessedOn: '2026-08-29',
    },
    {
      title: 'The scaly skin of the abelisaurid Carnotaurus sastrei',
      url: 'https://doi.org/10.1016/j.cretres.2021.104994',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '约 8 米是常见体长估算，完整身体比例需要参考保存不完整的尾部和小腿。',
      '双角可能参与展示、识别或碰撞，但目前没有唯一确定的解释。',
      '化石支持鳞片皮肤，却不支持把整齐连续的长背刺当成确定特征。',
    ],
    editedBy: 'Prehistoric Animal Museum candidate research',
    reviewedBy: 'Leon（产品负责人）',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentZhCN
