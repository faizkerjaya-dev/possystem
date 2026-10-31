import { setDoc, updateDoc } from 'firebase/firestore';
import { COL } from '@/config/collections';
import type { Order, Payment, PrintJob, Settings, Staff } from '@/types/models';
import { buildReceiptPages, buildTestPage } from '@/lib/printLayout';
import { newId } from '@/lib/ids';
import { docRef, withoutId } from './db';
import { writeAudit } from './audit';

/**
 * The web app never talks to the printer directly. It only creates documents in `printJobs`.
 * The print agent on the counter PC picks them up one at a time (see print-agent/README.md).
 *
 * Status flow:  pending -> printing -> printed
 *                                  \-> failed     (could not connect; nothing was sent — safe to retry)
 *                                  \-> uncertain  (connection dropped while sending — check paper first!)
 */

function baseJob(settings: Settings, staff: Staff): Pick<PrintJob, 'paperWidth' | 'status' | 'attempts' | 'error' | 'createdBy' | 'createdAt' | 'updatedAt'> {
  const now = Date.now();
  return { paperWidth: settings.receipt.paperWidth, status: 'pending', attempts: 0, error: null, createdBy: staff.name, createdAt: now, updatedAt: now };
}

export async function createTestPrint(settings: Settings, staff: Staff) {
  const job: Omit<PrintJob, 'id'> = {
    ...baseJob(settings, staff),
    type: 'test',
    ref: 'TEST',
    summary: 'Test print',
    pages: buildTestPage(settings, staff.name),
  };
  await setDoc(docRef(COL.printJobs, newId('test_')), job);
}

/** Failed jobs never reached the printer, so sending them again is safe. */
export async function retryJob(staff: Staff, job: PrintJob) {
  await updateDoc(docRef(COL.printJobs, job.id), { status: 'pending', error: null, updatedAt: Date.now() });
  await writeAudit(staff, 'print.retry', { jobId: job.id, ref: job.ref });
}

/** Staff checked the counter and the slip DID come out. */
export async function markJobPrinted(staff: Staff, job: PrintJob) {
  await updateDoc(docRef(COL.printJobs, job.id), { status: 'printed', error: null, updatedAt: Date.now() });
  await writeAudit(staff, 'print.markPrinted', { jobId: job.id, ref: job.ref });
}

/** Admin only: print again as a NEW job (keeps history). */
export async function reprintJob(staff: Staff, job: PrintJob) {
  const now = Date.now();
  const copy: Omit<PrintJob, 'id'> = {
    ...withoutId(job),
    summary: `REPRINT · ${job.summary}`,
    pages: job.pages.map((p) => ({ lines: [{ text: '*** REPRINT ***', align: 'center', bold: true }, ...p.lines] })),
    status: 'pending',
    attempts: 0,
    error: null,
    createdBy: staff.name,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(docRef(COL.printJobs, newId('reprint_')), copy);
  await writeAudit(staff, 'print.reprint', { jobId: job.id, ref: job.ref });
}

/** Admin only: reprint a receipt from a payment record. */
export async function reprintReceipt(staff: Staff, settings: Settings, order: Order, payment: Payment) {
  const pages = buildReceiptPages({ settings, order, payment }).map((p) => ({
    lines: [{ text: '*** REPRINT ***', align: 'center' as const, bold: true }, ...p.lines],
  }));
  const job: Omit<PrintJob, 'id'> = {
    ...baseJob(settings, staff),
    type: 'receipt',
    ref: payment.receiptNo,
    summary: `REPRINT · ${payment.receiptNo}`,
    pages,
  };
  await setDoc(docRef(COL.printJobs, newId('reprint_')), job);
  await writeAudit(staff, 'print.reprintReceipt', { receiptNo: payment.receiptNo });
}
