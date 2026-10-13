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
 * UxMedia renderer for Auto Grid. The Java BAutoGridPane layout remains the Workbench and Hx
 * renderer; this peer draws the same grid with CSS grid, like bajaui's UxFlowPane.
 */
@NiagaraType(agent = @AgentOn(types = "basidekick:AutoGridPane"))
public final class BUxAutoGridPane
  extends BSingleton
  implements BIJavaScript, BIJavaScriptWidget
{
  public static final BUxAutoGridPane INSTANCE = new BUxAutoGridPane();

  private BUxAutoGridPane() {}

  public static final Type TYPE = Sys.loadType(BUxAutoGridPane.class);

  @Override
  public Type getType()
  {
    return TYPE;
  }

  private static final JsInfo JS_INFO =
    JsInfo.make(BOrd.make("module://basidekick/rc/widgets/AutoGridPane.js"));

  @Override
  public JsInfo getJsInfo(Context cx)
  {
    return JS_INFO;
  }
}
