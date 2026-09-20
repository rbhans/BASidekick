# basidekick candidate evaluation

Evaluated September 12, 2026 against the installed Niagara 4.15.3.28 SDK and AX Community 22.02.01.01.0. The configured 4.15.1.16 SDK also contains the Line, Limiter, Reset and MinMaxAvg types discussed below. This revises the initial shortlist; it does not authorize or implement the future features.

Follow-up: on September 13 the user approved proceeding with the revised additions, including conditional tools. See the [implementation report](2026-09-followup-implementation.md) for the resulting source and verification limits. The assessment below is retained as the selection rationale.

## Decision

The initial shortlist was too generous. Some candidates are standard Niagara functionality, and the statistics row grouped three different jobs. Favor a few tools that reduce operator or engineering effort over another general-purpose block library.

| Original candidate | Decision | Proposed home |
|---|---|---|
| BqlNumericRecap + AvgMinMax | Combine into one Point Summary with linked/list or scoped-query inputs | Diagnostics / Point Summary |
| History analysis and CSV | Improve the existing saved-chart workflow using native history services | Existing Operations Dashboard / Trends |
| WhoWhen setpoint family | Replace the proposal with an audit-backed Recent Changes view; keep existing point types | Existing Operations Dashboard / equipment context |
| BooleanCompareCmdStatus | Conditional Equipment Proof helper only; ordinary mismatch uses native alarms | Diagnostics, if the defined gap is demonstrated |
| BatchLinkCreator + dynamic links | Consider one manual Link Planner; defer automatic runtime rewiring | Engineering, later |
| Converters + Scale | Remove generic versions from planned work | Use Niagara's existing palettes |
| FilterExt + FilterLogMeanExt | Hold; one live smoother only if a real noisy-signal use case warrants it | Signal Processing, if needed |
| PeakValueAndTstamp | Separate from Point Summary; defer a since-reset peak monitor | Diagnostics, if needed |

These are assessments of utility, overlap and implementation burden. Available public package activity does not establish component-level demand in September 2026.

## 1. Point Summary: worthwhile, with a focused scope

Niagara's MinMaxAvg already summarizes 2 to 10 linked StatusNumeric inputs. AX Community's AvgMinMax adds variable input count and sum. BqlNumericRecap executes a recurring BQL query over current NumericPoint outputs and provides count, min, max, average and sum. It does not calculate historical statistics.

Combine these two current-value workflows behind one calculation model: a configured collection of numeric points, selected directly or by a bounded scoped query. Start with whichever selection method is needed first, and add the other without creating another statistics component. The runtime component should expose outputs usable in ordinary wiresheets and PX; a dashboard card can present the same results.

Useful improvements:

- Show matching, valid and excluded point counts. Explain exclusions and query errors.
- Include the point name/ORD responsible for min and max. A hottest-zone value is much more useful when the operator can open that zone.
- Define valid status policy, freshness and unit compatibility. Reject incompatible units or explicitly convert them; copying facets alone is not unit conversion. A constant COV value is not automatically stale merely because it has not changed.
- Make no valid data visibly unavailable rather than a healthy zero. Preserve the distinction between an empty selection and a failed query.
- Bound query scope, result count and refresh rate; prevent overlapping runs. Avoid repeatedly scanning an entire station.
- Treat sum as optional and meaningful only for appropriate quantities. Averaging zone temperatures is useful; summing them usually is not.

Example acceptance: 24 zone temperatures with one fault and one unavailable point produce a clearly labeled valid count and hottest-zone identity. No invalid value silently becomes zero. A temperature/power mix is rejected. A failed query does not leave a healthy-looking old result.

## 2. History diagnostics: combine with saved charts

Use the existing Trends surface for period min/max with timestamps, comparisons, data-quality visibility and export of the displayed selection. These are proposed enhancements, not capabilities claimed by the initial implementation.

