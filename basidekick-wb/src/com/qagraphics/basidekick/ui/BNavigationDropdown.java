package com.qagraphics.basidekick.ui;

import com.qagraphics.basidekick.BNavigationItem;
import com.qagraphics.basidekick.BNavigationMenu;
import javax.baja.gx.*;
import javax.baja.naming.BOrd;
import javax.baja.naming.OrdTarget;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.ui.*;
import javax.baja.ui.commands.HyperlinkCommand;
import java.util.ArrayList;
import java.util.List;
import com.tridium.ui.Binder;
import com.tridium.workbench.util.WbUtil;

/** Native PX navigation control. Its Hx agent supplies the browser rendering. */
@NiagaraType
@NoSlotomatic
public class BNavigationDropdown extends BButton
{
  public static final Property menu = newProperty(0, BOrd.NULL, null);
  public BOrd getMenu() { return (BOrd)get(menu); }
  public void setMenu(BOrd value) { set(menu, value, null); }
  public static final Property prompt = newProperty(0, "Navigate to...", null);
  public String getPrompt() { return getString(prompt); }
  public void setPrompt(String value) { setString(prompt, value, null); }
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BNavigationDropdown.class);

  @Override public void computePreferredSize() { setPreferredSize(240, 38); }

  /** Resolve on opening so edits to the reusable menu appear without recreating the PX. */
  public BNavigationItem[] readItems(Context cx) throws Exception
  {
    if (getMenu().isNull()) throw new IllegalArgumentException("Choose a Navigation Menu in the dropdown properties.");
    // PX widgets live in a view space, not necessarily the station component space.
    // Use the same bound base as Workbench's WebWidget host for relative station ORDs.
    Binder binder = WbUtil.getBinder(this);
    OrdTarget base = binder == null ? null : binder.getBase();
    Context readContext = cx != null ? cx : base;
    OrdTarget target = getMenu().resolve(base == null ? this : base.get(), readContext);
    if (!target.canRead()) throw new javax.baja.security.PermissionException();
    if (!(target.get() instanceof BNavigationMenu)) throw new IllegalArgumentException("Menu must point to a basidekick Navigation Menu.");
    BNavigationMenu source = (BNavigationMenu)target.get();
    List<BNavigationItem> items = new ArrayList<>();
    for (BNavigationItem item : source.getChildren(BNavigationItem.class))
    {
      if (items.size() == 100) break;
      if (readContext != null && readContext.getUser() != null && !readContext.getUser().getPermissionsFor(item).hasOperatorRead()) continue;
      if (!item.getTarget().isNull()) items.add(item);
    }
    return items.toArray(new BNavigationItem[0]);
  }

  @Override public void doInvokeAction(CommandEvent event)
  {
    try
    {
      BMenu popup = new BMenu();
      BNavigationItem[] items = readItems(null);
      if (items.length == 0) { getShell().showStatus("This navigation menu has no destinations."); return; }
      for (int i = 0; i < items.length; i++)
        popup.add("item" + i, new HyperlinkCommand(this, items[i].getLabel(), items[i].getTarget()));
      popup.open(this, 0, getHeight());
    }
    catch (Exception error) { if (getShell() != null) getShell().showStatus(error.getMessage()); }
  }

  @Override public void paint(Graphics g)
  {
    double w = getWidth(), h = getHeight();
    g.setBrush(BColor.make(hasFocus() ? "#2563eb" : "#cbd5e1"));
    rounded(g, 0, 0, w, h, 8);
    g.setBrush(BColor.make(getEnabled() ? "#ffffff" : "#f1f5f9"));
    rounded(g, 1, 1, w - 2, h - 2, 7);
    BFont font = BFont.make("Segoe UI", 12);
    g.setFont(font);
    g.setBrush(BColor.make(getEnabled() ? "#334155" : "#94a3b8"));
    String label = getPrompt();
    while (label.length() > 1 && font.width(label + "...") > w - 46) label = label.substring(0, label.length() - 1);
    if (!label.equals(getPrompt())) label += "...";
    g.drawString(label, 12, (h + font.getAscent() - font.getDescent()) / 2);
    g.drawString("\u2304", Math.max(12, w - 25), (h + font.getAscent()) / 2 - 2);
  }

  private static void rounded(Graphics g, double x, double y, double w, double h, double r)
  {
    if (w <= 0 || h <= 0) return;
    r = Math.min(r, Math.min(w, h) / 2);
    g.fillRect(x + r, y, w - 2*r, h);
    g.fillRect(x, y + r, w, h - 2*r);
    g.fill(new EllipseGeom(x, y, 2*r, 2*r));
    g.fill(new EllipseGeom(x + w - 2*r, y, 2*r, 2*r));
    g.fill(new EllipseGeom(x, y + h - 2*r, 2*r, 2*r));
    g.fill(new EllipseGeom(x + w - 2*r, y + h - 2*r, 2*r, 2*r));
  }
}
