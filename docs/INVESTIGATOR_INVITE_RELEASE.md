# Investigator invitation release requirements

Source-only repair from main 1f49976b9cee3b751c7bf86a95f4f699fe02c4cd.
No production configuration or email was changed/sent during implementation.

## Configuration still required before live acceptance

In canonical Supabase project xiqpfhsdlvwrwhclonsg:

1. Authentication > Email > SMTP Settings: configure custom SMTP using the
   existing verified mail.easyerf.co.za domain, not the restricted default mailer.
   Resend documents host smtp.resend.com, port 465 and username resend.
   The SMTP password is an authorized Resend key entered only in that dashboard.
   Never put it in source, browser configuration, screenshots or receipts.
   Use the existing authorized sender on mail.easyerf.co.za and Easy Erf sender name.
   Confirm existing included sending capacity before any email; no purchase is authorized.
2. Authentication > URL Configuration: Site URL https://easyerf.co.za and exact
   allowed redirect https://easyerf.co.za/invite/accept. Do not add wildcard domains.
3. Confirm the invitation template uses Supabase's ConfirmationURL so Auth verifies
   the invite before redirecting. This page consumes the existing implicit Supabase
   session; it does not accept arbitrary email/role parameters or grant privileges.
4. Release the reviewed frontend/server candidate only after separate approval.
   No migration or Edge Function change is included.
5. Separately authorized live acceptance must verify actual inbox delivery and
   a fresh-browser password setup, not merely an Auth API success response.

## Security and limitations

Founder support calls carry AdminGuard's established token; the backend still
validates that token and the admin role. Missing/expired authentication fails closed.
Invitation delivery errors produce no success response or role grant.
Supabase invitation confirmation establishes email ownership; its confirmation
timestamp remains the existing active-directory/assignment criterion. Password setup
does not create another activation or role system. It revalidates invited Auth user
and investigator-only role before updating the password.

The existing role grant and order assignment audits remain unchanged. A role grants
no order access by itself. Existing customer promotion still requires explicit
confirmation. This tranche adds no retry/resend or role-revocation system.
SMTP acceptance is not inbox delivery. If email delivery succeeds but subsequent
role recording fails, the error remains visible and needs founder investigation;
the application does not resend automatically.

Sources:
- https://resend.com/docs/send-with-supabase-smtp
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
