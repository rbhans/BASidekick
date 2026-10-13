"""Generate the basidekick PX background SVGs into basidekick-wb/src/Backgrounds.

Niagara image brushes draw an image at its own size (no scaling), aligned or tiled.
So every background is 3840x2160 and composed so that any centered crop, down to
about 1024x768, still reads as a whole. Rules that keep them usable everywhere:

- SVG 1.1 that Batik renders: attributes only, no filters, no CSS variables, xlink.
- Glows fade to nothing before the edges, so every edge is the flat base color plus
  the pattern. With pattern periods that divide 2160 (and 3840 where possible) the
  images also tile seamlessly, for pages taller than 2160.

Run from the basidekick folder:  python3 tools/generate_backgrounds.py
"""
import math
from pathlib import Path

import numpy as np

W, H = 3840, 2160
OUT = Path(__file__).resolve().parents[1] / 'basidekick-wb/src/Backgrounds'

THEMES = {
    # hi / lo are the light and shadow colors used for texture relief; relief scales their opacity.
    'Light': {'base': '#eef2f6', 'ink': '#61768d', 'glows': ['#d3e4f1', '#d9ece6', '#f1e7dc'],
              'hi': '#ffffff', 'lo': '#26313d', 'relief': 1.0, 'light': True},
    'Dark': {'base': '#0d141d', 'ink': '#7d98b6', 'glows': ['#173150', '#103a40', '#1d2b45'],
             'hi': '#a9c6ea', 'lo': '#000000', 'relief': 0.85, 'light': False},
    # Pure grayscale dark: equal R, G and B throughout, for graphics that should carry all the color.
    'Graphite': {'base': '#141414', 'ink': '#a3a3a3', 'glows': ['#2b2b2b', '#232323', '#303030'],
                 'hi': '#ffffff', 'lo': '#000000', 'relief': 0.85, 'light': False},
    # Pure grayscale light: the light counterpart to Graphite.
    'Silver': {'base': '#efefef', 'ink': '#6b6b6b', 'glows': ['#e1e1e1', '#e7e7e7', '#f8f8f8'],
               'hi': '#ffffff', 'lo': '#2b2b2b', 'relief': 1.0, 'light': True},
}

# Large soft glows: (center x, center y, radius x, radius y, peak opacity). All stay inside
# the frame and overlap the central 1920x1080 crop.
GLOWS = [(1380, 820, 1280, 720, 0.9), (2520, 1360, 1220, 700, 0.8), (2050, 560, 900, 480, 0.6)]


def num(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def svg(defs, body, base, name):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<!-- basidekick PX background: {name}. 3840x2160; use as an image brush, centered. -->\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
            f'<defs>\n{defs}</defs>\n'
            f'<rect width="{W}" height="{H}" fill="{base}"/>\n{body}</svg>\n')


def glow_layer(colors, strength=1.0):
    defs, body = [], []
    for i, ((cx, cy, rx, ry, peak), color) in enumerate(zip(GLOWS, colors)):
        gid = f'glow{i}'
        defs.append(
            f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" '
            f'gradientTransform="translate({cx} {cy}) scale({rx} {ry})">'
            f'<stop offset="0" stop-color="{color}" stop-opacity="{round(peak * strength, 3)}"/>'
            f'<stop offset="0.55" stop-color="{color}" stop-opacity="{round(peak * strength * 0.45, 3)}"/>'
            f'<stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>\n')
        body.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#{gid})"/>\n')
    return ''.join(defs), ''.join(body)


def pattern_rect(pid):
    return f'<rect width="{W}" height="{H}" fill="url(#{pid})"/>\n'


# ---------------------------------------------------------------- designs

# Textures are one small seamless tile repeated across the frame. Every tile size divides
# 3840 and 2160. Marks that cross a tile edge are drawn past it on both sides: Batik places a
# pattern tile about half a pixel off, so a mark that stops exactly on the edge leaves a seam.

def op(t, value):
    return round(min(1.0, value * t['relief']), 3)


