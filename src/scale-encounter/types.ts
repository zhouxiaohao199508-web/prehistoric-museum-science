export const SCALE_ENCOUNTER_ANIMAL_IDS = [
  'stegosaurus',
  'pteranodon',
  'pachycephalosaurus',
  'ichthyosaur',
  'tyrannosaurus-rex',
  'rhamphorhynchus',
  'triceratops',
  'apatosaurus',
  'plesiosaurus',
  'gigantoraptor',
  'tupandactylus',
  'mammoth',
  'megalodon',
  'maiasaura',
  'sauropelta',
  'meganeura',
  'dilophosaurus',
  'mosasaurus',
  'spinosaurus',
  'lystrosaurus',
  'baryonyx',
  'archaeopteryx',
  'carnotaurus',
  'anomalocaris',
] as const

/**
 * Draft animals that may enter the local "compare with me" review flow.
 * The current expansion has been promoted, so no local-only IDs remain.
 */
export const REVIEW_SCALE_ENCOUNTER_ANIMAL_IDS = [] as const

/** Local-only review animals whose bilingual compare narration is available. */
export const NARRATED_REVIEW_SCALE_ENCOUNTER_ANIMAL_IDS = [] as const

export type ProductionScaleEncounterAnimalId =
  (typeof SCALE_ENCOUNTER_ANIMAL_IDS)[number]

export type ReviewScaleEncounterAnimalId =
  (typeof REVIEW_SCALE_ENCOUNTER_ANIMAL_IDS)[number]

export type ScaleEncounterAnimalId =
  ProductionScaleEncounterAnimalId

export type ScaleEncounterEnvironmentTheme =
  | 'forest'
  | 'glacier'
  | 'sky'
  | 'ocean'

export type ScaleEncounterAvatarPresentationProfile =
  | 'land-explorer'
  | 'snow-expedition'
  | 'air-wingsuit'
  | 'water-diver'

export type ScaleEncounterScaleConfidence = 'range-midpoint' | 'representative'

export type ScaleEncounterApproach = 'comfortable' | 'close'

export type ChildProfile = {
  readonly approach?: ScaleEncounterApproach
  readonly gender: 'boy' | 'girl'
  readonly heightCm: number
}

const SCALE_ENCOUNTER_ANIMAL_ID_SET: ReadonlySet<string> = new Set(
  [...SCALE_ENCOUNTER_ANIMAL_IDS, ...REVIEW_SCALE_ENCOUNTER_ANIMAL_IDS],
)

const PRODUCTION_SCALE_ENCOUNTER_ANIMAL_ID_SET: ReadonlySet<string> = new Set(
  SCALE_ENCOUNTER_ANIMAL_IDS,
)

export function isScaleEncounterAnimal(
  animalId: string,
): animalId is ScaleEncounterAnimalId {
  return SCALE_ENCOUNTER_ANIMAL_ID_SET.has(animalId)
}

export function isProductionScaleEncounterAnimal(
  animalId: ScaleEncounterAnimalId,
): animalId is ProductionScaleEncounterAnimalId {
  return PRODUCTION_SCALE_ENCOUNTER_ANIMAL_ID_SET.has(animalId)
}
