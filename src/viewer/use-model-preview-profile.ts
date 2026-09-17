import { useEffect, useState } from 'react'

import {
  modelPreviewProfiles,
  selectModelPreviewProfile,
  type ModelPreviewProfile,
} from './model-preview-profiles'

function currentProfile(): ModelPreviewProfile {
  return selectModelPreviewProfile((media) => window.matchMedia(media).matches)
}

const hydrationProfile = modelPreviewProfiles[modelPreviewProfiles.length - 1]!

export function useModelPreviewProfile(): ModelPreviewProfile {
  const [profile, setProfile] = useState<ModelPreviewProfile>(hydrationProfile)

  useEffect(() => {
    const queries = modelPreviewProfiles.map(({ media }) =>
      window.matchMedia(media),
    )
    const update = () => {
      setProfile(currentProfile())
    }
    for (const query of queries) {
      query.addEventListener('change', update)
    }
    update()
    return () => {
      for (const query of queries) {
        query.removeEventListener('change', update)
      }
    }
  }, [])

  return profile
}
