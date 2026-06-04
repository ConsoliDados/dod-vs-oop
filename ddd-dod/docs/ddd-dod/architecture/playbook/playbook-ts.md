# Playbook (TypeScript addendum)

TypeScript-specific conventions. Read together with `playbook-base.md`.

## 1. Workspace structure

A TS project is a workspace (Bun, pnpm, or npm). The repo-root `package.json` declares workspaces and shared scripts; per-package `package.json` declares per-package deps.

```jsonc
// package.json (root)
{
  "name": "<project>",
  "private": true,
  "workspaces": ["apps/*", "services/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

Tooling baseline:

- **Bun** for runtime + test runner where possible (faster, no extra config).
- **Biome** for lint + format (no eslint + prettier; one tool).
- **TypeScript `strict: true`** — no `any`, no implicit-any, no untyped JSON.
- **Turbo** for task orchestration in multi-package workspaces.

## 2. Package layout (DDD-shaped, medium / large tier)

```
packages/<context>/
├── package.json
├── AGENTS.md
├── tsconfig.json
├── src/
│   ├── index.ts                 # public API — re-exports only
│   ├── error.ts                 # Error types + Result<T, E>
│   ├── domain/
│   │   ├── <aggregate>.ts       # one file per aggregate root
│   │   ├── events.ts            # published domain events
│   │   └── value-objects/
│   ├── application/
│   │   ├── ports.ts             # repository + service interfaces
│   │   ├── <useCase>.ts         # one file, one function
│   │   └── on-<eventName>.ts    # cross-context subscribers
│   └── infra/
│       ├── pg-<aggregate>-repository.ts
│       └── <provider>-<port>.ts
└── tests/
```

For lighter projects, collapse into a flat `src/`.

## 3. `index.ts` is the public API

```ts
// packages/<context>/src/index.ts

export { generateCv, type GenerateCvInput, GenerateCvError } from './application/generate-cv'
export { Cv, CvStatus } from './domain/cv'
export type { CvGenerated, CvPublished, DomainEvent } from './domain/events'
```

Anything not exported from `index.ts` is internal. Other packages import only from `<package>` (resolves to `index.ts`), never from `<package>/src/...`.

### Namespace barrels — when a package owns several submodules

When a package groups several distinct submodules (e.g. a `platform` package with `config`, `di`, `logger`, `db`, `clock`), prefer **ESM namespace barrels** over a flat re-export, so the call site shows which module a symbol belongs to:

```ts
// packages/platform/src/index.ts
export * as config from './config'
export * as di from './di'
export * as logger from './logger'
// consumer:  config.load(env) · di.createContainer() · config.ConfigError.format(e)
```

Conventions: **lowercase** namespace (the ESM idiom; the class-like errors inside stay PascalCase — `config.ConfigError`); drop a redundant module-name suffix at the surface via a **barrel alias** (`export { loadConfig as load }`), keeping the canonical, greppable name in source. This blocks `import { load }` (only `config.load` is reachable); `const { load } = config` is still possible at runtime — a convention to avoid (flag in review), not a hard barrier. Rejected alternatives: `export default {…}` (needs `exports` subpaths, renames poorly) and the TS `namespace` keyword (pre-ESM, not tree-shakeable). For a single-purpose package, the flat re-export above is fine.

## 4. Errors — `Result<T, E>` pattern, not exceptions

TypeScript has no built-in `Result`; use a discriminated-union helper. Recommended: a small `Result<T, E>` library (e.g. `@consolidados/results`, neverthrow, or hand-rolled).

```ts
// shared/result.ts (or import from a chosen library)
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error })
```

Domain code returns `Result<T, E>`. Infrastructure code at the boundary may catch exceptions and convert to `Err`.

```ts
import { Result, Ok, Err } from '@/shared/result'

export type CvError =
  | { kind: 'invalid_ats_score'; score: number; expected: '0..=100' }
  | { kind: 'ats_score_too_low'; score: number; minimum: 70 }

