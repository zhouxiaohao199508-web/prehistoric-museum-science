import { ModelCache } from '../../src/viewer/model-cache'

describe('ModelCache', () => {
  it('evicts the least recently used model when its entry limit is exceeded', () => {
    const cache = new ModelCache({ maxEntries: 2 })
    const stegosaurus = new ArrayBuffer(4)
    const triceratops = new ArrayBuffer(5)
    const mammoth = new ArrayBuffer(6)

    cache.set('/stegosaurus.glb', stegosaurus)
    cache.set('/triceratops.glb', triceratops)
    expect(cache.get('/stegosaurus.glb')).toBe(stegosaurus)

    cache.set('/mammoth.glb', mammoth)

    expect(cache.get('/triceratops.glb')).toBeNull()
    expect(cache.get('/stegosaurus.glb')).toBe(stegosaurus)
    expect(cache.get('/mammoth.glb')).toBe(mammoth)
  })

  it('evicts least recently used models until its byte budget is respected', () => {
    const cache = new ModelCache({ maxBytes: 10, maxEntries: 3 })
    const stegosaurus = new ArrayBuffer(4)
    const triceratops = new ArrayBuffer(5)
    const mammoth = new ArrayBuffer(6)

    cache.set('/stegosaurus.glb', stegosaurus)
    cache.set('/triceratops.glb', triceratops)
    expect(cache.get('/stegosaurus.glb')).toBe(stegosaurus)

    cache.set('/mammoth.glb', mammoth)

    expect(cache.get('/triceratops.glb')).toBeNull()
    expect(cache.get('/stegosaurus.glb')).toBe(stegosaurus)
    expect(cache.get('/mammoth.glb')).toBe(mammoth)
  })
})
