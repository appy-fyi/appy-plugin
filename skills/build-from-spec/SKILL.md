---
name: build-from-spec
description: Build a complete native Android app end-to-end from a self-contained build-spec.json (the format appy.fyi's /report/:play_id/build-spec.json download produces). Use when the user has dropped a *-build-spec.json file into this project and wants Claude Code to build the app it describes — scaffolds the Gradle/Compose project, implements every screen/feature/data-model entity exactly as specified, writes the test_plan as real tests, generates a deterministic launcher icon, writes a README.md disclosing the named incumbent app this is an alternative to (and whether that incumbent is itself open source), wires in the Google Play In-App Review and Play Integrity client APIs, and — once the developer has completed the one-time Play Console/Cloud setup this skill walks them through step by step — calls the Google Play Developer API itself to upload the build to internal testing and create the billing product(s). It still stops cleanly at the true human-only gates (trademark clearance, privacy-claim verification, Play Console account creation/content declarations, and promotion to production) instead of guessing past them.
allowed-tools: Bash(bun ${CLAUDE_PLUGIN_ROOT}/scripts/genLauncherIcon.ts *)
---

This project has no relationship to appy.fyi — the build-spec.json it was
handed is the *entire* brief. Don't assume any other context exists. Read it
once, completely, before writing a single file, and treat every field as a
hard constraint, not a suggestion: this document was deliberately written so
you never have to guess a version number, invent an algorithm, or ask a
clarifying question. If something really is ambiguous even after re-reading
the spec, that's a gap in the spec, not something to paper over — stop and
say so rather than inventing scope.

## 0. Find and read the spec

Look for a single `*-build-spec.json` file in the project root (or wherever
the user points you) — dropped in by hand from the website, or already
fetched for you by this plugin's own `/build` command. Read the whole file
before doing anything else — don't start scaffolding off a partial read. If
more than one matches, ask which. The incumbent's play_id is
`original_app.play_id` in the JSON itself (not something to parse from the
filename, which varies depending on how the file was obtained) — this is the
`<play_id>` used below as `origin_play_id` in the `ownership` call and the
three GET endpoints. §8's confirmation links use `package_id` (this app's
own id) instead.

The JSON has this shape (all fields always present):

- `project_context` — a fixed disclaimer: this spec describes an
  independent, alternative app competing with an incumbent Play Store app,
  not a modification, clone, or reskin of the incumbent's own code or
  branding. Treat the incumbent purely as a market reference.
- `api_access` — `base_url` plus eight endpoints, each already a full URL
  for this specific app, except that `endpoints.privacy_policy`,
  `endpoints.app_page`, `endpoints.app_page_icon`, and
  `endpoints.app_page_screenshot` end in a literal `:user_play_id`
  placeholder — replace every one of those with `package_id` (this app's own
  id), never with the incumbent's `<play_id>` from §0. `instructions` says
  how to call them: send `Authorization: Bearer <key>` using the
  `APPY_API_KEY` environment variable if it's set. Call `endpoints.ownership`
  FIRST — `POST` JSON `{"origin_play_id": "<play_id>", "user_play_id":
  package_id}` — this permanently claims that pair for the signed-in account
  (max 2 claims per account, and `user_play_id` can never change once
  claimed); every other endpoint below 403s until this succeeds. If
  `APPY_API_KEY` isn't set, or this call 401s/403s, skip every remaining
  endpoint below and proceed with the rest of the spec — the whole block,
  ownership included, is enrichment, never a build blocker. Otherwise, three
  (`endpoints.app_info`, `endpoints.reviews`, `endpoints.app_photos`) are GET,
  optional live enrichment beyond the static report data baked into the rest
  of this spec, scoped to the incumbent (`<play_id>`). In particular,
  `endpoints.app_photos` returns CDN URLs for the incumbent's own Play Store
  screenshots — worth fetching for visual/UX inspiration (layout, information
  density, what the current app actually looks like) before designing
  `design_system` and `screens[]`, since the report's prose alone doesn't
  convey that. The other four — `endpoints.privacy_policy`,
  `endpoints.app_page`, `endpoints.app_page_icon`, and
  `endpoints.app_page_screenshot` — are POSTs, scoped to `package_id` (this
  app, not the incumbent), all used at the very end of the build, in §8.
