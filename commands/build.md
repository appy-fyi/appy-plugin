---
description: Fetch one or more claimed apps' build specs from appy.fyi and build them, each into its own subfolder.
---

Entry point for building an already-claimed app: fetches its build spec
straight from the appy.fyi API — no manual browser download needed — then
hands off into this plugin's `appy` skill exactly as if the file
had been dropped in by hand.

This command is multi-app-folder aware: run it from a shared apps root (e.g.
`~/apps`), and each app it builds gets its own subfolder there, named after
that app's `package_id` — never dumped loose into the current directory and
never mixed with a sibling app's files. It also accepts more than one
`origin_play_id` at once, in which case it builds all of them **in
parallel**, one per subfolder.

## 1. Check for a key

Read the `APPY_API_KEY` environment variable. If it's unset, tell the user to
sign in at `https://appy.fyi/profile` with Google, generate a key there
(free, self-serve, no waiting — one active key per account), set
`APPY_API_KEY` to it, and re-run this command. The key is required here —
without it there is nothing to fetch.

## 2. Find which app(s) to build

If this command was invoked with one or more `origin_play_id` arguments (the
incumbent's play_id, space- or comma-separated), use them directly and skip
to step 3. Otherwise this account's claims aren't known yet — follow this
plugin's `commands/list.md` step 2 to list them. If nothing's claimed yet (or
not the app the user actually wants), this plugin can't claim one itself —
list.md's step 3 sends them to the report page's "Build this" button on
appy.fyi instead; come back here once that's done. If more than one claimed
app has `build_spec_available: true`, ask the user whether they want to
build just one or all of them at once (building several apps at once only
ever makes sense across *different* `origin_play_id`s — there's nothing to
parallelize for a single app). Come back here with the `origin_play_id`(s)
picked.

## 3. Fetch each build spec into its own subfolder

For each `origin_play_id` from step 2, independently:

`GET https://appy.fyi/api/build_spec/<origin_play_id>`, header
`Authorization: Bearer $APPY_API_KEY`. Responses:
- `403 {"error": "not_owner"}` — this account hasn't actually claimed that
  `origin_play_id` (run `/appy:list` to check — if it's really not claimed,
  that only happens on appy.fyi's website, see `commands/list.md` step 3) —
  don't retry silently, surface this to the user.
- `404` — no Tier A build spec exists yet for this incumbent (matches
  `build_spec_available: false` in `/appy:list`'s output).
- `200` — the build spec JSON itself, no wrapper.

Read `package_id` out of the returned JSON — this app's own id, e.g.
`com.example.myapp` — and use it as the subfolder name. If
`./<package_id>/` doesn't exist yet, create it. If it already exists (this
app was fetched or built here before), tell the user that and confirm
whether to proceed — e.g. to refresh the spec after it changed on
appy.fyi — before overwriting anything inside it.

Save the response body verbatim to `./<package_id>/<origin_play_id>-build-spec.json`
— same filename shape and content the website's "Download build spec" link
produces, just relocated into that app's own subfolder instead of the
current directory.

When several `origin_play_id`s were requested, do all of these fetches
before moving on to step 4 — they're independent API calls, safe to run back
to back (or concurrently) regardless of how step 4 ends up building them.

## 4. Build

- **One app fetched:** hand off directly into this plugin's `appy`
  skill using the file just written in `./<package_id>/`, starting at its
  §0, with that subfolder as the project root.
- **More than one app fetched:** build them at the same time rather than one
  after another. Launch one subagent per subfolder (Claude Code's Task
  tool), each given that subfolder as its working directory and instructed
  to run this plugin's `appy` skill there, starting at its §0, on
  the `<origin_play_id>-build-spec.json` just fetched into it. Launch all of
  them in the same turn so they actually run concurrently, not queued
  behind each other. Each subagent's appy skill run is fully
  self-contained to its own subfolder — see that skill's §0, which spells
  out never touching a sibling app's folder even when one is sitting right
  next to it. Once all subagents finish, report a combined summary: one
  block per app (its `package_id`, subfolder, and that build's own §10
  final report), not just the last one to finish.

If a build's own §8/§10 shows the developer hadn't finished `/appy:publish`'s
one-time Play Console/Cloud setup yet, that's a normal stopping point, not a
failure — say so and mention they can run `/appy:publish` in that app's
subfolder once they're ready, without repeating this build.
