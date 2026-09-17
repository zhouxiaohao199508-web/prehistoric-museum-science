import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '无齿翼龙',
  classificationLabel: '翼龙类飞行爬行动物',
  visibleFeature: '看看它长长的无齿嘴巴、头后的冠和展开的大翅膀。',
  narration: {
    sentences: [
      '这是无齿翼龙，它是生活在晚白垩世、会飞的爬行动物。',
      '看看它长长的无齿嘴巴、头后的冠和展开的大翅膀。',
    ],
    pronunciation: [
      {
        text: '无齿翼龙',
        reading: 'wú chǐ yì lóng',
      },
      {
        text: '白垩世',
        reading: 'bái è shì',
      },
    ],
  },
  facts: {
    period: '晚白垩世',
    discoveryRegions: ['北美洲（美国）'],
    size: {
      kind: 'wingspan',
      minMeters: 6,
      maxMeters: 8,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '无齿翼龙属于翼龙类，是会飞的爬行动物，不是恐龙。它没有牙齿，化石胃内容物中的鱼类遗骸说明鱼是它的食物之一。较大标本的翼展可超过 6 米。',
  sources: [
    {
      title: 'Pterosaur — Kansas Geological Survey',
      url: 'https://geokansas.ku.edu/pterosaur',
      accessedOn: '2026-07-27',
    },
    {
      title: 'The truth about pterosaurs — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/the-truth-about-pterosaurs.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Taxonomy and systematics of Pteranodon — University of Kansas',
      url: 'https://www.biodiversitylibrary.org/part/23017',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '模型只标为 Pteranodon，文案不把它指定为某个种或性别。',
      '6–8 米表示翼展，不是体长。',
      '当前静态展示不暗示模型动画复原了真实飞行动作。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local collection-review content pass',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
