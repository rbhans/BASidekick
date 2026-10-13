package com.qagraphics.basidekick.ux;

import javax.baja.bajaux.BIJavaScriptWidget;
import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.AgentOn;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.sys.BSingleton;
import javax.baja.sys.Context;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;
import javax.baja.web.js.BIJavaScript;
import javax.baja.web.js.JsInfo;

/**
 * UxMedia renderer for Zoom Pane. The Java BZoomPane remains the Workbench renderer
 * and BHxZoomPane the Hx one; all three share the same properties.
 */
@NiagaraType(agent = @AgentOn(types = "basidekick:ZoomPane"))
public final class BUxZoomPane
  extends BSingleton
  implements BIJavaScript, BIJavaScriptWidget
{
  public static final BUxZoomPane INSTANCE = new BUxZoomPane();

  private BUxZoomPane() {}

  public static final Type TYPE = Sys.loadType(BUxZoomPane.class);

  @Override
  public Type getType()
  {
    return TYPE;
  }

  private static final JsInfo JS_INFO =
    JsInfo.make(BOrd.make("module://basidekick/rc/widgets/ZoomPane.js"));

  @Override
  public JsInfo getJsInfo(Context cx)
  {
    return JS_INFO;
  }
}
