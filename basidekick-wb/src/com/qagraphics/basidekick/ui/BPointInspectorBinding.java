package com.qagraphics.basidekick.ui;

import com.tridium.kitpx.BPopupProfile;
import com.tridium.workbench.shell.BNiagaraWbDialog;
import javax.baja.gx.BPoint;
import javax.baja.gx.BSize;
import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;
import javax.baja.ui.BBinding;
import javax.baja.ui.BWidget;
import javax.baja.ui.event.BMouseEvent;
import javax.baja.workbench.BWbShell;
import java.util.logging.Level;

/** Add to an existing Px widget through Add Property; Ord selects the point. */
@NiagaraType(agent = @AgentOn(types = "bajaui:Widget"))
@NoSlotomatic
public final class BPointInspectorBinding extends BBinding
{
  public static final Property title = newProperty(0, "Point Inspector", null);
  public String getTitle() { return getString(title); }
  public void setTitle(String value) { setString(title, value, null); }
  public static final Property size = newProperty(0, BSize.make(460, 600), null);
  public BSize getSize() { return (BSize)get(size); }
  public void setSize(BSize value) { set(size, value); }
  public static final Action mouseEvent = newAction(Flags.HIDDEN, new BMouseEvent(), null);
  public void mouseEvent(BMouseEvent event) { invoke(mouseEvent, event, null); }
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BPointInspectorBinding.class);

  @Override public void started()
  {
    super.started();
    if (getWidget() != null) linkTo(getWidget(), BWidget.mouseEvent, mouseEvent);
  }

  /** Keep the point binding intact; select the inspector only when opening it. */
  public BOrd getInspectorOrd()
  {
    return getOrd().isNull() ? BOrd.NULL :
      BOrd.make(getOrd(), BOrd.make("view:basidekick:InspectorWidget")).normalize();
  }

  public void doMouseEvent(BMouseEvent event)
  {
    BWidget widget = getWidget();
    if (widget == null || !widget.isEnabled() || getOrd().isNull() || event == null ||
        event.getId() != BMouseEvent.MOUSE_RELEASED || !event.isButton1Down() || event.isPopupTrigger()) return;
    try
    {
      BWbShell shell = BWbShell.getWbShell(widget);
      BOrd target = BOrd.make(shell.getActiveOrd(), getInspectorOrd()).normalize();
      new BNiagaraWbDialog(BPopupProfile.TYPE, shell, target, getTitle(),
        BPoint.make(100, 100), getSize(), false).open();
      event.consume();
    }
    catch (Exception error)
    {
      LOGGER.log(Level.WARNING, "Could not open Point Inspector", error);
      if (getShell() != null) getShell().showStatus("Could not open Point Inspector: " + error.getMessage());
    }
  }
}
