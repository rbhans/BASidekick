package com.qagraphics.basidekick;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;

/** Shared, station-persisted chart definitions. Configure category permissions on this component. */
@NiagaraType
@NoSlotomatic
public class BChartLibrary extends BComponent
{
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BChartLibrary.class);
}
