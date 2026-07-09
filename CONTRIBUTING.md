# Contributing to PeopleFlow HRMS

## Development Setup

1. Clone the repository
2. Run `npm ci`
3. Run `npx prisma generate`
4. Copy `.env.example` to `.env` and fill in values
5. Run `npm run dev`

## Quality Gates (must pass before merge)

```bash
npx tsc --noEmit        # TypeScript compilation
npx eslint              # Linting
npx vitest run          # Unit tests
npx next build          # Production build
```

All four must pass. CI runs these automatically on every PR.

## Code Style

- Use TypeScript strict mode
- Use design system tokens (bg-card, text-foreground, etc.) — no hardcoded colors
- Use i18n keys (next-intl) — no hardcoded English strings in UI
- Use TanStack Query for data fetching (not useEffect + fetch)
- Use the PageHeader component for page headers
- Use Zod for API input validation
- Use requireAuth() + auth.withDB() for API routes (RLS compliance)

## Commit Message Convention

Format: `TYPE: Brief description`

Types:
- `P0-*`: Critical fixes (security, data integrity, infrastructure)
- `P1-*`: High priority fixes (performance, UX bugs, feature wiring)
- `P2-*`: Medium priority (TanStack Query migration, i18n, UI consistency)
- `P3-*`: Low priority (bulk import, CI/CD, polish)
- `BATCH N`: Feature batch

## Pull Request Process

1. Create a feature branch from `masterpiece-v2`
2. Make your changes
3. Ensure all quality gates pass locally
4. Create a PR using the PR template
5. Wait for CI to pass
6. Request review
7. Merge after approval

## Testing

- Write unit tests for new business logic
- Test in both English and Bengali locales
- Test on mobile viewport (375px width)
- Test dark and light themes
