import type { ScaleEncounterPreparedLandBiome } from './types'

/**
 * Coal-swamp structure uses lycopsid trunks, calamites and fern components;
 * it intentionally excludes flowering broadleaf trees and modern rainforest
 * silhouettes.
 */
const CARBONIFEROUS_WETLAND_FOREST_BIOME = {
  assets: {
    groundAlbedoSourceUrl: new URL(
      '../../assets/environments/surface-carboniferous-peat-albedo-v1.webp',
      import.meta.url,
    ).href,
    groundPhysicalWidthMeters: 2,
    panoramaLowSourceUrl: new URL(
      '../../assets/environments/panorama-carboniferous-wetland-photoreal-v1-2048.webp',
      import.meta.url,
    ).href,
    panoramaLowWidth: 2048,
    panoramaSourceUrl: new URL(
      '../../assets/environments/panorama-carboniferous-wetland-photoreal-v1-4096.webp',
      import.meta.url,
    ).href,
    panoramaWidth: 4096,
    panoramaYawRadians: -Math.PI / 2 - 0.55,
    scannedPropProfile: 'coal-swamp-floor',
  },
  atmosphere: {
    exposure: 1.29,
    fogFarMeters: 360,
    fogNearMeters: 145,
    hemisphereGround: '#66796b',
    hemisphereIntensity: 2.5,
    hemisphereSky: '#b8cfca',
    sunIntensity: 3.05,
    sunPosition: [-48, 104, 58],
  },
  ecology: {
    calamites: 44,
    distantLandforms: 0,
    ferns: 170,
    gravel: 90,
    lycopsids: 12,
    riparianPlants: 80,
    shrubs: 0,
    treeFerns: 0,
  },
  palette: {
    fog: '#819c93',
    groundDark: '#34493d',
    groundLight: '#858f72',
    groundMid: '#586751',
    horizon: '#a1b8af',
    skyTop: '#6d969a',
    sun: '#f2e3ba',
    water: '#527a6e',
  },
  profile: 'carboniferous-coal-swamp',
  revision: 'carboniferous-coal-swamp-world-space-v11',
  scientificBasis: [
    'https://www.sciencedirect.com/science/article/pii/0031018294900043',
    'https://www.sciencedirect.com/science/article/pii/S0034666714001444',
    'https://repository.si.edu/bitstream/handle/10088/7146/paleo_2001_DiMichele_et_al_AREPS.pdf',
  ],
  seed: 0xca2b0,
  themeId: 'carboniferous-wetland-forest',
} as const satisfies ScaleEncounterPreparedLandBiome

export default CARBONIFEROUS_WETLAND_FOREST_BIOME
