import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Badge, Card, ScreenMessage, Stepper, Switch, TextField } from '@/components/ui/controls';
import { useStaff } from '@/hooks/useAuth';
import { useMenu } from '@/hooks/useMenu';
import { useToast } from '@/hooks/useToast';
import { blankModifierGroup, deleteModifierGroup, saveModifierGroup } from '@/services/menu';
import { fmtRM, toCents } from '@/lib/money';
import { newId } from '@/lib/ids';
import type { ModifierGroup } from '@/types/models';

type OptionForm = ModifierGroup['options'][number] & { priceText: string };

/** Admin: reusable modifier groups (doneness, sauce, side, add-ons…) with extra prices. */
export function ModifiersAdminPage() {
  const staff = useStaff();
  const toast = useToast();
  const menu = useMenu();
  const [selId, setSelId] = useState<string | null>(null);
  const group = menu.groups.find((g) => g.id === selId) ?? menu.groups[0] ?? null;
  const [form, setForm] = useState<(Omit<ModifierGroup, 'options'> & { options: OptionForm[] }) | null>(null);

  useEffect(() => {
    setForm(group ? { ...group, options: group.options.map((o) => ({ ...o, priceText: (o.priceCents / 100).toFixed(2) })) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const usedBy = group ? menu.products.filter((p) => p.modifierGroupIds.includes(group.id)) : [];
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.ok(ok);
    } catch (err) {
      toast.error(err, 'modifiers');
    }
  };
  const setOpt = (id: string, patch: Partial<OptionForm>) =>
    form && setForm({ ...form, options: form.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  const save = () => {
    if (!form) return;
    const clean: ModifierGroup = {
      ...form,
      name: form.name.trim(),
      maxChoices: Math.max(1, Math.min(form.maxChoices, form.options.length || 1)),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      options: form.options.map(({ priceText, ...o }) => ({ ...o, name: o.name.trim(), priceCents: toCents(priceText) })),
    };
    run(() => saveModifierGroup(staff, clean), 'Saved · live on all devices');
  };

  return (
    <Shell area="admin">
      <TopBar>
        <span className="text-lg font-extrabold">Add-ons &amp; modifiers</span>
        <Badge tone="dark">ADMIN ONLY</Badge>
        <span className="text-[13px] text-muted">Reusable groups · attach them to items in Menu</span>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <aside aria-label="Groups" className="flex w-[248px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-white p-2.5">
          <span className="px-1.5 pb-1.5 pt-1 text-[11px] font-extrabold tracking-widest text-muted">GROUPS</span>
          {menu.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={g.id === group?.id}
              onClick={() => setSelId(g.id)}
              className={`flex min-h-[58px] flex-col justify-center gap-0.5 rounded-xl px-3 text-left ${g.id === group?.id ? 'bg-ink text-white' : ''}`}
            >
              <span className="text-sm font-bold">{g.name}</span>
              <span className="text-xs opacity-75">
                {g.required ? 'Required' : 'Optional'} · {g.options.length} options
              </span>
            </button>
          ))}
          <Button
            className="mt-1.5 border-dashed"
            onClick={() => {
              const g = blankModifierGroup(menu.groups.length + 1);
              run(() => saveModifierGroup(staff, g), 'Group added').then(() => setSelId(g.id));
            }}
          >
            + New group
          </Button>
        </aside>

        {!form ? (
          <ScreenMessage title="Add a modifier group to start" />
        ) : (
          <section aria-label="Edit group" className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Card className="flex flex-col gap-3.5">
              <TextField label="Group name · shown to staff and printed on the KOT" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <div className="flex flex-wrap items-center gap-5">
                <span className="flex items-center gap-2.5">
                  <Switch label="Required" checked={form.required} onChange={(v) => setForm({ ...form, required: v })} />
                  <span className="flex flex-col">
                    <span className="text-sm font-bold">Required</span>
                    <span className="text-xs text-muted">Staff must choose before adding the item</span>
                  </span>
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-soft">Max choices</span>
                  <Stepper label="max choices" value={form.maxChoices} min={1} max={Math.max(1, form.options.length)} onChange={(v) => setForm({ ...form, maxChoices: v })} />
                </span>
              </div>
            </Card>

            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="grid grid-cols-[1fr_120px_76px_64px_48px] gap-2 bg-cream px-3.5 py-2.5 text-[11px] font-extrabold tracking-wide text-soft">
                <span>OPTION</span>
                <span>EXTRA (RM)</span>
                <span className="text-center">DEFAULT</span>
                <span className="text-center">ON</span>
                <span />
              </div>
              {form.options.map((o) => (
                <div key={o.id} className={`grid grid-cols-[1fr_120px_76px_64px_48px] items-center gap-2 border-t border-[#F1EEE8] px-3.5 py-2 ${o.available ? '' : 'opacity-55'}`}>
                  <input aria-label="Option name" value={o.name} onChange={(e) => setOpt(o.id, { name: e.target.value })} className="h-11 rounded-xl border border-[#D6D1C7] px-2.5 text-sm font-semibold" />
                  <input aria-label="Extra price" inputMode="decimal" value={o.priceText} onChange={(e) => setOpt(o.id, { priceText: e.target.value.replace(/[^0-9.]/g, '') })} className="h-11 rounded-xl border border-[#D6D1C7] px-2.5 text-right text-sm font-bold" />
                  <button
                    type="button"
                    aria-label="Default option"
                    aria-pressed={o.isDefault}
                    onClick={() =>
                      setForm({
                        ...form,
                        options: form.options.map((x) => ({ ...x, isDefault: x.id === o.id ? !o.isDefault : form.maxChoices === 1 ? false : x.isDefault })),
                      })
                    }
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${o.isDefault ? 'border-2 border-accent' : 'border border-[#D6D1C7]'}`}
                  >
                    <span className={`h-[18px] w-[18px] rounded-full ${o.isDefault ? 'bg-accent' : ''}`} />
                  </button>
                  <span className="mx-auto">
                    <Switch label="Available" checked={o.available} onChange={(v) => setOpt(o.id, { available: v })} />
                  </span>
                  <button type="button" aria-label="Delete option" onClick={() => setForm({ ...form, options: form.options.filter((x) => x.id !== o.id) })} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-danger">
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
              ))}
              <div className="border-t border-[#F1EEE8] p-3">
                <Button
                  size="sm"
                  className="border-dashed"
                  onClick={() => setForm({ ...form, options: [...form.options, { id: newId('o_'), name: 'New option', priceCents: 0, priceText: '0.00', isDefault: false, available: true }] })}
                >
                  + Add option
                </Button>
              </div>
            </div>

            <Card className="flex flex-col gap-2.5">
              <span className="text-[13px] font-bold">Used by {usedBy.length} item(s)</span>
              <div className="flex flex-wrap gap-1.5">
                {usedBy.map((p) => (
                  <span key={p.id} className="rounded-full bg-[#F1EEE8] px-3 py-1.5 text-[13px] font-semibold">
                    {p.name}
                  </span>
                ))}
              </div>
            </Card>

            <div className="mt-auto flex gap-2">
              <Button
                variant="danger"
                disabled={usedBy.length > 0}
                title={usedBy.length ? 'Remove it from items first' : undefined}
                onClick={() => window.confirm(`Delete ${form.name}?`) && run(() => deleteModifierGroup(staff, form.id), 'Group deleted').then(() => setSelId(null))}
              >
                Delete group
              </Button>
              <Button variant="primary" size="lg" className="flex-1" disabled={!form.name.trim()} onClick={save}>
                Save group
              </Button>
            </div>
          </section>
        )}

        {form && (
          <aside aria-label="Preview" className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line bg-paper p-3.5">
            <span className="text-[11px] font-extrabold tracking-widest text-soft">ON THE POS</span>
            <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5">
              <span className={`text-xs font-extrabold tracking-wide ${form.required ? 'text-accent' : 'text-soft'}`}>
                {form.name.toUpperCase() || 'UNTITLED'} · {form.required ? 'REQUIRED' : 'OPTIONAL'}
                {form.maxChoices > 1 ? ` · UP TO ${form.maxChoices}` : ''}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {form.options
                  .filter((o) => o.available)
                  .map((o) => (
                    <span key={o.id} className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 text-center text-[13px] font-bold ${o.isDefault ? 'bg-ink text-white' : 'border border-line'}`}>
                      {o.name}
                      {toCents(o.priceText) > 0 && <span className="text-[11px] font-semibold opacity-80">+{fmtRM(toCents(o.priceText))}</span>}
                    </span>
                  ))}
              </div>
            </div>
            <span className="text-[11px] font-extrabold tracking-widest text-soft">ON THE KOT</span>
            <div className="bg-white p-3 font-mono text-xs leading-relaxed shadow">
              <div className="font-bold">[A] 1 x Sirloin Steak</div>
              <div>   - {form.options.find((o) => o.isDefault)?.name ?? form.options[0]?.name ?? '—'}</div>
            </div>
          </aside>
        )}
      </div>
    </Shell>
  );
}
