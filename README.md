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
