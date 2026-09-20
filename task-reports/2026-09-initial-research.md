# basidekick: initial research and direction

Research date: September 12, 2026. Target: Niagara 4.15.

Current implementation status is recorded in the [September 13 follow-up](2026-09-followup-implementation.md). The ranking below records the research decisions before that implementation.

## Recommendation

Start with navigation, saved operator charts, and a reliable operations dashboard. Then add a small set of commissioning and troubleshooting components. AX Community is a useful catalogue of recurring engineering problems, but its age and download totals do not establish which individual tools are most requested today. The rankings below are recommendations based on the installed module, publicly visible activity, current Niagara features, and this project's requested scope. They are not a September 2026 demand survey.

## Evidence

- The supplied AX Community RT, WB, UX and documentation JARs identify version `22.02.01.01.0`, release date January 24, 2022. Its palette includes navigation, logic, conversion, history analysis, engineering helpers, and older weather/file/HTTP tools. The [local inventory](axcommunity-inventory.md) records exact names and hashes.
- [SourceForge's project page](https://sourceforge.net/projects/niagaraaxcommun/) lists its last update as February 16, 2022 and the project license as GPLv2. Its catalogue remains accessible; the source-tree URL could not be opened in this research pass.
- [NiagaraMods' release listing](https://niagaramodules.com/exchange/niagaramods/ax-community-module/files) identifies the signed R250 distribution from March 7, 2022. The page observed during research showed roughly 10,000 downloads. This is evidence of continued use of the package, not component-level popularity or recent downloads alone.
- [Tridium's feature timeline](https://www.tridium.com/us/en/Learn/about-us/niagara-timeline) identifies new elementary kitControl blocks and additional HTML5 views in Niagara 4.15. Check the platform palette before introducing another general-purpose logic component. Target this project at N4.15; a later Niagara 5 port should be a separate compatibility effort.

## Revised candidate shortlist

The [candidate evaluation](2026-09-candidate-evaluation.md) supersedes the original Next/Later ranking after checking overlap with the installed Niagara 4.15 tools.

| Decision | Direction | Reason |
|---|---|---|
| Initial | Native navigation, saved charts, Operations Dashboard | Existing requested scope; Niagara runtime validation remains outstanding. |
| Recommended next | Point Summary combining BqlNumericRecap and variable-input AvgMinMax ideas | One reusable current-value summary with quality counts, compatible units and min/max point identity. Native MinMaxAvg already covers 2 to 10 inputs. |
| Recommended next | Improve diagnostics inside saved Trends | Native rollup/export services already exist. Make period statistics, gaps and comparisons easier to use; do not create another history engine. |
| Combine into dashboard | Audit-backed Recent Changes | Native audit records already include actor and before/after fields. Avoid four replacement writable types. |
| Conditional | Equipment Proof | Only worthwhile for directional start/stop timing and diagnostic states beyond ordinary native command-failure alarms. |
| Later, conditional | Manual Link Planner | Guided repeated-equipment mapping may add value. AX BatchLinkCreator already has dry run; Niagara has Batch/Robot editors. Defer automatic runtime DynamicLinks. |
| Remove generic versions | Scale and converter pack | Substantial overlap with native Reset, Line, Limiter and converters. Require a demonstrated gap for any addition. |
| Defer | Live smoother and since-reset peak monitor | Separate workflows needing concrete use cases, not a combined statistics/filtering component. |

Defer the legacy HTTP, weather, arbitrary file-writing and duplicate thermostat blocks. Their maintenance and behavioral scope are disproportionate to the initial operator-tool release. This is prioritization, not a claim that every legacy implementation is defective.

## Palette taxonomy

The palette describes the task, not the runtime profile or rendering technology. Avoid a miscellaneous catch-all and avoid a top-level “UX Media” folder.

| Category | Initial content | Future additions |
|---|---|---|
| Graphics / Icons | Existing qagraphics icon families and styles, unchanged | Only genuinely reusable visual elements |
| Navigation | Dropdown, Navigation Menu, Navigation Item | Breadcrumbs, grouped navigation, page selectors |
| Operations | Operations Dashboard | Focused diagnostic views |
| Histories | Chart Library; saved chart records are created through the UI | History comparison and export workflows within Trends |
| Diagnostics | Conditional future category, not an empty palette folder | Point Summary; Equipment Proof only if justified |
| Schedules | Dashboard tab initially | Dedicated tools only when platform views leave a clear gap |
| Signal Processing | Conditional future category | One live smoother only for a demonstrated need |
| Engineering | Reserved in the roadmap | Bulk-link and commissioning tools |

Keep native widgets in WB, station data/configuration in RT, browser assets and RPC adapters in UX. Do not put runtime configuration in WB or require UX Media to use a native PX widget.

## Initial implementation decisions

- Reuse the qagraphics icons and dashboard under basidekick's module/package namespace. Preserve all 109 actual SVG files byte-for-byte; filesystem metadata sidecars are not icon assets. No qagraphics runtime dependency.
- No AX Community implementation or binary was imported. Its palette and documentation were research inputs. No qagraphics dropdown implementation was copied.
- Operations Dashboard remains a `workbench:WebWidget` with a basidekick JavaScript provider. This uses Niagara's embedded browser in Workbench and its standard Hx web widget host.
- Shared charts live under an explicitly configured `ChartLibrary` component. The default ORD is `station:|slot:/Services/BasidekickCharts`. No automatic station mutation creates the library. Chart edits require admin-write permission on the library and edited record; reading respects category permissions. The library can be placed elsewhere and the widget ORD changed.
- Saved setup contains title, time range, ordered history ORDs, colors and labels. It stores no history samples. Save as new and delete are explicit. Concurrent edits made through the RPC compare revisions before writing.
- The dropdown is a new native `BButton` subclass plus an Hx renderer, sharing ordered runtime menu items. The native face is rounded and neutral; web uses a styled accessible HTML select. Workbench menus and browser option popups use their platform controls, so they are not pixel-identical.
- The schedule calendar is explicitly a regular-week preview. It shows the live `out` value and output source, counts exceptions, and opens Niagara's full scheduler for holidays, exceptions and effective dates. It does not implement a second scheduling engine or claim to show an effective dated calendar.

## Release position

This is source under development, not a compiled or station-tested release. The parent build currently points at N4.15.1.16, while the supplied comparison JARs are from N4.15.3.28. Both API sets should remain compatible with the chosen target; no parent build configuration was changed.

The user has not selected a basidekick release license in this task. Preserve qagraphics attribution and choose the license before public release. AX Community is listed as GPLv2; any future source reuse needs its exact file provenance and license notices recorded rather than relabeling copied code.
