# Phosphor Icons — regular weight

Vendored from `@phosphor-icons/core@2.1.1` (https://github.com/phosphor-icons/phosphor-core),
`assets/regular/*.svg` only. MIT licensed — see `LICENSE` in this directory.

Each file is a single `<path>` on a `0 0 256 256` viewBox with `fill="currentColor"`,
named after the icon (e.g. `shopping-bag.svg`). Read by `../../../scripts/genLauncherIcon.ts`
to generate deterministic Android adaptive-icon foreground layers.

This set is this plugin's source of truth for valid icon names. Consumers
that need to constrain a choice to this set ahead of time (e.g. appy.fyi's
own build-spec generator, which asks an LLM to pick one) mirror the file
list into their own manifest — keep that mirror in sync by hand if this set
ever changes.
