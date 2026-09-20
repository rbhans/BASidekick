package com.qagraphics.basidekick;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;

/** Reusable ordered navigation items. Add NavigationItem children in the desired order. */
@NiagaraType
@NoSlotomatic
public class BNavigationMenu extends BComponent
{
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BNavigationMenu.class);
}