- `original_app` — the incumbent's static identity: `name`, `play_id`
  (§0's `<play_id>`), `play_store_url`, `report_url`, and optionally
  `category`/`price_trend` if appy.fyi has that data on file. Always
  present, independent of whether any `api_access` call was ever made — this
  is what §6's `README.md` names and links.
- `working_name`, `package_id`, `positioning`, `non_goals[]` — what to build
  and its explicit scope boundary. `trademark_cleared: false` always — see
  §8.
- `tech_stack` — `kotlin_version`, `compose_bom_version`, `gradle_version`,
  and `libraries[]` (`purpose`, `gradle_coordinate`) — pinned, real versions.
  Use exactly these, don't substitute "latest."
- `design_system` — literal hex colors and typography; don't invent a
  palette. `icon_name` names the launcher-icon glyph (see §5) — don't
  second-guess it.
- `min_sdk`, `target_sdk`, `permissions[]` — the manifest's permission list
  is a ceiling, not a floor: never add a permission not listed here, no
  matter how convenient.
- `screens[]` — every screen (`name`, `route`, `purpose`, `key_ui_elements`,
  `states`, `entry_points`). This is the full Compose Navigation graph.
  Every listed `states` value (loading/empty/error/etc.) needs a real,
  visibly distinct UI state, not a single generic loading spinner reused
  everywhere.
- `data_model[]` — entities with typed `fields` (`name`, `type`, `notes`)
  and a `storage` of `room_local`, `firestore`, or `encrypted_local`.
- `features[]` — `implementation_notes` is the actual approach (specific API
  calls, algorithms, state machines); `acceptance_criteria` are the pass/fail
  bar; `screens[]` says which screens this feature touches.
- `backend` (`"none"` or `"firebase"`) and `ai.needed` — if both are the
  "nothing extra" case, don't add a backend or an AI API call anyway out of
  habit.
- `pricing` — `model` (`one_time`/`subscription`) and `billing_lib`
  (`play_billing_direct`/`revenuecat`). Build exactly this billing model,
  not whichever is more familiar.
- `store_listing` — listing copy plus `icon_prompt` (unused by this skill —
  see §5, the launcher icon is generated deterministically instead).
- `legal` — `data_collected[]`, `regulated_category`,
  `privacy_policy_url`, `privacy_policy_accurate: false` always.
- `test_plan[]` — `kind` (`unit`/`instrumented`/`manual`), `scenario`,
  `steps[]`, `expected` — steps are written to be transcribed directly into
  a test function.
- `build_instructions` — literal shell commands to build, test, and sign.
- `human_gates_required[]` — see §8.

## 1. Scaffold the project

Create a standard Gradle Android project: `settings.gradle.kts`, root and
`app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`. Set
`applicationId` to `package_id`, `minSdk`/`targetSdk` from the spec, and the
Kotlin/Compose BOM/Gradle versions from `tech_stack` exactly. Add every
`tech_stack.libraries[].gradle_coordinate` as a dependency and nothing else
speculative. Declare only `permissions[]` in the manifest.

## 2. Data layer

For each `data_model[]` entity: `room_local` → a Room `@Entity` + DAO with
the listed fields and types; `encrypted_local` → `EncryptedSharedPreferences`
(AndroidX Security) rather than Room, since it's flagged that way in the
spec on purpose (credentials/entitlements, not queryable app data);
`firestore` → a Firestore collection (only expected when `backend` is
`"firebase"`).

## 3. Screens and navigation

Build one Composable per `screens[]` entry, wired into a single Compose
Navigation graph keyed by `route`. Every entry in a screen's `states[]` needs
a real branch in that screen's UI — an agent-written app that collapses
`loading`/`error`/`empty` into one generic spinner has silently dropped part
of the spec. Cross-check `entry_points[]` against your navigation calls: if
the spec says a screen is reachable from three places, all three navigation
call sites need to exist.

## 4. Features

Implement each `features[]` entry by following its `implementation_notes`
literally — they're written as the actual approach (specific Android APIs,
algorithms, edge-case handling), not paraphrasable intent. After
implementing a feature, re-read its `acceptance_criteria` and confirm the
code actually satisfies each one before moving on, rather than assuming the
implementation covers them because it "seems right." Respect
`non_goals[]` as hard exclusions — don't build toward them even if a feature
would be easy to extend that direction.

Implement `pricing` via the specified `billing_lib` — Play Billing directly
for `one_time`, RevenueCat for `subscription` — and nothing else (no
speculative account system if `backend` is `"none"`).

## 5. Assets

The launcher icon is generated deterministically by this plugin's own
bundled script — run:

```
bun ${CLAUDE_PLUGIN_ROOT}/scripts/genLauncherIcon.ts <path-to-build-spec.json> app/src/main/res
```

