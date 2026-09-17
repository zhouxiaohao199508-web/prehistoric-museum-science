import type { GateResult, QaReport } from './types'

function icon(gate: GateResult): string {
  if (gate.status === 'pass') return 'PASS'
  if (gate.status === 'not-applicable') return 'N/A'
  if (gate.status === 'pending') return 'PENDING'
  return 'FAIL'
}

export function reportMarkdown(report: QaReport): string {
  const sections = (
    [
      ['Automated gates', 'automated'],
      ['Warnings', 'warning'],
      ['Human-only gates', 'human-only'],
    ] as const
  )
    .map(([title, kind]) => {
      const rows = report.gates
        .filter((gate) => gate.kind === kind)
        .map(
          (gate) =>
            `| ${gate.id} | ${icon(gate)} | ${gate.summary.replaceAll('|', '\\|')} | ${(gate.evidence ?? []).map((path) => `\`${path}\``).join('<br>') || '—'} | ${gate.measured ? `\`${JSON.stringify(gate.measured)}\`` : '—'} |`,
        )
        .join('\n')
      return `## ${title}\n\n| Gate | Status | Summary | Evidence | Measurements |\n| --- | --- | --- | --- | --- |\n${rows || '| — | — | — | — | — |'}`
    })
    .join('\n\n')
  return `# ${report.animalId} onboarding QA

Generated: ${report.generatedAt}

- Automated pass: **${report.automatedPass ? 'yes' : 'no'}**
- Local review draft ready: **${report.localDraftReady ? 'yes' : 'no'}**
- Owner approved: **${report.ownerApproved ? 'yes' : 'no'}**
- Hard failures: ${report.counts.hardFailures}
- Warnings: ${report.counts.warnings}
- Pending human-only decisions: ${report.counts.pendingHumanOnly}

> Automated pass is engineering evidence only. It is not owner approval and
> does not authorize production promotion or publication.

${sections}

## Artifacts

${Object.entries(report.artifacts)
  .map(([name, path]) => `- ${name}: \`${path}\``)
  .join('\n')}
`
}

function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function reportHtml(report: QaReport): string {
  const groups = (['automated', 'warning', 'human-only'] as const)
    .map((kind) => {
      const rows = report.gates
        .filter((gate) => gate.kind === kind)
        .map(
          (gate) =>
            `<tr><td><code>${htmlEscape(gate.id)}</code></td><td class="${gate.status}">${icon(gate)}</td><td>${htmlEscape(gate.summary)}</td><td>${(gate.evidence ?? []).map((path) => `<code>${htmlEscape(path)}</code>`).join('<br>') || '—'}</td><td><code>${gate.measured ? htmlEscape(JSON.stringify(gate.measured)) : '—'}</code></td></tr>`,
        )
        .join('')
      return `<section><h2>${kind}</h2><table><thead><tr><th>Gate</th><th>Status</th><th>Summary</th><th>Evidence</th><th>Measurements</th></tr></thead><tbody>${rows}</tbody></table></section>`
    })
    .join('')
  const artifacts = Object.entries(report.artifacts)
    .map(
      ([name, path]) =>
        `<li><strong>${htmlEscape(name)}:</strong> <code>${htmlEscape(path)}</code></li>`,
    )
    .join('')
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${htmlEscape(report.animalId)} onboarding QA</title>
<style>
body{font:15px/1.55 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 24px;color:#17221d;background:#f6f4ec}
h1,h2{color:#173d2d} .summary{display:flex;gap:12px;flex-wrap:wrap}.pill{padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #d8d5ca}
table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:10px;text-align:left;border:1px solid #ddd}.pass{color:#176b3a}.fail{color:#a12820}.pending{color:#8c5c08}
code{font-size:13px} blockquote{border-left:4px solid #d39135;padding-left:14px;margin-left:0}
</style><body><h1>${htmlEscape(report.animalId)} onboarding QA</h1>
<div class="summary"><span class="pill">Automated: ${report.automatedPass ? 'PASS' : 'FAIL'}</span><span class="pill">Draft ready: ${report.localDraftReady ? 'YES' : 'NO'}</span><span class="pill">Owner approved: ${report.ownerApproved ? 'YES' : 'NO'}</span></div>
<blockquote>Automated pass is engineering evidence only. It is not owner approval or production authorization.</blockquote>
${groups}<section><h2>Artifacts</h2><ul>${artifacts}</ul></section></body></html>`
}
