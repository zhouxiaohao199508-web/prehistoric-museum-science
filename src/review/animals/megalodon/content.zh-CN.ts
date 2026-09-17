import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '巨齿鲨',
  classificationLabel: '史前鲨鱼',
  visibleFeature:
    '看看它流线形的身体和一排排牙齿，尾巴轻轻摆动时像不像一艘巨大的潜艇？',
  narration: {
    sentences: [
      '这是巨齿鲨，一种曾经游遍温暖海洋的巨型史前鲨鱼。',
      '看看它流线形的身体和一排排牙齿，尾巴轻轻摆动时像不像一艘巨大的潜艇？',
    ],
    pronunciation: [
      {
        text: '巨齿鲨',
        reading: 'jù chǐ shā',
      },
      {
        text: '软骨',
        reading: 'ruǎn gǔ',
      },
    ],
  },
  facts: {
    period: '中新世早期至上新世早期（约 2300 万至 360 万年前）',
    discoveryRegions: ['全球多地的海相地层'],
    size: {
      kind: 'body-length',
      minMeters: 15,
      maxMeters: 18,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '巨齿鲨是已经灭绝的鼠鲨目鲨鱼，不是恐龙或海生爬行动物。鲨鱼骨架主要由软骨构成，完整身体很难保存，因此它的体长、体形和外观主要根据牙齿、少量椎骨及现生近亲推算；当前模型不能当作确定的科学肖像。',
  sources: [
    {
      title:
        'Megalodon: The truth about the largest shark that ever lived — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/megalodon--the-truth-about-the-largest-shark-that-ever-lived.html/',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Reassessment of the possible size, form, weight, cruising speed, and growth parameters of Otodus megalodon — Palaeontologia Electronica',
      url: 'https://palaeo-electronica.org/content/current-in-press-articles/5450-biology-of-otodus-megalodon',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'The Early Pliocene extinction of the mega-toothed shark Otodus megalodon — PeerJ',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6377595/',
      accessedOn: '2026-07-30',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '15–18 米是大型个体的保守估算范围，不表示所有成年个体都达到这一长度。',
      '近期研究提出约 24.3 米的假设性最大值，但这一数字依赖多项比例假设，因此不放进儿童首层。',
      '身体比例、背鳍形状和体色缺少完整化石证据；不能简单视为放大的大白鲨。',
      '当前可确认的最年轻可靠化石记录约为 360 万年前。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Project owner production review',
    reviewedOn: '2026-07-31',
  },
} satisfies AnimalContentZhCN
