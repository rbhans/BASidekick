# PX backgrounds

October 2, 2026. Adds 44 SVG page backgrounds to basidekick for use as PX image brushes: 11 designs, each in Light, Silver (grayscale light), Dark (blue) and Graphite (grayscale dark). Silver and Graphite use only equal R/G/B colors.

Revision the same day: the user wanted grayscale darks and real texture rather than gradients ("can do that in niagara already"). Ambient (glows only) was dropped and Graphite was added. Six textures were added: Brushed, Linen, Concrete, Perforated, TreadPlate and Carbon. Silver was added afterwards on request as the grayscale light counterpart to Graphite.

## Why 3840×2160

Niagara image brushes never scale. In N4.15.3.28 `gx-rt` `BBrush.Image`, the only options are tile (`false`/`true`/`x`/`y`) and left/center/right, top/center/bottom alignment, and the image is drawn at its own size. Each SVG is therefore 4K and composed so that any centered crop, from about 1024×768 up, reads as complete.

Textures are one small tile (24 to 480 px) repeated across the frame. Every glow fades out before the edges, so each edge is the flat base color plus the pattern. Pattern periods divide 2160 (24/120 grid and dots; 48 isometric; 40 airflow rows) and, except Isometric, also divide 3840. The Contour field uses integer-frequency waves over the full frame. So tile `y` (and tile `true`, except Isometric) is seamless for pages taller than 2160.

## Files

| File | Role |
|---|---|
| `basidekick-wb/src/Backgrounds/<Design>-<Light\|Silver\|Dark\|Graphite>.svg` | Textures: Brushed, Linen, Concrete, Perforated, TreadPlate, Carbon. Patterns: Grid (vellum / blueprint / neutral), Dots, Isometric (true 30°), Contour, Airflow. 1–36 KB each, except Concrete (164 KB), Airflow (225 KB) and Contour (235 KB). |
| `tools/generate_backgrounds.py` | Seeded generator; the colors and designs live here. Uses only numpy. |
| `basidekick-wb.gradle.kts` | Packages `Backgrounds/**/*.svg` into the wb jar, next to `Icons`. |
| `module.palette` | `Graphics > Backgrounds > Light\|Silver\|Dark\|Graphite`: one 1920×1080 `ui:CanvasPane` per file, with its `background` brush set. |
| `verification/static-check.py` | Fails if a palette background `module://` reference has no file. |

The brush encoding `image( source(module://…) )` and the palette form `<p n="background" t="gx:Brush" v="image( source(module://…) )"/>` come from shipped `honeywellAXPlatinum.jar` (a wb-profile image module) and from PX files in `stations/Pine500BAS`.

## Verification

- **Issue: texture tile seam in Batik.**
  - *Symptom:* Brushed showed a 1px column about 7–10% darker at every 480px tile edge.
  - *Cause:* Batik places a pattern tile about half a pixel off, so hairlines that stopped exactly on the tile edge left a gap.
  - *Fix:* marks that cross a tile edge are now drawn past it on both sides (Brushed lines, Linen threads, Carbon cells).
  - *Verification:* column brightness across the boundary is now flat (±0.2%). Concrete and TreadPlate never had the issue: their marks either extend past the edge or never reach it.
- All 44 SVGs were built and painted by Niagara's own Batik (`svgBatik-wb.jar` + `gx-wb.jar`, `GVTBuilder`) in a scratch harness, with no errors, at 70–130 ms per 1080p crop. The output matched Chromium.
- Whole-image seams were checked by painting two copies stacked and side by side in Batik for all 44. Magnified joins of Brushed, Linen and Concrete show no line. Airflow first showed breaks at the vertical join because its swinging lines were clipped at the edge. Fixed by drawing 4 extra rows past each edge; rechecked clean. Contour and Airflow are continuous horizontally.
- Partial static check: 33 types, 79 slot contracts, XML/palette/JS and background references pass. Icon parity still can't run while the original icon source is unreadable.
- **Not run:** Gradle build, Workbench, Hx or UX Media.

## User-run checks

1. Build with `gradlew.bat :basidekick-rt:jar :basidekick-ux:jar :basidekick-wb:jar`, install, and restart Workbench/station.
2. In Workbench's palette, open `Graphics > Backgrounds > Graphite` and drop Brushed onto a PX page. It should render as neutral gray brushed metal.
3. On another pane, set Background → Image to `module://basidekick/Backgrounds/Contour-Light.svg` and leave it centered. Check it in Workbench, Hx and UX Media.
4. On a page taller than 2160, set tile to `y` and scroll; there should be no visible seam.
