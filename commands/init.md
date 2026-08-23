---
description: Check this project for Taskfile.yml and .env, creating whichever is missing (with the correct content) so task build/install/api-* work here without an agent in the loop.
---

Standalone entry point for backfilling `Taskfile.yml` and `.env` into a
project that doesn't have them yet — either because it predates them, or
because one got deleted (or, for `.env`, correctly gitignored out of a
fresh clone). Useful on its own, without repeating any other build step.
The `appy` skill also writes `Taskfile.yml` itself, as part of its §1,
during a full build — this command exists for everything that isn't a
fresh full build.

## 1. Find the spec

Look for a single `*-build-spec.json` file in the project root (or wherever
the user points you). If more than one matches, ask which. If run from a
shared multi-app folder (one subfolder per app, e.g. `~/apps/<package_id>/`,
as `/appy:build` sets up — see `commands/build.md`) and no spec sits
directly in the current directory, ask which app's subfolder `Taskfile.yml`
(step 2) should target — that step is always per-app. `.env` (step 3) is
shared across the whole folder, so it doesn't need a target app at all.

`Taskfile.yml` (step 2) needs this spec's `original_app.play_id` and
`package_id` — if no spec is found (or chosen), skip straight to step 3 for
`.env` and tell the user `Taskfile.yml` can't be generated yet: run
`/appy:build <origin_play_id>` (or drop a `*-build-spec.json` in by hand) to
fetch one first, then re-run this command.

## 2. Taskfile.yml

If the target app's `Taskfile.yml` already exists, leave it alone (don't
overwrite a file that might carry local edits) and say so. If it's missing
and step 1 found (or was pointed at) a spec, write it exactly as the `appy`
skill's "Taskfile.yml — commands to manage the app" section (under its §1)
specifies — same `version`, `vars` (this spec's `original_app.play_id` as
`ORIGIN_PLAY_ID`, `package_id` as `PACKAGE_ID`), and the full `build`/`test`/
`test-instrumented`/`install`/`release`/`clean`/`api-*` task set — so a
project set up via this command ends up byte-for-byte the same as one the
skill scaffolded from scratch. Use `dotenv: ['.env']` when this app's
project root is standalone, or `dotenv: ['../.env']` when it's a subfolder
of a shared multi-app folder (same rule as the skill's §1). If
`build_instructions` in the spec names different Gradle tasks than the
defaults, use those instead, same as the skill does.

Inside a shared multi-app folder, also make sure the apps root's own
`Taskfile.yml` `includes:` this app — create the root `Taskfile.yml` if it
doesn't exist yet (just the `includes:` map), or add this app's entry to it
if it exists and doesn't already list it. See the skill's §1 for the exact
`includes:` shape.

## 3. .env

`.env` lives at the project root — the apps root itself when run inside a
shared multi-app folder (one `APPY_API_KEY` per developer account, not one
per app), or this project's own root when standalone. If it already exists
there, leave it alone and say so — never overwrite a real key. If it's
missing, ask the user for their `APPY_API_KEY`; if they don't have one yet,
tell them to sign in at `https://appy.fyi/profile` with Google and generate
one there (free, self-serve, no waiting — one active key per account), then
come back with it. Write `.env` containing exactly one line:
`APPY_API_KEY=<the key they gave you>`.

Either way — whether `.env` already existed or was just created — make sure
the key never ends up committed: if the `.gitignore` at that same root
doesn't exist, create one containing `.env`; if it exists but doesn't
already list `.env`, append that line.

## 4. Show this account's claims and ask what's next

State plainly which of `Taskfile.yml`/`.env` already existed and which (if
either) you just created. If both are in place now, tell the user they can
run `task build`, `task install` (pushes to a connected device/emulator),
`task test`/`test-instrumented`/`release`/`clean`, and any `task api-*`
command (e.g. `task api-profile`, `task api-app-info`) directly from a
terminal from here on — from inside this app's own subfolder, or (inside a
shared multi-app folder) as `task <package_id>:build` etc. from the apps
root itself — no Claude Code turn needed for those.

Then show the user their appy.fyi claims, the same two things `/appy:list`
opens with (`commands/list.md` steps 2–3): "N of M app claims used — K
left", then every claimed app with `build_spec_available: true` as a
numbered list (`origin_play_id` + `user_play_id`), noting any
`build_spec_available: false` entries as not buildable yet. Prefer `task
api-profile` and `task api-ownerships` if `Taskfile.yml` is in place here
(dotenv loads `APPY_API_KEY` for you, no need to read the key yourself);
otherwise call the two endpoints directly — `GET
https://appy.fyi/api/profile` and `GET https://appy.fyi/api/ownerships`,
header `Authorization: Bearer $APPY_API_KEY` (the key just written to
`.env`, or already there if it existed) — same `403 {"error":
"user_required"}` handling as `commands/list.md`.

Ask what they want to do next, with the concrete options in front of them:
- **Build a claimed app** — `/appy:build <origin_play_id>` for one from the
  list above.
- **Continue this project** — if step 1 found a spec here (this is that
  app's own subfolder), `task build`/`task install` now, or
  `/appy:publish` to walk through Play Console/Cloud setup and push to
  internal testing.
- **Claim something new** — not possible from here; point them at
  `commands/list.md` step 4 (browse appy.fyi, click "Build this" on a
  report page).

If `Taskfile.yml` is still missing because step 1 found no spec, lead with
the `/appy:build`-first instruction from step 1 as the concrete next
action before any of the above, not a buried caveat.
