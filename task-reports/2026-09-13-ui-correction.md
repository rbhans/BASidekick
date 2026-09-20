# UI correction, September 13

Source changes only. Niagara compilation, deployment, Workbench, and station tests remain user-owned. Browser evidence uses simulated data, not a station connection.

## Value Card and dashboard

The outer frames now have square corners and fill their bounds. Internal dashboard panels retain rounded corners against the dashboard's own background. This avoids depending on native WebWidget transparency at the outside edges.

Value Card now preserves constructor properties, guards property changes before initialization, uses a flex layout with a fixed title row and explicit colors, and removes unsupported container-relative font sizing. The browser fixture checks a custom title at 260 × 120 and changes it after initialization. This is the user's single requested corrective attempt, not a claim of Workbench acceptance.

## Trends

Saved charts and histories are separate collapsible sections in a 250-pixel left sidebar. Click a saved name to open it. Enter a name and Save to create or update; + starts a new named chart using the current series. Each saved row has a delete control with confirmation. Sidebar hides both sections to expand the chart. Analysis and export are closed initially, and the mean summary strip is removed from the chart.

The old save implementation required a separately configured library. The default is now `station:|slot:/BasidekickCharts`, created only on an explicit validated Save by a user with admin-write permission. Existing libraries remain supported. A persisted old default at `station:|slot:/Services/BasidekickCharts` uses the new default only if no library exists at the old path. Custom locations still require a Chart Library component. Revision checks and read/write permissions remain enforced.

## Attach Point Inspector to a Px widget

As of September 17, Point Inspector Binding is a `basidekick:PointInspectorBinding` widget agent available through the Px widget's Add Property menu, following QA Graphics' Zone Equipment Binding registration. It has no palette entry. Add it to an existing label, icon, or other Px widget. Set its Point Ord to the point, for example:

`station:|slot:/Equipment/AHU1/SupplyTemp`

The binding appends the inspector view automatically. Workbench uses Niagara's popup profile/dialog; the Hx agent uses the native Hx popup transport. Title and Popup Size are binding properties. Existing native PopupBindings with an explicit InspectorWidget view ORD remain usable. The inspector is also registered as a view on control points. A point with no configured inspector history shows a short message rather than an empty chart area. Existing Value Card and Matrix inspector drawers are retained. Add Property discovery and Workbench/Hx behavior require runtime validation after rebuilding WB/UX.

## Test Link Planner

1. Drag Engineering / LinkPlannerDemo to the station root and keep its name. It contains two pairs of sample BooleanWritable points and a configured Planner.
2. Open LinkPlannerDemo / Planner and select its Link Planner view. The view now gets its Planner ORD from the component being viewed.
3. Preview should show two ready links: each Unit's `Command.out` to `Result.in16`.
4. Select only Unit1 and Apply selected. Set Unit1 / Command to Active; Unit1 / Result should follow. Unit2 should remain unlinked.
5. Use Undo unchanged added links and confirm the added wire is removed from Unit1. Undo removes wiring; it does not restore point values.

The same instructions are available in the view's expandable setup section. The demo has no drivers or connections to real equipment. It has not been instantiated or run in Niagara here.

## Palette folders

Diagnostics contains PointSummary, EquipmentProof, and PeakMonitor. Signal Processing contains NumericSmoother. Their entries exist in the source palette and the previously built WB JAR; the types and classes also exist in the previously built RT JAR. These are station logic components intended for wire sheets. The reported empty Workbench folders were not reproduced, so no speculative palette restructuring was made.

## Verification

September 14 palette correction: opening the palette reported an illegal parent for `kitPx:PopupBinding`. The Point Inspector Binding prototype was directly beneath a normal Data Displays folder. Installed `BBinding.isParentLegal` accepts only `BWidget`; installed `BUnrestrictedFolder` documentation explicitly identifies palette storage as its purpose. Changed only the Data Displays container to `b:UnrestrictedFolder` and added a static check against binding prototypes beneath plain folders. This requires a rebuilt WB JAR; Workbench loading has not been retested here.

September 16 type-loading correction: palette loading reported `BString cannot be cast to BComplex` in `ValueDocDecoder.parseSlots`. Inspection of installed 4.15.3.28 bytecode shows that `BModulePaletteNode$1.newInstance` catches type-instantiation failures and substitutes `BString.DEFAULT`; a prototype with children then fails in the decoder. `ComplexIntrospector.mapProperty` requires public getters and setters, and `mapAction` requires an invocation method as well as its `do` handler. LinkPlanner lacked all six property accessor pairs and all three invocation methods. Its configured Planner prototype in LinkPlannerDemo exposes the decoder failure. PointSummary, EquipmentProof, NumericSmoother, and PeakMonitor also lacked required invocation methods; Smoother and PeakMonitor lacked facets accessors, and SavedChart lacked setAnalysis. These defects also explain why bare logic prototypes disappeared from palette folders and why saving chart components could fail.

Added the missing slot methods in those six RT classes without changing slot names, defaults, or handler behavior. `javap` confirmed representative missing methods in each class in the installed RT JAR, so the defects are present in the built artifact as well as source. The source check now validates 66 manually maintained slot contracts across registered types; all existing static checks pass. Thirteen in-memory missing-method variants were rejected by the new check. The WB palette was not changed for this correction. This is source and installed-bytecode evidence, not a successful Workbench reload: the user must rebuild the RT JAR and validate the palette/chart behavior in Niagara.

September 17 chart units correction: `historySamples` formatted `BTrendRecord.getUnits()` whenever it was not Java null. Installed SDK source initializes that field to `BUnit.NULL`; checking Java null does not detect Niagara's unset unit. The installed `BHistoryExt` stores point facets on the history configuration at `<value property name>Facets`. The RPC now reads those facets before scanning samples, falls back to real record units when needed, and emits an empty label for absent/NULL units. Point inspection uses the same BUnit-aware formatting. Chart loading also normalizes legacy `null`/`undefined` unit strings for current and comparison series; sample values are unchanged.

September 17 verification: source/XML/JavaScript checks pass for 34 registered types and 69 manual slot contracts. Registration checks enforce Point Inspector's widget/Hx agents and absence from the palette. Installed API signature checks pass on both 4.15.1.16 and 4.15.3.28. Chart series-loading regression checks cover absent units, legacy null strings, real symbols, tooltip text, comparison units and unchanged numeric values; existing trend analysis checks pass. No Gradle, JAR compilation, deployment or Workbench/station execution was performed. WB/UX source changes remain pending runtime validation.

The browser fixture checks save/reload/reopen, colors/time ranges/analysis retention, revision-error presentation, delete confirmation, read-only controls, independent section collapse, chart expansion, custom Value Card titles, embedded inspector rendering, and existing schedule/navigation/planner controls. Source checks cover XML, type references, JavaScript syntax, and unchanged icons. Installed SDK signatures are inspected separately. None of these checks executes Java or demonstrates Niagara runtime behavior.
