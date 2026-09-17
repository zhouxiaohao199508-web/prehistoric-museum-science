export const GITHUB_REPOSITORY_URL =
  'https://github.com/s010s/prehistoric-animal-museum'
export const GITHUB_LICENSING_URL = `${GITHUB_REPOSITORY_URL}/blob/main/LICENSING.md`

export const GITHUB_STAR_PROMPT_STORAGE_KEY =
  'prehistoric-animal-museum:github-star-prompt:v1'
export const GITHUB_STAR_PROMPT_DELAY_MS = 60_000
export const GITHUB_STAR_PROMPT_VISIBLE_MS = 15_000
export const GITHUB_STAR_PROMPT_DISMISS_MS = 30 * 24 * 60 * 60 * 1_000

const DISMISSED_PREFIX = 'dismissed-until:'
const OPENED_VALUE = 'opened'

export function shouldSuppressGitHubStarPrompt(
  storage: Pick<Storage, 'getItem'>,
  now = Date.now(),
): boolean {
  const value = storage.getItem(GITHUB_STAR_PROMPT_STORAGE_KEY)
  if (value === OPENED_VALUE) {
    return true
  }
  if (!value?.startsWith(DISMISSED_PREFIX)) {
    return false
  }
  const dismissedUntil = Number(value.slice(DISMISSED_PREFIX.length))
  return Number.isFinite(dismissedUntil) && dismissedUntil > now
}

export function recordGitHubStarPromptOpened(
  storage: Pick<Storage, 'setItem'>,
): void {
  storage.setItem(GITHUB_STAR_PROMPT_STORAGE_KEY, OPENED_VALUE)
}

export function recordGitHubStarPromptDismissed(
  storage: Pick<Storage, 'setItem'>,
  now = Date.now(),
): void {
  storage.setItem(
    GITHUB_STAR_PROMPT_STORAGE_KEY,
    `${DISMISSED_PREFIX}${now + GITHUB_STAR_PROMPT_DISMISS_MS}`,
  )
}
