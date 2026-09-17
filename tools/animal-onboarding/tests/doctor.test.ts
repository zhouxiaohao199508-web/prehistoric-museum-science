import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import {
  doctorExitCode,
  findRepositoryRoot,
  runDoctor,
} from '../src/doctor'

const execFileAsync = promisify(execFile)

async function write(path: string, contents = ''): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

async function healthyRepository(): Promise<{
  readonly root: string
  readonly nested: string
  readonly blender: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'animal-onboarding-doctor-'))
  await write(
    resolve(root, 'package.json'),
    JSON.stringify({
      name: 'prehistoric-animal-museum',
      engines: { node: '>=20.19.0' },
    }),
  )
  await write(
    resolve(root, '.gitignore'),
    'node_modules/\n.handoff/\nassets/candidates/\n',
  )
  await write(
    resolve(
      root,
      '.agents/skills/prehistoric-animal-onboarding/SKILL.md',
    ),
    '---\nname: prehistoric-animal-onboarding\ndescription: fixture\n---\n',
  )
  await write(resolve(root, 'tools/animal-onboarding/package.json'), '{}\n')
  await write(resolve(root, 'tools/animal-onboarding/src/cli.ts'), 'export {}\n')
  await write(
    resolve(root, 'tools/animal-onboarding/src/doctor.ts'),
    'export {}\n',
  )
  await write(
    resolve(root, 'tools/animal-onboarding/src/derive-assets.mjs'),
    'export const derive = true\n',
  )
  await write(
    resolve(root, 'tools/animal-onboarding/src/validate-glb.mjs'),
    'export const validate = true\n',
  )
  await write(
    resolve(root, 'tools/animal-onboarding/src/composition.ts'),
    'export const captureMode = "connected-headed-browser"\n',
  )
  await write(
    resolve(root, 'tools/animal-onboarding/blender/normalize_animal.py'),
    '# fixture\n',
  )
  await write(
    resolve(root, 'tools/animal-onboarding/audio/generate_narration.py'),
    '# fixture\n',
  )
  await write(
    resolve(root, 'node_modules/tsx/package.json'),
    JSON.stringify({
      name: 'tsx',
      version: '4.23.1',
      type: 'module',
      exports: {
        '.': './loader.mjs',
        './package.json': './package.json',
      },
    }),
  )
  await write(resolve(root, 'node_modules/tsx/loader.mjs'), 'export {}\n')
  const blender = resolve(root, 'fixture-bin/blender')
  await write(blender, '#!/bin/sh\nexit 0\n')
  await chmod(blender, 0o755)
  const nested = resolve(root, 'workspace/deep')
  await mkdir(nested, { recursive: true })

  await execFileAsync('git', ['init', '--quiet'], { cwd: root })
  await execFileAsync(
    'git',
    [
      'add',
      '.gitignore',
      'package.json',
      '.agents/skills/prehistoric-animal-onboarding/SKILL.md',
      'tools/animal-onboarding',
    ],
    { cwd: root },
  )
  return { root, nested, blender }
}

function check(
  report: Awaited<ReturnType<typeof runDoctor>>,
  id: string,
) {
  const result = report.checks.find((entry) => entry.id === id)
  expect(result, `missing doctor check ${id}`).toBeDefined()
  return result!
}

describe('animal onboarding doctor', () => {
  it('discovers a worktree root from an arbitrary nested directory', async () => {
    const fixture = await healthyRepository()
    await expect(findRepositoryRoot(fixture.nested)).resolves.toBe(fixture.root)
  })

  it('returns a structured ready report for a portable local setup', async () => {
    const fixture = await healthyRepository()
    const report = await runDoctor({
      cwd: fixture.nested,
      blenderExecutable: fixture.blender,
      now: () => new Date('2026-08-31T00:00:00.000Z'),
    })

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt: '2026-08-31T00:00:00.000Z',
      repositoryRoot: fixture.root,
      ready: true,
      exitCode: 0,
      counts: { fail: 0, warn: 0, pass: 9 },
    })
    expect(doctorExitCode(report)).toBe(0)
    expect(check(report, 'tracked-onboarding-tool').status).toBe('pass')
    expect(check(report, 'candidate-write-boundary')).toMatchObject({
      status: 'pass',
      measured: { contained: true, writable: true, gitIgnored: true },
    })
    expect(check(report, 'run-write-boundary').status).toBe('pass')
  })

  it('blocks untracked runtime source and prohibited headless capture', async () => {
    const fixture = await healthyRepository()
    await write(
      resolve(fixture.root, 'tools/animal-onboarding/src/untracked-stage.ts'),
      'export const stage = true\n',
    )
    await write(
      resolve(fixture.root, 'tools/animal-onboarding/src/composition.ts'),
      'browser = await chromium.launch({ headless: true })\n',
    )

    const report = await runDoctor({
      cwd: fixture.nested,
      blenderExecutable: fixture.blender,
    })

    expect(report.ready).toBe(false)
    expect(report.exitCode).toBe(4)
    expect(doctorExitCode(report)).toBe(4)
    expect(check(report, 'tracked-onboarding-tool')).toMatchObject({
      status: 'fail',
      measured: { unavailableFiles: 1 },
    })
    expect(check(report, 'headed-browser-policy')).toMatchObject({
      status: 'fail',
      measured: { violations: 1 },
    })
  })

  it('fails when a self-contained runtime dependency is missing', async () => {
    const fixture = await healthyRepository()
    await rm(
      resolve(
        fixture.root,
        'tools/animal-onboarding/src/validate-glb.mjs',
      ),
    )

    const report = await runDoctor({
      cwd: fixture.nested,
      blenderExecutable: fixture.blender,
    })

    expect(check(report, 'tracked-onboarding-tool')).toMatchObject({
      status: 'fail',
      measured: { unavailableFiles: 1 },
    })
    expect(report.ready).toBe(false)
    expect(report.exitCode).toBe(4)
  })

  it('rejects a candidate boundary symlink that escapes the worktree', async () => {
    const fixture = await healthyRepository()
    const outside = await mkdtemp(join(tmpdir(), 'animal-candidates-outside-'))
    await mkdir(resolve(fixture.root, 'assets'), { recursive: true })
    await symlink(outside, resolve(fixture.root, 'assets/candidates'))

    const report = await runDoctor({
      cwd: fixture.nested,
      blenderExecutable: fixture.blender,
    })
    expect(check(report, 'candidate-write-boundary')).toMatchObject({
      status: 'fail',
      measured: { contained: false },
    })
    expect(report.exitCode).toBe(4)
  })

  it('fails clearly when Blender cannot be executed', async () => {
    const fixture = await healthyRepository()
    const report = await runDoctor({
      cwd: fixture.nested,
      blenderExecutable: resolve(fixture.root, 'missing-blender'),
      platform: 'linux',
      env: { PATH: '' },
    })
    expect(check(report, 'blender-executable')).toMatchObject({
      status: 'fail',
    })
    expect(report.ready).toBe(false)
  })
})
