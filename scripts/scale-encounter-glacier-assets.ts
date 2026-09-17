import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

import { localReviewAssetPrefix } from './review-assets'

const virtualModuleId = 'virtual:scale-encounter-glacier-assets'
const resolvedVirtualModuleId = `\0${virtualModuleId}`

const glacierAssets = {
  alpineDemUrl: 'alpine-dem-terrarium-z12-2139-1449.png',
  easternAlpsPanoramaUrl:
    'mammoth-eastern-alps-mis3-panorama-v2.webp',
  tundraGroundAlbedoUrl: 'mammoth-tundra-ground-albedo-v2.webp',
  tundraSedgeClumpUrl: 'mammoth-tundra-sedge-clump-v2.webp',
} as const

export function scaleEncounterGlacierAssetUrls(
  source: 'bundled' | 'disabled' | 'review',
): Plugin {
  return {
    name: 'scale-encounter-glacier-asset-urls',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : null
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return null

      if (source === 'bundled') {
        return Object.entries(glacierAssets)
          .map(([exportName, fileName], index) => {
            const localName = `glacierAsset${index}`
            const absolutePath = fileURLToPath(
              new URL(
                `../src/scale-encounter/assets/environments/glacier/${fileName}`,
                import.meta.url,
              ),
            )
            return `import ${localName} from ${JSON.stringify(`${absolutePath}?url`)}; export const ${exportName} = ${localName};`
          })
          .join('\n')
      }

      if (source === 'disabled') {
        return Object.keys(glacierAssets)
          .map(
            (exportName) =>
              `export const ${exportName} = 'about:blank#disabled';`,
          )
          .join('\n')
      }

      return Object.entries(glacierAssets)
        .map(
          ([exportName, fileName]) =>
            `export const ${exportName} = ${JSON.stringify(`${localReviewAssetPrefix}/scale-encounter-environments/glacier/${fileName}`)};`,
        )
        .join('\n')
    },
  }
}
