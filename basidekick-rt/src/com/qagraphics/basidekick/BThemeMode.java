package com.qagraphics.basidekick;

import javax.baja.nre.annotations.NiagaraEnum;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.Range;
import javax.baja.sys.BFrozenEnum;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;

/**
 * Neutral light or dark appearance for qagraphics dashboard widgets.
 */
@NiagaraType
@NiagaraEnum(range = {
  @Range("light"),
  @Range("dark")
})
public final class BThemeMode
  extends BFrozenEnum
{
//region /*+ ------------ BEGIN BAJA AUTO GENERATED CODE ------------ +*/
//@formatter:off
/*@ $com.qagraphics.basidekick.BThemeMode(1177730225)1.0$ @*/
/* Generated Mon Jul 27 21:19:03 MST 2026 by Slot-o-Matic (c) Tridium, Inc. 2012-2026 */

  /** Ordinal value for light. */
  public static final int LIGHT = 0;
  /** Ordinal value for dark. */
  public static final int DARK = 1;

  /** BThemeMode constant for light. */
  public static final BThemeMode light = new BThemeMode(LIGHT);
  /** BThemeMode constant for dark. */
  public static final BThemeMode dark = new BThemeMode(DARK);

  /** Factory method with ordinal. */
  public static BThemeMode make(int ordinal)
  {
    return (BThemeMode)light.getRange().get(ordinal, false);
  }

  /** Factory method with tag. */
  public static BThemeMode make(String tag)
  {
    return (BThemeMode)light.getRange().get(tag);
  }

  /** Private constructor. */
  private BThemeMode(int ordinal)
  {
    super(ordinal);
  }

  public static final BThemeMode DEFAULT = light;

  //region Type

  @Override
  public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BThemeMode.class);

  //endregion Type

//@formatter:on
//endregion /*+ ------------ END BAJA AUTO GENERATED CODE -------------- +*/
}
