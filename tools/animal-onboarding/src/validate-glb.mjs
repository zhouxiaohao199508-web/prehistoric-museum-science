import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import validator from 'gltf-validator'

function groupedIssues(messages) {
  return Object.fromEntries(
    [...new Set(messages.map((issue) => issue.code))]
      .sort()
      .map((code) => {
        const matches = messages.filter((issue) => issue.code === code)
        return [
          code,
          {
            count: matches.length,
            severity: matches[0]?.severity,
            example: matches[0]?.message,
            pointer: matches[0]?.pointer,
          },
        ]
      }),
  )
}

export async function validateGlbFile(input) {
  const inputPath = resolve(input)
  const report = await validator.validateBytes(await readFile(inputPath), {
    uri: inputPath,
    writeTimestamp: false,
    maxIssues: 0,
  })
  return {
    input: inputPath,
    validation: {
      errors: report.issues.numErrors,
      warnings: report.issues.numWarnings,
      infos: report.issues.numInfos,
      hints: report.issues.numHints,
      groupedIssues: groupedIssues(report.issues.messages),
    },
  }
}

async function main() {
  const [input] = process.argv.slice(2)
  if (!input) {
    console.error('Usage: node validate-glb.mjs <input.glb>')
    process.exitCode = 2
    return
  }
  const result = await validateGlbFile(input)
  console.log(JSON.stringify(result, null, 2))
  if (result.validation.errors > 0) process.exitCode = 1
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  await main()
}
