import type { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

function reviewCandidateUrl(bundledUrl: URL): string {
  return bundledUrl.href
}

const sourceUrl = reviewCandidateUrl(
  new URL(
    './assets/environments/forest-props-real-v1.glb',
    import.meta.url,
  ),
)

let templatePromise: Promise<Group> | null = null

export function loadReviewCandidateForestProps(): Promise<Group> {
  templatePromise ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(sourceUrl)
    .then((gltf) => {
      gltf.scene.name = 'scale-encounter-real-forest-props-template'
      return gltf.scene
    })
    .catch((error: unknown) => {
      templatePromise = null
      throw error
    })
  return templatePromise
}
