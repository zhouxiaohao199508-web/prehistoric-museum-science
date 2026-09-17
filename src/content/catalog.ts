import { mainCollection } from './collections/main'
import type {
  AnimalCollection,
  AnimalModule,
  AnimalPackage,
  PublishedAnimalPackage,
} from './types'

export interface DiscoveryOptions {
  readonly includeDrafts: boolean
}

export function filterPublishedAnimals(
  animals: readonly AnimalPackage[],
): PublishedAnimalPackage[] {
  return animals.filter(
    (animal): animal is PublishedAnimalPackage =>
      animal.status === 'published',
  )
}

export function discoverAnimalPackages(
  modules: Readonly<Record<string, AnimalModule>>,
  options: DiscoveryOptions,
): AnimalPackage[] {
  const seenIds = new Set<string>()

  return Object.entries(modules)
    .sort(([leftPath], [rightPath]) =>
      leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0,
    )
    .map(([modulePath, module]) => {
      if (seenIds.has(module.animal.id)) {
        throw new Error(
          `内容发现遇到重复动物 ID “${module.animal.id}”（${modulePath}）。`,
        )
      }
      seenIds.add(module.animal.id)
      return module.animal
    })
    .filter(
      (animal) => options.includeDrafts || animal.status === 'published',
    )
}

export function createAnimalIndex(
  animals: readonly AnimalPackage[],
): ReadonlyMap<string, AnimalPackage> {
  const entries = new Map<string, AnimalPackage>()

  for (const animal of animals) {
    if (entries.has(animal.id)) {
      throw new Error(`内容目录包含重复动物 ID “${animal.id}”。`)
    }
    entries.set(animal.id, animal)
  }

  return entries
}

export function getCollectionAnimals(
  collection: AnimalCollection,
  animals: readonly AnimalPackage[],
): PublishedAnimalPackage[] {
  const animalIndex = createAnimalIndex(animals)

  return collection.animalIds.map((animalId) => {
    const animal = animalIndex.get(animalId)
    if (!animal) {
      throw new Error(
        `集合 “${collection.id}” 引用了目录中不存在的动物 “${animalId}”。`,
      )
    }
    if (animal.status !== 'published') {
      throw new Error(
        `集合 “${collection.id}” 不能发布草稿动物 “${animalId}”。`,
      )
    }
    return animal
  })
}

const discoveredModules = import.meta.glob<AnimalModule>(
  './animals/*/animal.ts',
  { eager: true },
)

export const allAnimals = discoverAnimalPackages(discoveredModules, {
  includeDrafts: import.meta.env.DEV,
})

export const publishedAnimals = filterPublishedAnimals(allAnimals)
export const productionAnimals = filterPublishedAnimals(
  discoverAnimalPackages(discoveredModules, { includeDrafts: false }),
)
export const animalById = createAnimalIndex(allAnimals)
export const mainAnimals = getCollectionAnimals(
  mainCollection,
  productionAnimals,
)

export function getAnimalById(animalId: string): AnimalPackage | undefined {
  return animalById.get(animalId)
}
