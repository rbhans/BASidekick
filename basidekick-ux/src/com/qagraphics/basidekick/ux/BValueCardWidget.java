package com.qagraphics.basidekick.ux;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;
import javax.baja.web.BIFormFactorMax;
import javax.baja.web.js.*;

/** Compact point value card for Px pages. */
@NiagaraType @NoSlotomatic @NiagaraSingleton
public final class BValueCardWidget extends BSingleton implements BIJavaScript, BIFormFactorMax
{
  public static final BValueCardWidget INSTANCE = new BValueCardWidget();
  private static final JsInfo JS_INFO = JsInfo.make(BOrd.make("module://basidekick/rc/widgets/ValueCard.js"));
  private BValueCardWidget() {}
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BValueCardWidget.class);
  @Override public JsInfo getJsInfo(Context cx) { return JS_INFO; }
}
