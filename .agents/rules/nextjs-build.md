---
trigger: always_on
---

# Next.js Build Constraints

- NEVER run `npm run build` or `next build` to verify code changes.
- Running `next build` deletes the `.next` directory and breaks the active `next dev` server.
- To verify that code works, ALWAYS run `npm run check` instead.
