import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { query } from 'firebase/firestore';
import { COL } from '@/config/collections';
import { ROLE_LABEL } from '@/config/permissions';
import { colRef } from '@/services/db';
import { createStaffAccount, PIN_LENGTH, setStaffActive, staffEmail } from '@/services/auth';
import { createTable, deleteTable } from '@/services/tables';
import { Button } from '@/components/ui/Button';
import { Card, Segmented, Stepper, Switch, TextField, ToggleRow } from '@/components/ui/controls';
import { useLiveQuery } from '@/hooks/useLive';
import { useStaff } from '@/hooks/useAuth';
import { useTables } from '@/hooks/useOrders';
import { useToast } from '@/hooks/useToast';
import { usePrinterStatus } from '@/hooks/useDeviceStatus';
import { hhmm } from '@/lib/time';
import { newId } from '@/lib/ids';
import type { PaymentKind, Role, Settings, Staff } from '@/types/models';

/**
 * Each settings section is a small component. Sections that edit `settings/main` receive the draft
 * and an `update` function; the page saves everything with one "Save changes" button.
 * Tables and Staff are separate collections and save immediately.
 */
export interface SectionProps {
  draft: Settings;
  update: (patch: Partial<Settings>) => void;
}

const ACCENTS = [
  ['Terracotta', '#A9592F'],
  ['Forest', '#2F6B4F'],
  ['Navy', '#2E4A7A'],
  ['Burgundy', '#8A2E3B'],
  ['Charcoal', '#3A3C41'],
];

export function BusinessSection({ draft, update }: SectionProps) {
  const b = draft.business;
  const set = (k: keyof typeof b, v: string) => update({ business: { ...b, [k]: v } });
  return (
    <>
      <Card className="grid grid-cols-2 gap-3">
        <TextField className="col-span-2" label="Restaurant name" value={b.name} onChange={(v) => set('name', v)} />
        <TextField label="Company name" value={b.legalName} onChange={(v) => set('legalName', v)} />
        <TextField label="SST registration no." value={b.sstNo} onChange={(v) => set('sstNo', v)} />
        <TextField className="col-span-2" label="Address" value={b.address} onChange={(v) => set('address', v)} />
        <TextField label="Phone" value={b.phone} onChange={(v) => set('phone', v)} />
      </Card>
      <Card className="flex flex-col gap-3">
        <span className="text-[15px] font-extrabold">Accent colour · primary buttons on every device</span>
        <div role="group" aria-label="Accent colour" className="flex flex-wrap gap-2.5">
          {ACCENTS.map(([name, c]) => (
            <button
              key={c}
              type="button"
              aria-label={name}
              aria-pressed={b.accent === c}
              onClick={() => set('accent', c)}
              className="h-[52px] w-[52px] rounded-2xl"
              style={{ background: c, border: b.accent === c ? '3px solid #202124' : '3px solid #fff' }}
            />
          ))}
          <label className="flex items-center gap-2 text-sm font-semibold">
            Custom
            <input type="color" value={b.accent} onChange={(e) => set('accent', e.target.value)} className="h-[52px] w-[52px] cursor-pointer rounded-xl" />
          </label>
        </div>
      </Card>
    </>
  );
}

export function ReceiptSection({ draft, update }: SectionProps) {
  const r = draft.receipt;
  const set = (patch: Partial<typeof r>) => update({ receipt: { ...r, ...patch } });
  return (
    <>
      <Card className="flex flex-col gap-3">
        <TextField label="Message under the header" value={r.headerNote} onChange={(v) => set({ headerNote: v })} />
        <TextField label="Footer message" value={r.footerNote} onChange={(v) => set({ footerNote: v })} />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Paper width</span>
          <Segmented label="Paper width" value={r.paperWidth} onChange={(v) => set({ paperWidth: v })} options={[{ value: 80, label: '80 mm' }, { value: 58, label: '58 mm' }]} />
        </div>
      </Card>
      <Card className="!py-1">
        <ToggleRow label="Show SST registration no." hint="Required when SST is charged" checked={r.showSstNo} onChange={(v) => set({ showSstNo: v })} />
        <ToggleRow label="Show waiter name" checked={r.showWaiter} onChange={(v) => set({ showWaiter: v })} />
      </Card>
    </>
  );
}

