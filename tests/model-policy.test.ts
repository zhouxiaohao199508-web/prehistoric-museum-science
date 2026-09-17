import {
  ANIMAL_PACKAGE_HARD_CEILING_BYTES,
  ANIMAL_PACKAGE_TARGET_BYTES,
  LARGE_MODEL_NOTICE_THRESHOLD_BYTES,
  MEBIBYTE_BYTES,
  MODEL_GLB_HARD_CEILING_BYTES,
  MODEL_GLB_TARGET_BYTES,
  NARROW_TOUCH_MEDIA_QUERY,
  formatModelSize,
  isLargeModel,
} from '../src/model-policy'

describe('model delivery policy', () => {
  it('uses a 12/20 MiB production budget and a 6 MiB notice threshold', () => {
    expect(MODEL_GLB_TARGET_BYTES).toBe(12 * MEBIBYTE_BYTES)
    expect(MODEL_GLB_HARD_CEILING_BYTES).toBe(20 * MEBIBYTE_BYTES)
    expect(ANIMAL_PACKAGE_TARGET_BYTES).toBe(14 * MEBIBYTE_BYTES)
    expect(ANIMAL_PACKAGE_HARD_CEILING_BYTES).toBe(23 * MEBIBYTE_BYTES)
    expect(LARGE_MODEL_NOTICE_THRESHOLD_BYTES).toBe(6 * MEBIBYTE_BYTES)
    expect(NARROW_TOUCH_MEDIA_QUERY).toContain('(max-width: 1023px)')
    expect(NARROW_TOUCH_MEDIA_QUERY).toContain('(pointer: coarse)')
  })

  it('only classifies models strictly above the notice threshold as large', () => {
    expect(isLargeModel(6 * MEBIBYTE_BYTES)).toBe(false)
    expect(isLargeModel(6 * MEBIBYTE_BYTES + 1)).toBe(true)
  })

  it('formats an approximate encoded transfer size without false precision', () => {
    expect(formatModelSize(8_310_424)).toBe('7.9 MiB')
    expect(formatModelSize(12.4 * MEBIBYTE_BYTES)).toBe('12 MiB')
  })
})