export function publish(cv: Cv): Result<Cv, CvError> {
  if (cv.atsScore < 70) {
    return Err({ kind: 'ats_score_too_low', score: cv.atsScore, minimum: 70 })
  }
  return Ok({ ...cv, status: 'published' })
}
```

### Rules

- **No `throw` in domain code.** Use `Result<T, E>`. Throws are a side channel; types lose them.
- **Boundaries (HTTP, DB, file I/O) catch native errors and convert to `Err`** with a typed shape.
- **Never `.unwrap()` / `.unwrapErr()` in production code.** Narrow with `result.ok` or pattern-match. `unwrap*` is allowed only in tests as a fail-fast assertion (per `@consolidados/results` convention).
- **Errors carry the offending value and the expected shape** (per base playbook §10.3). Object-shaped errors (`{ kind: '...', value: ..., expected: ... }`) read better than `Error` subclasses.

### Test fail-fast

Tests can use `result.unwrap()` / `result.unwrapErr()` from the chosen Result library — these throw on the wrong branch with a clear message, which the test runner surfaces. This is the TS equivalent of `?` + `Box<dyn Error>` in Rust tests.

## 5. Enums & domain errors — object-as-enum patterns

### Closed sets — the const-object "enum"

For a closed set of string constants, prefer a `const` object + a derived type over a bare union. You get **named constants** to reference (no magic strings sprinkled through the code), the values are iterable, and it stays a plain data union (no TS `enum` runtime baggage).

```ts
export const DenyReason = {
  NoGrant: 'no-grant',
  CrossOrg: 'cross-org',
  NotVisible: 'not-visible',
} as const
export type DenyReason = (typeof DenyReason)[keyof typeof DenyReason]

// reference the constant, not the literal:
return deny(DenyReason.CrossOrg)
```

Use it for discriminants, status sets, error kinds, action verbs — anything enumerable. Do **not** use TypeScript's `enum` keyword (non-erasable, surprising runtime semantics).

### Domain errors — "enum with constructors"

For errors that **carry data**, use an object-as-enum whose entries are factory functions returning a discriminated variant; the union type is derived from the factories. Pairs with `Result` + the Notification pattern: accumulate `DomainError[]`, then roll up via `InvalidEntity(name, errors)`.

**Use object payloads with named fields** (`error.field`, `error.value`) — NOT positional tuples (`error.Required[0]`). Tag every variant with `type` and pattern-match on `error.type`.

```ts
// Derive the union from the factory object. Use `never[]` params (NOT `any[]`):
// it infers every factory's return type without an explicit-any lint or a
// `biome-ignore`. The `: T[K]` fallback also admits bare-value variants
// (`Foo: 'Foo'`) alongside factory variants. Host this helper in a shared types
// package (e.g. `@<scope>/types`) so every context derives errors the same way.
type EnumValues<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R ? R : T[K]
}[keyof T]

type DomainErrorLike = { readonly type: string } // breaks the InvalidEntity self-reference

export const DomainError = {
  Required(field: string) {
    return { type: 'Required', field } as const
  },
  OutOfRange(field: string, constraint: string) {
    return { type: 'OutOfRange', field, constraint } as const
  },
  InvalidProperty(property: string, message: string) {
    return { type: 'InvalidProperty', property, message } as const
  },
  InvalidEntity(entity: string, errors: readonly DomainErrorLike[]) {
    return { type: 'InvalidEntity', entity, errors } as const
  },
  Other(reason: string, details?: unknown) {
    return { type: 'Other', reason, details } as const
  },
} as const
export type DomainError = EnumValues<typeof DomainError>

// pattern-match on the tag, access named fields:
function format(e: DomainError): string {
  if (e.type === 'OutOfRange') return `${e.field}: ${e.constraint}`
  if (e.type === 'InvalidEntity') return `${e.entity}: ${e.errors.length} issue(s)`
  return 'error'
}
```

Host a shared `DomainError` in a foundational package (e.g. `packages/core`) so every context, service, and app validates the same way. Notes: type `errors` as `{ type: string }[]` (not the full union) to avoid a circular type alias; redact sensitive field values before putting them in an error.

### Operational / port errors — `defineError` with bundled renderers

Domain *validation* (above) is the **field-tagged, accumulated** encoding (`{ type, field }[]`, rolled up via `InvalidEntity`). Use-case / port / wiring outcomes are a different encoding: a closed, `match`-able set of **key-as-tag** variants (`{ NotRegistered: { token } }`), each carrying its own payload. Both are error-as-value (never throw); pick by job — accumulation vs a closed matchable set.

For the operational encoding, fuse the variant constructors with **two renderers** on one object via a `defineError` helper (host it next to `EnumValues`). The signature *requires* both renderers, so no error ships without them; the union type is derived from the **variants alone**, so the renderers never leak into it.

```ts
type ErrorJson = { readonly kind: string } & Readonly<Record<string, unknown>>

