---
description: List your appy.fyi claimed apps (or claim a new one), fetch its build spec via the API, and build it.
---

Entry point for the "hybrid" appy.fyi flow (doc/platform.md §6 in the
appy.fyi repo): list what this account has already claimed, let the user
pick (or claim a new app), fetch that app's build spec straight from the
API — no manual browser download — then hand off into this plugin's
`build-from-spec` skill exactly as if the file had been dropped in by hand.

## 1. Check for a key

Read the `APPY_API_KEY` environment variable. If it's unset, tell the user to
sign in at `https://appy.fyi/profile` with Google, generate a key there
(free, self-serve, no waiting — one active key per account), set
`APPY_API_KEY` to it, and re-run this command. Unlike the rest of this
plugin, where a missing key just skips optional enrichment, the key is
required here — without it there is nothing to list or fetch.

## 2. List claimed apps

`GET https://appy.fyi/api/ownerships` with header `Authorization: Bearer
$APPY_API_KEY`. A `403 {"error": "user_required"}` means the key is an
integration key, not a self-served one — tell the user to use the key from
their own `/profile` page instead.

The response is a JSON array of `{origin_play_id, user_play_id,
build_spec_available, build_spec_url}`. Present every entry with
`build_spec_available: true` as a numbered list — show both `origin_play_id`
(the incumbent being cloned) and `user_play_id` (the name the user picked for
their own app) — and let the user pick one. Mention entries with
`build_spec_available: false` too, but note they can't be built from yet (the
claim exists; appy.fyi hasn't generated a Tier A build spec for that
incumbent). An empty array means nothing is claimed yet — go straight to
step 3.

## 3. Claim a new app, if wanted

If the user wants to build something not already in that list: they first
need to find an app to clone by browsing `https://appy.fyi` (report pages,
`/search`, `/top`, `/movers`) and copying its `play_id` (the Play Store
package id in the URL/report), then choose a name for the *new* app they're
building — its own package id, e.g. `com.example.myapp` — as `user_play_id`.
An account can claim at most 2 apps total, ever, and a claim can never be
undone. Confirm both of those with the user explicitly before calling this —
it's not reversible the way most of this plugin's steps are.

`POST https://appy.fyi/api/ownership`, header `Authorization: Bearer
$APPY_API_KEY`, JSON body `{"origin_play_id": "<incumbent play_id>",
"user_play_id": "<the new app's package id>"}`. Responses:
- `403 {"error": "too_many_ownerships"}` — both claim slots are used; the
  user has to build from an existing claim (step 2) instead.
- `404` — `origin_play_id` isn't an app appy.fyi tracks; double-check it
  against the report page URL.
- `409 {"error": "already_claimed"}` — someone else claimed that exact
  `user_play_id` first; the user needs a different package id.
- `200 {"origin_play_id", "user_play_id"}` — claimed. Continue to step 4
  with this pair.

## 4. Fetch the build spec

`GET https://appy.fyi/api/build_spec/<origin_play_id>` (the incumbent's
play_id from step 2 or 3), same Bearer header. Responses:
- `403 {"error": "not_owner"}` — the claim from step 2/3 isn't actually in
  place for this account; don't retry silently, surface this to the user.
- `404` — no Tier A build spec exists yet for this incumbent (matches
  `build_spec_available: false` from step 2).
- `200` — the build spec JSON itself, no wrapper.

Save the response body verbatim to `<origin_play_id>-build-spec.json` in the
current directory — same filename shape and content the website's "Download
build spec" link produces.

## 5. Build

Hand off into this plugin's `build-from-spec` skill using the file just
written, starting at its §0.
