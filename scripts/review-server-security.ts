export const privateLocalMaterialDeny = [
  '.env',
  '.env.*',
  '*.{crt,pem,key,p12,pfx,cer,der}',
  '.npmrc',
  '.yarnrc.yml',
  '**/.git/**',
  '**/.handoff/**',
  '**/.wayfinder/**',
  '**/assets/candidates/**',
  '**/docs/handoff/**',
  '**/docs/research/**',
  '**/docs/specification/**',
  '**/prototypes/**',
  '**/spikes/**',
  '**/tools/**',
] as const

export function privateLocalMaterialDenyForRoot(
  projectRoot: string,
): readonly string[] {
  const normalizedRoot = projectRoot.replaceAll('\\', '/')
  if (!normalizedRoot.includes('/.wayfinder/worktrees/')) {
    return privateLocalMaterialDeny
  }

  // Vite applies deny globs to absolute paths before checking fs.allow. A
  // Wayfinder worktree therefore matches **/.wayfinder/** for every source
  // file, including index.html. The project root is already the fs boundary;
  // retain every nested private-material deny while removing only the parent
  // path pattern that would otherwise make the review server unusable.
  return privateLocalMaterialDeny.filter(
    (pattern) => pattern !== '**/.wayfinder/**',
  )
}

export function parseAllowedHosts(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
    ),
  ]
}

const privateLocalMaterialRouteRoots = [
  '.git',
  '.handoff',
  '.wayfinder',
  'assets/candidates',
  'docs/handoff',
  'docs/research',
  'docs/specification',
  'prototypes',
  'spikes',
  'tools',
] as const

function normalizedRequestPathname(requestUrl: string): string | undefined {
  try {
    return decodeURIComponent(
      new URL(requestUrl, 'http://localhost').pathname,
    )
      .replaceAll('\\', '/')
      .replace(/\/+/g, '/')
  } catch {
    return undefined
  }
}

export function isPrivateLocalMaterialRequest(requestUrl: string): boolean {
  const pathname = normalizedRequestPathname(requestUrl)
  if (!pathname) {
    return false
  }

  return privateLocalMaterialRouteRoots.some((root) => {
    const routeRoot = `/${root}`
    return pathname === routeRoot || pathname.startsWith(`${routeRoot}/`)
  })
}

export function assertReviewModeIsServeOnly(
  command: 'build' | 'serve',
  mode: string,
): void {
  if (command === 'build' && mode === 'review') {
    throw new Error(
      'Local review mode is serve-only and cannot produce a deployable bundle.',
    )
  }
}

export function unprefixedRouteMarker(routePrefix: string): string {
  return routePrefix.replace(/^\/+/, '')
}