def texture(theme, t, name, tile_w, tile_h, content, glow=0.6):
    gdefs, gbody = glow_layer(t['glows'], glow)
    defs = gdefs + (f'<pattern id="tex" patternUnits="userSpaceOnUse" width="{tile_w}" height="{tile_h}">'
                    f'{content}</pattern>\n')
    return svg(defs, gbody + pattern_rect('tex'), t['base'], f'{name} {theme}')


def brushed(theme, t):
    """Brushed metal: thousands of short horizontal hairlines of varying strength."""
    rng = np.random.default_rng(31)
    tw, th = 480, 240
    buckets = {}
    for _ in range(1400):
        y = round(float(rng.uniform(0, th)), 1)
        x = float(rng.uniform(0, tw))
        length = float(rng.uniform(30, 420))
        color = 'hi' if rng.random() < 0.45 else 'lo'
        level = int(rng.integers(1, 5))
        width = 1 if rng.random() < 0.8 else 1.4
        # The whole line, plus a copy one tile to the left when it runs past the right edge.
        xs = [x] + ([x - tw] if x + length > tw else [])
        ys = [y] + ([y + th] if y < 1 else []) + ([y - th] if y > th - 1 else [])
        d = ''.join(f'M{num(rx)} {num(yy)}h{num(length)}' for rx in xs for yy in ys)
        buckets.setdefault((color, level, width), []).append(d)
    paths = ''.join(
        f'<path d="{"".join(ds)}" fill="none" stroke="{t[c]}" stroke-width="{w}" '
        f'stroke-opacity="{op(t, 0.018 * lvl if c == "hi" else 0.016 * lvl)}"/>'
        for (c, lvl, w), ds in sorted(buckets.items()))
    return texture(theme, t, 'Brushed', tw, th, paths, glow=0.8)


