export interface GlbValidationReport {
  readonly input: string
  readonly validation: {
    readonly errors: number
    readonly warnings: number
    readonly infos: number
    readonly hints: number
    readonly groupedIssues: Readonly<
      Record<
        string,
        {
          readonly count: number
          readonly severity?: number
          readonly example?: string
          readonly pointer?: string
        }
      >
    >
  }
}

export function validateGlbFile(input: string): Promise<GlbValidationReport>
