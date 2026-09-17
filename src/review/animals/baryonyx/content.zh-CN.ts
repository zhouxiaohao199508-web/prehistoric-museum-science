import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '重爪龙',
  classificationLabel: '棘龙科兽脚类恐龙',
  visibleFeature:
    '看看它细长的吻部和手上的大爪，哪些特征可能帮助它抓住湿滑的猎物？',
  narration: {
    sentences: [
      '这是重爪龙，一种生活在早白垩世欧洲的棘龙科兽脚类恐龙。',
      '看看它细长的吻部和手上的大爪，哪些特征可能帮助它抓住湿滑的猎物？',
    ],
    pronunciation: [
      {
        text: '重爪龙',
        reading: 'zhòng zhǎo lóng',
        note: '“重”表示爪子又大又重，读 zhòng，是“轻重”的“重”。',
      },
      { text: '棘龙科', reading: 'jí lóng kē' },
      { text: '白垩世', reading: 'bái è shì' },
    ],
  },
  facts: {
    period: '早白垩世（约 1.3 亿至 1.25 亿年前）',
    discoveryRegions: ['英国', '欧洲'],
    size: {
      kind: 'body-length',
      minMeters: 7.5,
      maxMeters: 10,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '重爪龙有细长而低的吻部、相对靠后的鼻孔和巨大的手爪。正模腹部区域保存了鱼鳞和禽龙类骨骼，说明它能吃鱼，但不能据此说它只吃鱼或像现代鳄鱼一样生活。吻端宽度、鼻孔位置和拇指爪比例会随着化石材料与复原方法略有不同。',
  sources: [
    {
      title: 'How did Baryonyx change what we knew about spinosaurs? — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/how-did-baryonyx-change-what-we-knew-about-spinosaurs.html',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '7.5–10 米为近似体长范围，正模个体和完全成年体之间的估算不同。',
      '食鱼证据不等于只吃鱼，也不证明它完全水生。',
      '吻端宽度、鼻孔位置和手爪比例会随复原依据略有不同。',
    ],
    editedBy: 'Prehistoric Animal Museum candidate research',
    reviewedBy: 'Leon（产品负责人）',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentZhCN
