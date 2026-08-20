# build-from-spec-plugin

A [Claude Code](https://claude.com/claude-code) plugin that builds a complete
native Android app end-to-end from a self-contained `build-spec.json` — the
format [appy.fyi](https://appy.fyi)'s `/report/:play_id/build-spec.json`
download produces.

Bundles:
- The `build-from-spec` skill — scaffolds the Gradle/Compose project,
  implements every screen/feature/data-model entity exactly as specified,
  writes the test plan as real tests, and stops cleanly at the human-only
  gates (trademark clearance, privacy-claim verification, Play Console
  publishing).
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

Drop a `*-build-spec.json` file (downloaded from an appy.fyi report page)
into your project and ask Claude Code to build it. See
`skills/build-from-spec/SKILL.md` for exactly what happens.

## License

MIT — see `LICENSE`. The vendored icon set under
`assets/icons/phosphor-regular/` carries its own MIT license from Phosphor
Icons — see `assets/icons/phosphor-regular/LICENSE`.
