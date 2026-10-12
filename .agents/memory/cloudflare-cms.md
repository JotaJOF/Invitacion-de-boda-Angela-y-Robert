---
name: Cloudflare CMS constraints
description: Workspace preservation and password-verification decisions for the Cloudflare/Supabase site.
---

## Preserve existing products

When adding the standalone Cloudflare Worker site, keep the existing invitation, API, and mockup artifacts. Adapt only the files and configuration needed for the new deployment; do not replace or remove the existing project unless the user explicitly asks.

**Why:** The user clarified that they wanted the deployment adapted without deleting the existing work because many of its files remain useful.

**How to apply:** Keep future Cloudflare changes additive and preserve the existing Replit artifacts and their workflows.

## Keep bcrypt verification off the Worker CPU path

Generate bcrypt hashes with `bcryptjs`, but verify passwords with a restricted Supabase `pgcrypto` RPC rather than running bcrypt verification in the Worker.

**Why:** Cloudflare Workers Free allows only 10 ms CPU per request, which can be exceeded by bcrypt verification in JavaScript; moving verification to Supabase avoids requiring a paid CPU limit or weakening the bcrypt cost.

**How to apply:** Keep the RPC protected to `service_role`, never expose the service key to the site, and keep the Worker responsible for issuing and checking the signed session cookie.
