# Initial implementation

September 12, 2026. All changes are local to `basidekick`. qagraphics and the installed module JARs were read only.

## Delivered source

- One categorized WB palette, containing native widgets and RT configuration components: Graphics / Icons, Navigation, Operations and Histories. Removed the wizard's other empty palette resources so the module has one authoritative palette.
- All 109 SVG files copied byte-for-byte. The ten native icon classes differ only in module/package references. Existing icon rendering and behavior remain intact.
- Operations Dashboard and its RPC adapter moved into basidekick's namespace. Its JavaScript and style identifiers are isolated from qagraphics. It retains Niagara's Workbench WebWidget and Hx web host path.
- Shared Chart Library and Saved Chart RT types with browser save/open/update/save-as-new/delete controls. Saved settings include ordered history ORDs, labels, colors and relative time range. Maximum 12 series per chart and 100 charts created through a library's RPC.
- Chart reads require readable library/record access; mutations require admin-write on the library and existing record. History samples are queried fresh through the viewer's Niagara session. Revision checks reject concurrent RPC overwrites/deletes. This is shared station storage, not browser localStorage. The test fixture's sessionStorage is only a simulated server.
- New native Navigation Dropdown with an independent Hx renderer and reusable Navigation Menu / Navigation Item components. This does not copy the qagraphics dropdown. Rounded native face, styled browser select, keyboard support from platform menus/selects, explicit empty/error states, 100-item display limit, and current menu contents reread on opening/polling.
- Versionless dependencies follow the wizard's pattern. Removed its unused Grunt build plugin because the selected AMD assets are packaged directly, matching qagraphics. WB explicitly depends on UX for the Hx resources and dashboard provider. The empty SE part remains in the original descriptor but has no feature code.

## Confirmed source issues corrected

### Dashboard navigation in Workbench

Symptom: source passed a browser `/ord/...` URL into `niagara.env.hyperlink`, and ordinary anchor links bypassed the host helper.

Cause: the inspected Workbench `WebWidgetInterop.Env` constructs a `BOrd` relative to the active Workbench ORD. The Hx host accepts relative ORDs and converts them to browser URLs.

Fix: send the normalized relative ORD to the host and route ordinary dashboard link clicks through that helper. Preserve browser hrefs for modified clicks. The new native dropdown resolves its menu against the PX binder's base rather than assuming the widget itself is in station space.

Evidence: installed N4.15 class signatures/bytecode, Hx container source, and the browser fixture's captured `slot:/Schedules/Office|view:schedule:WebScheduler` navigation. Actual Workbench hyperlink behavior is not yet tested.

### Schedule current value and weekly-calendar scope

Symptom: source labeled `BAbstractSchedule.getEffectiveValue()` as the current value and presented the recurring week without clearly explaining exception handling.

Cause: the installed SDK defines `effectiveValue` as a configured schedule value; the actual weekly schedule publishes `out` and `outSource`.

Fix: read the live `out` slot and output source, identify the preview as the regular week, explain that exceptions can change output, and link to Niagara's complete scheduler. Add explicit component read checks to schedule and point-health row selection.

Evidence: installed `BAbstractSchedule`, `BWeeklySchedule` and `BBooleanSchedule` sources/signatures; browser rendering/navigation fixture. Station values and permissions remain unverified at runtime.

### Schedule header clipping

The browser fixture exposed the exception explanation squeezing the schedule title out of a single flex row. Changed the header to a grid with wrapping metadata and a separate explanation row. The final wide screenshot shows the title, current value/source, editor link and explanation without clipping; browser checks pass again.

## Verification completed

- [Static results](static-validation.json): 21 registered types have matching source files; XML and palette type/resource references pass; JavaScript syntax passes; all 109 SVG comparisons pass; native icon code has namespace changes only.
- Newly used API signatures were inspected with `javap`, not compiled. Imported classes were checked against both the configured N4.15.1.16 SDK and supplied N4.15.3.28 SDK, including NRE annotations, component mutation/permissions, Hx operations, native menu and PX binder APIs.
- Browser fixture passed save/reload/open, restored series colors and time range, save-as-new, conflicting save error, delete/cancel, read-only controls, malformed preset rejection, dropdown selection, and schedule ORD routing. No browser page errors were observed.
- Visually inspected [wide dashboard](dashboard-ui-fixture.png), [narrow dashboard](narrow-ui-fixture.png), and [schedule preview](schedules-ui-fixture.png). These show simulated fixture data, not a Niagara station.
- The app browser tool could not initialize because its runtime rejected the mounted workspace path as a filesystem glob. A temporary localhost Playwright fixture was used instead; its server was stopped after each run.

Reproducible source check: `python3 basidekick/verification/static-check.py` from the parent workspace. The preview preparation and browser scripts are under `verification`; Niagara jQuery is extracted only to `/tmp/basidekick-ui-check`, not added to distributable source.

## User-owned Niagara verification

No Gradle, Slot-o-matic, Java compilation, signing, deployment, restart, or station interaction was performed.

Build from the parent JENEsys workspace using the existing configured Niagara installation:

```bat
gradlew.bat :basidekick-rt:jar :basidekick-ux:jar :basidekick-wb:jar
```

Expected feature artifacts are `basidekick-rt.jar`, `basidekick-ux.jar` and `basidekick-wb.jar` in the normal part build outputs. Use the existing signing/deployment process. Source checks do not establish that these artifacts currently exist or compile.

Before describing this as a working release, verify:

1. Palette opens as four purposeful categories with all icon variants. Place the same native icon and dropdown on a PX page in Workbench and standard Hx web with no UX Media.
2. Open the dashboard in Workbench and web. Verify real history discovery, chart loading, resizing, point/health links and schedule links. Restricted accounts must not see unreadable points/schedules.
3. Configure one Chart Library. Save in web, reopen in Workbench and another browser session; test station save/reload persistence, unavailable/deleted histories, read-only accounts, conflicting sessions, save-as-new and deletion. Record-specific permissions must be respected.
4. Test a schedule where a holiday or special event overrides the regular week, plus a non-default/input-driven state. Compare live output/source with Niagara's property sheet and full scheduler. Exercise boolean, enum, numeric and string weekly schedules; effective date and timezone behavior remain Niagara's responsibility.
5. Change menu labels/order/destinations after opening the PX. Verify Workbench reopens with current items, Hx updates, keyboard selection/Escape, disabled parent widgets, long labels, empty menus, and permission-denied destinations.

The release license remains undecided. No AX Community code was imported, and no publication was performed.
