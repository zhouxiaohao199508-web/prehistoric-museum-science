import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '剑龙',
  classificationLabel: '剑龙类恐龙',
  visibleFeature: '看看它背上的两排骨板，像不像一列起伏的小山？',
  narration: {
    sentences: [
      '这是剑龙，它是一种生活在晚侏罗世的食草恐龙。',
      '看看它背上的两排骨板，像不像一列起伏的小山？',
    ],
    pronunciation: [
      {
        text: '剑龙',
        reading: 'jiàn lóng',
      },
      {
        text: '侏罗世',
        reading: 'zhū luó shì',
      },
    ],
  },
  facts: {
    period: '晚侏罗世',
    discoveryRegions: ['北美洲西部'],
    size: {
      kind: 'body-length',
      minMeters: 6.5,
      maxMeters: 9,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '剑龙属于鸟臀类恐龙中的剑龙类。它背上的骨板和尾端尖刺是最容易辨认的特征。',
  sources: [
    {
      title: 'Stegosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Stegosaurus stenops — Smithsonian National Museum of Natural History',
      url: 'https://naturalhistory.si.edu/education/teaching-resources/paleontology/stegosaurus-body',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '体长采用适合亲子阅读的近似范围，不把不同标本的估算写成单一精确值。',
      '不把骨板颜色和叫声描述成已经证实的事实。',
    ],
    editedBy: 'Prehistoric Animal Museum implementation',
    reviewedBy: 'First-slice content review',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
