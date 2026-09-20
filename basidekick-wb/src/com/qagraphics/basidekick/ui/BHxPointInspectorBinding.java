package com.qagraphics.basidekick.ui;

import javax.baja.hx.HxOp;
import javax.baja.hx.HxUtil;
import javax.baja.hx.PropertiesCollection;
import javax.baja.hx.px.MouseEventCommand;
import javax.baja.hx.px.binding.BHxPxBinding;
import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;
import javax.baja.ui.event.BInputEvent;
import javax.baja.ui.event.BMouseEvent;

/** Standard Hx Px support using Niagara's native popup transport. */
@NiagaraType(agent = @AgentOn(types = "basidekick:PointInspectorBinding", requiredPermissions = "r"))
@NiagaraSingleton
@NoSlotomatic
public final class BHxPointInspectorBinding extends BHxPxBinding
{
  public static final BHxPointInspectorBinding INSTANCE = new BHxPointInspectorBinding();
  private BHxPointInspectorBinding() {}
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BHxPointInspectorBinding.class);

  @Override public void update(int width, int height, boolean full, HxOp op) throws Exception
  {
    super.update(width, height, full, op);
    BPointInspectorBinding binding = (BPointInspectorBinding)op.get();
    if (binding.getOrd().isNull() || !MouseEventCommand.isMouseEnabled(binding.getWidget())) return;
    // Hx binding context -> bindings context -> host widget context, as in kitPx.
    HxOp widgetOp = (HxOp)op.getBase().getBase();
    PropertiesCollection styles = new PropertiesCollection.Styles();
    styles.add("cursor", "pointer");
    styles.write(widgetOp);
  }

  @Override public void handle(BInputEvent event, HxOp op) throws Exception
  {
    BPointInspectorBinding binding = (BPointInspectorBinding)op.get();
    if (!(event instanceof BMouseEvent) || event.getId() != BMouseEvent.MOUSE_PRESSED ||
        !((BMouseEvent)event).isButton1Down() || ((BMouseEvent)event).isPopupTrigger() ||
        binding.getOrd().isNull() || !MouseEventCommand.isMouseEnabled(binding.getWidget())) return;
    String uri = op.toUri(BOrd.make(op.getOrd(), binding.getInspectorOrd()).normalize());
    op.getHtmlWriter().w("hx.popup('").w(HxUtil.escapeJsStringLiteral(uri))
      .w("',100,100,").w(binding.getSize().width()).w(",").w(binding.getSize().height())
      .w(",false,false,'").w(HxUtil.escapeJsStringLiteral(binding.getTitle())).w("');");
  }
}
