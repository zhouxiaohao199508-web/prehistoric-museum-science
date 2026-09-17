import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'

import { App } from './App'
import type { InitialAppState } from './app-bootstrap'

export function renderMuseumApp(initialState: InitialAppState): string {
  return renderToString(
    <StrictMode>
      <App initialState={initialState} />
    </StrictMode>,
  )
}
