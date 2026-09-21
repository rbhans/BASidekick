# basidekick

A Niagara 4.15 collection of practical operator widgets and engineering tools.

The source includes the qagraphics icon collection, an Operations Dashboard with saved-chart analysis and Recent Changes, a native navigation dropdown, and focused diagnostic and engineering components. Dashboard and Link Planner views use the standard Workbench/web WebWidget host; navigation needs no UX Media.

## Palette

- **Graphics → Icons:** unchanged icon artwork and existing icon variants.
- **Navigation:** Dropdown, Navigation Menu and Navigation Item.
- **Operations:** Operations Dashboard and Zone Deviation Matrix.
- **Histories:** Chart Library.
- **Diagnostics:** Point Summary, Equipment Proof and Peak Monitor.
- **Signal Processing:** Numeric Smoother.
- **Engineering:** Link Planner component, Link Planner View and Link Planner Demo.

The [candidate evaluation](task-reports/2026-09-candidate-evaluation.md) explains the selection. The [follow-up implementation report](task-reports/2026-09-followup-implementation.md) records current behavior, bounds and verification.

## Components

This is the short guide to the user-facing pieces in the current module. The RPC and JavaScript support types are packaged automatically; you do not add those types to a station.

### Graphics and icons

- **Icons:** Drag a preset from `Graphics > Icons` onto a PX page. The icon keeps Niagara's normal `ValueBinding` hyperlink behavior. The presets cover illustrated, soft-line, schematic, duotone, solid-glyph and alarm variants.
- **Icon settings:** `IconType`, `IconStyle` and `IconMode` select the icon artwork, visual treatment and state behavior. The `NavIcon`, `NeutralNavIcon`, `SingleColorNavIcon`, `DuotoneNavIcon`, `SingleColorAlarmNavIcon` and `DuotoneAlarmNavIcon` variants expose the corresponding options.

### Navigation

- **Navigation Menu:** Add it to the station, then add `Navigation Item` children. Give each item a label and an absolute station or file ORD target.
- **Dropdown:** Drag `Navigation > Dropdown` onto a PX page and set `Menu` to the Navigation Menu ORD. Set `Prompt` for the closed label. It works in Workbench and Hx without UX Media.
- **Navigation Item:** Each item is one destination in the menu. Reorder the children to change the displayed order. Up to 100 readable destinations are shown.

### Operations and views

- **Operations Dashboard:** Drag `Operations > Operations Dashboard` onto a PX page. Set the chart library, overview scope, title, refresh interval and light or dark mode as needed. Its tabs cover point health, open alarms, schedules, histories, saved charts and recent audit changes.
- **Zone Deviation Matrix:** Drag `Operations > Zone Deviation Matrix` onto a PX page. Set the equipment scope plus the relative value and setpoint paths, such as `ZoneTemp` and `ZoneSetpoint`. Rows sort by largest deviation and open the point inspector when selected.
- **Point Inspector Binding:** This is intentionally not in the palette. Select an existing PX widget, use `Add Property > Point Inspector Binding`, set its point ORD, and optionally change `Title` and `Size`. Clicking the host widget opens the current value, status, alarms, recent changes and optional history.

Schedules and Recent Changes are dashboard tabs, not separate station components. The schedule tab links to Niagara's full scheduler for edits and exceptions.

### Histories

- **Chart Library:** Add `Histories > BasidekickCharts` under Services or another station folder. It stores saved chart definitions.
- **Saved Chart:** Saved charts are children of the Chart Library. In the dashboard, add histories, choose a period, name the chart and press `Save`. Use `Save as new` for another definition. The saved definition includes series, period and analysis settings; the dashboard queries fresh history data when opened.

### Diagnostics

- **Point Summary:** Add `Diagnostics > PointSummary` to a wire sheet. Set `Points`, `Query Scope`, or both, then read the calculated minimum, maximum, average and quality counts. Enable `Include Sum` when needed. Points should use compatible numeric units.
- **Equipment Proof:** Add `Diagnostics > EquipmentProof`, link `Command` and `Feedback`, and set the start delay, stop delay and startup grace. `Failure` is a status Boolean suitable for alarm logic; `State` explains proving, failed start or stop, unavailable and inhibited conditions.
- **Peak Monitor:** Add `Diagnostics > PeakMonitor`, link `Input`, set matching numeric facets and read `Minimum`, `Maximum` and their timestamps. Use `Reset` to begin a new observation window.

### Signal processing

- **Numeric Smoother:** Add `Signal Processing > NumericSmoother`, link `Input`, set matching numeric `Facets` and choose a `Time Constant`. Read `Output`; invalid input invalidates the output and a valid recovery reseeds the smoother. The source point is not changed.

### Engineering

