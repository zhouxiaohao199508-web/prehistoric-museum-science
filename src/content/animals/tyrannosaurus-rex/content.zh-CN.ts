import type { AnimalContentZhCN } from '../../types'

export const zhCN = {
  name: '霸王龙',
  classificationLabel: '霸王龙科兽脚类恐龙',
  visibleFeature: '看看它大大的脑袋、粗壮的后腿和两条短短的前肢。',
  narration: {
    sentences: [
      '这是霸王龙，它是生活在晚白垩世的食肉恐龙。',
      '看看它大大的脑袋、粗壮的后腿和两条短短的前肢。',
    ],
    pronunciation: [
      {
        text: '霸王龙',
        reading: 'bà wáng lóng',
      },
      {
        text: '白垩世',
        reading: 'bái è shì',
      },
    ],
  },
  facts: {
    period: '晚白垩世（约 6800万–6600万年前）',
    discoveryRegions: ['北美洲西部（美国、加拿大）'],
    size: {
      kind: 'body-length',
      minMeters: 11.5,
      maxMeters: 13,
    },
    diet: 'carnivore',
  },
  parentClassificationNote:
    '霸王龙是大型兽脚类恐龙。化石显示它有巨大的头骨、粗壮的牙齿和两指的短前肢；这些前肢具体怎样使用，科学家仍在讨论。这里用温和的观察方式介绍外形，不演示捕食。',
  sources: [
    {
      title: 'Tyrannosaurus — Natural History Museum',
      url: 'https://www.nhm.ac.uk/discover/dino-directory/tyrannosaurus.html',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Tyrannosaurus rex fact sheet — Smithsonian Institution',
      url: 'https://www.si.edu/newsdesk/factsheets/tyrannosaurus-rex',
      accessedOn: '2026-07-27',
    },
    {
      title: 'Tyrannosaurus rex — American Museum of Natural History',
      url: 'https://www.amnh.org/exhibitions/permanent/saurischian-dinosaurs/tyrannosaurus-rex',
      accessedOn: '2026-07-27',
    },
  ],
  editorial: {
    uncertaintyNotes: [
      '11.5–13 米是不同大型个体与常用估算形成的约数范围，不代表每只霸王龙都达到这一长度。',
      '不把前肢用途写成已有定论。',
      '儿童层避免血腥、追逐和捕食描写。',
    ],
    editedBy: 'Prehistoric Animal Museum primary-source research',
    reviewedBy: 'Local remaining-four content pass',
    reviewedOn: '2026-07-27',
  },
} satisfies AnimalContentZhCN
