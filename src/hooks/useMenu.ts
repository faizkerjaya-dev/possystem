import { useMemo } from 'react';
import { orderBy, query } from 'firebase/firestore';
import { COL } from '@/config/collections';
import { colRef } from '@/services/db';
import type { Category, ModifierGroup, Product } from '@/types/models';
import { useLiveQuery } from './useLive';

/** Whole menu, live. Changes made in Admin › Menu appear on every device within a second. */
export function useMenu() {
  const cats = useLiveQuery<Category>(() => query(colRef(COL.categories), orderBy('sort')), []);
  const products = useLiveQuery<Product>(() => query(colRef(COL.products), orderBy('sort')), []);
  const groups = useLiveQuery<ModifierGroup>(() => query(colRef(COL.modifierGroups), orderBy('sort')), []);

  const groupById = useMemo(() => new Map(groups.data.map((g) => [g.id, g])), [groups.data]);
  const categoryById = useMemo(() => new Map(cats.data.map((c) => [c.id, c])), [cats.data]);

  return {
    categories: cats.data,
    products: products.data,
    groups: groups.data,
    groupById,
    categoryById,
    loading: cats.loading || products.loading || groups.loading,
    error: cats.error || products.error || groups.error,
  };
}