Niagara already has HistoryRollup and history export types. SeriesTransform has rollup, aggregation, scaling and cleansing nodes. Tridium also teaches native [history rollup and web-chart sampling](https://www.tridiumuniversity.com/student/activity/967092). Build a convenient operator workflow over these capabilities rather than a second history processing engine or a separate CSV component.

A chart's statistics must name the selected period and aggregation. A mean of irregular COV samples is not a time-weighted mean. Define weighting, maximum gaps and coverage before presenting an average as representative. Raw-sample peaks and rolled-up peaks are different, so the UI must identify which it displays. Query limits and truncation must be visible. CSV should reflect the selected histories and period with timestamps, units and missing-data handling.

PeakValueAndTstamp solves another problem: a running peak since reset, including times when no history was recorded. Do not merge it into current Point Summary or infer it from chart data. Defer it until that job is needed; if added, use native timestamps and explicit reset, startup and retention semantics.

Example acceptance: an irregularly sampled history with a long outage does not show the same quality as a complete regularly sampled history. Reopening a saved setup restores its analysis settings and uses current access permissions.

## 3. Operator attribution: use the audit trail

The installed AuditHistoryService documents user-initiated property changes and action invocations. BAuditRecord exposes target, slotName, oldValue, value and userName, with timestamp inherited from the history record. Four replacement writable classes would require users to migrate point types and would duplicate much of that infrastructure.

Prefer a contextual Recent Changes view, filtered to an equipment subtree or selected points, showing the recorded operation, actor, time and available before/after values. Link to the existing point and audit detail. This can sit alongside trends and current status in the dashboard without another palette component or audit database.

The wording must be “last recorded operator change,” not “who caused the current output.” A later link update, driver value or priority release may change the effective output. Action records do not necessarily represent a scalar before/after output. Display only what was recorded; missing, truncated or rolled-out values stay unavailable. Respect audit permissions independently of permission to read a point, and expose disabled service, unavailable history and retention limits clearly. Do not query the entire audit history separately for every visible point.

Example acceptance: after an operator override and a later automatic release, the view still labels the override as a historical event rather than attributing the released output to that person. A viewer without audit access receives no audit-derived data.

## 4. Command/status proof: only build the missing diagnostic behavior

Niagara already provides Boolean and Enum command-failure alarm algorithms. The Boolean algorithm compares command and feedback values, while its documentation explicitly says feedback status is not used. AlarmSourceExt already supplies alarm delay, return-to-normal delay, alarm inhibit and inhibit timing. Delays and inhibition alone are not reasons to copy this feature.

A narrower Equipment Proof component could still be useful when a single understandable block replaces repeated wiring for independent start-proof and stop-proof timing, command reversal, and unavailable feedback. Those directional proof windows are different from a generic alarm's offnormal/normal delays.

Consider states such as proving on, running, proving off, stopped, failed to start, failed to stop, unavailable and inhibited. Keep unavailable proof distinct from confirmed equipment failure. Define grace after startup or re-enable and cancellation when commands reverse. Feed ordinary Niagara alarm extensions; do not create another alarm acknowledgement or routing system.

Decision: conditional, below Point Summary and dashboard improvements. First show a fan/pump sequence where existing alarm extensions plus simple native logic are cumbersome. If the need is only delayed mismatch, use the native extension.

## 5. Bulk linking: a guided planner, not a generic batch clone

AX Community's BatchLinkCreator already supports CSV link definitions, base substitutions, a DryRunOnly option, existing-link handling and outcome counts. Niagara also has the Workbench Batch Editor and Robot Editor. A dry run or generic batch operation is not new value on its own.

A Link Planner is worthwhile if it reduces the work of mapping repeated equipment: choose a known source/target pattern, preview exact proposed links for each instance, and identify missing slots, incompatible types, duplicates and ambiguous matches before applying selected rows. Preserve unrelated links by default. Rerunning should not duplicate links. Recheck the relevant configuration before applying an older preview, and retain per-link results for partial failures. A change journal can support restoring the tool's own edits; do not promise atomic undo of arbitrary station changes.

AX DynamicLinks is a different runtime mechanism: it generates dynamic slots and links and can remove/recreate them as configuration changes. Combine its useful relative-path selection ideas with the planner, but defer the runtime rewiring component itself. Manual engineering edits and automatic station behavior should not share one tool lifecycle.

Decision: later, after a representative repeated-equipment workflow demonstrates an advantage over native tools. Workbench is the appropriate first authoring surface; the user-facing widgets retain the Workbench/web requirement. A browser bulk-edit surface would be a separate scope decision.

## 6. Conversion, scaling and filtering: substantially reduce scope

Remove standalone Scale from the plan. Native Reset provides endpoint scaling and limit behavior; Niagara 4.15 Line provides a two-point mapping with optional limits, and Limiter handles clamping. Both installed 4.15 SDK versions contain these types. Standard converters already cover many Boolean, enum, numeric, string and time mappings. Add a conversion only after documenting a real unsupported mapping and why the existing converter chain is inadequate.

Live smoothing is different from scaling, enum conversion, Boolean debounce and history row filtering. In particular, SeriesTransform's BqlFilterNode filters rows by a predicate; it is not evidence of a live low-pass filter.

If a noisy analog sensor requires a dedicated smoother, implement one well-defined component rather than copying both AX filter variants. Prefer a documented time constant with elapsed-time-aware behavior, explicit invalid-input and reset/reseed behavior, and visible raw/filtered outputs. Bound scheduling work, and do not silently overwrite the source point or present indefinitely held data as healthy. Do not add a logarithmic variant merely because the old library has a similarly named type.

Decision: defer until there is an actual signal and desired response to evaluate.

## Palette and sequence

Keep the current palette compact. Add folders only when they contain released components:

- Graphics / Icons and Navigation retain their current roles.
- Operations holds the dashboard. Recent Changes and richer trend diagnostics belong inside that existing workflow.
- Histories holds persisted chart configuration and any genuinely reusable history components.
- Diagnostics is a better future home for Point Summary and optional Equipment Proof than forcing current-value statistics under Histories or every proof state under Alarms.
- Engineering is reserved for an eventual Link Planner.
- Signal Processing is conditional on a useful smoother. Do not create empty Logic, Conversion or Time folders just to resemble another module.

Recommended sequence: validate the initial dashboard, saved charts, navigation and schedule behavior first; then Point Summary and focused Trends improvements; then audit-backed Recent Changes if the audience has audit access. Evaluate Equipment Proof against a concrete sequence before committing it. Link Planner remains a separate later engineering project. Scaling, broad converters, runtime dynamic links and a standalone peak monitor do not enter the near-term backlog.

The schedule view should stay within the existing dashboard and open Niagara's full scheduler for authoritative exceptions and editing. A consolidated “what is active now / next change” view may be useful later, but only using Niagara's effective schedule calculation. Do not build a second exception or holiday engine. This remains a possible improvement, not a new committed feature.

## Evidence and limits

Inspected local evidence under `/Volumes/[C] Niagara/JENEsys/JENEsys-ProBuilder-N4.15.3.28/modules`:

- `axCommunity-doc.jar`: bajadoc entries for BqlNumericRecap, AvgMinMax, PeakValueAndTstamp, BatchLinkCreator, DynamicLinks, FilterExt, FilterLogMeanExt and Scale. Filter documentation is sparse; no undocumented formula is assumed.
- `docSource-doc.jar`: `BBooleanCommandFailureAlgorithm`, `BEnumCommandFailureAlgorithm`, `BTwoStateAlgorithm`, `BAlarmSourceExt`, `BMinMaxAvg`, `BAverage`, `BReset`, `BLine` and `BLimiter` Java sources.
- `docAlarms-doc.jar!/doc/Alarm-BooleanCommandFailureAlarmExt.html`: command/feedback behavior and unused feedback status.
- `docKitControl-doc.jar!/doc/kitControl-MinMaxAvg.html`: linked-input statistics, 2 to 10 inputs.
- `docHistories-doc.jar!/doc/history-AuditHistoryService.html` and `doc/AuditTrailManagement.html`: audited events, record properties and retention. `javap` on the installed BAuditRecord confirms oldValue/value/userName fields.
- `docUser-doc.jar!/doc/program-BatchEditor.html`: native batch selection and slot operations. `program-wb.jar` contains Batch Editor and Robot Editor classes; they are not separate module JARs.
- `history-rt.jar`, `seriesTransform-rt.jar` and `converters-rt.jar`: installed type inventories support the platform overlap described above. Type presence is not runtime acceptance or proof of every proposed integration.

This was a documentation, SDK source and installed-type evaluation. No module source was changed, no Niagara build was run, and no station or Workbench test was performed. The unresolved decisions are explicitly conditional rather than represented as demonstrated demand or completed integrations.
