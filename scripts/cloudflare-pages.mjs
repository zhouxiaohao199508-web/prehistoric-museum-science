import {
  cp,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'

const hostRootSeoFiles = ['robots.txt', 'sitemap.xml']
const cloudflareMuseumPath = '/museum/'

function rewriteNotFoundReturnPath(source) {
  const returnLink = /(<a data-museum-return href=")[^"]*(">)/
  if (!returnLink.test(source)) {
    throw new Error('404.html is missing its data-museum-return recovery link.')
  }
  return source.replace(returnLink, `$1${cloudflareMuseumPath}$2`)
}

const rootIndex = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0; url=/museum/" />
    <meta name="robots" content="noindex, follow" />
    <link rel="canonical" href="https://leon-made-this.work/museum/" />
    <title>Opening the Prehistoric Animal Museum</title>
  </head>
  <body>
    <p><a href="/museum/">Open the Prehistoric Animal Museum · 打开史前动物博物馆</a></p>
  </body>
</html>
`

const baseRedirects = `/museum/index.html /museum/ 301
/museum/zh-CN /museum/zh-CN/ 301
/museum/zh-CN/index.html /museum/zh-CN/ 301
/museum/en /museum/en/ 301
/museum/en/index.html /museum/en/ 301
/ /museum/ 301
`

const functionRoutes = `${JSON.stringify(
  {
    version: 1,
    include: ['/museum', '/museum/'],
    exclude: [],
  },
  null,
  2,
)}\n`

const baseHeaders = `/museum/assets/*
  Cache-Control: public, max-age=31536000, immutable

/museum/animals/*
  Cache-Control: public, max-age=0, must-revalidate

/museum/
  Cache-Control: public, max-age=0, must-revalidate

/museum/index.html
  Cache-Control: public, max-age=0, must-revalidate

/museum/zh-CN/
  Cache-Control: public, max-age=0, must-revalidate

/museum/zh-CN/index.html
  Cache-Control: public, max-age=0, must-revalidate

/museum/en/
  Cache-Control: public, max-age=0, must-revalidate

/museum/en/index.html
  Cache-Control: public, max-age=0, must-revalidate

/museum/zh-CN/animals/*
  Cache-Control: public, max-age=0, must-revalidate

/museum/en/animals/*
  Cache-Control: public, max-age=0, must-revalidate

/museum/social/*
  Cache-Control: public, max-age=0, must-revalidate

/museum/404.html
  Cache-Control: public, max-age=0, must-revalidate

/robots.txt
  Cache-Control: public, max-age=0, must-revalidate

/sitemap.xml
  Cache-Control: public, max-age=0, must-revalidate

/404.html
  Cache-Control: public, max-age=0, must-revalidate

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`

async function discoverAnimalDetailRoutes(sourceDirectory) {
  const routes = []
  for (const locale of ['zh-CN', 'en']) {
    const animalsDirectory = join(sourceDirectory, locale, 'animals')
    let entries
    try {
      entries = await readdir(animalsDirectory, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue
      }
      throw error
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      try {
        await readFile(join(animalsDirectory, entry.name, 'index.html'))
      } catch (error) {
        if (error?.code === 'ENOENT') {
          continue
        }
        throw error
      }
      routes.push(`/museum/${locale}/animals/${entry.name}`)
    }
  }
  return routes.sort()
}

function renderRedirects(animalDetailRoutes) {
  const animalRedirects = animalDetailRoutes
    .map(
      (route) =>
        `${route} ${route}/ 301\n${route}/index.html ${route}/ 301`,
    )
    .join('\n')
  return `${baseRedirects}${animalRedirects ? `${animalRedirects}\n` : ''}`
}

export async function prepareCloudflarePages({
  sourceDirectory,
  outputDirectory,
}) {
  const museumDirectory = join(outputDirectory, 'museum')

  await rm(outputDirectory, { force: true, recursive: true })
  await mkdir(museumDirectory, { recursive: true })
  await cp(sourceDirectory, museumDirectory, { recursive: true })
  const cloudflareNotFound = rewriteNotFoundReturnPath(
    await readFile(join(sourceDirectory, '404.html'), 'utf8'),
  )
  const animalDetailRoutes = await discoverAnimalDetailRoutes(sourceDirectory)

  await Promise.all(
    hostRootSeoFiles.map((fileName) =>
      copyFile(join(sourceDirectory, fileName), join(outputDirectory, fileName)),
    ),
  )

  await Promise.all([
    writeFile(join(outputDirectory, 'index.html'), rootIndex),
    writeFile(join(outputDirectory, '404.html'), cloudflareNotFound),
    writeFile(join(museumDirectory, '404.html'), cloudflareNotFound),
    writeFile(
      join(outputDirectory, '_redirects'),
      renderRedirects(animalDetailRoutes),
    ),
    writeFile(
      join(outputDirectory, '_headers'),
      baseHeaders,
    ),
    writeFile(join(outputDirectory, '_routes.json'), functionRoutes),
  ])
}
