import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '迷惑龙',
  classificationLabel: '蜥脚类恐龙',
  visibleFeature: '看看它长长的脖子、长长的尾巴和像柱子一样的四条腿。',
  narration: {
    sentences: [
      '这是迷惑龙，它是生活在晚侏罗世的大型植食性恐龙。',
      '看看它长长的脖子、长长的尾巴和像柱子一样的四条腿。',
    ],
    pronunciation: [
      {
        text: '迷惑龙',
        reading: 'mí huò lóng',
      },
      {
        text: '侏罗世',
        reading: 'zhū luó shì',
      },
    ],
  },
  facts: {
    period: '晚侏罗世（约 1.52亿–1.45亿年前）',
    discoveryRegions: ['北美洲（美国西部）'],
    size: {
      kind: 'body-length',
      minMeters: 21,
      maxMeters: 24,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '迷惑龙是蜥脚类恐龙，属于梁龙类的一支。它用四条柱状腿支撑庞大的身体，长颈和长尾构成醒目的轮廓；不同种和不同个体的体长估算并不完全相同。',
  sources: [
    {
      title: 'Apatosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/apatosaurus.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Thoroughly Modern Apatosaurus — American Museum of Natural History',
      url: 'https://www.amnh.org/exhibitions/dinosaurs-ancient-fossils/sauropod-biomechanics/thoroughly-modern-apatosaurus',
      accessedOn: '2026-07-27',
    },
    {
      title: 'The Morrison Formation — U.S. National Park Service',
      url: 'https://www.nps.gov/subjects/fossils/the-morrison-formation.htm',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '21–24 米整合了属级科普页与迷惑龙不同复原个体的估算，不代表当前模型对应某一标本。',
      '不把迷惑龙与雷龙写成同一个名称；两者现通常作为近亲但不同的属处理。',
      '不把尾巴用途或群居行为写成确定事实。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local remaining-four content pass',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
