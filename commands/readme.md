---
description: Generate or refresh this project's README.md from its appy.fyi build spec, disclosing the incumbent app it's an alternative to.
---

Standalone entry point for (re)writing this project's `README.md` from a
`*-build-spec.json` already present in it — useful on its own if the README
got deleted, needs refreshing after the spec changed, or you just want to
regenerate it without repeating any other build step. The `appy`
skill also runs these exact steps itself, as its §6, during a full build.

## 1. Find and read the spec

Look for a single `*-build-spec.json` file in the project root (or wherever
the user points you). If more than one matches, ask which. Read the whole
file — this command draws on `working_name`, `positioning`, `original_app`,
`features[]`, `min_sdk`, `build_instructions`, and `human_gates_required[]`.

If run from a shared multi-app folder (one subfolder per app, e.g.
`~/apps/<package_id>/`, as `/appy:build` sets up) rather than from inside a
single app's own project root, ask which app's subfolder to target instead
of guessing — don't scan every subfolder and don't touch more than one
app's `README.md` in a single run.

## 2. Write README.md — disclose the incumbent

Every app built from a spec is an alternative to a specific, named incumbent
(`original_app`), never an anonymous "competitor app." Write a `README.md`
in the project root that states this plainly, near the top:

- The app's own name (`working_name`) and one-line `positioning`.
- A named, linked disclosure: "`working_name` is an independent alternative
  to [`original_app.name`](`original_app.play_store_url`) — not affiliated
  with, endorsed by, or a modification of it." Link `original_app.report_url`
  too, as the market research this app's feature set was built from.
- Whether the incumbent itself is open source. Check this yourself — don't
  guess and don't leave it unstated. Search for `original_app.name` plus
  terms like "github", "source code", or "open source" (its Play Store
  listing description or developer website, if `GET /api/app_info/<play_id>`
  — the `appy` skill's "Calling appy.fyi's API" — was reachable,
  sometimes says so directly; otherwise a web search for the incumbent's own
  name is the next step). If you find a real public
  repository, name it and link it and say the incumbent is open source; if
  you find clear evidence it's closed-source (proprietary, no public repo
  after a real search), say that instead; if the search is genuinely
  inconclusive, say so honestly ("couldn't confirm whether the incumbent is
  open source") rather than asserting either way.
- The standard sections a new project needs anyway: what it does
  (`positioning` + a short feature list from `features[]`), `min_sdk`, how to
  build it (`build_instructions`), and current status (which
  `human_gates_required[]` are still open).
