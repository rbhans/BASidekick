package com.qagraphics.basidekick;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;

/** One navigation destination in a NavigationMenu. */
@NiagaraType
@NoSlotomatic
public class BNavigationItem extends BComponent
{
  public static final Property label = newProperty(0, "Page", null);
  public String getLabel() { return getString(label); }
  public void setLabel(String value) { setString(label, value, null); }
  public static final Property target = newProperty(0, BOrd.NULL, null);
  public BOrd getTarget() { return (BOrd)get(target); }
  public void setTarget(BOrd value) { set(target, value, null); }
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BNavigationItem.class);
}
