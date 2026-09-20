# Follow-up implementation

September 13, 2026. Implements the user's approval to proceed with the revised candidates, including the previously conditional Equipment Proof, manual Link Planner, live smoother and peak monitor. All changes are within basidekick. Generic scaling/converter duplicates and automatic runtime rewiring remain excluded.

## Delivered source

| Palette / surface | Addition | Contract |
|---|---|---|
| Diagnostics | Point Summary | Explicit local NumericPoint ORDs and/or a scoped subtree query; deduplicated current min/max/mean and optional sum, valid/excluded counts, min/max source ORDs and unit facets. |
| Operations Dashboard / Trends | Analysis and comparison | Raw-record min/max timestamps, sample or held-value time mean, coverage and gap visibility, previous equal-duration period comparison, explicit query limits, CSV of loaded samples. |
| Operations Dashboard | Recent Changes | Caller-authorized read of the station's native audit history, scoped by equipment path and period. |
| Graphics / Data Displays | Value Card + Point Inspector | Compact current value/status card and reusable same-page inspector drawer with optional secondary value and history, current alarms, override status, recent audit context and full Niagara navigation. |
| Operations | Zone Deviation Matrix | Immediate-child value/setpoint comparison sorted by absolute deviation, with unavailable states kept separate and point rows opening the inspector. |
| Operations Dashboard | Overview | Default exception workspace for open alarms, overrides/unavailable points, schedules and their next native event, Equipment Proof failures and recent operator changes. |
| Diagnostics | Equipment Proof | Independent start/stop proof delays, command-reversal cancellation, startup/re-enable grace, unavailable feedback and inhibition. A status Boolean failure output can feed standard Niagara alarm logic. |
| Diagnostics | Peak Monitor | Min/max and native timestamps since reset or station startup; separate current-input status. |
| Signal Processing | Numeric Smoother | Elapsed-time low-pass response, separate raw input, invalid-output handling and explicit reset/reseed. |
| Engineering | Link Planner + Link Planner View | Manual preview and selected application of repeated property links; native property-sheet actions and an optional Workbench/web WebWidget view. |

## Implementation boundaries

### Point Summary

`points` accepts local component ORDs resolving to NumericPoints. `queryScope` accepts a station subtree below the root and uses a fixed NumericPoint query, not arbitrary user-supplied BQL. Both selections can be combined; repeated handles count once. At most 500 unique points and 500 query rows are consumed. A scope exceeding the limit faults rather than showing a partial healthy summary.

Refresh runs on a Niagara BWorker, with one queued refresh and no concurrent execution for a component. Queued refreshes are coalesced to the latest configuration generation. Default interval is 30 seconds, with an effective minimum of 5 seconds. This is a row/scope bound, not a guaranteed BQL execution deadline. Keep the scope narrow on large stations.

Invalid-status and non-finite values are excluded. Different declared units fail the calculation; no implicit conversion occurs. Unitless inputs may be summarized together. Outputs expose result facets. No valid data is null, and resolution/query failures are fault. A constant COV input is not declared stale merely because it has not changed.

This is a station-derived component, like other runtime logic: its category permissions govern access to its results and source identities. It does not execute a separate query under each viewer's identity. Configure its categories accordingly. Server-side dashboard history and audit reads, in contrast, use the requesting user's context.

### Saved chart analysis

SavedChart now includes `analysis`: mean method, integer maximum-gap minutes, and preceding-period comparison setting. Existing definitions default to sample mean, a 60-minute gap and comparison off. The old save RPC signature is retained; the current UI calls the extended RPC. Existing revision and authorization checks remain in place.

Each history read uses the native HistorySpaceConnection and closes its table cursor and connection. The RPC returns up to 10,000 raw records with status, units where available, and an explicit truncation flag. The widget permits two concurrent sample requests. Ranges are half-open, at most 366 days, and use the viewer's local calendar boundaries for month/year to date. Reload Samples updates the shared time range for the chart.

A time-weighted mean assumes each valid recorded value is held until the next record, range end or configured maximum gap. Invalid records terminate coverage. No value before the start of the range is inferred. Coverage is therefore an explicit held-value assumption, not a claim of continuous sensor availability. Sample mean gives each valid record equal weight. Previous-period means use the same method and gap, with coverage shown separately; comparison is withheld for truncated results or different units.

The chart breaks across invalid records and long gaps, shades gap intervals, marks optional extrema and overlays readable alarm, schedule and operator events. Isolated samples remain visible as points. Incompatible units receive separate stacked value lanes on the shared time axis. CSV exports loaded records, not an unlimited history export; it includes UTC timestamps, range, status, validity, units and truncation metadata. Text cells are escaped to prevent spreadsheet formula interpretation.

Saved-chart commands are placed behind a quieter Chart Actions control. Saved analysis now retains the min/max marker preference while accepting the previous three-field settings format. On narrow layouts, selecting a history collapses the browser and the Histories control restores it.

### Recent Changes

The RPC checks the equipment scope, AuditHistoryService access, and audit-history access, then queries through a caller-context history connection. A disabled audit service returns an explicit unavailable state. It scans newest-first, up to 10,000 records and 200 matching events. A bounded display truncates very large values with a visible marker.

The UI shows a day-grouped timeline with operation-type filters, recorded user, time, target/slot and old-to-new values. It does not infer who caused the current effective output, synthesize missing old values, or create another audit store. Scope filtering supports local slot-path targets; retained records outside that form are not matched. Native audit retention limits still apply. Failed/denied requests clear previous displayed events.

### UI displays and inspector

Value Card, Point Inspector and Zone Deviation Matrix are WebWidgets so the same JavaScript surface is available to Workbench Px and web Px hosts. Their station reads use caller-context Box RPCs and local station ORDs. The inspector stays on the current page, closes by outside click, Escape or its X control, and restores focus. Its trend appears only when a History ORD is configured; it does not guess a point-to-history mapping.

The matrix reads only immediate equipment children and requires explicit relative value and setpoint paths. It accepts at most 200 children. Missing, unreadable, invalid and nonnumeric endpoints remain visible as unavailable rows rather than being treated as comfortable zones. Rows sort by absolute deviation, then unavailable rows, and open the same inspector when a readable value point exists.

The new Overview is the dashboard's default tab. Counts label operational queues rather than decorative KPIs, and section headers open the corresponding detailed dashboard workspace. Confirmed Equipment Proof failures can navigate directly to their Niagara component. Schedules include the native next event returned by the installed schedule API.

### Equipment Proof, smoothing and peaks

Equipment Proof evaluates changed inputs and a one-second timer, using monotonic clock ticks. Defaults: 30-second start proof, 15-second stop proof, 30-second grace. States distinguish startup grace, proving on/off, running/stopped, failed start/stop, unavailable and inhibited. Invalid feedback cannot produce a healthy proof decision; inhibition gives a disabled result. Ordinary alarm routing/acknowledgement remains Niagara's responsibility.

Numeric Smoother uses the previously held input over elapsed time, so a newly arrived value is not applied retroactively to the preceding interval. Its one-second timer advances the response when COV input remains constant. Invalid or disabled input invalidates output; the next valid input reseeds. Reset, time-constant changes and facet changes reseed. Set facets explicitly to match the source; facets do not convert values. It never writes the source point.

Peak Monitor records station observation times, not device timestamps. Equal repeated extrema retain their first timestamp. Invalid input retains existing extrema while marking current input unavailable. Reset, facet changes and station startup clear the monitoring window. This version intentionally has no cross-restart peak retention.

### Manual Link Planner

Configure an equipment folder and relative source/target component paths. Each immediate child is one equipment instance. Blank relative paths mean the equipment component itself. At most 100 equipment children are planned. The first version supports property-to-property links with compatible types, without implicit conversion. It does not support CSV import, arbitrary BFormat execution, action/topic linking or automatic runtime rewiring.

Preview records exact equipment, endpoint and slot identities, native link validation and existing incoming links. The WebWidget presents these in a table with Ready, Blocked and Existing counts, Select All Ready and a sticky Apply bar. Only selected ready rows are added. Default selection is empty. Existing links are never replaced; identical enabled wiring is reported as already linked. Admin-write is required on the planner and each target, with source read checks. Previews expire after five minutes and are invalidated by configuration changes or endpoint/slot replacement. A token binds calls to the current preview and user; all selected rows are rechecked before the first write and immediately before their individual add.

Apply uses Niagara's ordinary persistent makeLink/add pattern, as inspected in the installed Workbench LinkCommand source. It is not an atomic transaction across equipment. Every applied row receives a result, and a callback failure after insertion still records the added link in the recovery journal.

