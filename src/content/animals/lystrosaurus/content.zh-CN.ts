import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '水龙兽',
  classificationLabel: '二齿兽类合弓动物',
  visibleFeature:
    '看看它短短的脸、像喙一样的嘴和两枚獠牙，难怪让人一眼就记住。',
  narration: {
    sentences: [
      '这是水龙兽，一种生活在二叠纪末到三叠纪初的植食性合弓动物，它不是恐龙。',
      '看看它短短的脸、像喙一样的嘴和两枚獠牙，难怪让人一眼就记住。',
    ],
    pronunciation: [
      { text: '水龙兽', reading: 'shuǐ lóng shòu' },
      { text: '合弓动物', reading: 'hé gōng dòng wù' },
      { text: '二叠纪', reading: 'èr dié jì' },
    ],
  },
  facts: {
    period: '晚二叠世至早三叠世（约 2.55 亿至 2.47 亿年前）',
    discoveryRegions: ['非洲南部', '南极洲', '印度', '亚洲'],
    size: {
      kind: 'body-length',
      minMeters: 0.6,
      maxMeters: 2.5,
    },
    diet: 'herbivore',
  },
  parentClassificationNote:
    '水龙兽不是恐龙，而是二齿兽类合弓动物，属于通往哺乳动物的演化支系。它短而深的头骨、向下弯的吻部、喙和一对獠牙确实让活体复原显得“丑萌”；皮肤、体色、脂肪厚度以及是否有稀疏毛状覆盖，无法从现有化石中直接确定。',
  sources: [
    {
      title: 'Evolve or Perish guide — Smithsonian National Museum of Natural History',
      url: 'https://www.naturalhistory.si.edu/sites/default/files/media/file/evolve-or-perish-guidebook-3-12-20.pdf',
      accessedOn: '2026-08-29',
    },
    {
      title: 'The paleobiology and paleoecology of South African Lystrosaurus',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7694564/',
      accessedOn: '2026-08-29',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '这里的体型范围概括了水龙兽属内不同物种和个体的差异。',
      '水龙兽可能会挖洞，也可能主要在陆地活动；不同研究对它与水域的关系仍没有统一答案。',
      '软组织、灰绿色体色和敦实体形都属于无法由化石直接确定的活体复原部分。',
    ],
    editedBy: 'Prehistoric Animal Museum candidate research',
    reviewedBy: 'Leon（产品负责人）',
    reviewedOn: '2026-09-01',
  },
} satisfies AnimalContentZhCN