export function defineError<const V extends Record<string, string | ((...a: never[]) => string | object)>, E = EnumValues<V>>(
  variants: V,
  renderers: { format: (e: E) => string; serialize: (e: E) => ErrorJson },
): Readonly<V & typeof renderers> {
  return Object.freeze({ ...variants, ...renderers })
}

const variants = {
  notRegistered: (token: string) => ({ NotRegistered: { token } }) as const,
  factoryFailed: (token: string, cause: unknown) => ({ FactoryFailed: { token, cause } }) as const,
} as const
export type DiError = EnumValues<typeof variants>
export const DiError = defineError(variants, {
  // format = Display: human, one line, boot/CLI logs only
  format: (e: DiError) => match(e, {
    NotRegistered: (x) => `no provider for token "${x.token}"`,
    FactoryFailed: (x) => `factory "${x.token}" failed: ${String(x.cause)}`,
  }),
  // serialize = structured: flat record for observability; cause stringified, never leaked raw
  serialize: (e: DiError) => match(e, {
    NotRegistered: (x) => ({ kind: 'NotRegistered', token: x.token }),
    FactoryFailed: (x) => ({ kind: 'FactoryFailed', token: x.token, cause: String(x.cause) }),
  }),
})
// DiError.notRegistered('db')  → construct;  DiError.format(e) / DiError.serialize(e) → render
```

**Two renderers, disjoint jobs** (the Rust `Display` vs `serde` split): `format` is human-readable Display for boot/CLI logs only — **never** an API body or a log-field value; `serialize` returns a structured `ErrorJson` (`{ kind, …safe fields }`) for observability — never a stringified blob. `ErrorJson` is deliberately **not** the logger's field type, so a pure-domain error never depends on the logger's vocabulary. Mapping a variant → HTTP `{ status, token, safe fields }` is a **route-boundary** concern (a `match` per variant at the handler), not a third renderer on the error.

## 6. Validation — Zod at boundaries

Zod guards **external untrusted input** — HTTP body/params/query, env vars, config files, IPC messages. It does **not** guard a context reading its **own** persisted rows (sole writer + domain invariants + migrations are the source of truth; rows are typed interfaces, not re-parsed). "Validate at the boundary" means the *untrusted* boundary, not every deserialization (see ADR-0006 — relevant to read-hot-path perf too).

```ts
import { z } from 'zod'

const CreateCvBodySchema = z.object({
  userId: z.string().uuid(),
  rawData: z.string().min(1).max(10000),
}).strict()      // reject unknown fields

export type CreateCvBody = z.infer<typeof CreateCvBodySchema>

// Keep the validator OUT of the error type: map Zod issues to a neutral shape at
// the seam, so the error contract doesn't change if you swap Zod for TypeBox/etc.
type ValidationIssue = { readonly path: string; readonly message: string }
const toIssues = (e: z.ZodError): ValidationIssue[] =>
  e.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }))

// In the HTTP handler:
const parsed = CreateCvBodySchema.safeParse(req.body)
if (!parsed.success) return Err(ValidationError.invalid(toIssues(parsed.error)))
//                              ^ a defineError (§5) carrying ValidationIssue[], NOT z.ZodIssue[]
```

`.strict()` rejects unknown fields — equivalent to Rust's `#[serde(deny_unknown_fields)]`. Critical for security-relevant config. **Do not** store `parsed.error.issues` (a `z.ZodIssue[]`) in the error type — that couples every consumer to the validator library; map to the neutral `ValidationIssue` at the single seam shown above.

## 7. Aggregate root with rich documentation (DDD)

```ts
/**
 * Aggregate root: Cv.
 *
 * Invariants:
 * - Always has at least one section.
 * - Can only be published when `atsScore >= 70` (ADR-0003).
 * - `tokensUsed` is immutable after creation.
 *
 * Emitted events:
 * - `CvGenerated` — on `createCv`
 * - `CvPublished` — on `publishCv` when validation passes
 *
 * Consumers:
 * - The `billing` package listens to `CvGenerated`.
 */
export type Cv = {
  readonly id: CvId
  readonly userId: UserId
  readonly sections: readonly Section[]
  readonly atsScore: number
  readonly status: CvStatus
  readonly pendingEvents: readonly DomainEvent[]
}
```

Aggregates are **immutable values** + factory functions:

