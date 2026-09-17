import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { afterAll, afterEach, describe, expect, it } from 'vitest'

import { loadOwnerApprovalRecord } from '../src/approval'
import {
  assertSecureRepositoryFile,
  assertSecureRepositoryOutputPath,
  canonicalApprovalBundleSha256,
} from '../src/approval-bundle'

function record(): Record<string, unknown> {
  const files = [
    {
      path: 'assets/candidates/test-animal/output/model.glb',
      bytes: 123,
      sha256: 'd'.repeat(64),
    },
  ]
  return {
    schemaVersion: 2,
    animalId: 'test-animal',
    decision: 'approved-for-production',
    approvedBy: 'Leon',
    approvedOn: '2026-08-31',
    recordedAt: '2026-08-31T00:00:00.000Z',
    basis: 'Explicit owner decision in the active task.',
    categories: {
      scientific: true,
      visual: true,
      motion: true,
      audioListening: true,
      audioListeningByLocale: { 'zh-CN': true, en: true },
      publicDistribution: true,
      production: true,
      mouthMotion: 'not-applicable',
    },
    qaAtDecision: {
      path: '.handoff/animal-onboarding-runs/test-animal/approval-qa.json',
      bytes: 42,
      sha256: 'a'.repeat(64),
      automatedPass: true,
      localDraftReady: true,
    },
    profileBeforeSha256: 'b'.repeat(64),
    approvedProfileSha256: 'c'.repeat(64),
    approvalBundle: {
      algorithm: 'sha256',
      sha256: canonicalApprovalBundleSha256(files),
      files,
    },
  }
}

async function temporaryDirectory(): Promise<string> {
  await mkdir(temporaryRoot, { recursive: true })
  const directory = await mkdtemp(join(temporaryRoot, 'animal-approval-'))
  temporaryDirectories.push(directory)
  return directory
}

async function writeRecord(value: unknown): Promise<string> {
  const directory = await temporaryDirectory()
  const path = join(directory, 'approval-record.json')
  await writeFile(path, JSON.stringify(value), 'utf8')
  return path
}

const temporaryDirectories: string[] = []
const temporaryRoot = resolve('tests/.tmp')

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  )
})

afterAll(async () => {
  await rm(temporaryRoot, { recursive: true, force: true })
})

describe('owner approval record parsing', () => {
  it('accepts the exact hash-bound decision shape', async () => {
    await expect(loadOwnerApprovalRecord(await writeRecord(record()))).resolves
      .toMatchObject({ animalId: 'test-animal', approvedBy: 'Leon' })
  })

  it('rejects extra fields and incomplete locale decisions', async () => {
    const extra = record()
    extra.forged = true
    await expect(loadOwnerApprovalRecord(await writeRecord(extra))).rejects
      .toThrow(/must contain exactly/)

    const missingLocale = record()
    const categories = missingLocale.categories as Record<string, unknown>
    categories.audioListeningByLocale = { 'zh-CN': true }
    await expect(
      loadOwnerApprovalRecord(await writeRecord(missingLocale)),
    ).rejects.toThrow(/must contain exactly/)
  })

  it('rejects a forged approval-bundle digest', async () => {
    const forged = record()
    ;(forged.approvalBundle as Record<string, unknown>).sha256 = 'e'.repeat(64)
    await expect(loadOwnerApprovalRecord(await writeRecord(forged))).rejects
      .toThrow(/not canonical/)
  })

  it('rejects linked approval inputs and exact output-file symlinks', async () => {
    const directory = await temporaryDirectory()
    const actual = join(directory, 'actual.json')
    const linkedInput = join(directory, 'linked-input.json')
    const linkedOutput = join(directory, 'linked-output.json')
    await writeFile(actual, '{}\n', 'utf8')
    await symlink(actual, linkedInput)
    await symlink(actual, linkedOutput)
    await expect(assertSecureRepositoryFile(linkedInput)).rejects.toThrow(
      /symbolic link/,
    )
    await expect(
      assertSecureRepositoryOutputPath(linkedOutput),
    ).rejects.toThrow(/symbolic link/)
  })
})
