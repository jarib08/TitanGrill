# AGENTS.md — Titan Grill

> Project-level guidance for AI agents working in the **Titan Grill** codebase.
> Consult this file before starting any task. It documents the stack, conventions, verification commands, and which installed skills to apply for each type of task.

---

## 1. Project Context

| Aspect | Value |
|--------|-------|
| Type | Vite + React 19 SPA (Single package, not a monorepo) |
| Language | JavaScript / JSX — **no TypeScript** |
| Build | Vite 7, production `vite build` |
| Package manager | npm (`npm ci` / `npm run`) |
| Port (dev) | 5173 |
| Backend | Supabase (auth, DB, storage) |
| Routing | React Router v7 (`react-router-dom@7`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), `tailwind-merge`, `clsx` |
| Animations | Framer Motion |
| QR code | `qrcode.react`, `html5-qrcode`, `react-qr-code` |
| Charts | Recharts |
| Icons | Lucide React |
| Error handling | `react-error-boundary` |
| Linting | ESLint flat config — covers `**/*.{js,jsx}` |
| Tests | **None** — no test runner configured |
| Typecheck | **None** — no TypeScript |

### Verification (standard)

```bash
npm run lint
npm run build
```

Both must pass before considering work complete.

### Environment variables

- `.env` is tracked in git; **do not modify or delete it.**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are browser-safe (prefixed `VITE_`).
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** and must never appear in client-side code.

### Database conventions

- Supabase LIVE schema uses Spanish table/column names — e.g. `clientes`, not `clients`.
- `supabase_schema.sql` is **legacy and superseded** — do not reference it for current schema.

---

## 2. Installed Skills & Usage Policy

AutoSkills installed 10 skills. Use this table to pick the right skill for each task:

| Skill | Source | Relevance | Usage |
|-------|--------|-----------|-------|
| `react-best-practices` | `vercel-labs/agent-skills` | **High** | React components, hooks, data fetching, bundle optimization, re-render optimization |
| `supabase-postgres-best-practices` | `supabase/agent-skills` | **High** | Supabase DB queries, RLS, schema design, performance |
| `tailwind-css-patterns` | `giuseppe-trisciuoglio/developer-kit` | **High** | Tailwind v4 styling, responsive design, dark mode |
| `vite` | `antfu/skills` | **High** | Vite config, build optimization, plugins |
| `accessibility` | `addyosmani/web-quality-skills` | **Conditional** | "improve accessibility", "a11y audit", WCAG compliance, keyboard nav |
| `seo` | `addyosmani/web-quality-skills` | **Conditional** | "improve SEO", meta tags, structured data (JSON-LD), sitemap |
| `composition-patterns` | `vercel-labs/agent-skills` | **Conditional** | Refactoring components with boolean prop proliferation, compound components, React 19 patterns |
| `frontend-design` | `anthropics/skills` | **Conditional** | Building distinctive UI, visual design, aesthetic direction |
| `nodejs-best-practices` | `sickn33/antigravity-awesome-skills` | **Low value** | No backend Node.js code in this project; client-side SPA only |
| `nodejs-backend-patterns` | `wshobson/agents` | **Remove** | Project has no Express/Fastify/NestJS server; completely irrelevant |

### Decision rationale

- **KEEP (always loaded for relevant work):** `react-best-practices`, `supabase-postgres-best-practices`, `tailwind-css-patterns`, `vite`.
- **CONDITIONAL (load when task matches):** `accessibility`, `seo`, `composition-patterns`, `frontend-design`.
- **LOW VALUE / candidates for removal:** `nodejs-best-practices`, `nodejs-backend-patterns` — the project is a pure client-side SPA with no server-side Node.js code. These skills add token overhead without providing applicable value.

### Task-to-skill mapping

| Task type | Skills to apply |
|-----------|-----------------|
| React component work | `react-best-practices` |
| Styling / Tailwind | `tailwind-css-patterns` |
| Supabase/DB queries | `supabase-postgres-best-practices` |
| Vite/build config | `vite` |
| Component refactoring (compound, variants) | `composition-patterns` |
| Accessibility audit / WCAG | `accessibility` |
| SEO / meta tags / structured data | `seo` |
| Visual design / new UI | `frontend-design` |

---

## 3. Project Conventions

### Code style

- JavaScript (`.js` / `.jsx`), no TypeScript.
- Components in `src/components/`, hooks in `src/hooks/`, utilities in `src/lib/` and `src/utils/`.
- Use `clsx` + `tailwind-merge` for conditional class composition.
- Tailwind v4 uses `@import "tailwindcss"` in `src/index.css`.

### Supabase usage

- Browser-safe client: `src/lib/supabaseClient.js` — uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Always use the `clientes` table name (Spanish), not `clients`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in any client-side code.

### Build

- Vite config at `vite.config.js` with manual chunk splitting for vendor bundles.
- Production build: `vite build`.
- No sourcemaps in production.

### Git conventions

- `package-lock.json` is tracked; use `npm ci` for installs, not `npm install`.
- Do not commit generated files in `dist/` or `.env` changes.

---

## 4. Common Commands

```bash
npm run dev      # Start dev server on port 5173
npm run build    # Production build
npm run lint     # ESLint flat config
npm run preview  # Preview production build
```

---

## 5. Constraints

- No tests exist; verification is `npm run lint` + `npm run build`.
- No TypeScript; do not introduce `.ts`/`.tsx` files.
- `.env` is tracked — do not modify.
- `supabase_schema.sql` is legacy — reference the live Supabase schema instead.
