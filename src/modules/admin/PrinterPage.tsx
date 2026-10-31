import { useState } from 'react';
import { limit, orderBy, query } from 'firebase/firestore';
import { AlertTriangle, Printer } from 'lucide-react';
import { COL } from '@/config/collections';
import { can } from '@/config/permissions';
import { colRef } from '@/services/db';
import { createTestPrint, markJobPrinted, reprintJob, retryJob } from '@/services/printJobs';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Badge, ScreenMessage } from '@/components/ui/controls';
import { PaperPreview } from '@/components/print/PaperPreview';
import { useLiveQuery } from '@/hooks/useLive';
import { useStaff } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { usePrinterStatus } from '@/hooks/useDeviceStatus';
import { useToast } from '@/hooks/useToast';
import { savePagesAsPdf } from '@/lib/pdf';
import { hhmm } from '@/lib/time';
import type { PrintJob } from '@/types/models';

const STATUS: Record<PrintJob['status'], { text: string; tone: 'grey' | 'accent' | 'ok' | 'danger' | 'warn' | 'blue' }> = {
  pending: { text: 'WAITING', tone: 'blue' },
  printing: { text: 'PRINTING', tone: 'accent' },
  printed: { text: 'PRINTED', tone: 'ok' },
  failed: { text: 'FAILED', tone: 'danger' },
  uncertain: { text: 'NEEDS CHECK', tone: 'warn' },
};

