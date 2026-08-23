# build-from-spec-plugin

A [Claude Code](https://claude.com/claude-code) plugin that builds a complete
native Android app end-to-end from a self-contained `build-spec.json` — the
format [appy.fyi](https://appy.fyi)'s `/report/:play_id/build-spec.json`
download produces.

Bundles:
- The `/build` command — lists the apps your appy.fyi account has already
  claimed (or helps you claim a new one, up to 2 total), fetches its build
  spec straight from the appy.fyi API, and hands off into the skill below.
  No manual download needed.
- The `build-from-spec` skill — scaffolds the Gradle/Compose project,
  implements every screen/feature/data-model entity exactly as specified,
  writes the test plan as real tests, writes a README.md that names the
  incumbent app this is an alternative to and states whether that incumbent
  is itself open source, wires in the Google Play In-App Review and Play
  Integrity client APIs, and — once the developer has completed the one-time
  Play Console/Cloud setup the skill walks them through step by step — uses
  the Google Play Developer API itself to upload the build to internal
  testing and create the billing product(s). It still stops cleanly at the
  true human-only gates (trademark clearance, privacy-claim verification,
  Play Console account creation/content declarations, and promotion to
  production).
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
/plugin marketplace add appy-fyi/build-from-spec-plugin
/plugin install build-from-spec-plugin@build-from-spec-plugin
```

## Use

Run `/build` and follow the prompts — it lists your claimed apps, lets you
pick or claim one, and fetches the build spec for you (see
`commands/build.md`). Prefer to do it by hand? Drop a `*-build-spec.json`
file (downloaded from an appy.fyi report page) into your project instead and
ask Claude Code to build it. Either way, `skills/build-from-spec/SKILL.md`
is what actually builds the app.

## License

MIT — see `LICENSE`. The vendored icon set under
`assets/icons/phosphor-regular/` carries its own MIT license from Phosphor
Icons — see `assets/icons/phosphor-regular/LICENSE`.
