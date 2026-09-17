import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

export const scaleEncounterPrivateReviewMarkers = [
  'assets/candidates',
  '/__museum-review-assets',
  '.handoff/',
  '/private/tmp/',
  'meshy-scene-models-',
  'meshy-scene-multiview-',
  'source-polyhaven-',
  'source-blender-water-',
  'child-avatar-v3-',
  'child-avatar-review-candidates',
] as const

export interface ForbiddenProductionMarkerFinding {
  readonly distributionPath: string
  readonly marker: string
}

export async function collectProductionFiles(
  directory: string,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectProductionFiles(absolutePath)))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

export async function findForbiddenProductionMarkers(
  distributionRoot: string,
  markers: readonly string[] = scaleEncounterPrivateReviewMarkers,
  files?: readonly string[],
): Promise<ForbiddenProductionMarkerFinding[]> {
  const distributionFiles = files ?? (await collectProductionFiles(distributionRoot))
  const findings: ForbiddenProductionMarkerFinding[] = []

  for (const absolutePath of distributionFiles) {
    const source = await readFile(absolutePath)
    const distributionPath = relative(distributionRoot, absolutePath)
    for (const marker of markers) {
      if (
        distributionPath.includes(marker) ||
        source.includes(Buffer.from(marker))
      ) {
        findings.push({ distributionPath, marker })
      }
    }
  }

  return findings
}
