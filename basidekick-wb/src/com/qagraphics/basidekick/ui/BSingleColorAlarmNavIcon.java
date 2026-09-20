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
 * Legacy alarm icon type retained for existing PX files.
 */
@NiagaraType
@NiagaraProperty(
  name = "mode",
  type = "BIconMode",
  defaultValue = "BIconMode.light",
  flags = Flags.SUMMARY
)
@NiagaraProperty(
  name = "color",
  type = "BColor",
  defaultValue = "BColor.make(47, 47, 47)",
  flags = Flags.HIDDEN
)
public class BSingleColorAlarmNavIcon
  extends BAlarmNavIcon
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.qagraphics.basidekick.ui.BSingleColorAlarmNavIcon(1)1.0$ @*/

  public static final Property mode =
    newProperty(Flags.SUMMARY, BIconMode.light, null);

  public BIconMode getMode() { return (BIconMode)get(mode); }
  public void setMode(BIconMode v) { set(mode, v, null); }

  public static final Property color =
    newProperty(Flags.HIDDEN, BColor.make(47, 47, 47), null);

  public BColor getColor() { return (BColor)get(color); }
  public void setColor(BColor v) { set(color, v, null); }

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BSingleColorAlarmNavIcon.class);

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/

  @Override
  public void changed(Property property, Context context)
  {
    super.changed(property, context);
    if (property == mode) requestImageRefresh();
  }

  @Override
  protected String resourceVariantSuffix()
  {
    if (getStyle() == BIconStyle.duotone) return "";
    return getMode() == BIconMode.dark ? "-Dark" : "";
  }
}
