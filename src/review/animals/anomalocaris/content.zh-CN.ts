import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '奇虾',
  classificationLabel: '寒武纪放射齿类海生动物',
  visibleFeature:
    '看看它两侧一排排的游泳叶、柄眼和前方的捕食附肢，哪一部分最特别？',
  narration: {
    sentences: [
      '这是奇虾，一种生活在寒武纪海洋里的游泳猎手。',
      '看看它两侧一排排的游泳叶、柄眼和前方的捕食附肢，哪一部分最特别？',
    ],
    pronunciation: [
      { text: '奇虾', reading: 'qí xiā' },
      { text: '寒武纪', reading: 'hán wǔ jì' },
      { text: '放射齿类', reading: 'fàng shè chǐ lèi' },
    ],
  },
  facts: {
    period: '寒武纪中期（约 5.05 亿年前）',
    discoveryRegions: ['加拿大不列颠哥伦比亚省'],
    size: {
      kind: 'body-length',
      minMeters: 0.25,
      maxMeters: 1,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '奇虾是寒武纪海洋中的放射齿类动物。它用身体两侧成排的游泳叶在水中推进，用大眼寻找猎物，再用前方带刺的附肢抓取较柔软的动物。腹面圆形口器、额附肢和尾扇也是重要的识别结构。',
  sources: [
    {
      title: 'Anomalocaris canadensis — Royal Ontario Museum Burgess Shale',
      url: 'https://burgess-shale.rom.on.ca/fossils/anomalocaris-canadensis/',
      accessedOn: '2026-08-29',
    },
    {
      title: 'Anomalocaris canadensis was a fast and agile nektonic predator',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10320336/',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '较完整标本约 25 厘米，约 1 米的较大体长来自分离化石的推算。',
      '功能研究更支持它追逐和抓取较柔软的猎物，不宜把它描述成专门咬碎坚硬三叶虫外壳。',
      '身体颜色没有直接化石证据，模型的橙褐配色属于艺术复原。',
    ],
    editedBy: 'Prehistoric Animal Museum candidate research',
    reviewedBy: 'Leon（产品负责人）',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentZhCN
