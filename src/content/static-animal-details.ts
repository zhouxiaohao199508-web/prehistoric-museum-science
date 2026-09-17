import { mainCollection } from './collections/main'

export const staticAnimalDetailIds = Object.freeze([
  ...mainCollection.animalIds,
])

export type StaticAnimalDetailId = (typeof staticAnimalDetailIds)[number]
