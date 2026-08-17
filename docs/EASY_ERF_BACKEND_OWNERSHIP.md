# Easy Erf Backend Ownership

Status: canonical ownership and cutover boundary.

## Canonical owner

GitHub `main` is the canonical source for Easy Erf code and portable backend history.

The canonical founder-owned Easy Erf Supabase project is:

- project ref: `xiqpfhsdlvwrwhclonsg`
- project URL: `https://xiqpfhsdlvwrwhclonsg.supabase.co`

This is the existing backend Easy Erf is migrating toward and the only founder Supabase project that future canonical Easy Erf remote work may target.

Do not create another Easy Erf Supabase project or a parallel Lovable database to work around configuration problems.

## Rollback backend

The older Lovable-managed Supabase project remains a temporary rollback/runtime dependency during the controlled frontend cutover window.

Its presence does not make it the canonical Easy Erf backend.

Do not apply new canonical migrations, deploy new canonical Edge Functions, or seed new canonical runtime configuration into the rollback project merely because a tracked frontend environment still references it.

## Local config is not remote ownership

Supabase documents `supabase/config.toml` as local-stack configuration. The top-level `project_id` identifies the local development stack; it is **not** sufficient proof of which remote database a linked CLI command will target.

Easy Erf therefore uses the neutral local identifier `easy-erf` in `supabase/config.toml` rather than encoding either the founder or rollback remote ref there.

Remote CLI ownership is established explicitly with:

```bash
supabase link --project-ref xiqpfhsdlvwrwhclonsg
```

The resulting link is CLI local state and is not a canonical repository file. Before any remote operation, verify the linked project using `supabase projects list` and confirm it is the founder-owned Easy Erf ref above.

For commands that accept an explicit project-ref argument, prefer passing the founder Easy Erf ref instead of relying on ambient link state. For database commands that operate on `--linked`, verify the link immediately before the command.

Never run `db reset --linked` against production. Never run a remote migration, config push, function deployment or destructive operation merely because a link exists.

## Browser cutover is a separate decision

Backend ownership and browser cutover are intentionally separate.

The tracked browser environment remains on the current rollback path until all cutover gates are satisfied.

The frontend must not switch to the founder-owned project until at least:

1. Google OAuth is enabled and verified on the founder-owned Supabase project.
2. Existing migrated Google users can sign in successfully.
3. Signed-in Erf 1570 can read and write the expected canonical investigation data.
4. Site Potential entitlement/status transport works against the founder-owned API.
5. File Vault reads, planning state, Strategy state and Report assembly work for the signed-in user.
6. A rollback path remains available.

Correct repository ownership documentation does not authorize a frontend cutover, deployment, migration, publish or production data change.

## Secrets and public configuration

Never commit service-role keys, OAuth client secrets, worker secrets, provider secrets, database passwords or private model credentials.

Public browser configuration may identify the Supabase project and use its publishable/anon key, but only when the controlled frontend cutover is authorized and ready.

## Operational rule

Before any Supabase CLI, migration, function deployment or production configuration action:

- confirm the action itself is authorized;
- explicitly link to or pass the canonical Easy Erf founder project ref;
- verify the linked/explicit target immediately before a remote action;
- stop if the target resolves to the rollback Lovable project unless the action is explicitly a rollback operation;
- never touch unrelated projects such as Venture Compass.

## Current blocker

The repository already contains a rollback-safe direct Supabase Google-auth transport. The remaining frontend cutover gate is external: Google OAuth must be enabled and verified on the founder-owned Easy Erf Supabase project before the browser target is changed.
