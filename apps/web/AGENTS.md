<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Coding Rules & Architecture Guidelines

You are an expert in TypeScript, React, Next.js (App Router), Tailwind CSS, PWA UX, and TanStack Query (React Query). Prefer patterns that remain compatible with future React Native apps.

---

## Architecture

- **Monorepo layout**: Apps live under a dedicated directory (e.g. `apps/<app-name>`). Shared non-UI code belongs in a common package (e.g. `packages/common`); shared UI primitives and design-system components live in a UI package (e.g. `packages/ui`). App-specific UI wrappers stay inside the app (only when tied to auth, routes, or product-specific copy).
- Default to **Server Components** in Next.js App Router; add `"use client"` only when needed for interactivity or browser APIs.
- Prefer **server-first data fetching** (Server Components / Route Handlers) and pass data down to client components.
- Treat state in two categories:
  1. **Server state** (remote data): TanStack Query
  2. **UI state** (local component interaction): `useState` / `useReducer`
  - Use Zustand only for truly shared client state (cross-route / cross-feature), not as a dumping ground.
- Keep shared business logic, types, validators, and API clients in `packages/common/` to enable reuse across apps (and later React Native).

---

## Code Style and Structure

- Write all new code in **TypeScript** with explicit typing for public APIs, hooks, and exported helpers.
- Enforce strict typing: avoid `any` or `@ts-ignore`. Differentiate between `import` and `import type`.
- Prefer **functional patterns**; avoid classes in frontend code.
- Avoid data fetching in `useEffect` when TanStack Query or Server Components can handle it.
- Avoid prop drilling by lifting state appropriately or using TanStack Query / Zustand where justified.
- Use **named exports**; avoid default exports for components, hooks, and utilities.
- Prefer **feature-first organization** within each app:
  ```
  app/<feature>/(page|layout|components|hooks|lib)
  ```
- Keep `packages/common/` free of app-specific UI and React view components. Shared presentation components go in `packages/ui`; app-only UI stays in the app.

---

## Code Quality and Error Handling

- Wrap features and major components in explicit **React Error Boundaries**. Always prevent blank screens on crashes.
- Strictly type APIs and form data (e.g. use Zod or similar schema validation to enforce strict boundaries in data flow).
- Do **not** silently swallow API errors; map them cleanly to UI states or toasts.

---

## Next.js / App Router Conventions

- **Route Handlers** (`app/api/**/route.ts`) are the preferred server boundary for HTTP APIs in the web app.
- Use `loading.tsx` and `error.tsx` for user-friendly loading and error states; never allow blank screens.
- Use `next/image` and `next/font` where appropriate; avoid layout shift (CLS) by reserving space for media.
- Prefer React Server Components for data-heavy pages; avoid turning entire pages into client components.

---

## TanStack Query Conventions

- Use **stable query keys** (tuple form) and keep them close to the data domain.
- Centralize API client and query functions in `packages/common/lib` (or `packages/common/hooks` for hooks).
- Use **optimistic updates** for high-frequency interactions where rollback is safe.
- Do not store derived server state in local component state; derive from query data.

---

## State Rules (UI vs Global)

| Type      | Tool                      | When to use                                                          |
| --------- | ------------------------- | -------------------------------------------------------------------- |
| Local UI  | `useState` / `useReducer` | Modals, toggles, stepper state, form input, ephemeral flags          |
| Global UI | Zustand                   | Cross-feature UI state (e.g. global banner, theme) — not server data |
| Server    | TanStack Query            | All remote/async data                                                |

- Never store authorization tokens in logs or persistent browser storage unless explicitly required by the auth design.

---

## Naming Conventions

| Target                | Convention           | Example                                          |
| --------------------- | -------------------- | ------------------------------------------------ |
| Variables / functions | camelCase            | `getUserOrders`                                  |
| Components / types    | PascalCase           | `OrderList`                                      |
| Constants             | UPPER_SNAKE_CASE     | `MAX_RETRY_COUNT`                                |
| Hooks                 | `use*` prefix        | `useOrders`, `useInstallPrompt`                  |
| File names            | Match primary export | `OrderList.tsx`, `useOrders.ts`, `orderUtils.ts` |

- Avoid generic names like `index.ts`, `helpers.ts`, `styles.css` unless there is a clear, justified reason.

---

## UI and Styling

- **Tailwind CSS** is the default styling solution.
- Prefer consistent spacing and typography tokens; avoid one-off arbitrary values.
- **Mobile-first and touch-first**: minimum 44px tap targets; avoid hover-only interactions.
- Use **sentence casing** for UI labels, buttons, and tooltips (e.g. "Save as view", not "Save As View").

<!-- END:nextjs-agent-rules -->
