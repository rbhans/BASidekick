package com.qagraphics.basidekick.ui;

import javax.baja.gx.BColor;
import javax.baja.nre.annotations.NiagaraProperty;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.sys.Flags;
import javax.baja.sys.Property;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;

/**
 * Legacy single-color type retained so existing PX files continue to decode.
 */
@NiagaraType
@NiagaraProperty(
  name = "color",
  type = "BColor",
  defaultValue = "BColor.make(47, 47, 47)",
  flags = Flags.HIDDEN
)
public class BSingleColorNavIcon
  extends BNeutralNavIcon
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.qagraphics.basidekick.ui.BSingleColorNavIcon(1)1.0$ @*/

  public static final Property color =
    newProperty(Flags.HIDDEN, BColor.make(47, 47, 47), null);

  public BColor getColor() { return (BColor)get(color); }
  public void setColor(BColor v) { set(color, v, null); }

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BSingleColorNavIcon.class);

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/

}
