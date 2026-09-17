import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { loadAnimalDefinitions, repositoryRoot } from './content-data'
import { renderCreditsModule, renderThirdPartyNotices } from './credits'

const packages = await loadAnimalDefinitions()

await Promise.all([
  writeFile(
    join(repositoryRoot, 'src/content/credits.generated.ts'),
    renderCreditsModule(packages),
    'utf8',
  ),
  writeFile(
    join(repositoryRoot, 'THIRD_PARTY_NOTICES.md'),
    renderThirdPartyNotices(packages),
    'utf8',
  ),
])

console.log(
  `Generated credits for ${packages.filter(({ definition }) => definition.status === 'published').length} published animal package(s).`,
)
