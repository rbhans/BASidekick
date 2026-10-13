package com.qagraphics.basidekick.ui;

import javax.baja.gx.BBrush;
import javax.baja.gx.BColor;
import javax.baja.gx.BFont;
import javax.baja.gx.BPen;
import javax.baja.gx.BTransform;
import javax.baja.gx.Graphics;
import javax.baja.gx.Point;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.ui.BNullWidget;
import javax.baja.ui.BWidget;
import javax.baja.ui.MouseCursor;
import javax.baja.ui.event.BMouseEvent;
import javax.baja.ui.event.BMouseWheelEvent;
import javax.baja.ui.pane.BPane;

/**
 * Zoom/pan viewport for any content, with zoom controls and a minimap. Structured like
 * bajaui:ScrollPane and bajaui:TransformPane: a single Content widget (typically a CanvasPane
 * holding a graphic) shown at its preferred size.
 *
 * The view transform is applied the way bajaui:CanvasPane applies its scale: once in paint,
 * and inverted in childAt / translateToChild / translateFromChild, so bindings, hit testing
 * and the PX editor keep working inside. The viewer's pan and zoom are never saved.
 * Hx uses BHxZoomPane and UxMedia uses ZoomPane.js for the same behavior.
 */
@NiagaraType
@NoSlotomatic
public class BZoomPane extends BPane
{
  public static final Property content = newProperty(0, new BNullWidget(), null);
  public BWidget getContent() { return (BWidget)get(content); }
  public void setContent(BWidget value) { set(content, value, null); }
  /** Open zoomed to fit the content; off opens at 100% from the top-left. */
  public static final Property startFitted = newProperty(0, true, null);
  public boolean getStartFitted() { return getBoolean(startFitted); }
  public void setStartFitted(boolean value) { setBoolean(startFitted, value, null); }
  public static final Property minZoom = newProperty(0, 0.1d, BFacets.make(BFacets.MIN, BDouble.make(0.02)));
  public double getMinZoom() { return getDouble(minZoom); }
  public void setMinZoom(double value) { setDouble(minZoom, value, null); }
  public static final Property maxZoom = newProperty(0, 8d, BFacets.make(BFacets.MIN, BDouble.make(0.1)));
  public double getMaxZoom() { return getDouble(maxZoom); }
  public void setMaxZoom(double value) { setDouble(maxZoom, value, null); }
  /** Let viewers pan and zoom. Off shows the content at its start view only. */
  public static final Property panZoom = newProperty(0, true, null);
  public boolean getPanZoom() { return getBoolean(panZoom); }
  public void setPanZoom(boolean value) { setBoolean(panZoom, value, null); }
  public static final Property background = newProperty(0, BBrush.makeSolid(BColor.make("#eef1f4")), null);
  public BBrush getBackground() { return (BBrush)get(background); }
  public void setBackground(BBrush value) { set(background, value, null); }
  public static final Property showMinimap = newProperty(0, true, null);
  public boolean getShowMinimap() { return getBoolean(showMinimap); }
  public void setShowMinimap(boolean value) { setBoolean(showMinimap, value, null); }
  public static final Property showControls = newProperty(0, true, null);
  public boolean getShowControls() { return getBoolean(showControls); }
  public void setShowControls(boolean value) { setBoolean(showControls, value, null); }

  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BZoomPane.class);

  @Override public void changed(Property property, Context cx)
  {
    if (property == startFitted || property == content) moved = false;
    relayout();
    repaint();
  }

////////////////////////////////////////////////////////////////
// View state: content point at the top-left (vx, vy) and zoom vz
////////////////////////////////////////////////////////////////

  private double vx, vy, vz = 1;
  /** Set once the viewer pans or zooms; until then the start view follows resizes. */
  private boolean moved;

  private double clampZoom(double z)
  {
    double lo = Math.max(0.02, getMinZoom());
    double hi = Math.max(lo, getMaxZoom());
    return Math.max(lo, Math.min(hi, z));
  }

  /** Content to pane transform: pane = (content - view) * zoom. */
  public BTransform getViewTransform()
  {
    return BTransform.make(new BTransform.Translate(-vx * vz, -vy * vz), new BTransform.Scale(vz, vz));
  }

  public double getCurrentZoom() { return vz; }

  private double contentW() { return Math.max(1, getContent().getWidth()); }
  private double contentH() { return Math.max(1, getContent().getHeight()); }

  /** Like a scroll pane: content smaller than the view is centered, larger content can't leave its edges. */
  private void clampView()
  {
    double vw = getWidth() / vz, vh = getHeight() / vz;
    vx = contentW() <= vw ? (contentW() - vw) / 2 : Math.max(0, Math.min(contentW() - vw, vx));
    vy = contentH() <= vh ? (contentH() - vh) / 2 : Math.max(0, Math.min(contentH() - vh, vy));
  }

  private void startView()
  {
    if (getStartFitted()) fitView();
    else { vz = clampZoom(1); vx = 0; vy = 0; clampView(); }
  }

  private void fitView()
  {
    if (getWidth() <= 0 || getHeight() <= 0) return;
    vz = clampZoom(Math.min(getWidth() / contentW(), getHeight() / contentH()));
    clampView();
  }

  /** Zoom by a factor keeping the content point under (sx, sy) fixed. */
  public void zoomAt(double sx, double sy, double factor)
  {
    double wx = vx + sx / vz, wy = vy + sy / vz;
    vz = clampZoom(vz * factor);
    vx = wx - sx / vz;
    vy = wy - sy / vz;
    clampView();
    moved = true;
    repaint();
  }

  public void panBy(double dx, double dy)
  {
    vx -= dx / vz;
    vy -= dy / vz;
    clampView();
    moved = true;
    repaint();
  }

  public void zoomToFit()
  {
    fitView();
    moved = true;
    repaint();
  }

