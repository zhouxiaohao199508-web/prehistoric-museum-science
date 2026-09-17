export interface PrepareCloudflarePagesOptions {
  readonly sourceDirectory: string
  readonly outputDirectory: string
}

export function prepareCloudflarePages(
  options: PrepareCloudflarePagesOptions,
): Promise<void>
