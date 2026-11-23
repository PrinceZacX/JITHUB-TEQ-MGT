# JITHUB-TEQ-MGT

## Optional email delivery

Email delivery uses the app&apos;s SMTP server configuration when supplied; it does not require Resend or another paid transactional-email service. Without SMTP configuration, existing sign-in and password login remain available. Verification and recovery requests are logged as not sent, rather than blocking authentication.

Configure these server-side production environment variables to enable outbound email:

| Variable | Required | Description |
| --- | --- | --- |
| `SMTP_HOST` | Yes | SMTP server hostname. |
| `SMTP_PORT` | No | SMTP server port (commonly `587` for STARTTLS or `465` for implicit TLS). Defaults to `587`. |
| `SMTP_FROM` | Yes | Sender address, for example `JITHUB-TEQ <no-reply@example.com>`. |
| `SMTP_USER` | Provider-dependent | SMTP username when the server requires authentication. |
| `SMTP_PASSWORD` | Provider-dependent | SMTP password when the server requires authentication. Keep this server-side; never expose it in client code. |
| `SMTP_SECURE` | No | `true` to use implicit TLS; defaults to `true` on port `465` and `false` otherwise. |

The username and password must be set together. SMTP credentials are read only by server code. Delivery outcomes and configuration failures are logged without logging credentials or message contents. The mail helper supports verification, password recovery, workspace invitations and account-security notifications; invitation and security messages can be sent by server-side application flows.

## Database environments

The application uses separate Neon branches. Never reuse a connection string across environments.

| Environment | Neon branch | Purpose |
| --- | --- | --- |
| Development | `development` | Local development and developer testing |
| Preview | `staging` | Vercel Preview deployments and acceptance testing |
| Production | `main` | Live application data |
| Integration tests | `ci-test` | Isolated automated PostgreSQL checks |

The application reads one server-side `DATABASE_URL`. The real database test suite reads `DATABASE_URL_TEST`. Both values are encrypted in Vercel. The test URL must point to the dedicated `ci-test` branch, never staging or production.

### Local setup

After linking the repository to the existing Vercel project, pull the development-only variables:

```bash
vercel link
vercel env pull .env.local --environment=development
pnpm dev
```

The repository ignores `.env*` files. Never commit local environment files or paste connection strings into issues, chat messages or source code.

### Database readiness

- `GET /api/health/database` checks a real PostgreSQL connection and returns a non-cacheable readiness response.
- Missing or malformed `DATABASE_URL` fails immediately. The PostgreSQL client must never fall back to localhost.
- Every build runs `pnpm test` before `next build`.
- Real integration tests use `DATABASE_URL_TEST`, verify the required application tables and test transaction rollback using a temporary table.
- Do not run destructive schema commands or migrations against production as part of routine verification.