- **Link Planner:** Add `Engineering > LinkPlanner` to the station. Set `Equipment Scope` to a folder whose immediate children are equipment instances, then set relative `Source Path` / `Source Slot` and `Target Path` / `Target Slot`. Preview first, select ready rows and apply only after reviewing the proposed links.
- **Link Planner View:** Drag `Engineering > Link Planner View` onto a PX page and enter the planner component ORD. It provides Preview, Apply Selected, Undo unchanged added links and Keep links actions.
- **Link Planner Demo:** Drag `Engineering > LinkPlannerDemo` to the station root to create a safe sample with two BooleanWritable units. Preview the two proposed `Command.out` to `Result.in16` links, apply only Unit1, confirm its result follows Command, then use Undo. The demo does not connect to real equipment.

## Saved charts

Place the **BasidekickCharts** Chart Library component under Services, or choose another location and set the dashboard's **Chart Library** property to its station ORD. The default is `station:|slot:/Services/BasidekickCharts`.

Add histories, select a time range, enter a name and save. Open a saved chart to query fresh data. **Save** updates the opened setup; **Save as new** creates another. Edits require admin-write permission on the library and the saved record. Read-only users can open charts; history access still depends on their Niagara permissions. Definitions are ordinary persistent station components, included in normal station saves and backups. Mean method, maximum gap and preceding-period comparison are saved with the chart.

Analysis shows raw-sample extrema and timestamps, valid/excluded counts, gap and held-value coverage. Choose sample mean or time-weighted mean; the latter holds a recorded value only until the next record or maximum gap. Each query is limited to 10,000 records and visibly marked if partial. **Export loaded samples** includes status, units and truncation metadata. **Reload samples** updates the chart period. Calendar ranges use the viewer’s time zone.

## Navigation dropdown

Place **Navigation Menu** in the station, add ordered **Navigation Item** children, and set each item's label and target ORD. Use absolute station/file ORDs for destinations. Drop **Dropdown** onto a PX page and set **Navigation Menu** to that component's ORD. Set **Prompt** for its closed label. No UX Media is required.

The menu is limited to 100 displayed destinations. Workbench rereads items when opened; Hx updates on its normal page polling cycle.

## Schedules

The dashboard shows the recurring week, current output, active source and exception count. Use **Open/Edit full schedule & exceptions** for Niagara's authoritative scheduler. The regular-week preview does not apply holiday exceptions to a dated calendar.

## Diagnostics

**Point Summary:** configure Points with local NumericPoint ORDs, Query Scope with an equipment subtree, or both. It deduplicates up to 500 points and provides current min/max/mean, optional sum, quality counts, unit facets and min/max source ORDs. Different declared units fail the calculation. Refresh defaults to 30 seconds. Set component categories for the intended viewers of these derived results.

**Equipment Proof:** link Command and Feedback, then configure Start Proof Delay, Stop Proof Delay and Startup Grace. Failure is a status Boolean for ordinary Niagara alarm logic. State distinguishes proving, failed start/stop, unavailable and inhibited conditions.

**Numeric Smoother:** link Input, set matching Facets and Time Constant, then use Output. Invalid input invalidates output; recovery reseeds. The raw point is unchanged.

**Peak Monitor:** link Input and set matching Facets. Minimum/Maximum include station observation timestamps. Reset, changing facets or station startup starts a new monitoring window. Input Status remains separate from recorded extrema.

## Recent Changes

In the dashboard, enter an equipment ORD such as `station:|slot:/Equipment/AHU1` and select a period. The view reads Niagara's native audit history and requires audit access. It shows recorded operator events, not who caused the current output. Missing values and partial results are explicit.

## Link Planner

Place the Link Planner component in the station. Configure Equipment Scope to a folder whose immediate children are equipment instances. Set relative Source Path / Target Path and Source Slot / Target Slot. For example, each AHU can link `command/out` to `proof/command` using the same pattern.

Open Link Planner View on a PX page and enter the component's station ORD, or use its native actions and Report property. Preview first, select ready rows, then Apply Selected. Existing incoming links are preserved. The first version supports compatible property-to-property links across at most 100 equipment instances. Apply requires admin-write on the planner and targets.

Undo removes only unchanged links added by this planner during the current component session. Keep Links clears the in-memory undo journal. Added links persist normally; the undo journal does not survive a restart.

## Status

Source, calculation and simulated browser checks are documented in the [follow-up report](task-reports/2026-09-followup-implementation.md); the [initial report](task-reports/initial-implementation.md) retains the original implementation evidence. Niagara compilation, deployment, and Workbench/station behavior require user-run verification. No build or runtime success is implied.

No AX Community code is included. Original icon and dashboard material comes from the local qagraphics project. The public-release license is still to be selected.
