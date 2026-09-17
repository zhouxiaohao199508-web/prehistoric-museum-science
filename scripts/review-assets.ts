import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  MODEL_PREVIEW_MANIFEST_FILE,
  modelPreviewProfiles,
} from '../src/viewer/model-preview-profiles'
import type { LocalReviewAnimalId } from '../src/review/assets'

export const localReviewAssetPrefix = '/__museum-review-assets'

function repositoryFile(relativePath: string): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', relativePath)
}

function productionAnimalAsset(
  animalId: LocalReviewAnimalId,
  relativePath: string,
): string {
  return repositoryFile(`src/content/animals/${animalId}/${relativePath}`)
}

interface ReviewAnimalFiles {
  readonly model: string
  readonly backgroundLandscape: string
  readonly backgroundPortrait: string
  readonly narration?: string
  readonly narrationEn?: string
  readonly poster: string
  readonly posterPortrait?: string
  readonly thumbnail: string
}

const reviewAnimalFiles: Readonly<
  Record<LocalReviewAnimalId, ReviewAnimalFiles>
> = {
  stegosaurus: {
    model: repositoryFile(
      'src/content/animals/stegosaurus/model/model.glb',
    ),
    backgroundLandscape: repositoryFile(
      'src/content/animals/stegosaurus/backgrounds/landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'src/content/animals/stegosaurus/backgrounds/portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/stegosaurus/audio-candidates/stegosaurus-serena-preview.mp3',
    ),
    poster: repositoryFile(
      'src/content/animals/stegosaurus/images/poster.webp',
    ),
    thumbnail: repositoryFile(
      'src/content/animals/stegosaurus/images/thumbnail.webp',
    ),
  },
  pachycephalosaurus: {
    model: repositoryFile(
      'assets/candidates/second-pass-sketchfab/normalized-glb/pachycephalosaurus.glb',
    ),
    backgroundLandscape: productionAnimalAsset(
      'pachycephalosaurus',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'pachycephalosaurus',
      'backgrounds/portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/collection-review/audio/pachycephalosaurus.mp3',
    ),
    poster: productionAnimalAsset(
      'pachycephalosaurus',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'pachycephalosaurus',
      'images/thumbnail.webp',
    ),
  },
  ichthyosaur: {
    model: productionAnimalAsset('ichthyosaur', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'ichthyosaur',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'ichthyosaur',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'ichthyosaur',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'ichthyosaur',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset(
      'ichthyosaur',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'ichthyosaur',
      'images/thumbnail.webp',
    ),
  },
  pteranodon: {
    model: productionAnimalAsset('pteranodon', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'pteranodon',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'pteranodon',
      'backgrounds/portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/collection-review/audio/pteranodon.mp3',
    ),
    poster: productionAnimalAsset(
      'pteranodon',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'pteranodon',
      'images/thumbnail.webp',
    ),
  },
  'tyrannosaurus-rex': {
    model: productionAnimalAsset('tyrannosaurus-rex', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'tyrannosaurus-rex',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'tyrannosaurus-rex',
      'backgrounds/portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/collection-review/audio/tyrannosaurus-rex.mp3',
    ),
    poster: productionAnimalAsset(
      'tyrannosaurus-rex',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'tyrannosaurus-rex',
      'images/thumbnail.webp',
    ),
  },
  triceratops: {
    model: productionAnimalAsset('triceratops', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'triceratops',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'triceratops',
      'backgrounds/portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/collection-review/audio/triceratops.mp3',
    ),
    poster: productionAnimalAsset(
      'triceratops',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'triceratops',
      'images/thumbnail.webp',
    ),
  },
  apatosaurus: {
    model: productionAnimalAsset('apatosaurus', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'apatosaurus',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'apatosaurus',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'apatosaurus',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'apatosaurus',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset(
      'apatosaurus',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'apatosaurus',
      'images/thumbnail.webp',
    ),
  },
  gigantoraptor: {
    model: productionAnimalAsset('gigantoraptor', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'gigantoraptor',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'gigantoraptor',
      'backgrounds/portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/collection-review/audio/gigantoraptor.mp3',
    ),
    poster: productionAnimalAsset(
      'gigantoraptor',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'gigantoraptor',
      'images/thumbnail.webp',
    ),
  },
  mammoth: {
    model: productionAnimalAsset('mammoth', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'mammoth',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'mammoth',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'mammoth',
      'audio/narration.zh-CN.mp3',
    ),
    poster: productionAnimalAsset(
      'mammoth',
      'images/poster.webp',
    ),
    thumbnail: productionAnimalAsset(
      'mammoth',
      'images/thumbnail.webp',
    ),
  },
  maiasaura: {
    model: productionAnimalAsset('maiasaura', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'maiasaura',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'maiasaura',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'maiasaura',
      'audio/narration.zh-CN.mp3',
    ),
    poster: productionAnimalAsset('maiasaura', 'images/poster.webp'),
    thumbnail: productionAnimalAsset('maiasaura', 'images/thumbnail.webp'),
  },
  plesiosaurus: {
    model: productionAnimalAsset('plesiosaurus', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'plesiosaurus',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'plesiosaurus',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'plesiosaurus',
      'audio/narration.zh-CN.mp3',
    ),
    poster: productionAnimalAsset('plesiosaurus', 'images/poster.webp'),
    thumbnail: productionAnimalAsset(
      'plesiosaurus',
      'images/thumbnail.webp',
    ),
  },
  megalodon: {
    model: productionAnimalAsset('megalodon', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'megalodon',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'megalodon',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'megalodon',
      'audio/narration.zh-CN.mp3',
    ),
    poster: productionAnimalAsset('megalodon', 'images/poster.webp'),
    thumbnail: productionAnimalAsset('megalodon', 'images/thumbnail.webp'),
  },
  sauropelta: {
    model: productionAnimalAsset('sauropelta', 'model/model.glb'),
    backgroundLandscape: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/sauropelta/output/background-landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/sauropelta/output/background-portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/animal-onboarding-runs/2026-07-31-batch/sauropelta/narration.mp3',
    ),
    poster: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/sauropelta/output/poster.webp',
    ),
    thumbnail: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/sauropelta/output/thumbnail.webp',
    ),
  },
  dilophosaurus: {
    model: productionAnimalAsset('dilophosaurus', 'model/model.glb'),
    backgroundLandscape: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/dilophosaurus/output/background-landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/dilophosaurus/output/background-portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/animal-onboarding-runs/2026-07-31-batch/dilophosaurus/narration.mp3',
    ),
    poster: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/dilophosaurus/output/poster.webp',
    ),
    thumbnail: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/dilophosaurus/output/thumbnail.webp',
    ),
  },
  mosasaurus: {
    model: productionAnimalAsset('mosasaurus', 'model/model.glb'),
    backgroundLandscape: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/mosasaurus/output/background-landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/mosasaurus/output/background-portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/animal-onboarding-runs/2026-07-31-batch/mosasaurus/narration.mp3',
    ),
    poster: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/mosasaurus/output/poster.webp',
    ),
    thumbnail: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/mosasaurus/output/thumbnail.webp',
    ),
  },
  rhamphorhynchus: {
    model: productionAnimalAsset('rhamphorhynchus', 'model/model.glb'),
    backgroundLandscape: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/rhamphorhynchus/output/background-landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/rhamphorhynchus/output/background-portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/animal-onboarding-runs/2026-07-31-rhamphorhynchus/narration.mp3',
    ),
    poster: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/rhamphorhynchus/output/poster.webp',
    ),
    thumbnail: repositoryFile(
      'assets/candidates/animal-onboarding-2026-07-31/rhamphorhynchus/output/thumbnail.webp',
    ),
  },
  tupandactylus: {
    model: productionAnimalAsset('tupandactylus', 'model/model.glb'),
    backgroundLandscape: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/tupandactylus/output/background-landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/tupandactylus/output/background-portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/animal-onboarding-runs/2026-08-01-tupandactylus/narration.mp3',
    ),
    poster: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/tupandactylus/output/poster.webp',
    ),
    thumbnail: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/tupandactylus/output/thumbnail.webp',
    ),
  },
  meganeura: {
    model: productionAnimalAsset('meganeura', 'model/model.glb'),
    backgroundLandscape: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/meganeura/output/background-landscape.webp',
    ),
    backgroundPortrait: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/meganeura/output/background-portrait.webp',
    ),
    narration: repositoryFile(
      '.handoff/animal-onboarding-runs/2026-08-01-meganeura/narration.mp3',
    ),
    poster: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/meganeura/output/poster.webp',
    ),
    thumbnail: repositoryFile(
      'assets/candidates/animal-onboarding-2026-08-01/meganeura/output/thumbnail.webp',
    ),
  },
  spinosaurus: {
    model: productionAnimalAsset('spinosaurus', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'spinosaurus',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'spinosaurus',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'spinosaurus',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'spinosaurus',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset('spinosaurus', 'images/poster.webp'),
    posterPortrait: productionAnimalAsset(
      'spinosaurus',
      'images/poster-portrait.webp',
    ),
    thumbnail: productionAnimalAsset('spinosaurus', 'images/thumbnail.webp'),
  },
  lystrosaurus: {
    model: productionAnimalAsset('lystrosaurus', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'lystrosaurus',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'lystrosaurus',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'lystrosaurus',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'lystrosaurus',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset('lystrosaurus', 'images/poster.webp'),
    posterPortrait: productionAnimalAsset(
      'lystrosaurus',
      'images/poster-portrait.webp',
    ),
    thumbnail: productionAnimalAsset('lystrosaurus', 'images/thumbnail.webp'),
  },
  baryonyx: {
    model: productionAnimalAsset('baryonyx', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'baryonyx',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'baryonyx',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'baryonyx',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'baryonyx',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset('baryonyx', 'images/poster.webp'),
    posterPortrait: productionAnimalAsset(
      'baryonyx',
      'images/poster-portrait.webp',
    ),
    thumbnail: productionAnimalAsset('baryonyx', 'images/thumbnail.webp'),
  },
  archaeopteryx: {
    model: productionAnimalAsset('archaeopteryx', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'archaeopteryx',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'archaeopteryx',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'archaeopteryx',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'archaeopteryx',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset('archaeopteryx', 'images/poster.webp'),
    posterPortrait: productionAnimalAsset(
      'archaeopteryx',
      'images/poster-portrait.webp',
    ),
    thumbnail: productionAnimalAsset('archaeopteryx', 'images/thumbnail.webp'),
  },
  carnotaurus: {
    model: productionAnimalAsset('carnotaurus', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'carnotaurus',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'carnotaurus',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'carnotaurus',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'carnotaurus',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset('carnotaurus', 'images/poster.webp'),
    posterPortrait: productionAnimalAsset(
      'carnotaurus',
      'images/poster-portrait.webp',
    ),
    thumbnail: productionAnimalAsset('carnotaurus', 'images/thumbnail.webp'),
  },
  anomalocaris: {
    model: productionAnimalAsset('anomalocaris', 'model/model.glb'),
    backgroundLandscape: productionAnimalAsset(
      'anomalocaris',
      'backgrounds/landscape.webp',
    ),
    backgroundPortrait: productionAnimalAsset(
      'anomalocaris',
      'backgrounds/portrait.webp',
    ),
    narration: productionAnimalAsset(
      'anomalocaris',
      'audio/narration.zh-CN.mp3',
    ),
    narrationEn: productionAnimalAsset(
      'anomalocaris',
      'audio/narration.en.mp3',
    ),
    poster: productionAnimalAsset('anomalocaris', 'images/poster.webp'),
    posterPortrait: productionAnimalAsset(
      'anomalocaris',
      'images/poster-portrait.webp',
    ),
    thumbnail: productionAnimalAsset('anomalocaris', 'images/thumbnail.webp'),
  },
}

const routeFilePairs = Object.entries(reviewAnimalFiles).flatMap(
  ([animalId, files]) => {
    const modelPreviewDirectory = repositoryFile(
      `assets/review-generated/model-previews/${animalId}`,
    )
    const posterPortrait =
      files.posterPortrait ??
      productionAnimalAsset(
        animalId as LocalReviewAnimalId,
        'images/poster-portrait.webp',
      )
    const modelPreviewFiles = [
      ...modelPreviewProfiles.map(
        ({ fileName }) =>
          [fileName, resolve(modelPreviewDirectory, fileName)] as const,
      ),
      [
        MODEL_PREVIEW_MANIFEST_FILE,
        resolve(modelPreviewDirectory, MODEL_PREVIEW_MANIFEST_FILE),
      ] as const,
    ]
    const filePairs = [
      ['model.glb', files.model],
      ['background-landscape', files.backgroundLandscape],
      ['background-portrait', files.backgroundPortrait],
      ['poster.webp', files.poster],
      ['poster-portrait.webp', posterPortrait],
      ['thumbnail.webp', files.thumbnail],
      ...modelPreviewFiles,
      ...(files.narration === undefined
        ? []
        : ([['narration.mp3', files.narration]] as const)),
      ...(files.narrationEn === undefined
        ? []
        : ([['narration.en.mp3', files.narrationEn]] as const)),
    ] satisfies readonly (readonly [string, string])[]

    return filePairs.map(
      ([fileName, absolutePath]) =>
        [
          `${localReviewAssetPrefix}/${animalId}/${fileName}`,
          absolutePath,
        ] as const,
    )
  },
)

const scaleEncounterEnvironmentAssetFiles = [
  'forest-props-real-v1.glb',
  'forest-ecology-real-v2.glb',
  'real-tree-lods-v1.glb',
  'midground-vegetation-atlas-v2.webp',
  'midground-araucaria-components-v4.webp',
  'midground-frond-components-v4-final.webp',
  'midground-mature-tree-atlas-v1.webp',
  'midground-mature-tree-atlas-v1-1024.webp',
  'panorama-land-cretaceous-v5-farfield-4096.webp',
  'panorama-land-cretaceous-v5-farfield-2048.webp',
  'panorama-gobi-irendabas-photoreal-v1-4096.webp',
  'panorama-gobi-irendabas-photoreal-v1-2048.webp',
  'panorama-floodplain-kayenta-photoreal-v1-4096.webp',
  'panorama-floodplain-kayenta-photoreal-v1-2048.webp',
  'panorama-carboniferous-wetland-photoreal-v1-4096.webp',
  'panorama-carboniferous-wetland-photoreal-v1-2048.webp',
  'surface-gobi-gravel-albedo-v1.webp',
  'surface-floodplain-red-silt-albedo-v1.webp',
  'surface-carboniferous-peat-albedo-v1.webp',
  'surface-land-v4-humus-albedo-1254.webp',
  'panorama-land-cretaceous-2048.webp',
  'panorama-land-cretaceous-4096.webp',
  'panorama-land-cretaceous-8192.webp',
  'panorama-air-cretaceous-2048.webp',
  'panorama-air-cretaceous-4096.webp',
  'panorama-air-cretaceous-8192.webp',
  'panorama-water-cretaceous-2048.webp',
  'panorama-water-cretaceous-4096.webp',
  'panorama-water-cretaceous-8192.webp',
  'panorama-snow-ice-age-2048.webp',
  'panorama-snow-ice-age-4096.webp',
  'panorama-snow-ice-age-8192.webp',
  ...(['land', 'water', 'snow'] as const).flatMap((theme) =>
    (['albedo', 'normal', 'roughness'] as const).flatMap((map) => [
      `surface-${theme}-${map}-1024.webp`,
      `surface-${theme}-${map}-2048.webp`,
    ]),
  ),
  'glacier/alpine-dem-terrarium-z12-2139-1449.png',
  'glacier/mammoth-eastern-alps-mis3-panorama-v2.webp',
  'glacier/mammoth-tundra-ground-albedo-v2.webp',
  'glacier/mammoth-tundra-sedge-clump-v2.webp',
] as const

const scaleEncounterEnvironmentRouteFilePairs =
  scaleEncounterEnvironmentAssetFiles.map(
    (fileName) =>
      [
        `${localReviewAssetPrefix}/scale-encounter-environments/${fileName}`,
        repositoryFile(
          `src/scale-encounter/assets/environments/${fileName}`,
        ),
      ] as const,
  )

export const scaleEncounterChildAvatarAssetFiles = [
  'child-avatar-v4-boy-land-explorer-review-v01.glb',
  'child-avatar-v4-girl-land-explorer-review-v01.glb',
  'child-avatar-v4-boy-snow-expedition-review-v01.glb',
  'child-avatar-v4-girl-snow-expedition-review-v01.glb',
  'child-avatar-v4-boy-air-wingsuit-review-v01.glb',
  'child-avatar-v4-girl-air-wingsuit-review-v01.glb',
  'child-avatar-v4-boy-water-diver-review-v01.glb',
  'child-avatar-v4-girl-water-diver-review-v01.glb',
] as const

const scaleEncounterChildAvatarRouteFilePairs =
  scaleEncounterChildAvatarAssetFiles.map(
    (fileName) =>
      [
        `${localReviewAssetPrefix}/scale-encounter-child-avatar/${fileName}`,
        repositoryFile(
          `src/scale-encounter/assets/avatars/${fileName.replace('-review-v01', '-v01')}`,
        ),
      ] as const,
  )

export const scaleEncounterChildPortraitAssets = [
  {
    fileName: 'boy-land-explorer.webp',
    sourceFile: 'boy-land-explorer.webp',
  },
  {
    fileName: 'girl-land-explorer.webp',
    sourceFile: 'girl-land-explorer.webp',
  },
] as const

const scaleEncounterChildPortraitRouteFilePairs =
  scaleEncounterChildPortraitAssets.map(
    ({ fileName, sourceFile }) =>
      [
        `${localReviewAssetPrefix}/scale-encounter-child-portraits/${fileName}`,
        repositoryFile(
          `src/scale-encounter/assets/avatars/${sourceFile}`,
        ),
      ] as const,
  )

const scaleEncounterNarrationRouteFilePairs = [
  'spinosaurus',
  'lystrosaurus',
  'baryonyx',
  'archaeopteryx',
  'carnotaurus',
  'anomalocaris',
].flatMap((animalId) =>
  ['zh-CN', 'en'].flatMap((locale) =>
    ['intro', 'transition', 'arrival'].map((kind) => {
      const fileName = `${animalId}-${kind}.${locale}.mp3`
      return [
        `${localReviewAssetPrefix}/scale-encounter-audio/${fileName}`,
        repositoryFile(`src/scale-encounter/audio/${fileName}`),
      ] as const
    }),
  ),
)

export const localReviewAssetFiles: ReadonlyMap<string, string> = new Map(
  [
    ...routeFilePairs,
    ...scaleEncounterEnvironmentRouteFilePairs,
    ...scaleEncounterChildAvatarRouteFilePairs,
    ...scaleEncounterChildPortraitRouteFilePairs,
    ...scaleEncounterNarrationRouteFilePairs,
  ],
)
