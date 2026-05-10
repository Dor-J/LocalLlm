/**
 * Public entry point for the shared package.
 *
 * Hand-written types in {@link ./chat} will migrate to `schemas.*`
 * incrementally as new DTOs are added. New DTOs should import from
 * `@local/shared` and reach for `schemas.<Name>` before adding new
 * hand-typed duplicates.
 *
 * The generated namespace mirrors the live FastAPI OpenAPI document and is
 * regenerated via `bun run codegen:openapi` (see `scripts/codegen-openapi.ts`).
 */

export * from './chat'
export * as schemas from './generated/api'
