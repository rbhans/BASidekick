package com.qagraphics.basidekick.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;
import javax.baja.web.BIFormFactorMax;
import javax.baja.web.js.*;

/** Sortable zone value-to-setpoint deviation matrix for Px pages. */
@NiagaraType @NoSlotomatic @NiagaraSingleton
public final class BZoneDeviationMatrixWidget extends BSingleton implements BIJavaScript, BIFormFactorMax
{
  public static final BZoneDeviationMatrixWidget INSTANCE = new BZoneDeviationMatrixWidget();
  private static final JsInfo JS_INFO = JsInfo.make(BOrd.make("module://basidekick/rc/widgets/ZoneDeviationMatrix.js"));
  private BZoneDeviationMatrixWidget() {}
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BZoneDeviationMatrixWidget.class);
  @Override public JsInfo getJsInfo(Context cx) { return JS_INFO; }
}
