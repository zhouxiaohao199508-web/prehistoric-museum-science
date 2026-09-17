import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  findForbiddenProductionMarkers,
} from '../scripts/production-boundary-markers'

const privateScaleEncounterMutations = [
  { expectedMarker: 'assets/candidates', injected: 'assets/candidates/file.glb' },
  {
    expectedMarker: '/__museum-review-assets',
    injected: '/__museum-review-assets/private.glb',
  },
  { expectedMarker: '.handoff/', injected: '.handoff/private-review' },
  { expectedMarker: '/private/tmp/', injected: '/private/tmp/source.glb' },
  { expectedMarker: 'meshy-scene-models-', injected: 'meshy-scene-models-run' },
  {
    expectedMarker: 'meshy-scene-multiview-',
    injected: 'meshy-scene-multiview-source',
  },
  { expectedMarker: 'source-polyhaven-', injected: 'source-polyhaven-scan.jpg' },
  {
    expectedMarker: 'source-blender-water-',
    injected: 'source-blender-water-master.png',
  },
  {
    expectedMarker: 'child-avatar-v3-',
    injected: 'child-avatar-v3-boy-land-normal.glb',
  },
  {
    expectedMarker: 'child-avatar-review-candidates',
    injected: 'child-avatar-review-candidates.glb',
  },
] as const

describe('production boundary private scale-encounter markers', () => {
  it.each(privateScaleEncounterMutations)(
    'detects $injected when a safe distribution fixture is mutated',
    async ({ expectedMarker, injected }) => {
      const fixtureRoot = await mkdtemp(
        join(tmpdir(), 'museum-production-boundary-'),
      )
      try {
        const assetDirectory = join(fixtureRoot, 'assets')
        const bundlePath = join(assetDirectory, 'app.js')
        await mkdir(assetDirectory)
        await writeFile(bundlePath, 'console.log("production-safe")')
        await expect(
          findForbiddenProductionMarkers(fixtureRoot),
        ).resolves.toEqual([])

        await writeFile(
          bundlePath,
          `console.log("production-safe", ${JSON.stringify(injected)})`,
        )
        const findings = await findForbiddenProductionMarkers(fixtureRoot)
        expect(findings).toContainEqual({
          distributionPath: 'assets/app.js',
          marker: expectedMarker,
        })
      } finally {
        await rm(fixtureRoot, { force: true, recursive: true })
      }
    },
  )
})
