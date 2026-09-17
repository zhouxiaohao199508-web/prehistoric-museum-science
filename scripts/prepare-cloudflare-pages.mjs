import { fileURLToPath } from 'node:url'

import { prepareCloudflarePages } from './cloudflare-pages.mjs'

await prepareCloudflarePages({
  sourceDirectory: fileURLToPath(new URL('../dist/', import.meta.url)),
  outputDirectory: fileURLToPath(
    new URL('../cloudflare-dist/', import.meta.url),
  ),
})

console.log('Prepared Cloudflare Pages bundle in cloudflare-dist/.')
