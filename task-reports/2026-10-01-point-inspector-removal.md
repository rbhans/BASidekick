# Point Inspector removal

October 1, 2026. The user asked to remove the Point Inspector everywhere. Value Card is removed with it: it was already taken out of registration on September 20, and opening the inspector was its only action.

## Removed

| Surface | Source |
|---|---|
| `Add Property > Point Inspector Binding` on every PX widget (agent on `bajaui:Widget`) | `ui/BPointInspectorBinding.java`, `ui/BHxPointInspectorBinding.java` |
| `InspectorWidget` view on every control point (agent on `control:ControlPoint`) | `ux/BInspectorWidget.java`, `rc/widgets/InspectorWidget.js` |
| Inspector drawer | `rc/widgets/InspectorPanel.js`, inspector CSS in `UiFoundation.js` |
| Value Card | `ux/BValueCardWidget.java`, `rc/widgets/ValueCard.js` |
| `DiagnosticsRpc.inspectPoint` (no remaining caller) | `BDiagnosticsRpc.java` |

Zone Deviation Matrix rows no longer open the drawer; the table is unchanged otherwise. The registrations, lexicon keys, README entry and the fixture/browser/static checks were updated to match. Older reports still describe the inspector as it was.

## Issue: removed types come back after a build

- **Symptom:** after the Sept 30 20:45 build, `basidekick-ux/module-include.xml` was rewritten. It had new formatting and a `<!--com.qagraphics.basidekick.ux-->` header, and it listed `ValueCardWidget` again even though commit `86f02ac` had deleted that line.
- **Cause:** the build regenerates `module-include.xml` from `@NiagaraType` classes. `BValueCardWidget.java` still existed, so it was re-registered.
- **Fix:** delete or de-annotate the class itself, not just its include line.
- **Verification:** pending the next user build. `module-include.xml` and `META-INF/module.xml` in the built jar should no longer list the removed types.

## Station impact

`stations/Dev` and `stations/Pine500BAS` (33 `.px` files plus `config.bog`) contain none of the removed types. On any other station, remove Point Inspector Bindings and Value Card / InspectorWidget WebWidgets from PX pages before installing this build. Otherwise those slots fail to decode as unknown types.

Static check (excluding the unreadable `../qagraphics` icon-parity section): 33 registered types, 79 manual slot contracts, XML/palette/JS pass. The Playwright `browser-check.cjs` was not re-run.
