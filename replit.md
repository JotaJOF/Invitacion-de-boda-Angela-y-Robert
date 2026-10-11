# Invitación de boda Angela y Robert

Invitación web móvil para la boda de Angela Palmerston y Robert Wilson, recreada a partir del diseño original de Canva.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/invitacion-boda/` — página web y recursos visuales de la invitación.

## Architecture decisions

- Invitación estática; el RSVP se presenta como vista previa y no envía ni almacena confirmaciones.
- El video se conserva como imagen fija hasta que se proporcione el archivo de video.

## Product

Invitación de una sola página con información del evento, ubicación, vestimenta, itinerario, preguntas frecuentes y vista previa del RSVP.

## User preferences

- Priorizar la réplica móvil del PDF: fondo rosa palo con secciones verde oliva y sin el espacio vacío al final.
- La fecha de portada, 13 de junio de 2026, es la fecha oficial; todas las fechas posteriores deben ajustarse a ella.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
