import { useEffect, useState, type ComponentType } from 'react';
import { Building2, ChefHat, CreditCard, LayoutGrid, MonitorSmartphone, Printer, Receipt, Percent, Users } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/controls';
import { PaperPreview } from '@/components/print/PaperPreview';
import { useStaff } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { saveSettings } from '@/services/settings';
import type { Settings } from '@/types/models';
import {
  BusinessSection,
  DevicesSection,
  PaymentsSection,
  PrintingSection,
  ReceiptSection,
  StaffSection,
  StationsSection,
  TablesSection,
  TaxSection,
  type SectionProps,
} from './SettingsSections';
import { sampleKot, sampleReceipt } from './sampleData';

interface SectionDef {
  id: string;
  label: string;
  sub: string;
  icon: typeof Building2;
  Comp: ComponentType<SectionProps>;
  preview?: 'receipt' | 'kot';
}

/** To add a settings section: write a component in SettingsSections.tsx and add one line here. */
const SECTIONS: SectionDef[] = [
  { id: 'business', label: 'Business & brand', sub: 'Name, address and colour on every device and receipt', icon: Building2, Comp: BusinessSection, preview: 'receipt' },
  { id: 'receipt', label: 'Receipt', sub: 'What prints on the customer receipt', icon: Receipt, Comp: ReceiptSection, preview: 'receipt' },
  { id: 'tax', label: 'Tax & charges', sub: 'SST, service charge, rounding, discounts', icon: Percent, Comp: TaxSection, preview: 'receipt' },
  { id: 'printing', label: 'Printing & KOT', sub: 'KOT copies and labels for the counter printer', icon: Printer, Comp: PrintingSection, preview: 'kot' },
  { id: 'payments', label: 'Payment methods', sub: 'Buttons on the payment screen', icon: CreditCard, Comp: PaymentsSection },
  { id: 'stations', label: 'Kitchen stations', sub: 'Stations and late timers', icon: ChefHat, Comp: StationsSection },
  { id: 'tables', label: 'Tables & areas', sub: 'Areas and tables on the floor plan', icon: LayoutGrid, Comp: TablesSection },
  { id: 'staff', label: 'Staff & roles', sub: 'Logins, PINs, roles', icon: Users, Comp: StaffSection },
  { id: 'devices', label: 'Devices', sub: 'Print agent and device setup', icon: MonitorSmartphone, Comp: DevicesSection },
];

export function SettingsPage() {
  const staff = useStaff();
  const toast = useToast();
  const { settings, loaded } = useSettings();
  const [draft, setDraft] = useState<Settings>(settings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secId, setSecId] = useState('business');
  const sec = SECTIONS.find((s) => s.id === secId) ?? SECTIONS[0];

  // Load saved settings once (and again after saving / when not editing)
  useEffect(() => {
    if (!dirty) setDraft(settings);
  }, [settings, dirty, loaded]);

  const update = (patch: Partial<Settings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(staff, draft);
      setDirty(false);
      toast.ok('Saved · all devices updated');
    } catch (err) {
      toast.error(err, 'settings');
    } finally {
      setSaving(false);
    }
  };

  const pages = sec.preview === 'kot' ? sampleKot(draft) : sec.preview === 'receipt' ? sampleReceipt(draft) : [];

  return (
    <Shell area="admin">
      <TopBar
        right={
          <>
            <span className={`text-[13px] font-semibold ${dirty ? 'text-[#7A5310]' : 'text-muted'}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <Button size="sm" disabled={!dirty || saving} onClick={() => { setDraft(settings); setDirty(false); }}>
              Undo
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <span className="text-lg font-extrabold">Settings</span>
        <Badge tone="dark">ADMIN ONLY</Badge>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <div role="tablist" aria-label="Settings sections" className="flex w-[216px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-white p-2.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === secId}
              onClick={() => setSecId(s.id)}
              className={`flex min-h-[50px] items-center gap-2.5 rounded-xl px-3 text-left text-sm ${s.id === secId ? 'bg-ink font-bold text-white' : 'font-medium'}`}
            >
              <s.icon size={18} aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
        <section aria-label={sec.label} className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-extrabold">{sec.label}</h1>
            <span className="text-[13px] text-muted">{sec.sub}</span>
          </div>
          <sec.Comp draft={draft} update={update} />
        </section>
        {pages.length > 0 && (
          <aside aria-label="Live preview" className="flex w-[330px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto border-l border-line bg-paper p-3.5">
            <span className="self-start text-[11px] font-extrabold tracking-widest text-soft">LIVE PREVIEW · NOT SAVED UNTIL YOU SAVE</span>
            {pages.map((p, i) => (
              <PaperPreview key={i} lines={p.lines} paperWidth={draft.receipt.paperWidth} />
            ))}
          </aside>
        )}
      </div>
    </Shell>
  );
}
