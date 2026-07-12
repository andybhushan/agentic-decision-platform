# Agent instructions

## Hard rules (do not violate)

- **Never use the canvas.** Do not call `open_canvas` or `invoke_canvas_action`
  for any canvas type — including the **browser**, **terminal**, and **editor**
  canvases. Do not open, navigate, screenshot, read, click, type into, or run
  JavaScript in a browser canvas; do not open terminal or editor canvases.
- **Verification is the user's job in the browser.** Validate your changes with
  static checks only — e.g. `tsc --noEmit`, linters, and existing unit/integration
  tests. Report what you changed and let the user verify it in their own browser.
- If you think a visual/browser check is genuinely required, ask the user to do
  it and tell them exactly what to look at. Never do it yourself via a canvas.

## Project notes

- Monorepo: `frontend/` (Vite + React + Carbon) and `backend/` (Node + TS,
  `npm run dev` uses nodemon so `.ts` changes hot-reload).
- Typecheck before committing: `cd frontend; npx tsc --noEmit` and
  `cd backend; npx tsc --noEmit`.
- Commits include the trailer:
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
