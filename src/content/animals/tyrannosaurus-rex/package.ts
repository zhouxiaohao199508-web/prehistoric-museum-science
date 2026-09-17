import { definePublishedAnimal } from '../../types'
import { en } from './content.en'
import { zhCN } from './content.zh-CN'
import { provenance } from './provenance'

export const animalDefinition = definePublishedAnimal({
  id: 'tyrannosaurus-rex',
  status: 'published',
  kind: 'dinosaur',
  habitat: 'land',
  atmosphere: 'forest',
  content: { 'zh-CN': zhCN, en },
  presentation: {
    cameraLightScale: 0.95,
    initialYawDegrees: -90,
    safeAreaPadding: 0.12,
    shadow: 'ground',
    toneMappingExposure: 1.15,
  },
  animation: {
    clip: 'Idle',
    loop: 'repeat',
    speed: 0.9,
  },
  narration: {
    'zh-CN': {
      status: 'ready',
      sourcePath: 'audio/narration.zh-CN.mp3',
      mimeType: 'audio/mpeg',
      speaker: 'Serena',
      language: 'Chinese',
      humanReviewStatus: 'approved',
    },
    en: {
      status: 'ready',
      sourcePath: 'audio/narration.en.mp3',
      mimeType: 'audio/mpeg',
      speaker: 'Serena',
      language: 'English',
      humanReviewStatus: 'approved',
    },
  },
  provenance,
})