against the spec you were handed. It reads `design_system.icon_name` (a
fixed glyph name from this plugin's bundled Phosphor icon set — see
`${CLAUDE_PLUGIN_ROOT}/assets/icons/phosphor-regular/`, MIT licensed) and
`color_primary_hex`, and writes the full adaptive-icon resource set —
`drawable/ic_launcher_background.xml`, `drawable/ic_launcher_foreground.xml`,
`mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml` — straight into
the scaffolded project's `res/` tree. If `min_sdk` is below 26 (adaptive
icons require API 26+), add `--legacy` to also emit rasterized
`mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` fallbacks (this
needs the optional `sharp` npm dependency available in the environment
running the script — if it's missing or errors, fall back to the XML-only
adaptive icon and flag in your final report that legacy-density PNGs still
need generating). The non-legacy path has no dependencies beyond Bun itself
and never produces a placeholder — treat a failed/skipped run there as a
real bug to fix, not a gap to flag in the final report. `store_listing.
icon_prompt` is unused by this flow (kept in the schema for optional future
AI-generated icon experiments, not this skill's path).

Play listing screenshots are not produced by this skill — note that gap in
your final report. `api_access.endpoints.app_photos` (see above) is for
reference during design, not a source of assets to ship — per
`project_context`, this app's own icon and screenshots must be its own, not
the incumbent's.

If `sharp` is available, also call this plugin's exported
`genLegacyLauncherPngs(design_system)` (`${CLAUDE_PLUGIN_ROOT}/scripts/genLauncherIcon.ts`)
to get a flat, rasterized version of the same deterministic icon — its
`mipmap-xxxhdpi/ic_launcher.png` entry (192×192) is what §8 uploads as the
appy.fyi app_page's icon, regardless of whether this project's own `min_sdk`
needs the `--legacy` mipmaps for itself. If `sharp` errors or is missing,
skip the app_page icon upload in §8 the same way `--legacy` already
tolerates its absence — never treat it as a build blocker.

## 6. README.md — disclose the incumbent

Every app built from a spec is an alternative to a specific, named incumbent
(`original_app` — see §0), never an anonymous "competitor app." Write a
`README.md` in the project root that states this plainly, near the top:

- The app's own name (`working_name`) and one-line `positioning`.
- A named, linked disclosure: "`working_name` is an independent alternative
  to [`original_app.name`](`original_app.play_store_url`) — not affiliated
  with, endorsed by, or a modification of it." Link `original_app.report_url`
  too, as the market research this app's feature set was built from.
- Whether the incumbent itself is open source. Check this yourself — don't
  guess and don't leave it unstated. Search for `original_app.name` plus
  terms like "github", "source code", or "open source" (its Play Store
  listing description or developer website, if `api_access.endpoints.app_info`
  was reachable in §0, sometimes says so directly; otherwise a web search for
  the incumbent's own name is the next step). If you find a real public
  repository, name it and link it and say the incumbent is open source; if
  you find clear evidence it's closed-source (proprietary, no public repo
  after a real search), say that instead; if the search is genuinely
  inconclusive, say so honestly ("couldn't confirm whether the incumbent is
  open source") rather than asserting either way.
- The standard sections a new project needs anyway: what it does
  (`positioning` + a short feature list from `features[]`), `min_sdk`, how to
  build it (`build_instructions`), and current status (which
  `human_gates_required[]` are still open — see §8).

## 7. Play Store readiness (client-side, no gate)

Two Google Play client libraries get added to every app this skill builds,
regardless of whether `tech_stack.libraries[]` lists them — like the launcher
icon in §5, these are baseline infrastructure every Play Store app needs, not
app-specific scope, so treat them as exempt from §1's "nothing speculative"
rule rather than skipping them for not being named in the spec:

- **In-App Review API** (`com.google.android.play:review-ktx`) — resolve the
  current stable version from Google's Maven repo
  (`maven.google.com`/`dl.google.com/android/maven2`) at build time rather
  than trust a hardcoded number here, since this plugin file doesn't move on
  Google's release cadence. Wire a single `ReviewManagerFactory` helper and
  call it from one natural, positive pause point in the app's flow — e.g.
  right after a `features[]` entry's `acceptance_criteria` describes a
  successful completion of the app's core action, never on first launch or
  right after an error state. The real Play API is quota-limited server-side
  and doesn't guarantee the dialog actually shows even when requested — don't
  build any app logic that assumes it did.
- **Play Integrity API** (`com.google.android.play:integrity`) — only add
  this when `backend` is `"firebase"` **and** `pricing` is present (i.e.
  there's both a server to verify a token against and a purchased
  entitlement worth protecting). A client-only integrity check with no
  server-side verification is security theater — it adds surface without
  adding protection — so skip it entirely when `backend` is `"none"`, and say
  so in the final report rather than silently omitting it. When it applies:
  request an integrity token client-side right before granting the purchased
  entitlement, and verify it server-side in the same Firebase Cloud Function
  described in §8's Purchases API section, using the same service-account
  credentials set up there. Never decode or trust an integrity verdict
  on-device — that defeats the point of the API.

Note in the final report (§10) which of these two got added, and — if the
Integrity API was skipped because `backend` is `"none"` — say so explicitly
rather than leaving it unmentioned.

## 8. Stop at the human gates — don't build past them

`trademark_cleared: false` and `legal.privacy_policy_accurate: false` are
not placeholders waiting for a value you can fill in — they're two
checkpoints appy.fyi's build-spec pipeline deliberately leaves for a human.
Play Console account creation and its content declarations are a third —
see the walkthrough below. Uploading a build to internal testing and
creating the billing product(s), however, are *not* human-only anymore:
once the developer has completed that walkthrough's one-time manual setup,
you call the Google Play Developer API yourself for those. Concretely, that
means:

- Write the code, write a real Room/EncryptedSharedPreferences
  implementation, write a real privacy policy *page* using
  `legal.data_collected`/`legal.privacy_policy_url` as the draft — but don't
  assert anywhere in your final report that the name is trademark-clear or
  that the privacy claim has been verified. Those are still open.
  If `APPY_API_KEY` is set and the `ownership` claim from §0 succeeded, also
  `POST` the drafted policy text as the raw request body to
  `api_access.endpoints.privacy_policy` (with `package_id` substituted for
  its `:user_play_id` placeholder) — unlike the three GET endpoints above,
  this one needs the same real appy.fyi account whose key claimed ownership
  in §0. On success, use the response's `url` field — a real, publicly
  reachable page — as this app's actual privacy policy link (store listing,
  in-app settings, manifest metadata) instead of the unhosted
  `legal.privacy_policy_url` suggestion. Then, in your final report, also
  give the user the live confirmation page —
  `https://appy.fyi/privacy/<package_id>`, using `package_id` (this app's own
  id, not the incumbent's `<play_id>` from §0) — and say so explicitly as a
  human-gate item: the upload isn't confirmed until the user has opened that
  URL and checked the page actually reads correctly, not just that the POST
  returned 200. A `413` means the text is over the size cap — shorten it,
  don't retry as-is. A `403` means `ownership` was never actually claimed
  (an integration key was used, or the §0 call 401s/403s/failed) — fall back
  to leaving `legal.privacy_policy_url` as the placeholder and flag this in
  your final report. Either way this is enrichment on top of a policy you've
  already drafted locally, never a build blocker: if `APPY_API_KEY` isn't
  set or the call fails for any other reason, proceed with the local draft
  and the unhosted placeholder URL, same as skipping the GET endpoints above.
- If `APPY_API_KEY` is set and the `ownership` claim from §0 succeeded, also
  publish this app's own appy.fyi app_page — a Google-Play-style page,
  hosted on appy.fyi, for apps built with appy.fyi.
  `POST` `{"name": working_name, "description": store_listing.long_description}`
  as JSON to `api_access.endpoints.app_page` (with `package_id` substituted
  for its `:user_play_id` placeholder); on success, `POST` the rasterized
  icon PNG from §5 (if `sharp` was available) as the raw body to
  `api_access.endpoints.app_page_icon` (same substitution) with
  `Content-Type: image/png`. A `403` here means the same thing as the
  privacy policy upload above — `ownership` was never actually claimed —
  stop and flag it in your final report rather than retrying. Screenshot
  upload (`api_access.endpoints.app_page_screenshot`) is skipped by default,
  since this skill doesn't produce real in-app screenshots (see the gap
  noted in §5) — note in your final report that the user can add up to 5
  screenshots later themselves by POSTing image bytes to
  `<endpoints.app_page_screenshot>/1` through `/5` (same `package_id`
  substitution). This whole step is enrichment on top of the app you've
  already built, never a build blocker — skip it entirely if `APPY_API_KEY`
  isn't set or `ownership` wasn't claimed.
- Generate a local debug/upload keystore for `build_instructions` to run
  against (that's a disposable local artifact, fine to create), but flag the
  placeholder store/key passwords in `build_instructions` as needing to be
  replaced with real secrets before any real release — don't silently ship
  the sample password.

### Google Play Developer API: manual setup, then automated publishing

Creating the Play Console account itself, creating the app shell, and
answering Play's content declarations cannot be done by an agent — they
require a human to pass identity verification, accept legal declarations,
and pay a one-time fee. Everything past that point — uploading the build to
internal testing, writing the store listing, and creating billing
product(s) — you can and should do yourself via the Google Play Developer
API (`androidpublisher` v3), once the developer hands you working
credentials. Walk the developer through this exactly once, step by step,
before touching any of it — don't assume they already know these steps:

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
   `https://appy.fyi/privacy/<package_id>` if that upload above succeeded,
   otherwise `legal.privacy_policy_url`), an ads declaration, the content
   rating questionnaire (IARC — you may draft suggested answers from
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
   one you publish yourself, steps 4 onward (and this whole subsection)
   simply don't apply — that's a normal, complete outcome too, not a
   shortcut you took.

Once you have a working credential and step 3's declarations are complete,
use it (the `googleapis` npm package's `androidpublisher` v3 client, or
equivalent direct REST calls with a signed JWT) to:

- `edits.insert` → open an edit.
- `edits.bundles.upload` → upload the signed `.aab` `build_instructions`
  produces.
- `edits.tracks.update` → assign the uploaded version code to the
  **`internal`** testing track only. Never target `production`, `beta`, or
  any other track — promoting past internal testing is a real-users,
  real-money, real-store-presence action, so it stays a human decision, the
  same way trademark clearance and the privacy claim do. State this
  explicitly in your final report rather than letting silence imply you went
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
  final report so the developer (or you, next time) can find it again. If
  `pricing.billing_lib` is `revenuecat` instead, skip this entirely —
  RevenueCat manages its own product catalog through its own dashboard, not
  through this API.

A `403` on any of these calls means the service account either isn't
linked, wasn't granted the right permission, or is still pending Owner
approval — stop, don't retry blindly, and tell the developer which of step
6/7 to re-check.

### Purchases API: server-side entitlement verification

Only applies when `backend` is `"firebase"` **and** `pricing.billing_lib`
is `play_billing_direct` — when `billing_lib` is `revenuecat`, its own
backend already verifies purchases server-side; don't duplicate that.

Trusting a client-reported purchase is unsafe — implement a Firebase Cloud
Function (HTTPS callable) that receives the purchase token and product ID
after a purchase completes, then calls `purchases.products.get`
(`pricing.model === "one_time"`) or `purchases.subscriptionsv2.get`
(`pricing.model === "subscription"`) against the Google Play Developer API
before writing the entitlement to Firestore — never grant the entitlement
from the client-reported result alone. You can reuse the same service
account from the Publishing API walkthrough above if the developer only
wants to manage one, but least-privilege is better here: have them create a
second service account scoped to just financial-data/order permissions,
with no release-management grant, since this function never needs to touch
a release. Store whichever key this function uses as a Firebase Functions
secret (`firebase functions:secrets:set`), never inline in source or
committed to the repo. This is also the verification step §7's Play
Integrity paragraph hooks into when that API is in play.

- `human_gates_required[]` in the spec lists which of these still apply —
  echo them back in your final report as the open items, don't resolve them
  yourself.

## 9. Verify

Run `build_instructions` (or the equivalent up through the test tasks — skip
the signing/`bundleRelease` step unless the user asks for a signed build) if
an Android SDK/emulator toolchain is available in this environment. If it
isn't, say so explicitly rather than reporting untested code as passing —
"builds and tests pass" is a claim you need to have actually run, not
inferred from the code looking right.

## 10. Final report

Summarize: what got built (screens/features/tests), what `build_instructions`
actually did or didn't run and why, whether §6's `README.md` got written and
what it concluded about the incumbent's open-source status, the screenshot
gap from §5, which of §7's In-App Review / Play Integrity APIs got added
(and why Integrity was skipped,
if it was), and the open `human_gates_required[]` items from §8 as an
explicit checklist — not a buried caveat. If §8's Google Play Developer API
walkthrough got as far as an internal-testing upload, state that plainly
(track = internal, never further) along with the billing product ID if one
was created; if the developer hasn't finished §8's steps 1–3 yet, list
exactly which of those remain instead of a generic "publishing is manual"
note. If the privacy policy upload in §8 succeeded, include the
`https://appy.fyi/privacy/<package_id>` confirmation link in that checklist too,
so the user has a concrete next action instead of just being told it's
"uploaded." If the app_page upload in §8 succeeded, include its response
`url` too, and remind the user the screenshot slots are still empty and up
to them to fill in.
