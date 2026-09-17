import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '三角龙',
  classificationLabel: '角龙类恐龙',
  visibleFeature: '看看它眼睛上方的两只长角、鼻尖的小角和宽宽的颈盾。',
  narration: {
    sentences: [
      '这是三角龙，它是生活在晚白垩世的植食性恐龙。',
      '看看它眼睛上方的两只长角、鼻尖的小角和宽宽的颈盾。',
    ],
    pronunciation: [
      {
        text: '三角龙',
        reading: 'sān jiǎo lóng',
      },
      {
        text: '颈盾',
        reading: 'jǐng dùn',
      },
    ],
  },
  facts: {
    period: '晚白垩世（约 6800万–6600万年前）',
    discoveryRegions: ['北美洲（美国、加拿大）'],
    size: {
      kind: 'body-length',
      minMeters: 8,
      maxMeters: 9,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '三角龙属于角龙类恐龙，嘴的前端像鸟喙，后面的牙齿可以处理植物。它最醒目的三只角和颈盾可能参与展示、辨认同类或防护，但不把任何一种用途说成唯一答案。',
  sources: [
    {
      title: 'Triceratops — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/triceratops.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Triceratops fossil skeleton — American Museum of Natural History',
      url: 'https://www.amnh.org/exhibitions/permanent/ornithischian-dinosaurs/triceratops',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Fossil Planet educator guide — Royal Tyrrell Museum',
      url: 'https://www.tyrrellmuseum.com/sites/default/files/media/DL_FP-AG.pdf',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '体长采用约 8–9 米的亲子层范围；不同个体和复原估算会有差异。',
      '颈盾与角可能有多种用途，不在儿童层断言只用于打斗或防御。',
      '模型不作为某一具体种或标本的科学复原证据。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local remaining-four content pass',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