def linen(theme, t):
    """Woven linen: horizontal and vertical threads every 3px, each with its own weight."""
    rng = np.random.default_rng(43)
    tw, th = 480, 240
    parts = []
    for direction, count, span in (('h', th // 3, tw), ('v', tw // 3, th)):
        for i in range(count):
            pos = i * 3 + 1.5
            color = 'lo' if rng.random() < 0.6 else 'hi'
            strength = float(rng.uniform(0.02, 0.09))
            d = f'M-2 {pos}h{span + 4}' if direction == 'h' else f'M{pos} -2v{span + 4}'
            parts.append(f'<path d="{d}" stroke="{t[color]}" stroke-width="1.2" stroke-opacity="{op(t, strength)}"/>')
    # Slubs: short thicker lumps in the weft, as in real linen.
    for _ in range(40):
        y = int(rng.integers(0, th // 3)) * 3 + 1.5
        x = float(rng.uniform(0, tw - 60))
        parts.append(f'<path d="M{num(x)} {y}h{num(float(rng.uniform(12, 60)))}" stroke="{t["lo"]}" '
                     f'stroke-width="2" stroke-linecap="round" stroke-opacity="{op(t, 0.08)}"/>')
    return texture(theme, t, 'Linen', tw, th, ''.join(parts), glow=0.7)


def concrete(theme, t):
    """Cast concrete: fine speckle, a few pores, and faint mottling."""
    rng = np.random.default_rng(59)
    tw, th = 480, 432                       # 3840/480 = 8, 2160/432 = 5
    groups = {'mlo': [], 'mhi': [], 'lo': [], 'hi': []}

    def dot(x, y, r, color, opacity):
        for dx in (-tw, 0, tw):
            for dy in (-th, 0, th):
                cx, cy = x + dx, y + dy
                if -r <= cx <= tw + r and -r <= cy <= th + r:
                    groups[color].append(f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" fill-opacity="{opacity}"/>')

    for _ in range(34):                     # soft-edged mottling
        dot(float(rng.uniform(0, tw)), float(rng.uniform(0, th)), float(rng.uniform(40, 110)),
            'mlo' if rng.random() < 0.5 else 'mhi', op(t, 0.06))
    for _ in range(2600):                   # speckle
        dot(float(rng.uniform(0, tw)), float(rng.uniform(0, th)), float(rng.uniform(0.5, 1.3)),
            'lo' if rng.random() < 0.7 else 'hi', op(t, float(rng.uniform(0.06, 0.22))))
    for _ in range(70):                     # pores, each with a lit lower lip
        x, y, r = float(rng.uniform(0, tw)), float(rng.uniform(0, th)), float(rng.uniform(1.6, 3.2))
        dot(x, y + 0.8, r, 'hi', op(t, 0.18))
        dot(x, y, r, 'lo', op(t, 0.28))
    fills = {'lo': t['lo'], 'hi': t['hi'], 'mlo': 'url(#mlo)', 'mhi': 'url(#mhi)'}
    soft = ''.join(f'<radialGradient id="m{c}"><stop offset="0" stop-color="{t[c]}"/>'
                   f'<stop offset="1" stop-color="{t[c]}" stop-opacity="0"/></radialGradient>' for c in ('lo', 'hi'))
    content = soft + ''.join(f'<g fill="{fills[c]}">{"".join(items)}</g>' for c, items in groups.items())
    return texture(theme, t, 'Concrete', tw, th, content, glow=0.7)


def perforated(theme, t):
    """Perforated metal panel: staggered round holes, shaded as if lit from the top left."""
    hole, tw = 4.2, 24
    content = ''
    for cx, cy in ((6, 6), (18, 18)):
        content += (f'<circle cx="{cx}" cy="{cy}" r="{hole}" fill="{t["lo"]}" fill-opacity="{op(t, 0.26)}"/>'
                    # lit lower-right rim of the hole
                    f'<path d="M{num(cx + hole)} {cy}A{hole} {hole} 0 0 1 {cx} {num(cy + hole)}" fill="none" '
                    f'stroke="{t["hi"]}" stroke-width="1" stroke-opacity="{op(t, 0.28)}"/>')
    return texture(theme, t, 'Perforated', tw, tw, content, glow=0.8)


def tread_plate(theme, t):
    """Diamond tread plate: raised lozenges alternating direction, with highlight and shadow."""
    tw = 48
    content = ''
    for cx, cy, angle in ((12, 12, 45), (36, 36, 45), (36, 12, -45), (12, 36, -45)):
        dx = 8 * math.cos(math.radians(angle))
        dy = 8 * math.sin(math.radians(angle))
        line = lambda ox, oy: f'M{num(cx - dx + ox)} {num(cy - dy + oy)}L{num(cx + dx + ox)} {num(cy + dy + oy)}'
        content += (f'<path d="{line(1.2, 1.2)}" stroke="{t["lo"]}" stroke-width="5" stroke-linecap="round" stroke-opacity="{op(t, 0.18)}"/>'
                    f'<path d="{line(0, 0)}" stroke="{t["ink"]}" stroke-width="5" stroke-linecap="round" stroke-opacity="{op(t, 0.07)}"/>'
                    f'<path d="{line(-0.8, -0.8)}" stroke="{t["hi"]}" stroke-width="1.6" stroke-linecap="round" stroke-opacity="{op(t, 0.28)}"/>')
    return texture(theme, t, 'TreadPlate', tw, tw, content, glow=0.8)


def carbon(theme, t):
    """Carbon fibre plain weave: 12px tows, alternating direction, each with a cylindrical sheen."""
    c = 12
    sheen = (f'<stop offset="0" stop-color="{t["lo"]}" stop-opacity="{op(t, 0.26)}"/>'
             f'<stop offset="0.5" stop-color="{t["hi"]}" stop-opacity="{op(t, 0.10)}"/>'
             f'<stop offset="1" stop-color="{t["lo"]}" stop-opacity="{op(t, 0.26)}"/>')
    content = (f'<linearGradient id="towH" x1="0" y1="0" x2="0" y2="1">{sheen}</linearGradient>'
               f'<linearGradient id="towV" x1="0" y1="0" x2="1" y2="0">{sheen}</linearGradient>'
               + ''.join(f'<rect x="{i * c}" y="{j * c}" width="{c}" height="{c}" '
                         f'fill="url(#{"towH" if (i + j) % 2 == 0 else "towV"})"/>'
                         for i in range(-1, 3) for j in range(-1, 3)))
    return texture(theme, t, 'Carbon', 2 * c, 2 * c, content, glow=0.8)


def grid(theme, t):
    # Light is drafting vellum with blue-pencil rules; Dark is blueprint; Graphite and Silver are neutral.
    if theme == 'Light':
        base, ink, glows, minor, major = '#f5f3ed', '#7f9cbb', ['#e3ebf3', '#e9efe9', '#f3ece0'], 0.30, 0.55
    elif theme == 'Graphite':
        base, ink, glows, minor, major = t['base'], t['ink'], t['glows'], 0.08, 0.17
    elif theme == 'Silver':
        base, ink, glows, minor, major = t['base'], t['ink'], t['glows'], 0.20, 0.40
    else:
        base, ink, glows, minor, major = '#0e2742', '#8cc0ee', ['#1b4a77', '#14405a', '#1d3a63'], 0.10, 0.22
    gdefs, gbody = glow_layer(glows, 0.9)
    # 24px minor / 120px major; both divide 3840 and 2160, so the image tiles seamlessly.
    defs = gdefs + (
        f'<pattern id="minor" patternUnits="userSpaceOnUse" width="24" height="24">'
        f'<path d="M0.5 0V24M0 0.5H24" fill="none" stroke="{ink}" stroke-width="1" stroke-opacity="{minor}"/></pattern>\n'
        f'<pattern id="major" patternUnits="userSpaceOnUse" width="120" height="120">'
        f'<path d="M0.5 0V120M0 0.5H120" fill="none" stroke="{ink}" stroke-width="1.25" stroke-opacity="{major}"/></pattern>\n')
    return svg(defs, gbody + pattern_rect('minor') + pattern_rect('major'), base, f'Grid {theme}')


def dots(theme, t):
    gdefs, gbody = glow_layer(t['glows'], 0.85)
    dot, cross = (0.42, 0.55) if t['light'] else (0.30, 0.42)
    # Dots every 24px; a small registration cross every 120px.
    defs = gdefs + (
        f'<pattern id="dots" patternUnits="userSpaceOnUse" width="24" height="24">'
        f'<circle cx="12" cy="12" r="1.5" fill="{t["ink"]}" fill-opacity="{dot}"/></pattern>\n'
        f'<pattern id="marks" patternUnits="userSpaceOnUse" width="120" height="120">'
        f'<path d="M60 54V66M54 60H66" fill="none" stroke="{t["ink"]}" stroke-width="1.25" '
        f'stroke-linecap="round" stroke-opacity="{cross}"/></pattern>\n')
    return svg(defs, gbody + pattern_rect('dots') + pattern_rect('marks'), t['base'], f'Dots {theme}')


def isometric(theme, t):
    gdefs, gbody = glow_layer(t['glows'], 0.85)
    line, node = (0.16, 0.45) if t['light'] else (0.10, 0.32)
    # True 30-degree lattice: 48px vertical spacing (divides 2160, so it tiles vertically).
    L = 48
    w = L * math.sqrt(3)
    hw = w / 2
    d = (f'M0 0L{num(w)} {L}M0 {L}L{num(w)} 0'          # +30 and -30 degree families
         f'M0 0V{L}M{num(hw)} 0V{L}M{num(w)} 0V{L}')      # vertical family
    defs = gdefs + (
        f'<pattern id="iso" patternUnits="userSpaceOnUse" width="{w:.4f}" height="{L}">'
        f'<path d="{d}" fill="none" stroke="{t["ink"]}" stroke-width="1" stroke-opacity="{line}"/>'
        f'<circle cx="0" cy="0" r="1.6" fill="{t["ink"]}" fill-opacity="{node}"/>'
        f'<circle cx="{w:.4f}" cy="0" r="1.6" fill="{t["ink"]}" fill-opacity="{node}"/>'
        f'<circle cx="0" cy="{L}" r="1.6" fill="{t["ink"]}" fill-opacity="{node}"/>'
        f'<circle cx="{w:.4f}" cy="{L}" r="1.6" fill="{t["ink"]}" fill-opacity="{node}"/>'
        f'<circle cx="{hw:.4f}" cy="{L / 2}" r="1.6" fill="{t["ink"]}" fill-opacity="{node}"/></pattern>\n')
    return svg(defs, gbody + pattern_rect('iso'), t['base'], f'Isometric {theme}')


def periodic_field(seed, terms, step):
    """Smooth field built from integer-frequency waves, so it repeats exactly every W and H."""
    rng = np.random.default_rng(seed)
    xs = np.arange(0, W + step, step, dtype=float)
    ys = np.arange(0, H + step, step, dtype=float)
    X, Y = np.meshgrid(xs, ys)
    f = np.zeros_like(X)
    for _ in range(terms):
        m, n = int(rng.integers(-4, 5)), int(rng.integers(-3, 4))
        if m == 0 and n == 0:
            continue
        amp = 1.0 / math.hypot(m, n) ** 1.1
        f += amp * np.cos(2 * math.pi * (m * X / W + n * Y / H) + rng.uniform(0, 2 * math.pi))
    return xs, ys, f


def marching_squares(xs, ys, f, level):
    """Contour polylines of f at level, with segments joined into chains."""
    a, b, c, d = f[:-1, :-1], f[:-1, 1:], f[1:, 1:], f[1:, :-1]  # tl, tr, br, bl
    idx = ((a > level) * 8 + (b > level) * 4 + (c > level) * 2 + (d > level)).astype(int)
    step = xs[1] - xs[0]
    segments = []
    # Edge ids: ('h', row, col) top edge of cell row/col; ('v', row, col) left edge.
    table = {1: [('L', 'B')], 2: [('B', 'R')], 3: [('L', 'R')], 4: [('T', 'R')], 5: [('L', 'T'), ('B', 'R')],
             6: [('T', 'B')], 7: [('L', 'T')], 8: [('L', 'T')], 9: [('T', 'B')], 10: [('T', 'R'), ('L', 'B')],
             11: [('T', 'R')], 12: [('L', 'R')], 13: [('B', 'R')], 14: [('L', 'B')]}
    points = {}

    def edge_point(side, r, col):
        if side == 'T':
            key, v0, v1, p0, p1 = ('h', r, col), f[r, col], f[r, col + 1], (xs[col], ys[r]), (xs[col + 1], ys[r])
        elif side == 'B':
            key, v0, v1, p0, p1 = ('h', r + 1, col), f[r + 1, col], f[r + 1, col + 1], (xs[col], ys[r + 1]), (xs[col + 1], ys[r + 1])
        elif side == 'L':
            key, v0, v1, p0, p1 = ('v', r, col), f[r, col], f[r + 1, col], (xs[col], ys[r]), (xs[col], ys[r + 1])
        else:
            key, v0, v1, p0, p1 = ('v', r, col + 1), f[r, col + 1], f[r + 1, col + 1], (xs[col + 1], ys[r]), (xs[col + 1], ys[r + 1])
        if key not in points:
            t = (level - v0) / (v1 - v0)
            points[key] = (p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]))
        return key

    for r, col in zip(*np.nonzero((idx > 0) & (idx < 15))):
        for s0, s1 in table[idx[r, col]]:
            segments.append((edge_point(s0, r, col), edge_point(s1, r, col)))

    neighbors = {}
    for p, q in segments:
        neighbors.setdefault(p, []).append(q)
        neighbors.setdefault(q, []).append(p)
    seen, chains = set(), []
    starts = [k for k, v in neighbors.items() if len(v) == 1] + list(neighbors)
    for start in starts:
        if start in seen:
            continue
        chain, prev, cur = [start], None, start
        seen.add(start)
        while True:
            nxt = [n for n in neighbors[cur] if n != prev and n not in seen]
            if not nxt:
                if len(chain) > 2 and chain[0] in neighbors[cur]:
                    chain.append(chain[0])   # closed loop
                break
            prev, cur = cur, nxt[0]
            seen.add(cur)
            chain.append(cur)
        if len(chain) >= 3:
            chains.append([points[k] for k in chain])
    return chains


def smooth_path(pts):
    """Quadratic curve through the midpoints, using each vertex as the control point."""
    if len(pts) < 3:
        return ''
    out = [f'M{num(pts[0][0])} {num(pts[0][1])}']
    for i in range(1, len(pts) - 1):
        mx, my = (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2
        out.append(f'Q{num(pts[i][0])} {num(pts[i][1])} {num(mx)} {num(my)}')
    out.append(f'L{num(pts[-1][0])} {num(pts[-1][1])}')
    return ''.join(out)


def contour(theme, t):
    gdefs, gbody = glow_layer(t['glows'], 0.8)
    xs, ys, f = periodic_field(seed=17, terms=14, step=12)
    lo, hi = np.percentile(f, 2), np.percentile(f, 98)
    levels = np.linspace(lo, hi, 30)[1:-1]
    thin, bold = (0.22, 0.42) if t['light'] else (0.13, 0.28)
    paths = []
    for i, level in enumerate(levels):
        index = i % 5 == 2   # every fifth line is an index contour, as on survey maps
        d = ''.join(smooth_path(chain[::2] + ([chain[-1]] if len(chain) % 2 == 0 else [])) for chain in marching_squares(xs, ys, f, level))
        if d:
            paths.append(f'<path d="{d}" fill="none" stroke="{t["ink"]}" stroke-linejoin="round" '
                         f'stroke-width="{1.5 if index else 1}" stroke-opacity="{bold if index else thin}"/>\n')
    return svg(gdefs, gbody + ''.join(paths), t['base'], f'Contour {theme}')


def airflow(theme, t):
    gdefs, gbody = glow_layer(t['glows'], 0.85)
    rng = np.random.default_rng(5)
    rows = 54                      # one streamline every 40px; 2160 / 54 = 40, so it tiles vertically
    spacing = H / rows
    waves = [(int(k), rng.uniform(0, 2 * math.pi), a) for k, a in ((2, 70), (3, 38), (5, 16))]
    xs = np.arange(0, W + 24, 24, dtype=float)
    base_op = 0.30 if t['light'] else 0.18
    paths = []
    # Lines swing up to ~124px, so draw 4 extra rows past each edge. Whatever one tile
    # clips at its edge is then drawn by its neighbour, and tiling stays seamless.
    for r in range(-4, rows + 5):
        y0 = r * spacing
        # Phase drifts slowly with the row, so neighbouring lines bunch and spread like air.
        drift = 2 * math.pi * r / rows
        y = y0 + sum(a * np.sin(2 * math.pi * k * xs / W + p + drift * (i + 1)) for i, (k, p, a) in enumerate(waves))
        pts = list(zip(xs, y))
        weight = 0.5 + 0.5 * math.cos(2 * math.pi * r * 3 / rows)   # three soft bands of emphasis
        op = round(base_op * (0.35 + 0.65 * weight), 3)
        paths.append(f'<path d="{smooth_path(pts)}" fill="none" stroke="{t["ink"]}" stroke-width="1.1" '
                     f'stroke-linecap="round" stroke-opacity="{op}"/>\n')
    return svg(gdefs, gbody + ''.join(paths), t['base'], f'Airflow {theme}')


DESIGNS = {'Brushed': brushed, 'Linen': linen, 'Concrete': concrete, 'Perforated': perforated,
           'TreadPlate': tread_plate, 'Carbon': carbon, 'Grid': grid, 'Dots': dots,
           'Isometric': isometric, 'Contour': contour, 'Airflow': airflow}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    # This folder belongs to the generator: drop designs that are no longer defined.
    wanted = {f'{n}-{th}.svg' for n in DESIGNS for th in THEMES}
    for stale in OUT.glob('*.svg'):
        if stale.name not in wanted and not stale.name.startswith('._'):
            stale.unlink()
            print(f'removed {stale.name}')
    for name, make in DESIGNS.items():
        for theme, t in THEMES.items():
            path = OUT / f'{name}-{theme}.svg'
            path.write_text(make(theme, t), encoding='utf-8')
            print(f'{path.relative_to(OUT.parents[2])}  {path.stat().st_size // 1024} KB')