Undo removes only the same unchanged link objects this planner added. Modified, replaced, missing or denied entries remain in the journal for review. The journal is limited to 500 entries, remains in memory for the current component session, and is cleared explicitly with Keep Links or when the component stops. It does not survive restart. Native actions are also available; Apply Selected Rows takes comma-separated preview row numbers.

## Verification completed

- [Static checks](static-validation.json): 32 registered types with matching sources, palette/resource references and XML, JavaScript syntax, 109 byte-identical SVGs, and unchanged native icon behavior source apart from the existing namespace adaptation.
- [SDK checks](sdk-signature-validation.json): signatures from 19 relevant installed classes in both 4.15.1.16 and 4.15.3.28. This does not type-check or compile the new Java source.
- `verification/analysis-check.cjs`: irregular sample weighting, invalid values, gaps/coverage, duplicate timestamps, empty ranges, half-open boundaries, configuration validation and CSV formula escaping/truncation metadata.
- `verification/browser-check.cjs`: default Overview, saved analysis/range/colors, reload/open, comparison, CSV download, truncation, audit event rendering and denied-state clearing, inspector open/close, matrix sorting, planner selection/apply/undo UI, plus existing save/conflict/delete/read-only/navigation/schedule regression cases. All station/RPC responses in this fixture are simulated.
- Inspected [Overview](initial-ui-fixture.png), [Value Card and Matrix](ui-graphics-fixture.png), [Point Inspector](point-inspector-fixture.png), [wide Trends](dashboard-ui-fixture.png), [narrow Trends](narrow-ui-fixture.png), [Recent Changes](recent-changes-ui-fixture.png), and [Link Planner](link-planner-ui-fixture.png).

Two issues found during source/fixture review were corrected: isolated samples disappeared when every gap exceeded the line-connection threshold, and analysis controls could squeeze their labels. The renderer now draws isolated points and keeps labels intact while wrapping controls. The browser checks passed after those changes. The refresh queue was also changed to retain the newest configuration rather than dropping it behind an obsolete queued job; this fix has source review only, pending Niagara testing.

The first user-run UX compilation reported `cannot find symbol: variable Clock` in `BOperationsDashboardRpc`. The schedule next-event implementation used `Clock.millis()` without importing `javax.baja.sys.Clock`. The import was added, and the source/XML/JavaScript checks plus installed 4.15.1 and 4.15.3 SDK signature checks passed afterward. A new user-run Gradle build is still the compilation proof.

The next user-run build compiled and packaged `basidekick-ux`, then reported `class file for javax.servlet.http.HttpServletRequest not found` while compiling `BHxNavigationDropdown` in `basidekick-wb`. The dropdown called the `WebUtil.toUri` overload that accepts the servlet request. It now calls the inherited `WebOp.toUri(BOrd)` API on `HxOp`, which creates the Niagara URL without exposing servlet types. A temporary servlet dependency attempt was removed because its undeclared build-script variable caused configuration to fail before any task could run.

## Outstanding Niagara verification

No Gradle, Slot-o-matic, Java compilation, signing, deployment, station startup/restart or station mutation was performed. The new Java algorithms and actual link/audit permissions have not executed in Niagara during this task.

The user-run build and runtime checks must cover:

1. All palette types instantiate, including BWorker lifecycle and the Workbench/web Dashboard, Value Card, Point Inspector, Zone Deviation Matrix and Link Planner views.
2. Point Summary with more than ten inputs, invalid values, differing units, duplicate ORDs, empty/oversized scopes, configuration changes during refresh, disable/re-enable and category access.
3. Equipment Proof start/stop timeouts, quick command reversal, feedback recovery, startup/re-enable grace and inhibited/unavailable states, including the intended alarm wiring.
4. Smoother response to a held step at one time constant, irregular COV changes, invalid-to-valid recovery and reset. Peak first-timestamp behavior, invalid input, unit-facet reset and restart reset.
5. Native history record status/units, irregular and Boolean/enum histories, large-query truncation, cross-host saved settings and permission-denied histories. Compare calculations with the documented held-value model, not an unspecified platform average.
6. Native audit target formats, missing/rolled records, action versus property records, disabled service and users with point read access but no audit-history access.
7. Link Planner against disposable equipment first: missing/type-incompatible/occupied slots, duplicate wiring, stale previews, denied writes, partial failures, reruns, another session, modified links before undo and station persistence of added links. Confirm that undo removes only its own unchanged links.

This is source ready for the user's build and runtime validation, not a working-release claim. No AX Community code was copied and no release was published.
