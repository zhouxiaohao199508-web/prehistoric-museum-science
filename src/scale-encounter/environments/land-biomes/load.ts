import type { ScaleEncounterEnvironmentThemeId } from '../../environment-theme-registry'
import {
  isScaleEncounterProceduralLandBiomeThemeId,
  type ScaleEncounterPreparedLandBiome,
  type ScaleEncounterProceduralLandBiomeThemeId,
} from './types'
import { acquireScaleEncounterLandBiomeArt } from './assets'

interface NetworkInformationLike {
  readonly effectiveType?: string
  readonly saveData?: boolean
}

function currentConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (
    navigator as Navigator & {
      readonly connection?: NetworkInformationLike
    }
  ).connection
}

/**
 * Every direct import is a separate Vite chunk. Calling this switch requests
 * only the selected theme; the other two preset modules remain untouched.
 */
export async function loadPreparedScaleEncounterLandBiome(
  themeId: ScaleEncounterProceduralLandBiomeThemeId,
): Promise<ScaleEncounterPreparedLandBiome> {
  switch (themeId) {
    case 'gobi':
      return (await import('./gobi')).default
    case 'floodplain':
      return (await import('./floodplain')).default
    case 'carboniferous-wetland-forest':
      return (await import('./carboniferous-wetland-forest')).default
  }
}

export async function acquireProceduralLandBiomeEnvironmentLease(
  themeId: ScaleEncounterEnvironmentThemeId,
  maximumTextureSize = 8192,
  connection: NetworkInformationLike | undefined = currentConnection(),
) {
  if (!isScaleEncounterProceduralLandBiomeThemeId(themeId)) {
    throw new Error(`scale-encounter-theme-is-not-procedural:${themeId}`)
  }
  const preparedLandBiome = await loadPreparedScaleEncounterLandBiome(themeId)
  const useLowPanorama =
    maximumTextureSize < preparedLandBiome.assets.panoramaWidth ||
    connection?.saveData ||
    ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
  const panoramaSourceUrl = useLowPanorama
    ? preparedLandBiome.assets.panoramaLowSourceUrl
    : preparedLandBiome.assets.panoramaSourceUrl
  const panoramaWidth = useLowPanorama
    ? preparedLandBiome.assets.panoramaLowWidth
    : preparedLandBiome.assets.panoramaWidth
  const quality = useLowPanorama ? 'low' as const : 'medium' as const
  const art = await acquireScaleEncounterLandBiomeArt(
    preparedLandBiome,
    panoramaSourceUrl,
  )
  return {
    matureTreeAtlas: art.matureTreeAtlas,
    panoramaWidth,
    preferredQuality: quality,
    preparedLandBiome,
    quality,
    release: () => art.release(),
    sceneProps: art.props,
    sourceUrl: panoramaSourceUrl,
    startPanoramaUpgrade: () => Promise.resolve(null),
    surfaceTextures: art.surfaceTextures,
    texture: art.panorama,
    theme: preparedLandBiome.themeId,
  }
}
