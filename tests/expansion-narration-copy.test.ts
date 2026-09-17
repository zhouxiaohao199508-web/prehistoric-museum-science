import { zhCN as carnotaurusZhCN } from '../src/review/animals/carnotaurus/content.zh-CN'
import { en as lystrosaurusEn } from '../src/review/animals/lystrosaurus/content.en'
import { zhCN as spinosaurusZhCN } from '../src/review/animals/spinosaurus/content.zh-CN'

describe('expansion exhibit narration copy', () => {
  it('keeps static copy and narration scripts synchronized after corrections', () => {
    expect(spinosaurusZhCN.visibleFeature).toBe(
      spinosaurusZhCN.narration.sentences[1],
    )
    expect(spinosaurusZhCN.visibleFeature).toContain(
      '你觉得哪些特征可能帮助它在水边生活',
    )

    expect(lystrosaurusEn.narration.sentences[0]).toContain(
      'Late Permian and Early Triassic',
    )
    expect(lystrosaurusEn.narration.sentences[0]).not.toContain(
      'plant-eating Permian synapsid',
    )
    expect(lystrosaurusEn.narration.pronunciation).toContainEqual({
      text: 'Triassic',
      reading: 'try-ASS-ik',
    })

    expect(carnotaurusZhCN.visibleFeature).toBe(
      carnotaurusZhCN.narration.sentences[1],
    )
    expect(carnotaurusZhCN.visibleFeature).toContain('小小的前肢')
    expect(carnotaurusZhCN.visibleFeature).not.toContain('小小前肢')
  })
})