////////////////////////////////////////////////////////////////
// Layout: content at its preferred size (the viewport size if it has none)
////////////////////////////////////////////////////////////////

  @Override public void computePreferredSize()
  {
    BWidget c = getContent();
    c.computePreferredSize();
    setPreferredSize(Math.max(1, c.getPreferredWidth()), Math.max(1, c.getPreferredHeight()));
  }

  @Override public void doLayout(BWidget[] kids)
  {
    BWidget c = getContent();
    c.computePreferredSize();
    double w = c.getPreferredWidth() > 0 ? c.getPreferredWidth() : getWidth();
    double h = c.getPreferredHeight() > 0 ? c.getPreferredHeight() : getHeight();
    c.setBounds(0, 0, w, h);
    if (!moved || isDesignTime()) startView();
    else clampView();
  }

////////////////////////////////////////////////////////////////
// Hit testing
////////////////////////////////////////////////////////////////

  /**
   * Route a point into the content only where something there takes input (a bound label,
   * a button...). Over plain panes and unbound shapes the pane keeps the event, so dragging
   * the graphic pans it, as on a map. In the PX editor everything routes normally.
   */
  @Override public BWidget childAt(Point pt)
  {
    if (!isDesignTime() && overOverlay(pt.x, pt.y)) return null;
    Point local = getViewTransform().getInverse().transform(pt, null);
    BWidget hit = super.childAt(local);
    if (hit == null || isDesignTime() || !getPanZoom()) return hit;
    Point inner = new Point(local.x - hit.getX(), local.y - hit.getY());
    BWidget target = hit.descendentAt(inner);
    for (BWidget w = target != null ? target : hit; w != null && w != this; w = w.getParentWidget())
      if (!(w instanceof BPane) && w.receiveInputEvents()) return hit;
    return null;
  }

  @Override public Point translateToChild(BWidget child, Point pt)
  {
    pt = getViewTransform().getInverse().transform(pt, pt);
    return super.translateToChild(child, pt);
  }

  @Override public Point translateFromChild(BWidget child, Point pt)
  {
    pt.x += child.getX();
    pt.y += child.getY();
    return getViewTransform().transform(pt, pt);
  }

////////////////////////////////////////////////////////////////
// Paint
////////////////////////////////////////////////////////////////

  @Override public void paint(Graphics g)
  {
    double w = getWidth(), h = getHeight();
    BBrush brush = getBackground();
    if (!brush.isNull())
    {
      g.setBrush(brush);
      g.fillRect(0, 0, w, h);
    }
    BWidget c = getContent();
    g.push();
    try
    {
      g.clip(0, 0, w, h);
      g.transform(getViewTransform());
      g.clip(0, 0, c.getWidth(), c.getHeight());
      c.paint(g);
    }
    catch (Throwable e) { e.printStackTrace(); }
    finally { g.pop(); }

    if (!isDesignTime())
    {
      if (getShowMinimap()) paintMinimap(g);
      if (getShowControls() && getPanZoom()) paintControls(g);
    }
  }

