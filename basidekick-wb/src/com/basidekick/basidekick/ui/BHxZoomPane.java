package com.basidekick.basidekick.ui;

import javax.baja.hx.HxOp;
import javax.baja.hx.HxUtil;
import javax.baja.hx.PropertiesCollection;
import javax.baja.hx.px.BHxPxWidget;
import javax.baja.hx.px.MouseEventCommand;
import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;

/**
 * Hx rendering for Zoom Pane. Hx renders the content from the Java layout as usual;
 * zoompane.js moves it into a transformed layer and adds the controls and minimap.
 * Pan and zoom stay in the browser.
 */
@NiagaraType(agent = @AgentOn(types = "basidekick:ZoomPane"))
@NiagaraSingleton
@NoSlotomatic
public final class BHxZoomPane extends BHxPxWidget
{
  public static final BHxZoomPane INSTANCE = new BHxZoomPane();
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BHxZoomPane.class);
  private BHxZoomPane() {}

  /** Pan and zoom happen in the browser; don't forward those drags to the server-side pane. */
  @Override public MouseEventCommand getMouseEventHandler() { return null; }

  @Override public void write(HxOp op) throws Exception
  {
    op.addJavaScript(BOrd.make("module://basidekick/rc/zoompane/zoompane.js"));
    // Written before the content; zoompane.js moves everything else in the pane into its layer.
    op.getHtmlWriter().w("<div style='display:none'").attr("id", op.scope("zoompane")).w("></div>");
    op.addOnload(script(op));
  }

  @Override public void update(int width, int height, boolean full, HxOp op) throws Exception
  {
    BZoomPane pane = (BZoomPane)op.get();
    PropertiesCollection styles = new PropertiesCollection.Styles();
    HxUtil.makeBackground(pane.getBackground(), null, styles, op);
    styles.write(op);
    op.getHtmlWriter().w("\n").w(script(op));
  }

  private static String script(HxOp op)
  {
    BZoomPane pane = (BZoomPane)op.get();
    String options = "{startFitted:" + pane.getStartFitted() + ",minZoom:" + pane.getMinZoom() +
      ",maxZoom:" + pane.getMaxZoom() + ",panZoom:" + pane.getPanZoom() +
      ",showMinimap:" + pane.getShowMinimap() + ",showControls:" + pane.getShowControls() + "}";
    return "window.baskZoomPane && window.baskZoomPane.hx('" +
      HxUtil.escapeJsStringLiteral(op.scope("zoompane")) + "'," + options + ");";
  }
}
