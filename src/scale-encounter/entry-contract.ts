import type { DirectScaleEncounter } from './DirectScaleEncounter'
import type { preloadDirectScaleEncounterAssets } from './preload-assets'

export type DirectScaleEncounterLoader = () => Promise<{
  readonly DirectScaleEncounter: typeof DirectScaleEncounter
  readonly preloadDirectScaleEncounterAssets: typeof preloadDirectScaleEncounterAssets
}>
