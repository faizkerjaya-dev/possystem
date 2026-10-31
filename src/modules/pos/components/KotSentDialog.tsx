import { Printer } from 'lucide-react';
import { COL } from '@/config/collections';
import type { PrintJob } from '@/types/models';
import { docRef } from '@/services/db';
import { useLiveDoc } from '@/hooks/useLive';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/controls';
import { PaperPreview } from '@/components/print/PaperPreview';
import { savePagesAsPdf } from '@/lib/pdf';

const STATUS_TEXT: Record<PrintJob['status'], { text: string; tone: 'grey' | 'accent' | 'ok' | 'danger' | 'warn' }> = {
  pending: { text: 'WAITING FOR PRINTER', tone: 'grey' },
  printing: { text: 'PRINTING', tone: 'accent' },
  printed: { text: 'PRINTED', tone: 'ok' },
  failed: { text: 'FAILED · RETRY IN PRINTER PAGE', tone: 'danger' },
  uncertain: { text: 'CHECK PRINTER', tone: 'warn' },
};

/** After "Send": shows the exact KOT pages sent to the counter printer and their live status. */
export function KotSentDialog({ orderId, batch, onClose }: { orderId: string; batch: number; onClose: () => void }) {
  const job = useLiveDoc<PrintJob>(() => docRef(COL.printJobs, `kot_${orderId}_${batch}`), [orderId, batch]);
  const st = job.data ? STATUS_TEXT[job.data.status] : STATUS_TEXT.pending;

  return (
    <Modal
      wide
      title={batch > 1 ? `Add-on sent · ${job.data?.ref ?? ''}` : `Order sent · ${job.data?.ref ?? ''}`}
      subtitle={`${job.data?.pages.length ?? 0} labelled KOT copies at the counter printer · tear and hand out`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Printer size={18} aria-hidden />
            <Badge tone={st.tone}>{st.text}</Badge>
          </span>
          <div className="flex gap-2">
            {job.data && (
              <Button onClick={() => savePagesAsPdf(job.data!.pages, `KOT-${job.data!.ref}-${batch}`, job.data!.paperWidth)}>Save PDF</Button>
            )}
            <Button variant="dark" size="lg" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex gap-3 overflow-x-auto rounded-2xl bg-paper p-4">
        {job.loading && <span className="text-sm text-muted">Loading…</span>}
        {job.data?.pages.map((p, i) => <PaperPreview key={i} lines={p.lines} paperWidth={job.data!.paperWidth} />)}
      </div>
    </Modal>
  );
}
