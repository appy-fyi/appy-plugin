---
description: Walk the developer through the one-time Play Console/Cloud setup (if not already done) and publish this project's build to Google Play's internal testing track via the Google Play Developer API, without repeating any other build step.
---

Standalone entry point for publishing an already-built project — the part
of `appy`'s §8 that isn't a human-only gate. Useful on its own
when the developer wasn't ready with Play Console credentials during the
original build (skip straight to step 2 once they are), or to push a fresh
internal-testing build and/or store listing after later code changes,
without re-running the whole build. The `appy` skill also runs
these exact steps itself, as its §8, during a full build.

## 1. Find and read the spec

Look for a single `*-build-spec.json` file in the project root (or wherever
the user points you). If more than one matches, ask which. This command
draws on `working_name`, `package_id`, `store_listing`, `pricing`, and
`human_gates_required[]`.

If run from a shared multi-app folder (one subfolder per app, e.g.
`~/apps/<package_id>/`, as `/appy:build` sets up) rather than from inside a
single app's own project root, ask which app's subfolder to target instead
of guessing — don't touch more than one app's release in a single run.

Confirm a signed, buildable app actually exists in this project already
(the output `build_instructions` produces) — this command publishes what's
already built, it doesn't build anything itself. If nothing's been built
yet, send the developer to `/appy:build` or the `appy` skill first.

## 2. One-time Play Console/Cloud setup

Creating the Play Console account itself, creating the app shell, and
answering Play's content declarations cannot be done by an agent — they
require a human to pass identity verification, accept legal declarations,
and pay a one-time fee. Everything past that point — uploading the build to
internal testing, writing the store listing, and creating billing
product(s) — you can and should do yourself via the Google Play Developer
API (`androidpublisher` v3), once the developer hands you working
credentials. Walk the developer through this exactly once, step by step,
before touching any of it — don't assume they already know these steps, and
skip whichever they confirm they've already done:

1. **Play Console account** (skip if they already have one). At
   `play.google.com/console/signup`, pay the one-time $25 registration fee
   and complete Google's identity verification (a person, or a D-U-N-S
   number for an organization) — this can take anywhere from minutes to a
   few days and is entirely out of your hands; tell the developer to come
   back once it's approved, and don't attempt any of the steps below until
   then.
2. **Create the app shell.** In Play Console, "Create app" → enter an app
   name, default language, "App" (not "Game"), and free/paid → accept the
   Developer Program Policies and US export laws declarations. The package
   name (`package_id`) itself gets locked in later, from the first bundle
   upload — it isn't typed in at this step.
3. **Required content declarations.** Play Console's "App content" section
   (the left-nav label has moved before and may move again — look for
   whatever section groups privacy policy, ads, content rating, target
   audience, and data safety, regardless of its current name). None of these
   are exposed by the Publishing API, so the developer must click through
   them by hand: privacy policy URL (use
   `https://appy.fyi/privacy/<package_id>` if that upload succeeded during
   the build, otherwise `legal.privacy_policy_url`), an ads declaration, the
   content rating questionnaire (IARC — you may draft suggested answers from
   `features[]` and `legal` for the developer to review, but they must
   submit it themselves, since it's a legal attestation), target audience,
   and the data safety form (populate from `legal.data_collected`). A
   release can't roll out to *any* track, including internal testing, until
   these are complete — if the developer hasn't finished them yet, say so
   and stop here rather than attempting an upload you know will fail.
4. **Link a Google Cloud project.** Play Console → Setup → API access → link
   an existing Google Cloud project, or let Play create one. Note which
   project it is — steps 5–6 happen inside it.
5. **Enable the API.** In that Cloud project's console
   (`console.cloud.google.com`) → APIs & Services → Library → search "Google
   Play Android Developer API" → Enable.
6. **Create a service account and key.** Same Cloud project → IAM & Admin →
   Service Accounts → Create Service Account (no project-level IAM role is
   needed) → open it → Keys tab → Add Key → Create new key → JSON. This
   downloads a credentials file — treat it as a secret from the moment it
   exists: never commit it, keep it outside this project's git tree (or add
   its exact filename to `.gitignore` if that's not possible), and never
   paste its contents into a file or message you might commit or log.
7. **Grant the service account Play Console permissions.** Back in Play
   Console → Setup → API access, find the new service account → "Manage
   Play Console permissions" → grant it release management for this app
   (testing tracks at minimum) and, if billing products will be created via
   API, product/order management too. An account Owner may need to approve
   this before it becomes active — if calls 403 later, this is the first
   thing to have the developer re-check.
8. **Hand you the credentials.** The developer points you at the downloaded
   JSON key — a file path, or an env var (e.g.
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`) holding one — and tells you to
   proceed. Until you have this, none of the steps below are possible, and
   if all the developer wants is a build you hand them directly instead of
   one you publish yourself, step 3 onward (and the rest of this command)
   simply don't apply — that's a normal, complete outcome too, not a
   shortcut you took.

## 3. Automated publish

Once you have a working credential and step 2.3's declarations are
complete, use it (the `googleapis` npm package's `androidpublisher` v3
client, or equivalent direct REST calls with a signed JWT) to:

- `edits.insert` → open an edit.
- `edits.bundles.upload` → upload the signed `.aab` `build_instructions`
  produces.
- `edits.tracks.update` → assign the uploaded version code to the
  **`internal`** testing track only. Never target `production`, `beta`, or
  any other track — promoting past internal testing is a real-users,
  real-money, real-store-presence action, so it stays a human decision, the
  same way trademark clearance and the privacy claim do. State this
  explicitly in your report rather than letting silence imply you went
  further.
- `edits.listings.update` → push `store_listing.title` /
  `short_description` / `long_description` for the app's default language.
- `edits.commit` → finalize the edit.
- If `pricing.billing_lib` is `play_billing_direct`: create the billing
  product with `inappproducts.insert` (`pricing.model === "one_time"`) or
  `monetization.subscriptions.create` (`pricing.model === "subscription"`),
  using `pricing.price_usd` as the default price (region `"US"`,
  auto-convert on for the rest). Use whatever product ID your Play Billing
  integration code actually references, and state that exact ID in your
  report so the developer (or you, next time) can find it again. If
  `pricing.billing_lib` is `revenuecat` instead, skip this entirely —
  RevenueCat manages its own product catalog through its own dashboard, not
  through this API.

A `403` on any of these calls means the service account either isn't
linked, wasn't granted the right permission, or is still pending Owner
approval — stop, don't retry blindly, and tell the developer which of step
2.6/2.7 to re-check.

## 4. Report

Tell the developer plainly what happened: if the upload succeeded, state the
track (internal, never further) and the billing product ID if one was
created; if step 2's setup isn't finished yet, list exactly which of its
numbered steps remain instead of a generic "publishing is manual" note.
Echo `human_gates_required[]` from the spec as the still-open items — don't
resolve them yourself.
