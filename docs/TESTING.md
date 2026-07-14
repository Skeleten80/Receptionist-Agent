# Testing

## Unit (Vitest)

```bash
npm run test
```

Covers prompt builder, Zod schemas, plan limits, business hours, appointment overlap, phone normalization, Vapi normalization/signature, error taxonomy.

## E2E (Playwright)

```bash
npx playwright install chromium
npm run test:e2e
```

Smoke tests cover marketing + login. Full auth flows require a configured Supabase project.

## Integration notes

Cross-tenant denial and webhook processing are enforced in server code + RLS. Run against a seeded Supabase project for full integration verification of the vertical slice.
