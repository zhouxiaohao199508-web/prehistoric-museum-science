import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '巨脉蜻蜓',
  classificationLabel: '巨脉类大型飞行昆虫',
  visibleFeature: '看看它四片布满翅脉的翅膀、六条腿和一双大大的复眼。',
  narration: {
    sentences: [
      '这是巨脉蜻蜓，它生活在约三亿年前的晚石炭世，是现代蜻蜓的远亲。',
      '看看它四片布满翅脉的翅膀、六条腿和一双大大的复眼。',
    ],
    pronunciation: [
      { text: '巨脉蜻蜓', reading: 'jù mài qīng tíng' },
      { text: '石炭世', reading: 'shí tàn shì' },
      { text: '复眼', reading: 'fù yǎn' },
    ],
  },
  facts: {
    period: '晚石炭世（约 3 亿年前）',
    discoveryRegions: ['欧洲（法国 Commentry）'],
    size: {
      kind: 'wingspan',
      minMeters: 0.7,
      maxMeters: 0.7,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '巨脉蜻蜓是与现代蜻蜓相关的已灭绝大型飞行昆虫，并不是真正的现代蜻蜓。法国 Commentry 的晚石炭世化石显示翼展约 70 厘米；模式标本保存的翅脉是复原四片翅膀的重要依据。近缘巨脉类腿上的强棘支持它们把六足合成空中捕猎篮，但巨脉蜻蜓的完整身体保存有限。模型的黄黑配色、半透明翼膜、精确翅脉分叉、腿棘数量和拍翼方式都是科学约束下的艺术复原。',
  sources: [
    {
      title: 'Meganeura monyi, libellule géante — Muséum national d’Histoire naturelle',
      url: 'https://www.mnhn.fr/fr/meganeura-monyi-libellule-geante',
      accessedOn: '2026-08-01',
    },
    {
      title: 'The winged insects of the Carboniferous and their predatory leg basket',
      url: 'https://doi.org/10.1038/s41598-018-30629-w',
      accessedOn: '2026-08-01',
    },
    {
      title: 'New imaging and wing venation of the Meganeura monyi holotype',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10548097/',
      accessedOn: '2026-08-01',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '“巨脉蜻蜓”是通行中文名；它属于已灭绝巨脉类，不是真正的现代蜻蜓。',
      '约 70 厘米表示翼展，不是身体长度。',
      '翅脉证据强，完整身体软组织、体色、眼色和腿棘数量证据弱。',
      '高氧可能帮助昆虫巨型化，但不是已证实的唯一原因。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Project owner production review',
    reviewedOn: '2026-08-01',
  },
} satisfies AnimalContentZhCN
