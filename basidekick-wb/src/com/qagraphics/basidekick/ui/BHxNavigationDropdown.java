package com.qagraphics.basidekick.ui;

import com.qagraphics.basidekick.BNavigationItem;
import javax.baja.hx.HxOp;
import javax.baja.hx.HxUtil;
import javax.baja.hx.px.BHxPxWidget;
import javax.baja.hx.px.MouseEventCommand;
import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;

/** Hx rendering for standard web PX pages, without UxMedia. */
@NiagaraType(agent = @AgentOn(types = "basidekick:NavigationDropdown", requiredPermissions = "r"))
@NiagaraSingleton
@NoSlotomatic
public final class BHxNavigationDropdown extends BHxPxWidget
{
  public static final BHxNavigationDropdown INSTANCE = new BHxNavigationDropdown();
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BHxNavigationDropdown.class);
  private BHxNavigationDropdown() {}

  @Override public MouseEventCommand getMouseEventHandler() { return null; }
  @Override public boolean needsUpdate(BAbsTime lastUpdate, BAbsTime lastModified) { return true; }

  @Override public void write(HxOp op) throws Exception
  {
    op.addStyleSheet(BOrd.make("module://basidekick/rc/navigation/dropdown.css"));
    op.addJavaScript(BOrd.make("module://basidekick/rc/navigation/dropdown.js"));
    op.getHtmlWriter().w("<select class=\"bask-navigation-dropdown\" id=\"")
      .w(HxUtil.encodeText(op.scope("select"))).w("\" aria-label=\"Navigate to page\"></select>");
    op.addOnload(script(op));
  }

  @Override public void update(int width, int height, boolean full, HxOp op) throws Exception
  {
    op.getHtmlWriter().w(script(op));
  }

  private static String quote(String value) { return "'" + HxUtil.escapeJsStringLiteral(value) + "'"; }

  private static String script(HxOp op) throws Exception
  {
    BNavigationDropdown widget = (BNavigationDropdown)op.get();
    StringBuilder options = new StringBuilder("[");
    String message = widget.getPrompt();
    boolean enabled = MouseEventCommand.isMouseEnabled(widget);
    try
    {
      BNavigationItem[] items = widget.readItems(op);
      for (int i = 0; i < items.length; i++)
      {
        // Generate an authenticated Niagara URL rather than composing /ord routes.
        String uri = op.toUri(items[i].getTarget());
        if (i > 0) options.append(',');
        options.append("[").append(quote(items[i].getLabel())).append(',').append(quote(uri)).append(']');
      }
      if (items.length == 0) { message = "No destinations configured"; enabled = false; }
    }
    catch (Exception error) { message = error.getMessage() == null ? "Menu unavailable" : error.getMessage(); enabled = false; }
    return "window.baskNavigationDropdown && window.baskNavigationDropdown(" + quote(op.scope("select")) +
      "," + quote(message) + "," + options.append(']') + "," + enabled + ");";
  }
}