```ts
export function createCv(
  userId: UserId,
  summary: string,
  tokensUsed: number,
): Cv {
  const id = generateCvId()
  return {
    id,
    userId,
    sections: [summarySection(summary)],
    atsScore: 0,
    status: 'draft',
    pendingEvents: [{ kind: 'cv.generated', cvId: id, userId, tokensUsed, occurredAt: new Date() }],
  }
}

export function optimize(cv: Cv, score: number): Result<Cv, CvError> {
  if (score < 0 || score > 100) {
    return Err({ kind: 'invalid_ats_score', score, expected: '0..=100' })
  }
  return Ok({
    ...cv,
    atsScore: score,
    pendingEvents: [...cv.pendingEvents, { kind: 'cv.optimized', cvId: cv.id, score }],
  })
}
```

Why immutable: simpler reasoning, no hidden mutation, easier serialization for events / DB / wire.

## 8. Use cases as functions

```ts
import { Result, Err } from '@/shared/result'
import type { CvRepository, LlmProvider } from './ports'

export type GenerateCvInput = {
  userId: UserId
  rawData: string
}

export type GenerateCvError =
  | { kind: 'domain'; cause: CvError }
  | { kind: 'infra'; cause: InfraError }

export async function generateCv(
  input: GenerateCvInput,
  repo: CvRepository,
  llm: LlmProvider,
): Promise<Result<Cv, GenerateCvError>> {
  const out = await llm.generate(buildPrompt(input.rawData))
  if (!out.ok) return Err({ kind: 'infra', cause: out.error })

  const cv = createCv(input.userId, out.value.content, out.value.tokensUsed)

  const saved = await repo.saveWithEvents(cv, [...cv.pendingEvents])
  if (!saved.ok) return Err({ kind: 'infra', cause: saved.error })

  return { ok: true, value: cv }
}
```

Rules:

- One file, one exported function.
- Dependencies as parameters (the function takes a `CvRepository`, doesn't construct one).
- Returns `Promise<Result<T, E>>` for async use cases.

## 9. Ports (interfaces) at the aggregate level

```ts
// packages/<ctx>/src/application/ports.ts

export type InfraError =
  | { kind: 'database'; message: string }
  | { kind: 'not_found' }
  | { kind: 'llm_provider'; message: string }

export interface CvRepository {
  saveWithEvents(cv: Cv, events: DomainEvent[]): Promise<Result<void, InfraError>>
  findById(id: CvId): Promise<Result<Cv | null, InfraError>>
  findByUser(userId: UserId): Promise<Result<Cv[], InfraError>>
}

export interface LlmProvider {
  generate(prompt: string): Promise<Result<LlmOutput, InfraError>>
}
```

One interface per aggregate. Not per query.

## 10. Frontend (Next.js / React) — vertical slicing

For frontends in `apps/web/` or shared `packages/features/`:

- **Vertical slicing** — feature folders contain components, hooks, validation, API client. Not horizontal layers.
- **TanStack Router + TanStack Query** — routing and server state.
- **Zustand** — client UI state (modals, drafts).
- **shadcn/ui** — component primitives.
- **Zod** at every transport boundary (server actions, API responses, form inputs).
- **Generated types from the backend** (OpenAPI, ts-rs) — never hand-copy event shapes or DTOs.

```
apps/web/src/features/<feature>/
├── components/
├── hooks/
├── api/                          # client wrappers + Zod parses
├── routes.ts                     # TanStack Router config
└── index.ts                      # exports for the rest of the app
```

## 11. Things to NOT do (TypeScript)

1. **Don't use `any`.** Use `unknown` and narrow.
2. **Don't `throw` in domain code.** Use `Result<T, E>`.
3. **Don't `.unwrap()` / `.unwrapErr()`** outside tests.
4. **Don't catch exceptions to recover** in business logic. Catch at boundaries to convert to `Err`.
5. **Don't trust untyped JSON.** Zod-parse at every boundary.
6. **Don't hand-copy types between frontend and backend.** Generate (ts-rs / OpenAPI / shared `packages/types`).
7. **Don't introduce a class hierarchy** for aggregates. Use plain types + factory functions.
8. **Don't reach into `<package>/src/...`** from another package. Only the public `index.ts` exports are stable.
9. **Don't mix Bun and Node assumptions.** Pick one runtime per service and document it.
10. **Don't write tests that depend on time / network without mocking.** Time-travel via `vi.useFakeTimers()` or equivalent; mock fetches.
