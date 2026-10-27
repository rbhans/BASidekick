# Auto Grid pane

September 30, 2026. Adds `basidekick:AutoGridPane`, a native PX layout pane using the CSS `repeat(auto-fit, minmax(min, 1fr))` card-grid pattern. The user chose the auto-fit grid, per-cell card styling and Workbench + Hx + UX Media rendering.

## Why not FlowPane + ResponsivePane

Checked against N4.15.3.28 `docSource-doc.jar` `bajaui-wb/javax/baja/ui/pane/BFlowPane.java` / `BResponsivePane.java` and `bajaui-ux.jar` `rc/ux/FlowPane.js`. FlowPane wraps widgets like words in a line. Sizing requires a ResponsivePane around every child, and percent widths are estimated with gap arithmetic, so the columns of one row don't line up with the next. The pane has no padding of its own and no card surface.

## Files

| Part | File | Role |
|---|---|---|
| wb | `ui/BAutoGridPane.java` | `BPane` layout and paint. Workbench and Hx both use this `doLayout`. |
| wb | `ui/BHxAutoGridPane.java` | Hx agent that adds the pane background plus a card layer written before the children, the same layering as `hx:HxPxBorderPane`. |
| ux | `ux/BUxAutoGridPane.java`, `rc/widgets/AutoGridPane.js` | UX Media agent: spandrel + CSS grid, structured like `bajaui:UxFlowPane`. |
| wb | `module.palette` | New `Layout > Auto Grid` entry, 960×480. |
| ux | `basidekick-ux.gradle.kts` | `bajaui-ux` (LayoutHintsSupport) and `gx-ux` (Brush/Color/Insets); both are ux-profile modules. |

The ScrollPane handling copies FlowPane's approach: the pane's preferred width is the viewport width, so it grows vertically instead of scrolling sideways. A nested Auto Grid measures its height from its actual width through `heightForWidth`.

`AutoGridPane.js` depends on `nmodule/bajaui/rc/mixin/LayoutHintsSupport`, which Tridium marks API Status: Private. It is the same mechanism `FlowPane.js` uses so a containing UX ScrollPane restricts horizontal scrolling. Recheck it when moving to a new Niagara release.

## Verification

- Partial `verification/static-check.py`: 36 registered types resolve, 82 manual slot getter/setter contracts pass, XML/palette parse, JS syntax passes. Its icon-parity section could not run because the original icon source was unreadable at the time. `BAutoGridPane.java` and `BHxAutoGridPane.java` were added to its list of basidekick-only files.
- The real `AutoGridPane.js` render function ran in Chromium with stubbed Niagara modules. Its column counts and cell widths matched the Java `columnsFor` / `layoutRows` math at 1200, 700 and 300 px, with fill row on and off and with max columns 3. Row heights were equal, and nothing scrolled horizontally at 300 px.
- **User build, Sept 30 20:45:** `basidekick-wb.jar` contains `BAutoGridPane.class` and `BHxAutoGridPane.class`, and `basidekick-ux.jar` registers `UxAutoGridPane`, so the source compiles. Workbench, Hx and station behavior have not been checked yet; paint, Hx card placement and the UX preferred-size behavior still need a runtime check.

## User-run checks

1. Build from the JENEsys root: `gradlew.bat :basidekick-rt:jar :basidekick-ux:jar :basidekick-wb:jar`, then install the module and restart Workbench/station.
2. Workbench: drop `Layout > Auto Grid` onto a PX page, add 6 Labels and resize. Columns should reflow, rows should be equal height, and cards should be rounded with a shadow.
3. Make the Auto Grid the content of a ScrollPane. The grid should fill the width, scroll only vertically, and have no horizontal scrollbar.
4. Hx: view the same page in a browser without UX Media. Cards should sit behind the labels and move when the window is resized.
5. UX Media: set the page media to UX. The layout should match, reflow should be live, and changing `visible` on a child should hide its card.
