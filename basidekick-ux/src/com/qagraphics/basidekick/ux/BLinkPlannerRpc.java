package com.qagraphics.basidekick.ux;
import com.qagraphics.basidekick.BLinkPlanner;
import javax.baja.naming.*;
import javax.baja.nre.annotations.*;
import javax.baja.rpc.*;
import javax.baja.security.*;
import javax.baja.sys.*;

@NiagaraType
@NoSlotomatic
public final class BLinkPlannerRpc extends BObject {
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BLinkPlannerRpc.class);
  private static BLinkPlanner planner(String ord, Context cx) throws Exception {
    if (cx == null || cx.getUser() == null) throw new PermissionException();
    if (ord == null || ord.length() > 2000 || !ord.matches("station:\\|slot:/[^|?#]+")) throw new IllegalArgumentException("Set Planner ORD to a station Link Planner component");
    OrdTarget t = BOrd.make(ord).resolve(null,cx);
    if (!t.canRead() || !(t.get() instanceof BLinkPlanner)) throw new PermissionException();
    cx.getUser().check((BComponent)t.get(),BPermissions.adminWrite);
    return (BLinkPlanner)t.get();
  }
  @NiagaraRpc(transports={@Transport(type=TransportType.box)},permissions="unrestricted")
  public static String preview(String ord,Context cx) throws Exception { return planner(ord,cx).previewPlan(cx); }
  @NiagaraRpc(transports={@Transport(type=TransportType.box)},permissions="unrestricted")
  public static String apply(String ord,String token,String selected,Context cx) throws Exception { return planner(ord,cx).applyPlan(token,selected,cx); }
  @NiagaraRpc(transports={@Transport(type=TransportType.box)},permissions="unrestricted")
  public static String undo(String ord,String token,Context cx) throws Exception { return planner(ord,cx).undoPlan(token,cx); }
  @NiagaraRpc(transports={@Transport(type=TransportType.box)},permissions="unrestricted")
  public static String keep(String ord,String token,Context cx) throws Exception { return planner(ord,cx).keepLinks(token,cx); }
}
