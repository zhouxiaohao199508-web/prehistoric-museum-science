import { zhCN } from '../src/review/animals/mammoth/content.zh-CN'

describe('mammoth narration pronunciation', () => {
  it('gives 长毛 an unambiguous cháng máo context for offline TTS authoring', () => {
    expect(zhCN.narration.sentences[0]).toContain('身披长毛的猛犸象')
    const animalName = zhCN.narration.pronunciation.find(
      ({ text }) => text === '长毛猛犸象',
    )

    expect(animalName).toMatchObject({
      text: '长毛猛犸象',
      reading: 'cháng máo měng mǎ xiàng',
    })
    expect(animalName).toBeDefined()
    if (!animalName || !('note' in animalName)) {
      throw new Error('长毛猛犸象 pronunciation note is missing')
    }
    expect(animalName.note).toContain('读 cháng')
  })
})
