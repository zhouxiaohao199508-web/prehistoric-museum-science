import { NodeIO, type Accessor } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

type ConnectedComponent = readonly number[]

function connectedComponents(
  vertexCount: number,
  indices: NonNullable<ReturnType<Accessor['getArray']>>,
): ConnectedComponent[] {
  const parents = Array.from({ length: vertexCount }, (_, index) => index)

  const find = (initialIndex: number): number => {
    let index = initialIndex
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!
      index = parents[index]!
    }
    return index
  }
  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
  }

  for (let offset = 0; offset < indices.length; offset += 3) {
    const left = Number(indices[offset])
    const middle = Number(indices[offset + 1])
    const right = Number(indices[offset + 2])
    union(left, middle)
    union(middle, right)
    union(right, left)
  }

  const components = new Map<number, number[]>()
  for (let index = 0; index < vertexCount; index += 1) {
    const root = find(index)
    const vertices = components.get(root) ?? []
    vertices.push(index)
    components.set(root, vertices)
  }
  return [...components.values()].sort(
    (left, right) => right.length - left.length,
  )
}

describe('Tyrannosaurus skinning', () => {
  it('keeps the lower jaw and both hip seams attached while the feet stay planted', async () => {
    await MeshoptDecoder.ready
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const document = await io.read(
      'src/content/animals/tyrannosaurus-rex/model/model.glb',
    )
    const root = document.getRoot()
    const bodyMesh = root
      .listMeshes()
      .find((mesh) => mesh.getName().includes('Body'))
    expect(bodyMesh).toBeDefined()
    const primitive = bodyMesh!.listPrimitives()[0]!
    const positions = primitive.getAttribute('POSITION')!
    const normals = primitive.getAttribute('NORMAL')!
    const joints = primitive.getAttribute('JOINTS_0')!
    const weights = primitive.getAttribute('WEIGHTS_0')!
    const indices = primitive.getIndices()!.getArray()!
    const skin = root
      .listNodes()
      .find((node) => node.getMesh() === bodyMesh)
      ?.getSkin()
    expect(skin).toBeDefined()
    const jointNames = skin!.listJoints().map((joint) => joint.getName())

    const influence = (vertexIndex: number, jointName: string): number => {
      const vertexJoints = joints.getElement(vertexIndex, [] as number[])
      const vertexWeights = weights.getElement(vertexIndex, [] as number[])
      let total = 0
      for (let slot = 0; slot < vertexJoints.length; slot += 1) {
        if (jointNames[vertexJoints[slot]!] === jointName) {
          total += vertexWeights[slot]!
        }
      }
      return total
    }
    const influencedVertices = (
      component: ConnectedComponent,
      jointName: string,
    ) =>
      component.filter((vertexIndex) => influence(vertexIndex, jointName) > 1e-5)

    const components = connectedComponents(positions.getCount(), indices)
    const integratedBody = components[0]!
    expect(integratedBody.length).toBeGreaterThan(6_000)
    expect(influencedVertices(integratedBody, 'jaw').length).toBeGreaterThan(
      600,
    )

    const sharedMouthLining = components.find(
      (component) =>
        component.length >= 500 &&
        component.length <= 600 &&
        influencedVertices(component, 'head').length > 300 &&
        influencedVertices(component, 'jaw').length > 150,
    )
    expect(sharedMouthLining).toBeDefined()

    const lowerMouthFloor = [
      ...integratedBody,
      ...sharedMouthLining!,
    ].filter((vertexIndex) => {
      // Meshopt stores positions in its normalized quantization volume. This
      // band maps to the upward-facing lower mouth floor in Blender space.
      const position = positions.getElement(vertexIndex, [] as number[])
      const normal = normals.getElement(vertexIndex, [] as number[])
      return (
        position[1]! >= 0.137 &&
        position[1]! <= 0.153 &&
        position[2]! >= 0.824 &&
        position[2]! <= 0.873 &&
        normal[1]! >= 0.02
      )
    })
    expect(lowerMouthFloor.length).toBeGreaterThanOrEqual(45)
    for (const vertexIndex of lowerMouthFloor) {
      expect(influence(vertexIndex, 'jaw')).toBeGreaterThan(0.99)
    }

    const tongueSideLining = sharedMouthLining!.filter((vertexIndex) => {
      // This narrower strip is the shared lining directly beside the tongue;
      // partial head weights here reproduce the visible mouth separation.
      const position = positions.getElement(vertexIndex, [] as number[])
      const normal = normals.getElement(vertexIndex, [] as number[])
      return (
        position[1]! >= 0.1544 &&
        position[1]! <= 0.1565 &&
        position[2]! >= 0.8325 &&
        position[2]! <= 0.8505 &&
        normal[1]! >= 0.12
      )
    })
    expect(tongueSideLining.length).toBeGreaterThanOrEqual(6)
    for (const vertexIndex of tongueSideLining) {
      expect(influence(vertexIndex, 'jaw')).toBeGreaterThan(0.99)
    }

    const bodyVerticesByPosition = new Map<string, number[]>()
    for (const vertexIndex of integratedBody) {
      const key = positions
        .getElement(vertexIndex, [] as number[])
        .join(',')
      const matches = bodyVerticesByPosition.get(key) ?? []
      matches.push(vertexIndex)
      bodyVerticesByPosition.set(key, matches)
    }

    for (const legName of ['leg_left', 'leg_right'] as const) {
      const upperLeg = components.find(
        (component) =>
          component.length >= 1_100 &&
          component.length <= 1_300 &&
          influencedVertices(component, legName).length > 1_100,
      )
      expect(upperLeg).toBeDefined()
      expect(influencedVertices(upperLeg!, 'spine').length).toBeGreaterThan(
        270,
      )

      const seamPairs: Array<readonly [number, number]> = []
      for (const legVertex of upperLeg!) {
        const key = positions
          .getElement(legVertex, [] as number[])
          .join(',')
        for (const bodyVertex of bodyVerticesByPosition.get(key) ?? []) {
          seamPairs.push([legVertex, bodyVertex])
        }
      }
      expect(seamPairs).toHaveLength(33)
      for (const [legVertex, bodyVertex] of seamPairs) {
        expect(influence(legVertex, 'spine')).toBeCloseTo(
          influence(bodyVertex, 'spine'),
          5,
        )
        expect(influence(legVertex, legName)).toBeLessThan(1e-5)
      }

      const plantedFoot = components.find(
        (component) =>
          component.length >= 800 &&
          component.length <= 900 &&
          influencedVertices(component, legName).length > 800,
      )
      expect(plantedFoot).toBeDefined()
      expect(influencedVertices(plantedFoot!, 'spine')).toHaveLength(0)
    }
  })
})
