import { deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { COL } from '@/config/collections';
import type { Category, ModifierGroup, Product, Staff } from '@/types/models';
import { newId } from '@/lib/ids';
import { docRef, withoutId } from './db';
import { writeAudit } from './audit';

/** Menu changes are live immediately on every device (Firestore realtime). Admin only. */

export async function saveCategory(staff: Staff, cat: Category) {
  await setDoc(docRef(COL.categories, cat.id), withoutId(cat));
  await writeAudit(staff, 'menu.category.save', { id: cat.id, name: cat.name });
}
export async function deleteCategory(staff: Staff, id: string) {
  await deleteDoc(docRef(COL.categories, id));
  await writeAudit(staff, 'menu.category.delete', { id });
}
export function blankCategory(sort: number): Category {
  return { id: newId('cat_'), name: 'New category', color: '#A8A49B', sort };
}

export async function saveProduct(staff: Staff, product: Product) {
  await setDoc(docRef(COL.products, product.id), withoutId(product));
  await writeAudit(staff, 'menu.product.save', { id: product.id, name: product.name, priceCents: product.priceCents });
}
export async function setProductAvailable(staff: Staff, id: string, available: boolean) {
  await updateDoc(docRef(COL.products, id), { available });
  await writeAudit(staff, 'menu.product.available', { id, available });
}
export async function deleteProduct(staff: Staff, id: string) {
  await deleteDoc(docRef(COL.products, id));
  await writeAudit(staff, 'menu.product.delete', { id });
}
export function blankProduct(categoryId: string, station: string, sort: number): Product {
  return {
    id: newId('p_'),
    name: 'New item',
    priceCents: 0,
    categoryId,
    station,
    modifierGroupIds: [],
    available: true,
    popular: false,
    description: '',
    sort,
  };
}

export async function saveModifierGroup(staff: Staff, group: ModifierGroup) {
  await setDoc(docRef(COL.modifierGroups, group.id), withoutId(group));
  await writeAudit(staff, 'menu.modifierGroup.save', { id: group.id, name: group.name });
}
export async function deleteModifierGroup(staff: Staff, id: string) {
  await deleteDoc(docRef(COL.modifierGroups, id));
  await writeAudit(staff, 'menu.modifierGroup.delete', { id });
}
export function blankModifierGroup(sort: number): ModifierGroup {
  return { id: newId('mg_'), name: 'New group', required: false, maxChoices: 1, options: [], sort };
}
