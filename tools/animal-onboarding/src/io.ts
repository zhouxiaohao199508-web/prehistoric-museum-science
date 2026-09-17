import { createHash } from 'node:crypto'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export function absolutePath(path: string): string {
  return resolve(path)
}

export async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  )
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function fileDigest(path: string): Promise<{
  readonly bytes: number
  readonly sha256: string
}> {
  const buffer = await readFile(path)
  return { bytes: buffer.length, sha256: sha256(buffer) }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, value, 'utf8')
}

export async function regularFile(path: string): Promise<boolean> {
  return stat(path).then(
    (entry) => entry.isFile() && entry.size > 0,
    () => false,
  )
}
