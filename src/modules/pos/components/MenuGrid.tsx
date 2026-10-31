import type { Category, Product } from '@/types/models';
import { fmtRM } from '@/lib/money';

export const POPULAR = '__popular__';

/** Tile colour = category colour at low opacity, so staff recognise categories at a glance. */
export function tint(hex: string | undefined, alpha = '2E') {
  return (hex ?? '#A8A49B') + alpha;
}

export function filterProducts(products: Product[], categoryId: string, search: string) {
  const q = search.trim().toLowerCase();
  if (q) return products.filter((p) => p.name.toLowerCase().includes(q));
  if (categoryId === POPULAR) return products.filter((p) => p.popular);
  return products.filter((p) => p.categoryId === categoryId);
}

export function MenuGrid({
  products,
  categoryById,
  counts,
  onPick,
  columns = 4,
}: {
  products: Product[];
  categoryById: Map<string, Category>;
  counts: Map<string, number>;
  onPick: (p: Product) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4';
  if (products.length === 0) return <p className="p-6 text-center text-sm text-muted">No items here.</p>;
  return (
    <div className={`grid ${cols} gap-2.5`}>
      {products.map((p) => {
        const cat = categoryById.get(p.categoryId);
        const n = counts.get(p.id) ?? 0;
        return (
          <button
            key={p.id}
            type="button"
            disabled={!p.available}
            onClick={() => onPick(p)}
            aria-label={`${p.name}, ${fmtRM(p.priceCents)}${p.available ? '' : ', sold out'}`}
            className="relative flex h-[104px] flex-col justify-between rounded-2xl p-3 text-left disabled:opacity-50"
            style={{ background: tint(cat?.color) }}
          >
            <span className="pr-6 text-[15px] font-bold leading-tight">{p.name}</span>
            <span className="flex w-full items-end justify-between">
              <span className="text-sm font-semibold tabular-nums">{fmtRM(p.priceCents)}</span>
              <span className="text-[10px] font-extrabold opacity-70">
                K-{p.station}
                {p.modifierGroupIds.length ? ' · OPTIONS' : ''}
              </span>
            </span>
            {n > 0 && (
              <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-extrabold text-white">
                {n}
              </span>
            )}
            {!p.available && (
              <span className="absolute right-2 top-2 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-extrabold text-white">SOLD OUT</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
