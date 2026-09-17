import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '蛇颈龙类',
  classificationLabel: '海生爬行动物',
  visibleFeature:
    '看看它的长颈和四只鳍，四只鳍会像水下的翅膀一样一起划水。',
  narration: {
    sentences: [
      '这是蛇颈龙类，它们不是恐龙，而是和恐龙生活在同一时代的海生爬行动物。',
      '看看它的长颈和四只鳍，四只鳍会像水下的翅膀一样一起划水。',
    ],
    pronunciation: [
      {
        text: '蛇颈龙类',
        reading: 'shé jǐng lóng lèi',
      },
      {
        text: '海生爬行动物',
        reading: 'hǎi shēng pá xíng dòng wù',
      },
    ],
  },
  facts: {
    period: '晚三叠世至晚白垩世',
    discoveryRegions: ['全球多地的古海洋沉积'],
    size: {
      kind: 'group-range',
      minMeters: 1.5,
      maxMeters: 13,
      note: '蛇颈龙类内部差异很大，并非当前模型的个体体长',
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '蛇颈龙类是一大群已经灭绝的海生爬行动物，不是恐龙。不同成员有长颈小头或短颈大头等不同体型；它们独特的四只鳍都可能参与持续推进。当前模型来源没有标明属、种或标本，因此展签保持在类群层级。',
  sources: [
    {
      title: 'What is a plesiosaur? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/what-is-a-plesiosaur.html',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'The four-flipper swimming method of plesiosaurs enabled efficient and effective locomotion — Proceedings of the Royal Society B',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5577481/',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Rethinking the four-wing problem in plesiosaur swimming using bio-inspired decentralized control — Scientific Reports',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11519978/',
      accessedOn: '2026-07-30',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '模型来源只写作 Plesiosaure，没有属、种、地层或标本编号。',
      '1.5–13 米是跨多个蛇颈龙类成员的粗略范围，不可当作当前模型个体体长。',
      '鳍的相位配合会随体型和游速变化；本模型 Idle 只做低速展示性复原。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Project owner production review',
    reviewedOn: '2026-07-31',
  },
} satisfies AnimalContentZhCN
