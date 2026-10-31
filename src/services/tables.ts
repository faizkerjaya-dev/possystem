import { deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { COL } from '@/config/collections';
import type { Staff, Table, TableShape, TableStatus } from '@/types/models';
import { newId } from '@/lib/ids';
import { docRef, withoutId } from './db';
import { writeAudit } from './audit';

export async function setTableStatus(id: string, status: TableStatus, extra: Partial<Table> = {}) {
  await updateDoc(docRef(COL.tables, id), { status, ...extra });
}

/** After payment: the table goes to CLEANING (never straight to available). */
export async function releaseTable(staff: Staff, table: Table) {
  await updateDoc(docRef(COL.tables, table.id), { status: 'cleaning', orderId: null, guests: 0, openedAt: null });
  await writeAudit(staff, 'table.release', { table: table.label });
}

export async function markTableAvailable(id: string) {
  await updateDoc(docRef(COL.tables, id), { status: 'available', orderId: null, guests: 0, openedAt: null, note: '' });
}

export async function reserveTable(id: string, note: string) {
  await updateDoc(docRef(COL.tables, id), { status: 'reserved', note });
}

export async function moveTable(id: string, x: number, y: number) {
  await updateDoc(docRef(COL.tables, id), { x: Math.round(x), y: Math.round(y) });
}

export async function createTable(staff: Staff, area: string, label: string, seats: number, index: number) {
  const shape: TableShape = seats <= 2 ? 'round' : seats >= 6 ? 'rect' : 'square';
  const w = shape === 'rect' ? 200 : shape === 'round' ? 110 : 130;
  const h = shape === 'round' ? 110 : 130;
  const table: Table = {
    id: newId('t_'),
    label,
    area,
    seats,
    shape,
    x: 40 + (index % 4) * 230,
    y: 40 + Math.floor(index / 4) * 200,
    w,
    h,
    status: 'available',
    orderId: null,
    guests: 0,
    openedAt: null,
    note: '',
  };
  await setDoc(docRef(COL.tables, table.id), withoutId(table));
  await writeAudit(staff, 'table.create', { label, area });
}

export async function deleteTable(staff: Staff, table: Table) {
  await deleteDoc(docRef(COL.tables, table.id));
  await writeAudit(staff, 'table.delete', { label: table.label });
}