export function TaxSection({ draft, update }: SectionProps) {
  const t = draft.tax;
  const set = (patch: Partial<typeof t>) => update({ tax: { ...t, ...patch } });
  const num = (v: string) => Math.max(0, Math.min(100, Number(v.replace(/[^0-9.]/g, '')) || 0));
  return (
    <>
      <Card className="grid grid-cols-2 gap-3">
        <TextField label="SST rate (%)" inputMode="decimal" value={String(t.sstRate)} onChange={(v) => set({ sstRate: num(v) })} />
        <TextField label="Service charge rate (%)" inputMode="decimal" value={String(t.serviceRate)} onChange={(v) => set({ serviceRate: num(v) })} />
      </Card>
      <Card className="!py-1">
        <ToggleRow label="Charge SST" hint="On subtotal − discount + service charge" checked={t.sstEnabled} onChange={(v) => set({ sstEnabled: v })} />
        <ToggleRow label="Charge service charge" hint="Dine-in orders" checked={t.serviceEnabled} onChange={(v) => set({ serviceEnabled: v })} />
        <ToggleRow label="Service charge on takeaway" checked={t.serviceOnTakeaway} onChange={(v) => set({ serviceOnTakeaway: v })} />
        <ToggleRow label="Cash rounding to 5 sen" hint="Card and QR are never rounded" checked={t.cashRounding} onChange={(v) => set({ cashRounding: v })} />
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="text-sm font-bold">Discount buttons for the cashier (%)</span>
        <TextField
          label="Comma separated, e.g. 5, 10, 15"
          value={draft.discountOptions.join(', ')}
          onChange={(v) => update({ discountOptions: v.split(',').map((x) => num(x)).filter((x) => x > 0) })}
        />
      </Card>
    </>
  );
}

