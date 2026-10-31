import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Badge, ScreenMessage, Segmented, Switch, TextField, ToggleRow } from '@/components/ui/controls';
import { useStaff } from '@/hooks/useAuth';
import { useMenu } from '@/hooks/useMenu';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import {
  blankCategory,
  blankProduct,
  deleteCategory,
  deleteProduct,
  saveCategory,
  saveProduct,
  setProductAvailable,
} from '@/services/menu';
import { fmtRM, toCents } from '@/lib/money';
import { newId } from '@/lib/ids';
import type { Category, Product } from '@/types/models';
import { tint } from '../pos/components/MenuGrid';

const PALETTE = ['#B9A27A', '#D69E2E', '#C8754D', '#A7A05A', '#5B8BA3', '#4F9A86', '#B9707F', '#9C6B44', '#A8A49B'];

/** Admin: categories, items, prices, stations, availability, modifier groups. Saved items are live at once. */
export function MenuAdminPage() {
  const staff = useStaff();
  const { settings } = useSettings();
  const toast = useToast();
  const menu = useMenu();
  const [catId, setCatId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<(Product & { priceText: string }) | null>(null);
  const [catName, setCatName] = useState('');

  const cat: Category | undefined = menu.categories.find((c) => c.id === catId) ?? menu.categories[0];
  const items = menu.products.filter((p) => p.categoryId === cat?.id);
  const editing = menu.products.find((p) => p.id === editId) ?? null;

  useEffect(() => setCatName(cat?.name ?? ''), [cat?.id, cat?.name]);
  useEffect(() => {
    setForm(editing ? { ...editing, priceText: (editing.priceCents / 100).toFixed(2) } : null);
    // only reload the form when switching item
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, editing === null]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.ok(ok);
    } catch (err) {
      toast.error(err, 'menu');
    }
  };

  const dirty =
    !!form && !!editing && JSON.stringify({ ...form, priceText: undefined, priceCents: toCents(form.priceText) }) !== JSON.stringify({ ...editing, priceText: undefined });

  return (
    <Shell area="admin">
      <TopBar>
        <span className="text-lg font-extrabold">Menu &amp; prices</span>
        <Badge tone="dark">ADMIN ONLY</Badge>
        <span className="text-[13px] text-muted">
          {menu.products.length} items · {menu.categories.length} categories · changes go live on every device
        </span>
      </TopBar>
      {menu.error && <p className="m-3 rounded-xl bg-dangerbg p-3 text-sm font-semibold text-danger">{menu.error}</p>}
      <div className="flex min-h-0 flex-1">
        <aside aria-label="Categories" className="flex w-[212px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-white p-2.5">
          <span className="px-1.5 pb-1.5 pt-1 text-[11px] font-extrabold tracking-widest text-muted">CATEGORIES</span>
          {menu.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === cat?.id}
              onClick={() => {
                setCatId(c.id);
                setEditId(null);
              }}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl px-2.5 text-left text-sm ${c.id === cat?.id ? 'bg-ink font-bold text-white' : 'font-medium'}`}
            >
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: c.color }} />
              <span className="flex-1">{c.name}</span>
              <span className="text-xs opacity-70">{menu.products.filter((p) => p.categoryId === c.id).length}</span>
            </button>
          ))}
          <Button
            className="mt-1.5 border-dashed"
            onClick={() => {
              const c = blankCategory(menu.categories.length + 1);
              run(() => saveCategory(staff, c), 'Category added').then(() => setCatId(c.id));
            }}
          >
            + Add category
          </Button>
        </aside>

        <section aria-label="Items" className="flex min-w-0 flex-1 flex-col">
          {cat ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-line bg-[#FBFAF7] px-3.5 py-3">
                <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: cat.color }} />
                <input
                  aria-label="Category name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  onBlur={() => catName.trim() && catName !== cat.name && run(() => saveCategory(staff, { ...cat, name: catName.trim() }), 'Category renamed')}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[#D6D1C7] px-3 text-base font-bold"
                />
                <div role="group" aria-label="Category colour" className="flex gap-1">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Colour ${c}`}
                      aria-pressed={c === cat.color}
                      onClick={() => run(() => saveCategory(staff, { ...cat, color: c }))}
                      className="h-7 w-7 rounded-lg"
                      style={{ background: c, border: c === cat.color ? '3px solid #202124' : '2px solid #fff' }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={items.length > 0}
                  title={items.length ? 'Move or delete its items first' : 'Delete category'}
                  onClick={() => window.confirm(`Delete ${cat.name}?`) && run(() => deleteCategory(staff, cat.id), 'Category deleted').then(() => setCatId(null))}
                >
                  Delete
                </Button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3.5">
                {items.map((p) => (
                  <div key={p.id} className={`flex items-center gap-2.5 rounded-xl border bg-white p-1.5 ${p.id === editId ? 'border-2 border-ink' : 'border-line'} ${p.available ? '' : 'opacity-60'}`}>
                    <button type="button" onClick={() => setEditId(p.id)} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-1.5 text-left">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold" style={{ background: tint(cat.color, '44') }}>
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-xs text-muted">
                          Station {p.station} · {p.modifierGroupIds.length ? `${p.modifierGroupIds.length} modifier group(s)` : 'No modifiers'}
                          {p.popular ? ' · Popular' : ''}
                        </span>
                      </span>
                      <span className="font-extrabold tabular-nums">{fmtRM(p.priceCents)}</span>
                    </button>
                    <Switch label={`${p.name} available`} checked={p.available} onChange={(v) => run(() => setProductAvailable(staff, p.id, v))} />
                  </div>
                ))}
                {items.length === 0 && <ScreenMessage title="No items in this category yet." />}
                <Button
                  className="border-dashed"
                  size="lg"
                  onClick={() => {
                    const p = blankProduct(cat.id, settings.stations[0]?.id ?? 'A', menu.products.length + 1);
                    run(() => saveProduct(staff, p), 'Item added').then(() => setEditId(p.id));
                  }}
                >
                  + Add item to {cat.name}
                </Button>
              </div>
            </>
          ) : (
            <ScreenMessage title="Add a category to start" />
          )}
        </section>

        <aside aria-label="Edit item" className="flex w-[372px] shrink-0 flex-col border-l border-line bg-white">
          {!form ? (
            <ScreenMessage title="Select or add an item to edit it." />
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
                <TextField label="Item name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <div className="grid grid-cols-2 gap-2.5">
                  <TextField label="Price (RM)" inputMode="decimal" value={form.priceText} onChange={(v) => setForm({ ...form, priceText: v.replace(/[^0-9.]/g, '') })} />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-soft">Category</span>
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="h-12 rounded-xl border border-[#D6D1C7] bg-white px-2.5 text-sm font-semibold">
                      {menu.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-soft">Kitchen station · where it shows and prints bold</span>
                  <Segmented label="Station" value={form.station} onChange={(v) => setForm({ ...form, station: v })} options={settings.stations.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))} />
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-soft">Description</span>
                  <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none rounded-xl border border-[#D6D1C7] p-3 text-sm" />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="flex justify-between text-xs font-bold text-soft">
                    Add-ons &amp; modifiers
                    <Link to="/admin/modifiers" className="text-accent">
                      Manage groups
                    </Link>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {menu.groups.map((g) => {
                      const on = form.modifierGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setForm({ ...form, modifierGroupIds: on ? form.modifierGroupIds.filter((x) => x !== g.id) : [...form.modifierGroupIds, g.id] })}
                          className={`h-10 rounded-full px-3 text-[13px] font-bold ${on ? 'border-2 border-accent bg-[#FBF1EA]' : 'border border-line'}`}
                        >
                          {on ? '✓ ' : '+ '}
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <ToggleRow label="Available" hint="Off shows SOLD OUT on every device" checked={form.available} onChange={(v) => setForm({ ...form, available: v })} />
                  <ToggleRow label="Show in Popular" hint="Pinned to the first tab on the POS" checked={form.popular} onChange={(v) => setForm({ ...form, popular: v })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
                <Button variant="danger" onClick={() => window.confirm(`Delete ${form.name}?`) && run(() => deleteProduct(staff, form.id), 'Item deleted').then(() => setEditId(null))}>
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    const { priceText, ...rest } = form;
                    const copy: Product = { ...rest, id: newId('p_'), name: `${rest.name} (copy)`, priceCents: toCents(priceText), sort: menu.products.length + 1 };
                    run(() => saveProduct(staff, copy), 'Duplicated').then(() => setEditId(copy.id));
                  }}
                >
                  Duplicate
                </Button>
                <Button
                  variant="primary"
                  disabled={!dirty || !form.name.trim()}
                  onClick={() => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { priceText, ...rest } = form;
                    run(() => saveProduct(staff, { ...rest, name: rest.name.trim(), priceCents: toCents(priceText) }), 'Saved · live on all devices');
                  }}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>
    </Shell>
  );
}
