import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '肿头龙',
  classificationLabel: '肿头龙类恐龙',
  visibleFeature: '看看它圆圆的头顶和周围的小骨突，像不像戴着一顶小圆帽？',
  narration: {
    sentences: [
      '这是肿头龙，它是一种生活在晚白垩世的植食性恐龙。',
      '看看它圆圆的头顶和周围的小骨突，像不像戴着一顶小圆帽？',
    ],
    pronunciation: [
      {
        text: '肿头龙',
        reading: 'zhǒng tóu lóng',
      },
      {
        text: '白垩世',
        reading: 'bái è shì',
      },
    ],
  },
  facts: {
    period: '晚白垩世',
    discoveryRegions: ['北美洲（美国、加拿大）'],
    size: {
      kind: 'body-length',
      minMeters: 3,
      maxMeters: 4.5,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '肿头龙属于鸟臀类中的肿头龙类。头顶厚实的骨穹是它最醒目的特征；骨穹可能参与展示或同类间碰撞，但具体使用方式仍在研究。食性通常概括为植食，也仍有不确定性。',
  sources: [
    {
      title: 'Pachycephalosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/pachycephalosaurus',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Smithsonian acquires an exceptionally complete Pachycephalosaurus skull',
      url: 'https://www.si.edu/newsdesk/releases/smithsonian-acquires-exceptionally-complete-skull-iconic-dome-headed-dinosaur',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Cranial pathologies in dome-headed dinosaurs — PLOS ONE',
      url: 'https://doi.org/10.1371/journal.pone.0068620',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '体长范围整合不同官方机构的估算，不代表每件标本都落在同一范围。',
      '不在儿童层把食性或骨穹用途写成已经完全确定的事实。',
      '不展示或断言高速正面撞头行为。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local collection-review content pass',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
