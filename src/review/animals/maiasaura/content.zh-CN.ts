import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '慈母龙',
  classificationLabel: '鸭嘴龙类恐龙',
  visibleFeature:
    '看看它宽阔的嘴和结实的后腿，你能想象它在巢区附近慢慢走动吗？',
  narration: {
    sentences: [
      '这是慈母龙，一种生活在晚白垩世北美洲的植食性鸭嘴龙类恐龙。',
      '看看它宽阔的嘴和结实的后腿，你能想象它在巢区附近慢慢走动吗？',
    ],
    pronunciation: [
      {
        text: '慈母龙',
        reading: 'cí mǔ lóng',
      },
      {
        text: '鸭嘴龙类',
        reading: 'yā zuǐ lóng lèi',
      },
    ],
  },
  facts: {
    period: '晚白垩世（约 8000 万至 7500 万年前）',
    discoveryRegions: ['美国蒙大拿州两药组'],
    size: {
      kind: 'body-length',
      minMeters: 7,
      maxMeters: 9,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '慈母龙属于鸭嘴龙科，既能用后腿行走，也能四足活动。巢、蛋、幼体和成年个体化石让它成为研究恐龙繁殖与成长的重要对象；“成年恐龙会长期喂养幼体”仍是需要谨慎表达的科学推断。',
  sources: [
    {
      title: 'Maiasaura — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/maiasaura.html',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Egg Mountain, the Two Medicine, and the Caring Mother Dinosaur — U.S. National Park Service',
      url: 'https://www.nps.gov/articles/mesozoic-egg-mountain-dawson-2014.htm',
      accessedOn: '2026-07-30',
    },
    {
      title:
        'Maiasaura, a model organism for extinct vertebrate population biology — Paleobiology',
      url: 'https://www.cambridge.org/core/journals/paleobiology/article/maiasaura-a-model-organism-for-extinct-vertebrate-population-biology-a-large-sample-statistical-assessment-of-growth-dynamics-and-survivorship/288407BA0A91914480A0531529F050EF',
      accessedOn: '2026-07-30',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '7–9 米是成年或大型个体的近似范围，不表示当前模型对应某件特定标本。',
      '巢区化石强烈支持群体筑巢；亲代喂养的具体方式和持续时间仍有讨论。',
      '模型的体色与软组织属于审慎的艺术复原。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Project owner production review',
    reviewedOn: '2026-07-31',
  },
} satisfies AnimalContentZhCN