/** Printer status, the print queue, and previews/PDF of any job. */
export function PrinterPage() {
  const staff = useStaff();
  const { settings } = useSettings();
  const toast = useToast();
  const printer = usePrinterStatus();
  const jobs = useLiveQuery<PrintJob>(() => query(colRef(COL.printJobs), orderBy('createdAt', 'desc'), limit(40)), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = jobs.data.find((j) => j.id === selectedId) ?? jobs.data[0] ?? null;
  const [page, setPage] = useState(0);

  const problems = jobs.data.filter((j) => j.status === 'failed' || j.status === 'uncertain');
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.ok(ok);
    } catch (err) {
      toast.error(err, 'printer');
    }
  };

  return (
    <Shell area="admin">
      <TopBar>
        <span className="text-lg font-extrabold">Printer &amp; queue</span>
        <span className="text-[13px] text-muted">One printer · KOT and receipts print one job at a time</span>
      </TopBar>
      <div className="flex min-h-0 flex-1 gap-3 p-3.5">
        <div className="flex w-[330px] shrink-0 flex-col gap-3 overflow-y-auto">
          <section aria-label="Printer status" className="flex flex-col gap-3 rounded-2xl bg-rail p-4 text-cream">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2B2D31]">
                <Printer size={26} aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-[17px] font-extrabold">{settings.printing.printerName}</span>
                <span className="text-xs text-[#B5B1A8]">80mm thermal · ESC/POS · LAN</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className={`flex flex-col rounded-xl p-2.5 ${printer.agentOnline ? 'bg-[#1F3A2B]' : 'bg-[#4A2222]'}`}>
                <span className="text-[11px] opacity-80">PRINT AGENT</span>
                <span className="text-[15px] font-extrabold">{printer.agentOnline ? 'Online' : 'Offline'}</span>
              </span>
              <span className={`flex flex-col rounded-xl p-2.5 ${printer.printerOnline ? 'bg-[#1F3A2B]' : 'bg-[#4A2222]'}`}>
                <span className="text-[11px] opacity-80">PRINTER</span>
                <span className="text-[15px] font-extrabold">{printer.printerOnline ? 'Reachable' : 'Not reachable'}</span>
              </span>
            </div>
            <dl className="flex flex-col gap-1 text-xs text-[#B5B1A8]">
              <div className="flex justify-between"><dt>Printer address</dt><dd className="font-mono text-cream">{printer.agent?.printerHost ?? '—'}</dd></div>
              <div className="flex justify-between"><dt>Agent</dt><dd className="text-cream">{printer.agent ? `${printer.agent.name} · v${printer.agent.version}` : 'not running'}</dd></div>
              <div className="flex justify-between"><dt>Last heartbeat</dt><dd className="text-cream">{printer.agent ? hhmm(printer.agent.lastSeen) : '—'}</dd></div>
            </dl>
            {!printer.agentOnline && (
              <p className="rounded-lg bg-[#2B2D31] p-2.5 text-xs leading-relaxed">
                Start the print agent on the counter PC (print-agent/README.md). Jobs wait in the queue until it is running.
              </p>
            )}
          </section>
          <Button variant="primary" size="lg" onClick={() => run(() => createTestPrint(settings, staff), 'Test print queued')}>
            Test print
          </Button>
          {problems.map((j) => (
            <section key={j.id} role="alert" className="flex flex-col gap-2.5 rounded-2xl bg-dangerbg p-3.5 text-[#6E1F1F]">
              <span className="flex items-center gap-2 text-xs font-extrabold tracking-wide">
                <AlertTriangle size={16} aria-hidden /> {STATUS[j.status].text} · {j.ref}
              </span>
              <span className="text-[13px] leading-snug">
                {j.status === 'uncertain'
                  ? 'The printer stopped responding while this was being sent. Look at the counter: did it come out?'
                  : `Could not reach the printer: ${j.error ?? 'unknown error'}. Nothing was printed — safe to retry.`}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {j.status === 'uncertain' ? (
                  <>
                    <Button size="sm" onClick={() => run(() => markJobPrinted(staff, j), 'Marked as printed')}>It printed</Button>
                    <Button size="sm" variant="dark" disabled={!can(staff.role, 'reprint')} onClick={() => run(() => reprintJob(staff, j), 'Reprint queued')}>
                      {can(staff.role, 'reprint') ? 'Reprint' : 'Ask admin'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="dark" className="col-span-2" onClick={() => run(() => retryJob(staff, j), 'Retry queued')}>
                    Retry
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>

        <section aria-label="Queue" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-baseline justify-between border-b border-[#F1EEE8] px-4 py-3">
            <span className="text-[15px] font-extrabold">Queue · last 40</span>
            <span className="text-xs text-muted">Tap a job to preview</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {jobs.error && <ScreenMessage tone="error" title={jobs.error} />}
            {jobs.data.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => {
                  setSelectedId(j.id);
                  setPage(0);
                }}
                className={`flex w-full items-center gap-3 border-b border-[#F4F2EE] px-4 py-2.5 text-left ${selected?.id === j.id ? 'bg-[#FBF4EE]' : ''}`}
              >
                <span className={`flex h-10 w-16 items-center justify-center rounded-lg text-xs font-extrabold ${j.type === 'receipt' ? 'bg-[#E4EAF1] text-[#2E3D5E]' : 'bg-[#F3E4DA] text-[#7A3A1E]'}`}>
                  {j.type.toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-bold">{j.ref}</span>
                  <span className="truncate text-xs text-muted">
                    {j.summary} · {j.pages.length} page(s)
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={STATUS[j.status].tone}>{STATUS[j.status].text}</Badge>
                  <span className="text-[11px] text-muted">{hhmm(j.createdAt)} · {j.createdBy}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Preview" className="flex w-[330px] shrink-0 flex-col items-center gap-2.5 rounded-2xl bg-paper p-3">
          {selected ? (
            <>
              {selected.pages.length > 1 && (
                <div role="group" aria-label="Copy" className="grid w-full gap-1" style={{ gridTemplateColumns: `repeat(${selected.pages.length}, minmax(0,1fr))` }}>
                  {selected.pages.map((_, i) => (
                    <button key={i} type="button" aria-pressed={i === page} onClick={() => setPage(i)} className={`h-10 rounded-lg text-xs font-bold ${i === page ? 'bg-ink text-white' : 'border border-[#D6D1C7] bg-white'}`}>
                      {i + 1}/{selected.pages.length}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <PaperPreview lines={selected.pages[Math.min(page, selected.pages.length - 1)].lines} paperWidth={selected.paperWidth} />
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                <Button onClick={() => savePagesAsPdf(selected.pages, `${selected.type}-${selected.ref}`, selected.paperWidth)}>Save PDF</Button>
                <Button variant="dark" disabled={!can(staff.role, 'reprint')} onClick={() => run(() => reprintJob(staff, selected), 'Reprint queued')}>
                  {can(staff.role, 'reprint') ? 'Reprint' : 'Admin only'}
                </Button>
              </div>
            </>
          ) : (
            <ScreenMessage title="No print jobs yet" />
          )}
        </section>
      </div>
    </Shell>
  );
}
