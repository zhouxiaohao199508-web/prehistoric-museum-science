import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '长毛猛犸象',
  classificationLabel: '象科的史前哺乳动物',
  visibleFeature: '看看它厚厚的长毛、小耳朵和向前弯曲的长牙。',
  narration: {
    sentences: [
      '这是身披长毛的猛犸象，它是冰河时期生活在北方开阔地的史前象类。',
      '看看它厚厚的长毛、小耳朵和向前弯曲的长牙。',
    ],
    pronunciation: [
      {
        text: '长毛猛犸象',
        reading: 'cháng máo měng mǎ xiàng',
        note: '“长”在这里表示毛发很长，读 cháng；旁白用“身披长毛”提供明确语境。',
      },
      {
        text: '象牙',
        reading: 'xiàng yá',
      },
    ],
  },
  facts: {
    period: '更新世至全新世早期（约 80万–4000年前）',
    discoveryRegions: ['欧亚大陆北部', '北美洲北部'],
    size: {
      kind: 'shoulder-height',
      minMeters: 3,
      maxMeters: 3.5,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '长毛猛犸象（Mammuthus primigenius）属于象科，是现代象的近亲而不是祖先。它们适应寒冷，却常生活在植被丰富的开阔地，并非总在深雪里。成年个体肩高约 3–3.5 米；上游模型标题虽然写着“Baby”，长牙和身体比例却不能可靠证明年龄。',
  sources: [
    {
      title: 'Were all mammoths woolly? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/were-all-mammoths-woolly.html',
      accessedOn: '2026-07-28',
    },
    {
      title: 'Mammuthus primigenius (Blumbach) — Smithsonian Institution',
      url: 'https://www.si.edu/object/nmnhpaleobiology_3447777',
      accessedOn: '2026-07-28',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '3–3.5 米是成年长毛猛犸象的肩高范围，不是对当前“Baby”模型的尺寸测量。',
      '上游标题所称的幼体年龄与模型很长的象牙并不容易相符，评审时不把它断言为幼体。',
      '毛色、毛量和软组织细节属于复原表达；冰期背景也是绘本式环境复原，不代表某一处具体化石地点。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local Sketchfab candidate review',
    reviewedOn: '2026-07-28',
  },
} satisfies AnimalContentZhCN
