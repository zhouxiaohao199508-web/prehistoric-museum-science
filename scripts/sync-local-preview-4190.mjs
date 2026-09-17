import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDirectory)
const optInMarker = join(
  projectRoot,
  '.handoff',
  'preview-4190',
  'enabled',
)

if (!existsSync(optInMarker)) {
  process.exit(0)
}

const sourceDist = join(projectRoot, 'dist')
const sourceServer = join(projectRoot, 'server.mjs')
const runtimeRoot = join(
  homedir(),
  'Library',
  'Caches',
  'LeonMadeThis',
  'prehistoric-animal-museum-preview-4190',
)
const liveDist = join(runtimeRoot, 'dist')
const nextDist = join(runtimeRoot, 'dist.next')
const previousDist = join(runtimeRoot, 'dist.previous')

if (!existsSync(sourceDist)) {
  throw new Error(`Preview source does not exist: ${sourceDist}`)
}

mkdirSync(runtimeRoot, { recursive: true })
rmSync(nextDist, { force: true, recursive: true })
rmSync(previousDist, { force: true, recursive: true })
cpSync(sourceDist, nextDist, { dereference: true, recursive: true })
copyFileSync(sourceServer, join(runtimeRoot, 'server.mjs'))

if (existsSync(liveDist)) {
  renameSync(liveDist, previousDist)
}

try {
  renameSync(nextDist, liveDist)
  rmSync(previousDist, { force: true, recursive: true })
} catch (error) {
  if (!existsSync(liveDist) && existsSync(previousDist)) {
    renameSync(previousDist, liveDist)
  }
  throw error
}

console.log(`Synced persistent 4190 preview to ${runtimeRoot}`)
