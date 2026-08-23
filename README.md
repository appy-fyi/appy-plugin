# appy

> This repo is auto-published from the `plugin/` folder of appy.fyi's
> private repo on every push to `main`. Don't edit files here directly —
> edit `plugin/` in appy.fyi instead, or changes will be overwritten on the
> next sync.

A [Claude Code](https://claude.com/claude-code) plugin (formerly
`build-from-spec-plugin`) that builds a complete native Android app
end-to-end from a self-contained `build-spec.json` — the format
[appy.fyi](https://appy.fyi)'s `/report/:play_id/build-spec.json` download
produces.

Designed to run from a shared apps folder (e.g. `~/apps`) as much as from a
single project directory — `/appy:build` gives each app its own subfolder
(named after its `package_id`) and can fetch and build several apps **in
parallel**, one subfolder each, in a single call. Inside a shared folder,
`.env`, the aggregating `Taskfile.yml`, and `service-account.json` live once
at the folder root rather than duplicated in every app's subfolder — see the
`appy` skill's §1 and `/appy:publish` for the exact rules.

Bundles:
- The `/appy:list` command — lists the apps your appy.fyi account has
  already claimed and how many claims are left. Claiming a *new* one happens
  on appy.fyi itself now — sign in, open the report page for the app you
  want to clone, and click "Build this."
- The `/appy:build` command — fetches one or more claimed apps' build specs
  straight from the appy.fyi API (no manual download needed), each into its
  own subfolder, and hands off into the skill below for each — building them
  concurrently when more than one is requested. Pass the incumbent's
  `origin_play_id` as an argument (space/comma-separated for several), or
  run it bare and it'll walk you through `/appy:list` first.
- The `/appy:readme` command — (re)writes just this project's `README.md`
  from its build spec, on its own, without repeating any other build step.
- The `/appy:init` command — backfills `Taskfile.yml` and/or `.env` into a
  project that's missing either (predates them, or a fresh clone that
  correctly gitignored `.env`), asking for your `APPY_API_KEY` if needed —
  on its own, without repeating any other build step.
- The `/appy:publish` command — walks the developer through the one-time
  Play Console/Cloud setup (if not already done) and then, via the Google
  Play Developer API itself, uploads the build to internal testing, pushes
  the store listing, and creates the billing product(s) — on its own,
  without repeating any other build step, so it also works to push a fresh
  build later after code changes.
- The `appy` skill — scaffolds the Gradle/Compose project, writes a
  `Taskfile.yml` with named commands (`task build`/`test`/`install`/
  `release`/`clean`) to manage it via the [Task](https://taskfile.dev)
  runner plus dotenv-backed `task api-*` commands that call every appy.fyi
  API endpoint directly via `curl` (no agent invocation needed), implements
  every screen/feature/data-model entity exactly as specified, writes the
  test plan as real tests, writes a README.md (via `/appy:readme` above)
  that names the incumbent app this is an alternative to and states
  whether that incumbent is itself open source, wires in the Google Play
  In-App Review and Play Integrity client APIs, and — via `/appy:publish`
  above — uses the Google Play Developer API itself to upload the build to
  internal testing and create the billing product(s). It still stops
  cleanly at the true human-only gates (trademark clearance, privacy-claim
  verification, Play Console account creation/content declarations, and
  promotion to production).
- `scripts/genLauncherIcon.ts` — deterministic Android adaptive-icon
  generation from the spec's `design_system` tokens. No AI image-gen tool
  required, no placeholder ever shipped. The default (API 26+) path has zero
  dependencies beyond Bun; `--legacy` (for `minSdk < 26`) needs the optional
  `sharp` dependency (`bun add sharp` in this plugin's directory) to
  rasterize legacy-density PNGs.
- `assets/icons/phosphor-regular/` — the [Phosphor Icons](https://phosphoricons.com)
  "regular" weight (MIT licensed), vendored so icon generation works fully
  offline.

## Install

```
/plugin marketplace add appy-fyi/appy-plugin
/plugin install appy@appy
```

## Use

Haven't claimed an app yet? Sign in on `https://appy.fyi`, open the report
page for the app you want to clone, and click "Build this" — that's the only
way to claim one; this plugin can't do it for you. It gives you the exact
commands to run next, the same ones under Install above plus `/appy:build
<origin_play_id>`.

Already claimed something? Run `/appy:list` to see it, then `/appy:build
<origin_play_id>` to fetch its spec and build it — or just run `/appy:build`
bare and it'll list your claims first. Building more than one claimed app?
Pass all their `origin_play_id`s to one `/appy:build` call and it builds
them at the same time, each in its own subfolder under wherever you ran the
command from (e.g. `~/apps/com.example.myapp/`). Prefer to do it by hand?
Drop a `*-build-spec.json` file (downloaded from an appy.fyi report page)
into your project instead and ask Claude Code to build it. Either way,
`skills/appy/SKILL.md` is what actually builds the app, scoped to
whichever subfolder it's handed. Once a project exists, `/appy:readme`
regenerates just its `README.md` on its own, `/appy:publish` walks
through Play Console/Cloud setup and uploads the build to internal testing,
and `/appy:init` backfills `Taskfile.yml`/`.env` if either is missing —
all three on their own, without repeating any other build step.

## License

MIT — see `LICENSE`. The vendored icon set under
`assets/icons/phosphor-regular/` carries its own MIT license from Phosphor
Icons — see `assets/icons/phosphor-regular/LICENSE`.
