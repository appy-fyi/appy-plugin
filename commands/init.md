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
as `/appy:build` sets up — see `commands/build.md`), ask which app's
subfolder to target instead of guessing.

`Taskfile.yml` (step 2) needs this spec's `original_app.play_id` and
`package_id` — if no spec is found here, skip straight to step 3 for `.env`
and tell the user `Taskfile.yml` can't be generated yet: run `/appy:build
<origin_play_id>` (or drop a `*-build-spec.json` in by hand) to fetch one
first, then re-run this command.

## 2. Taskfile.yml

If `Taskfile.yml` already exists in this project, leave it alone (don't
overwrite a file that might carry local edits) and say so. If it's missing
and step 1 found a spec, write it exactly as the `appy` skill's "Taskfile.yml
— commands to manage the app" section (under its §1) specifies — same
`version`, `dotenv: ['.env']`, `vars` (this spec's `original_app.play_id` as
`ORIGIN_PLAY_ID`, `package_id` as `PACKAGE_ID`), and the full `build`/`test`/
`test-instrumented`/`install`/`release`/`clean`/`api-*` task set — so a
project set up via this command ends up byte-for-byte the same as one the
skill scaffolded from scratch. If `build_instructions` in the spec names
different Gradle tasks than the defaults, use those instead, same as the
skill does.

## 3. .env

If `.env` already exists in this project, leave it alone and say so —
never overwrite a real key. If it's missing, ask the user for their
`APPY_API_KEY`; if they don't have one yet, tell them to sign in at
`https://appy.fyi/profile` with Google and generate one there (free,
self-serve, no waiting — one active key per account), then come back with
it. Write `.env` containing exactly one line: `APPY_API_KEY=<the key they
gave you>`.

Either way — whether `.env` already existed or was just created — make sure
the key never ends up committed: if `.gitignore` doesn't exist, create one
containing `.env`; if it exists but doesn't already list `.env`, append that
line.

## 4. Tell the user what's next

State plainly which of `Taskfile.yml`/`.env` already existed and which (if
either) you just created. If both are in place now, tell the user they can
run `task build`, `task install` (pushes to a connected device/emulator),
and any `task api-*` command (e.g. `task api-profile`, `task api-app-info`)
directly from a terminal from here on — no Claude Code turn needed for
those. If `Taskfile.yml` is still missing because step 1 found no spec, end
with the `/appy:build`-first instruction from step 1 as the concrete next
action, not a buried caveat.
