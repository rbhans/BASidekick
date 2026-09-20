package com.qagraphics.basidekick.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.AgentOn;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.nre.annotations.NiagaraSingleton;
import javax.baja.sys.BSingleton;
import javax.baja.sys.Context;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;
import javax.baja.web.BIFormFactorMax;
import javax.baja.web.js.BIJavaScript;
import javax.baja.web.js.JsInfo;

/**
 * Manual link preview and application UI for Workbench and web hosts.
 */
@NiagaraType(agent = @AgentOn(types = "basidekick:LinkPlanner"))
@NoSlotomatic
@NiagaraSingleton
public final class BLinkPlannerWidget
  extends BSingleton
  implements BIJavaScript, BIFormFactorMax
{
  public static final BLinkPlannerWidget INSTANCE =
    new BLinkPlannerWidget();

  private BLinkPlannerWidget() {}

  private static final JsInfo JS_INFO =
    JsInfo.make(BOrd.make("module://basidekick/rc/widgets/LinkPlanner.js"));

  @Override
  public Type getType()
  {
    return TYPE;
  }

  public static final Type TYPE = Sys.loadType(BLinkPlannerWidget.class);

  @Override
  public JsInfo getJsInfo(Context cx)
  {
    return JS_INFO;
  }
}
