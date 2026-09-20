package com.qagraphics.basidekick.ui;

import javax.baja.gx.BColor;
import javax.baja.nre.annotations.NiagaraProperty;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.sys.Context;
import javax.baja.sys.Flags;
import javax.baja.sys.Property;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;

/**
 * Legacy Duotone alarm type retained only so existing PX files decode.
 */
@NiagaraType
@NiagaraProperty(
  name = "secondaryColor",
  type = "BColor",
  defaultValue = "BColor.make(138, 175, 212)",
  flags = Flags.HIDDEN
)
public final class BDuotoneAlarmNavIcon
  extends BSingleColorAlarmNavIcon
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.qagraphics.basidekick.ui.BDuotoneAlarmNavIcon(1)1.0$ @*/

  public static final Property secondaryColor =
    newProperty(Flags.HIDDEN, BColor.make(138, 175, 212), null);

  public BColor getSecondaryColor() { return (BColor)get(secondaryColor); }
  public void setSecondaryColor(BColor v) { set(secondaryColor, v, null); }

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BDuotoneAlarmNavIcon.class);

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/

  @Override
  public void changed(Property property, Context context)
  {
    super.changed(property, context);
    if (property == secondaryColor) requestImageRefresh();
  }

}
