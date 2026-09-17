import type { AnimalContentZhCN } from '../../../content/types'

export const zhCN = {
  name: '古神翼龙',
  classificationLabel: '带巨大头冠的无齿翼龙类',
  visibleFeature: '看看它没有牙齿的喙、巨大的头冠和展开的皮膜翅膀。',
  narration: {
    sentences: [
      '这是古神翼龙，它是生活在早白垩世巴西的会飞爬行动物，不是恐龙。',
      '看看它没有牙齿的喙、巨大的头冠和展开的皮膜翅膀。',
    ],
    pronunciation: [
      { text: '古神翼龙', reading: 'gǔ shén yì lóng' },
      { text: '白垩世', reading: 'bái è shì' },
      { text: '皮膜翅膀', reading: 'pí mó chì bǎng' },
    ],
  },
  facts: {
    period: '早白垩世',
    discoveryRegions: ['南美洲（巴西东北部）'],
    size: {
      kind: 'wingspan',
      minMeters: 2.7,
      maxMeters: 2.7,
    },
    diet: 'unknown',
  },
  parentClassificationNote:
    '古神翼龙属于翼龙类，是会主动飞行的爬行动物，不是恐龙，也不是鸟。巴西克拉图组标本保存了无齿的喙和由骨质支架、软组织共同构成的巨大头冠；一件近完整成年古神翼龙标本估算翼展约 2.7 米。有研究提出它可能取食植物、也可能受巨大头冠限制而更擅长短距离飞行，但这些解释还不是直接食物或行为证据。模型的冠饰颜色、翼膜花纹和具体拍翼方式都是科学约束下的艺术复原。',
  sources: [
    {
      title: 'Osteology of an exceptionally well-preserved tapejarid skeleton from Brazil',
      url: 'https://doi.org/10.1371/journal.pone.0254789',
      accessedOn: '2026-08-01',
    },
    {
      title: 'New information on Tupandactylus imperator and tapejarid relationships',
      url: 'https://doi.org/10.4202/app.2010.0057',
      accessedOn: '2026-08-01',
    },
    {
      title: 'New tapejarine pterosaur from the Early Cretaceous of Brazil',
      url: 'https://doi.org/10.1371/journal.pone.0162692',
      accessedOn: '2026-08-01',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '模型页只标古神翼龙属，不根据头冠外形判断物种、年龄或性别。',
      '约 2.7 米翼展来自一件近完整成年 T. navigans 标本，不是整个属的精确上下限。',
      '无齿喙和巨大软组织头冠有化石证据；冠饰颜色、花纹与展示功能未知。',
      '食植物与飞行距离限制是已提出的解释，不作为儿童层确定事实。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Project owner production review',
    reviewedOn: '2026-08-01',
  },
} satisfies AnimalContentZhCN