export function PrintingSection({ draft, update }: SectionProps) {
  const p = draft.printing;
  const set = (patch: Partial<typeof p>) => update({ printing: { ...p, ...patch } });
  const copies = p.kotCopies;
  return (
    <>
      <Card className="flex flex-col gap-3">
        <TextField label="Printer name (shown on screens)" value={p.printerName} onChange={(v) => set({ printerName: v })} />
        <p className="text-xs text-muted">The printer IP address is set on the counter PC in print-agent/.env (PRINTER_HOST).</p>
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex flex-col">
            <span className="text-sm font-bold">KOT copies per send</span>
            <span className="text-xs text-muted">Each copy prints with its own label. Items of the chosen station print bold.</span>
          </span>
          <Stepper
            label="copies"
            value={copies.length}
            min={1}
            max={6}
            onChange={(n) =>
              set({
                kotCopies: n > copies.length ? [...copies, { label: `COPY ${n}`, station: null }] : copies.slice(0, n),
              })
            }
          />
        </div>
        {copies.map((c, i) => (
          <div key={i} className="grid grid-cols-[64px_1fr_170px] items-end gap-2.5">
            <span className="pb-3.5 text-xs font-extrabold text-soft">COPY {i + 1}</span>
            <TextField label="Label" value={c.label} onChange={(v) => set({ kotCopies: copies.map((x, j) => (j === i ? { ...x, label: v.toUpperCase() } : x)) })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-soft">Bold items of</span>
              <select
                value={c.station ?? ''}
                onChange={(e) => set({ kotCopies: copies.map((x, j) => (j === i ? { ...x, station: e.target.value || null } : x)) })}
                className="h-12 rounded-xl border border-[#D6D1C7] bg-white px-2.5 text-sm font-semibold"
              >
                <option value="">All stations</option>
                {draft.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    Station {s.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </Card>
      <Card className="!py-1">
        <ToggleRow label="Print receipt after payment" hint="1 copy, only after payment is confirmed" checked={p.autoPrintReceipt} onChange={(v) => set({ autoPrintReceipt: v })} />
        <ToggleRow label="Restaurant name on KOT" hint="Off saves a little paper" checked={p.kotShowBusinessName} onChange={(v) => set({ kotShowBusinessName: v })} />
      </Card>
    </>
  );
}

export function PaymentsSection({ draft, update }: SectionProps) {
  const list = draft.paymentMethods;
  const set = (i: number, patch: Partial<(typeof list)[number]>) => update({ paymentMethods: list.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  return (
    <>
      <Card className="flex flex-col gap-2">
        {list.map((m, i) => (
          <div key={m.id} className="grid grid-cols-[1fr_150px_auto_auto] items-end gap-2.5 border-b border-[#F4F2EE] pb-2.5 last:border-0">
            <TextField label="Name on the button" value={m.label} onChange={(v) => set(i, { label: v })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-soft">Type</span>
              <select value={m.kind} onChange={(e) => set(i, { kind: e.target.value as PaymentKind })} className="h-12 rounded-xl border border-[#D6D1C7] bg-white px-2.5 text-sm font-semibold">
                <option value="cash">Cash (numpad, rounding)</option>
                <option value="qr">QR</option>
                <option value="card">Card terminal</option>
                <option value="other">Other / e-wallet</option>
              </select>
            </label>
            <span className="pb-2.5">
              <Switch label={`${m.label} enabled`} checked={m.enabled} onChange={(v) => set(i, { enabled: v })} />
            </span>
            <button type="button" aria-label={`Remove ${m.label}`} onClick={() => update({ paymentMethods: list.filter((_, j) => j !== i) })} className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-line text-danger">
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
        ))}
      </Card>
      <Button className="self-start border-dashed" onClick={() => update({ paymentMethods: [...list, { id: newId('pm_'), label: 'New method', kind: 'other', enabled: true }] })}>
        + Add payment method
      </Button>
    </>
  );
}

export function StationsSection({ draft, update }: SectionProps) {
  const list = draft.stations;
  const set = (i: number, patch: Partial<(typeof list)[number]>) => update({ stations: list.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <>
      {list.map((s, i) => (
        <Card key={s.id} className="grid grid-cols-[1.6fr_1fr_1fr] items-end gap-3">
          <TextField label={`Station ${s.id} · name`} value={s.name} onChange={(v) => set(i, { name: v })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-soft">Amber after (min)</span>
            <Stepper label="warn minutes" value={s.warnAfterMin} min={1} max={120} onChange={(v) => set(i, { warnAfterMin: v })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-soft">Late after (min)</span>
            <Stepper label="late minutes" value={s.lateAfterMin} min={1} max={180} onChange={(v) => set(i, { lateAfterMin: v })} />
          </label>
        </Card>
      ))}
      <Button
        className="self-start border-dashed"
        onClick={() => update({ stations: [...list, { id: String.fromCharCode(65 + list.length), name: 'New station', warnAfterMin: 10, lateAfterMin: 20 }] })}
      >
        + Add station
      </Button>
      <p className="text-xs text-muted">Open a station screen on its tablet at /kds/&lt;letter&gt;, e.g. /kds/C. Assign items to it in Menu.</p>
    </>
  );
}

/** Tables live in their own collection and save immediately. */
export function TablesSection({ draft, update }: SectionProps) {
  const staff = useStaff();
  const toast = useToast();
  const { tables } = useTables();
  const [newArea, setNewArea] = useState('');
  const run = (fn: () => Promise<unknown>) => fn().catch((e) => toast.error(e, 'tables'));
  const nextLabel = () => {
    const nums = tables.map((t) => Number(t.label.replace(/\D/g, '')) || 0);
    return `T${String(Math.max(0, ...nums) + 1).padStart(2, '0')}`;
  };

  return (
    <>
      {draft.areas.map((area) => {
        const inArea = tables.filter((t) => t.area === area);
        return (
          <Card key={area} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold">{area}</span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => run(() => createTable(staff, area, nextLabel(), 4, inArea.length))}>
                  + Table
                </Button>
                <Button size="sm" variant="danger" disabled={inArea.length > 0} onClick={() => update({ areas: draft.areas.filter((a) => a !== area) })}>
                  Remove area
                </Button>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inArea.map((t) => (
                <span key={t.id} className="flex items-center gap-1 rounded-full bg-[#F1EEE8] py-1 pl-3 pr-1 text-[13px] font-bold">
                  {t.label} · {t.seats}
                  <button
                    type="button"
                    aria-label={`Delete ${t.label}`}
                    disabled={!!t.orderId}
                    onClick={() => window.confirm(`Delete ${t.label}?`) && run(() => deleteTable(staff, t))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-danger disabled:opacity-30"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </span>
              ))}
              {inArea.length === 0 && <span className="text-sm text-muted">No tables yet.</span>}
            </div>
          </Card>
        );
      })}
      <Card className="flex items-end gap-2.5">
        <TextField className="flex-1" label="New area name" value={newArea} onChange={setNewArea} />
        <Button
          disabled={!newArea.trim() || draft.areas.includes(newArea.trim())}
          onClick={() => {
            update({ areas: [...draft.areas, newArea.trim()] });
            setNewArea('');
          }}
        >
          Add area
        </Button>
      </Card>
      <p className="text-xs text-muted">Areas are saved with “Save changes”. Drag tables into place on the Floor screen with “Arrange”.</p>
    </>
  );
}

export function StaffSection({ draft }: SectionProps) {
  const admin = useStaff();
  const toast = useToast();
  const staff = useLiveQuery<Staff>(() => query(colRef(COL.staff)), []);
  const [form, setForm] = useState({ name: '', username: '', role: 'waiter' as Role, pin: '', station: draft.stations[0]?.id ?? 'A' });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await createStaffAccount(admin, form);
      toast.ok(`${form.name} can now log in with their PIN`);
      setForm({ ...form, name: '', username: '', pin: '' });
    } catch (e) {
      toast.error(e, 'staff');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="!py-1">
        {staff.data.map((s) => (
          <div key={s.id} className="flex items-center gap-3 border-b border-[#F4F2EE] py-2.5 last:border-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1EEE8] text-sm font-extrabold">{s.name.slice(0, 2).toUpperCase()}</span>
            <span className="flex flex-1 flex-col">
              <span className="font-bold">{s.name}</span>
              <span className="text-xs text-muted">
                {ROLE_LABEL[s.role]}
                {s.role === 'kitchen' && s.station ? ` · Station ${s.station}` : ''} · {s.email}
              </span>
            </span>
            <Switch
              label={`${s.name} active`}
              checked={s.active}
              disabled={s.id === admin.id || s.role === 'owner'}
              onChange={(v) => setStaffActive(admin, s.id, v).catch((e) => toast.error(e, 'staff'))}
            />
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <span className="text-[15px] font-extrabold">Add staff</span>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Display name" value={form.name} onChange={(v) => setForm({ ...form, name: v, username: form.username || v.toLowerCase().replace(/\s+/g, '') })} />
          <TextField label={`Username (login email: ${staffEmail(form.username || 'name')})`} value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-soft">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="h-12 rounded-xl border border-[#D6D1C7] bg-white px-2.5 text-sm font-semibold">
              {(['admin', 'cashier', 'waiter', 'kitchen'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <TextField label={`${PIN_LENGTH}-digit PIN`} inputMode="numeric" value={form.pin} onChange={(v) => setForm({ ...form, pin: v.replace(/\D/g, '').slice(0, PIN_LENGTH) })} />
          {form.role === 'kitchen' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-soft">Station</span>
              <select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} className="h-12 rounded-xl border border-[#D6D1C7] bg-white px-2.5 text-sm font-semibold">
                {draft.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    Station {s.id} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Button variant="primary" disabled={busy || !form.name.trim() || !form.username.trim() || form.pin.length !== PIN_LENGTH} onClick={add}>
          {busy ? 'Creating…' : 'Create staff login'}
        </Button>
        <p className="text-xs text-muted">
          Forgotten PIN: Firebase console › Authentication › find the email › reset password, or deactivate and create a new login.
          Permissions per role are fixed in code (src/config/permissions.ts + firestore.rules).
        </p>
      </Card>
    </>
  );
}

export function DevicesSection() {
  const printer = usePrinterStatus();
  return (
    <Card className="flex flex-col gap-2.5">
      <span className="text-[15px] font-extrabold">Print agent</span>
      {printer.agent ? (
        <p className="text-sm">
          {printer.agent.name} · v{printer.agent.version} · printer {printer.agent.printerHost} · last seen {hhmm(printer.agent.lastSeen)} ·{' '}
          <strong className={printer.agentOnline ? 'text-ok' : 'text-danger'}>{printer.agentOnline ? 'online' : 'offline'}</strong>
        </p>
      ) : (
        <p className="text-sm text-muted">No print agent has connected yet. See print-agent/README.md.</p>
      )}
      <span className="mt-2 text-[15px] font-extrabold">Tablets &amp; phones</span>
      <p className="text-sm text-muted">
        Any device can be used: open the website, sign in with a staff PIN. Bookmark /pos on the cashier tablet, /m on waiter phones and
        /kds/A, /kds/B on the kitchen tablets. Use “Add to Home Screen” for a full-screen app.
      </p>
    </Card>
  );
}
