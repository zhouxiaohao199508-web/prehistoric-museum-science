import {
  animalDetailIdFromPath,
  readInitialAppState,
} from '../src/app-bootstrap'

describe('application bootstrap', () => {
  it('reads the build-time state embedded in a localized museum document', () => {
    document.body.innerHTML = `
      <script id="museum-bootstrap" type="application/json">
        {"animalId":"stegosaurus","locale":"en","pageKind":"museum","preference":"en"}
      </script>
    `

    expect(readInitialAppState()).toEqual({
      animalId: 'stegosaurus',
      locale: 'en',
      pageKind: 'museum',
      preference: 'en',
    })
  })

  it('reads the animal-detail state embedded in a localized deep link', () => {
    document.body.innerHTML = `
      <script id="museum-bootstrap" type="application/json">
        {"animalId":"mosasaurus","locale":"zh-CN","pageKind":"animal-detail","preference":"zh-CN"}
      </script>
    `

    expect(readInitialAppState()).toEqual({
      animalId: 'mosasaurus',
      locale: 'zh-CN',
      pageKind: 'animal-detail',
      preference: 'zh-CN',
    })
  })

  it('extracts a valid animal id from a localized detail path', () => {
    expect(
      animalDetailIdFromPath(
        '/museum/en/animals/tyrannosaurus-rex/',
      ),
    ).toBe('tyrannosaurus-rex')
    expect(
      animalDetailIdFromPath('/museum/zh-CN/animals/mosasaurus/index.html'),
    ).toBe('mosasaurus')
    expect(animalDetailIdFromPath('/museum/en/')).toBeNull()
    expect(animalDetailIdFromPath('/museum/animals/mosasaurus/')).toBeNull()
  })
})
