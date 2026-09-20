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
 * UxMedia renderer for every qagraphics navigation icon variant.
 */
@NiagaraType(agent = @AgentOn(types = {
  "basidekick:NavIcon",
  "basidekick:NeutralNavIcon",
  "basidekick:SingleColorNavIcon",
  "basidekick:DuotoneNavIcon",
  "basidekick:AlarmNavIcon",
  "basidekick:SingleColorAlarmNavIcon",
  "basidekick:DuotoneAlarmNavIcon"
}))
public final class BNavIconJs
  extends BSingleton
  implements BIJavaScript, BIJavaScriptWidget
{
  public static final BNavIconJs INSTANCE = new BNavIconJs();

  private BNavIconJs() {}

  public static final Type TYPE = Sys.loadType(BNavIconJs.class);

  @Override
  public Type getType()
  {
    return TYPE;
  }

  private static final JsInfo JS_INFO =
    JsInfo.make(BOrd.make("module://basidekick/rc/widgets/NavIcon.js"));

  @Override
  public JsInfo getJsInfo(Context cx)
  {
    return JS_INFO;
  }
}
