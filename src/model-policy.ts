export const MEBIBYTE_BYTES = 1024 * 1024

export const MODEL_GLB_TARGET_BYTES = 12 * MEBIBYTE_BYTES
export const MODEL_GLB_HARD_CEILING_BYTES = 20 * MEBIBYTE_BYTES
export const ANIMAL_PACKAGE_TARGET_BYTES = 14 * MEBIBYTE_BYTES
export const ANIMAL_PACKAGE_HARD_CEILING_BYTES = 23 * MEBIBYTE_BYTES

/**
 * Models strictly above 6 MiB get a quiet heads-up when a real network
 * transfer starts. This is only a loading notice: publication remains
 * governed by the larger hard ceiling and the unchanged complexity and
 * real-device gates.
 */
export const LARGE_MODEL_NOTICE_THRESHOLD_BYTES = 6 * MEBIBYTE_BYTES
export const NARROW_TOUCH_MEDIA_QUERY =
  '(max-width: 1023px) and (pointer: coarse)'
export const MODEL_DATA_REMINDER_STORAGE_KEY =
  'prehistoric-animal-museum:model-data-reminder:v1'

export function isLargeModel(modelBytes: number): boolean {
  return modelBytes > LARGE_MODEL_NOTICE_THRESHOLD_BYTES
}

export function formatModelSize(modelBytes: number): string {
  const mebibytes = modelBytes / MEBIBYTE_BYTES
  return `${mebibytes.toFixed(mebibytes >= 10 ? 0 : 1)} MiB`
}
