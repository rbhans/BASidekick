package com.qagraphics.basidekick.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraType;
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
 * Zero-configuration operations dashboard for histories, point health, and schedules.
 */
@NiagaraType
@NoSlotomatic
@NiagaraSingleton
public final class BOperationsDashboardWidget
  extends BSingleton
  implements BIJavaScript, BIFormFactorMax
{
  public static final BOperationsDashboardWidget INSTANCE =
    new BOperationsDashboardWidget();

  private BOperationsDashboardWidget() {}

  private static final JsInfo JS_INFO =
    JsInfo.make(BOrd.make("module://basidekick/rc/widgets/OperationsDashboard.js"));

  @Override
  public Type getType()
  {
    return TYPE;
  }

  public static final Type TYPE = Sys.loadType(BOperationsDashboardWidget.class);

  @Override
  public JsInfo getJsInfo(Context cx)
  {
    return JS_INFO;
  }
}
