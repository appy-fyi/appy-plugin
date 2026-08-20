---
name: build-from-spec
description: Build a complete native Android app end-to-end from a self-contained build-spec.json (the format appy.fyi's /report/:play_id/build-spec.json download produces). Use when the user has dropped a *-build-spec.json file into this project and wants Claude Code to build the app it describes — scaffolds the Gradle/Compose project, implements every screen/feature/data-model entity exactly as specified, writes the test_plan as real tests, generates a deterministic launcher icon, and stops cleanly at the human-only gates (trademark clearance, privacy-claim verification, Play Console publishing) instead of guessing past them.
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
the user points you). Read the whole file before doing anything else — don't
start scaffolding off a partial read. If more than one matches, ask which.

The JSON has this shape (all fields always present):

- `project_context` — a fixed disclaimer: this spec describes an
  independent, alternative app competing with an incumbent Play Store app,
  not a modification, clone, or reskin of the incumbent's own code or
  branding. Treat the incumbent purely as a market reference.
- `api_access` — optional, live enrichment beyond the static report data
  baked into the rest of this spec. `base_url` plus three GET endpoints
  (`endpoints.app_info`, `endpoints.reviews`, `endpoints.app_photos`), each
  already a full URL for this specific app — nothing to template yourself.
  `instructions` says how to call them: send `Authorization: Bearer <key>`
  using the `APPY_API_KEY` environment variable if it's set. In particular,
  `endpoints.app_photos` returns CDN URLs for the incumbent's own Play Store
  screenshots — worth fetching for visual/UX inspiration (layout, information
  density, what the current app actually looks like) before designing
  `design_system` and `screens[]`, since the report's prose alone doesn't
  convey that. If `APPY_API_KEY` isn't set, or a call 401s, skip `api_access`
  entirely and proceed with the rest of the spec — it's enrichment, never a
  blocker.
- `working_name`, `package_id`, `positioning`, `non_goals[]` — what to build
  and its explicit scope boundary. `trademark_cleared: false` always — see
  §6.
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
- `human_gates_required[]` — see §6.

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

## 6. Stop at the human gates — don't build past them

`trademark_cleared: false` and `legal.privacy_policy_accurate: false` are
not placeholders waiting for a value you can fill in — they're the two
checkpoints appy.fyi's build-spec pipeline deliberately leaves for a human.
Concretely, that means:

- Write the code, write a real Room/EncryptedSharedPreferences
  implementation, write a real privacy policy *page* using
  `legal.data_collected`/`legal.privacy_policy_url` as the draft — but don't
  assert anywhere in your final report that the name is trademark-clear or
  that the privacy claim has been verified. Those are still open.
- Generate a local debug/upload keystore for `build_instructions` to run
  against (that's a disposable local artifact, fine to create), but flag the
  placeholder store/key passwords in `build_instructions` as needing to be
  replaced with real secrets before any real release — don't silently ship
  the sample password.
- Do **not** attempt to create a Play Console account, register the app,
  configure billing products, or upload anything anywhere. That whole
  category of action is out of scope for this skill regardless of how far
  the CLI tooling could technically go.
- `human_gates_required[]` in the spec lists which of these still apply —
  echo them back in your final report as the open items, don't resolve them
  yourself.

## 7. Verify

Run `build_instructions` (or the equivalent up through the test tasks — skip
the signing/`bundleRelease` step unless the user asks for a signed build) if
an Android SDK/emulator toolchain is available in this environment. If it
isn't, say so explicitly rather than reporting untested code as passing —
"builds and tests pass" is a claim you need to have actually run, not
inferred from the code looking right.

## 8. Final report

Summarize: what got built (screens/features/tests), what `build_instructions`
actually did or didn't run and why, the screenshot gap from §5, and the
open `human_gates_required[]` items from §6 as an explicit checklist — not a
buried caveat.
