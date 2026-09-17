import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { loadAnimalDefinitions, repositoryRoot } from './content-data'
import { renderCreditsModule, renderThirdPartyNotices } from './credits'
import {
  validateContent,
  type ValidationIssue,
} from './content-validation'

const packages = await loadAnimalDefinitions()
const issues = await validateContent(packages)

const generatedArtifacts = [
  {
    path: 'src/content/credits.generated.ts',
    expected: renderCreditsModule(packages),
  },
  {
    path: 'THIRD_PARTY_NOTICES.md',
    expected: renderThirdPartyNotices(packages),
  },
]

for (const artifact of generatedArtifacts) {
  let actual: string | undefined
  try {
    actual = await readFile(join(repositoryRoot, artifact.path), 'utf8')
  } catch {
    actual = undefined
  }
  if (actual !== artifact.expected) {
    issues.push({
      severity: 'error',
      code: 'GENERATED_CREDITS_STALE',
      path: artifact.path,
      message: `${artifact.path} 缺失或已过期；请运行 npm run generate:credits。`,
    })
  }
}

const errorCount = issues.filter(({ severity }) => severity === 'error').length
const warningCount = issues.filter(
  ({ severity }) => severity === 'warning',
).length
const manualGateCount = issues.filter(
  ({ severity }) => severity === 'manual-gate',
).length

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        valid: errorCount === 0,
        packages: packages.map(({ definition }) => ({
          id: definition.id,
          status: definition.status,
        })),
        issues,
      },
      null,
      2,
    ),
  )
} else {
  const marker: Record<ValidationIssue['severity'], string> = {
    error: 'ERROR',
    warning: 'WARN',
    'manual-gate': 'GATE',
  }
  for (const item of issues) {
    const location = [item.animalId, item.path].filter(Boolean).join('/')
    console.log(
      `[${marker[item.severity]}] ${item.code}${location ? ` (${location})` : ''}: ${item.message}`,
    )
  }
  console.log(
    `Content validation: ${packages.length} package(s), ${errorCount} error(s), ${warningCount} warning(s), ${manualGateCount} manual gate(s).`,
  )
}

if (errorCount > 0) {
  process.exitCode = 1
}
