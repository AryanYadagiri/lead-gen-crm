<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Custom Project Guardrails

## 1. Visual Appearance & UI Styling
- **Design System Enforcement:** Before building, modifying, or refactoring any Next.js frontend UI components, you **MUST read the styling specifications in the root `DESIGN.md` file**.
- **Utility Constraints:** Strictly implement the designated color palettes, Tailwind CSS utility scales, typography ramps, and corner radii specified there. Never invent or hallucinate custom styling values.
- **Verification:** Ensure that your generated JSX/TSX class names cleanly map back to the design tokens outlined in `DESIGN.md`.