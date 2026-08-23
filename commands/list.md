---
description: List your appy.fyi claimed apps.
---

Entry point for browsing what this appy.fyi account has already claimed.
This command only lists — it can't claim anything new (that's a website-only
action now, see step 3) and it doesn't fetch a build spec or build anything.
Once you know which app you want, run this plugin's `/build <origin_play_id>`
command next.

## 1. Check for a key

Read the `APPY_API_KEY` environment variable. If it's unset, tell the user to
sign in at `https://appy.fyi/profile` with Google, generate a key there
(free, self-serve, no waiting — one active key per account), set
`APPY_API_KEY` to it, and re-run this command. The key is required here —
without it there is nothing to list.

## 2. List claimed apps

`GET https://appy.fyi/api/ownerships` with header `Authorization: Bearer
$APPY_API_KEY`. A `403 {"error": "user_required"}` means the key is an
integration key, not a self-served one — tell the user to use the key from
their own `/profile` page instead.

The response is a JSON array of `{origin_play_id, user_play_id,
build_spec_available, build_spec_url}`. Present every entry with
`build_spec_available: true` as a numbered list — show both `origin_play_id`
(the incumbent being cloned) and `user_play_id` (the app id appy.fyi
generated for this account, `fyi.appy.<app_name>.<username>`) — and let the
user pick one. Mention entries with `build_spec_available: false` too, but
note they can't be built from yet (the claim exists; appy.fyi hasn't
generated a Tier A build spec for that incumbent). An empty array means
nothing is claimed yet — go straight to step 3.

Once the user has picked an `origin_play_id`, tell them to run `/build
<origin_play_id>` to fetch its spec and build it — each app `/build` fetches
gets its own subfolder (named after its `package_id`), so this is safe to run
from a shared apps root that holds several apps at once. If more than one
entry here has `build_spec_available: true` and the user wants more than one,
they can pass several `origin_play_id`s to a single `/build` call and it'll
build all of them in parallel, one subfolder each — see `commands/build.md`.

## 3. Claiming a new app happens on the website, not here

This plugin can only read an app your account has *already* claimed — it has
no way to create a new claim. If the user wants to build something not in
the list above: they first need to find an app to clone by browsing
`https://appy.fyi` (report pages, `/search`, `/top`, `/movers`), then, while
signed in on that app's report page (`https://appy.fyi/report/<play_id>`),
click the "Build this" button. That claims it (appy.fyi generates the new
app's id itself — `fyi.appy.<app_name>.<username>`, no package-id choice to
make) and shows the exact `/plugin`/`/build` commands to run next, the same
ones this plugin's own README documents. An account can claim at most 2 apps
total, ever, and a claim can never be undone — the website button already
enforces both; there's nothing more to confirm here. Once they've clicked it,
re-run this command (or just `/build <origin_play_id>` directly) — the new
claim will show up.
