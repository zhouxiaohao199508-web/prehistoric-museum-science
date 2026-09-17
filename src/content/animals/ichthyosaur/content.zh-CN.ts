import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '鱼龙类',
  classificationLabel: '海生爬行动物',
  visibleFeature: '看看它流线形的身体和四只鳍，像不像一艘会游泳的小船？',
  narration: {
    sentences: [
      '这是鱼龙类，它们是生活在古代海洋里的爬行动物。',
      '看看它流线形的身体和四只鳍，像不像一艘会游泳的小船？',
    ],
    pronunciation: [
      {
        text: '鱼龙类',
        reading: 'yú lóng lèi',
      },
      {
        text: '流线形',
        reading: 'liú xiàn xíng',
      },
    ],
  },
  facts: {
    period: '三叠纪至晚白垩世',
    discoveryRegions: ['全球多地的古海洋沉积'],
    size: {
      kind: 'group-range',
      minMeters: 0.9,
      maxMeters: 25,
      note: '不同种类差异很大，并非当前模型的个体体长',
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '鱼龙类是一大群适应海洋生活的爬行动物，不是恐龙。不同种类的体型和食物差异很大；化石还显示它们能在海中产下幼体。当前模型的来源没有给出属或种，因此这里保持群体级名称。',
  sources: [
    {
      title: 'What is an ichthyosaur? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/what-is-an-ichthyosaur.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Earliest ichthyosaur fossil discovered — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/news/2023/april/earliest-ichthyosaur-fossil-discovered-on-remote-arctic-island.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Earliest Triassic ichthyosaur fossils — Current Biology',
      url: 'https://pubmed.ncbi.nlm.nih.gov/36917937/',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '模型只标为 ichthyosaur，没有属、种、地层或标本编号。',
      '类群体型范围不能解释为当前模型个体的体长。',
      '肉食是界面层的群体级概括，不表示所有鱼龙类吃同一种食物。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local collection-review content pass',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