////////////////////////////////////////////////////////////////
// Overlay: minimap (bottom right) and zoom controls (bottom left)
////////////////////////////////////////////////////////////////

  private static final double MAP_MAX = 180, PAD = 12, BTN = 30;
  private static final String[] BUTTONS = { "−", "100%", "+", "Fit" };
  private static final double[] BUTTON_W = { BTN, 52, BTN, 40 };
  private static final BColor PANEL = BColor.make(255, 255, 255, 235), EDGE = BColor.make("#d5dbe2"),
    INK = BColor.make("#3b4652"), ACCENT = BColor.make("#2463eb");

  /** Minimap keeps the content's aspect ratio, at most 180px on its long side. */
  private double[] mapRect()
  {
    double s = MAP_MAX / Math.max(contentW(), contentH());
    double mw = Math.max(40, contentW() * s), mh = Math.max(30, contentH() * s);
    return new double[] { getWidth() - PAD - mw, getHeight() - PAD - mh, mw, mh };
  }

  private double controlsWidth() { double t = 0; for (double b : BUTTON_W) t += b; return t; }

  private double[] controlsRect() { return new double[] { PAD, getHeight() - PAD - BTN, controlsWidth(), BTN }; }

  private boolean overOverlay(double x, double y)
  {
    return (getShowMinimap() && inside(mapRect(), x, y)) || (getShowControls() && getPanZoom() && inside(controlsRect(), x, y));
  }

  private static boolean inside(double[] r, double x, double y) { return x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]; }

  private void paintMinimap(Graphics g)
  {
    double[] r = mapRect();
    double s = Math.min(r[2] / contentW(), r[3] / contentH());
    g.setBrush(BBrush.makeSolid(PANEL));
    g.fillRect(r[0], r[1], r[2], r[3]);
    g.push();
    try
    {
      // A live thumbnail: the content itself, painted small.
      g.clip(r[0], r[1], r[2], r[3]);
      g.translate(r[0], r[1]);
      g.transform(BTransform.makeScale(s, s));
      g.clip(0, 0, contentW(), contentH());
      getContent().paint(g);
    }
    catch (Throwable e) { e.printStackTrace(); }
    finally { g.pop(); }
    g.setPen(BPen.make(1));
    g.setBrush(BBrush.makeSolid(EDGE));
    g.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1);
    // Visible area, clipped to the map.
    double x0 = Math.max(0, vx), y0 = Math.max(0, vy);
    double x1 = Math.min(contentW(), vx + getWidth() / vz), y1 = Math.min(contentH(), vy + getHeight() / vz);
    g.setBrush(BBrush.makeSolid(ACCENT));
    g.setPen(BPen.make(1.5));
    g.strokeRect(r[0] + x0 * s, r[1] + y0 * s, Math.max(2, (x1 - x0) * s), Math.max(2, (y1 - y0) * s));
  }

  private void paintControls(Graphics g)
  {
    double[] r = controlsRect();
    g.setBrush(BBrush.makeSolid(PANEL));
    g.fillRect(r[0], r[1], r[2], r[3]);
    g.setBrush(BBrush.makeSolid(EDGE));
    g.setPen(BPen.make(1));
    g.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1);
    g.setFont(BFont.make("11pt Sans-Serif"));
    double x = r[0];
    for (int i = 0; i < BUTTONS.length; i++)
    {
      String text = i == 1 ? Math.round(vz * 100) + "%" : BUTTONS[i];
      g.setBrush(BBrush.makeSolid(INK));
      double tw = text.length() * 6.6;
      g.drawString(text, x + (BUTTON_W[i] - tw) / 2, r[1] + 20);
      if (i > 0)
      {
        g.setBrush(BBrush.makeSolid(EDGE));
        g.strokeLine(x + 0.5, r[1] + 6, x + 0.5, r[1] + BTN - 6);
      }
      x += BUTTON_W[i];
    }
  }

////////////////////////////////////////////////////////////////
// Interaction (runtime only)
////////////////////////////////////////////////////////////////

  private double lastX, lastY;
  private boolean panning, mapDragging;

  private boolean interactive() { return !isDesignTime() && getPanZoom(); }

  @Override public void mousePressed(BMouseEvent event)
  {
    if (!interactive()) return;
    double x = event.getX(), y = event.getY();
    if (getShowControls() && inside(controlsRect(), x, y)) { pressControl(x - controlsRect()[0]); return; }
    if (getShowMinimap() && inside(mapRect(), x, y)) { mapDragging = true; centerFromMap(x, y); return; }
    if (event.getClickCount() == 2) { zoomToFit(); return; }
    panning = true;
    lastX = x;
    lastY = y;
    setMouseCursor(MouseCursor.grabHand);
  }

  @Override public void mouseDragged(BMouseEvent event)
  {
    if (mapDragging) { centerFromMap(event.getX(), event.getY()); return; }
    if (!panning) return;
    panBy(event.getX() - lastX, event.getY() - lastY);
    lastX = event.getX();
    lastY = event.getY();
  }

  @Override public void mouseReleased(BMouseEvent event)
  {
    if (panning) setMouseCursor(MouseCursor.normal);
    panning = false;
    mapDragging = false;
  }

  @Override public void mouseWheel(BMouseWheelEvent event)
  {
    if (!interactive()) return;
    zoomAt(event.getX(), event.getY(), Math.pow(1.1, -event.getPreciseWheelRotation()));
  }

  private void pressControl(double offset)
  {
    double cx = getWidth() / 2, cy = getHeight() / 2, edge = 0;
    for (int i = 0; i < BUTTON_W.length; i++)
    {
      edge += BUTTON_W[i];
      if (offset >= edge) continue;
      switch (i)
      {
        case 0: zoomAt(cx, cy, 1 / 1.25); break;
        case 1: zoomAt(cx, cy, 1 / vz); break;
        case 2: zoomAt(cx, cy, 1.25); break;
        default: zoomToFit();
      }
      return;
    }
  }

  /** Center the view on the minimap point (the map always shows the whole content). */
  private void centerFromMap(double x, double y)
  {
    double[] r = mapRect();
    double s = Math.min(r[2] / contentW(), r[3] / contentH());
    vx = (x - r[0]) / s - getWidth() / 2 / vz;
    vy = (y - r[1]) / s - getHeight() / 2 / vz;
    clampView();
    moved = true;
    repaint();
  }

  @Override public BIcon getIcon() { return icon; }
  private static final BIcon icon = BIcon.std("widgets/scrollPane.png");
}
