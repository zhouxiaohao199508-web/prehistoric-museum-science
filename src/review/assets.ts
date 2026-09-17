import {
  modelPreviewProfiles,
  type ModelPreviewFileName,
} from '../viewer/model-preview-profiles'

export type LocalReviewAnimalId =
  | 'stegosaurus'
  | 'pachycephalosaurus'
  | 'ichthyosaur'
  | 'pteranodon'
  | 'tyrannosaurus-rex'
  | 'triceratops'
  | 'apatosaurus'
  | 'gigantoraptor'
  | 'mammoth'
  | 'maiasaura'
  | 'plesiosaurus'
  | 'megalodon'
  | 'sauropelta'
  | 'dilophosaurus'
  | 'mosasaurus'
  | 'rhamphorhynchus'
  | 'tupandactylus'
  | 'meganeura'
  | 'spinosaurus'
  | 'lystrosaurus'
  | 'baryonyx'
  | 'archaeopteryx'
  | 'carnotaurus'
  | 'anomalocaris'

export function reviewAssetUrl(
  animalId: LocalReviewAnimalId,
  fileName:
    | 'model.glb'
    | 'background-landscape'
    | 'background-portrait'
    | 'narration.mp3'
    | 'narration.en.mp3'
    | 'poster.webp'
    | 'poster-portrait.webp'
    | 'thumbnail.webp'
    | 'model-preview.manifest.json'
    | ModelPreviewFileName,
): string {
  return `/__museum-review-assets/${animalId}/${fileName}`
}

export const reviewModelPreviewFileNames = modelPreviewProfiles.map(
  ({ fileName }) => fileName,
)
