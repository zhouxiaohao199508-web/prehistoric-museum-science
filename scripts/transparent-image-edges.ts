import sharp from 'sharp'

export const VISIBLE_ALPHA_THRESHOLD = 12

export interface VisibleAlphaEdgeContacts {
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly top: number
}

export async function visibleAlphaEdgeContacts(
  input: Uint8Array,
  threshold = VISIBLE_ALPHA_THRESHOLD,
): Promise<VisibleAlphaEdgeContacts> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const contacts = { bottom: 0, left: 0, right: 0, top: 0 }

  for (let x = 0; x < info.width; x += 1) {
    if (data[x * 4 + 3] > threshold) {
      contacts.top += 1
    }
    if (data[((info.height - 1) * info.width + x) * 4 + 3] > threshold) {
      contacts.bottom += 1
    }
  }
  for (let y = 0; y < info.height; y += 1) {
    if (data[y * info.width * 4 + 3] > threshold) {
      contacts.left += 1
    }
    if (data[(y * info.width + info.width - 1) * 4 + 3] > threshold) {
      contacts.right += 1
    }
  }

  return contacts
}

export function formatVisibleAlphaEdgeContacts(
  contacts: VisibleAlphaEdgeContacts,
): string | undefined {
  const entries = Object.entries(contacts).filter(([, count]) => count > 0)
  return entries.length === 0
    ? undefined
    : entries.map(([edge, count]) => `${edge}=${count}`).join(', ')
}
