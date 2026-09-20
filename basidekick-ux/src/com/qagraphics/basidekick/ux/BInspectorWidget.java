package com.qagraphics.basidekick.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;
import javax.baja.web.BIFormFactorMax;
import javax.baja.web.js.*;

/** Point detail view, also opened by a native Px Popup Binding. */
@NiagaraType(agent = @AgentOn(types = "control:ControlPoint")) @NoSlotomatic @NiagaraSingleton
public final class BInspectorWidget extends BSingleton implements BIJavaScript, BIFormFactorMax
{
  public static final BInspectorWidget INSTANCE = new BInspectorWidget();
  private static final JsInfo JS_INFO = JsInfo.make(BOrd.make("module://basidekick/rc/widgets/InspectorWidget.js"));
  private BInspectorWidget() {}
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BInspectorWidget.class);
  @Override public JsInfo getJsInfo(Context cx) { return JS_INFO; }
}
