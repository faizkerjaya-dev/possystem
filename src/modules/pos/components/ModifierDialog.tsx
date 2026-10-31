import { useMemo, useState } from 'react';
import type { ChosenModifier, ModifierGroup, Product } from '@/types/models';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/controls';
import { fmtRM } from '@/lib/money';

const NOTE_PRESETS = ['Sauce on side', 'No onion', 'Less salt', 'Less spicy', 'Allergy: nuts'];

/**
 * Item options picker (doneness, sauce, side, add-ons…). Required groups must be answered before
 * "Add" is enabled. Used by the POS tablet and the handheld (shows as a bottom sheet on phones).
 */
export function ModifierDialog({
  product,
  groups,
  onClose,
  onAdd,
}: {
  product: Product;
  groups: ModifierGroup[];
  onClose: () => void;
  onAdd: (mods: ChosenModifier[], note: string, qty: number) => void;
}) {
  const visible = useMemo(
    () => groups.map((g) => ({ ...g, options: g.options.filter((o) => o.available) })).filter((g) => g.options.length),
    [groups],
  );
  // Start with each group's default option(s) selected
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(visible.map((g) => [g.id, g.options.filter((o) => o.isDefault).map((o) => o.id).slice(0, g.maxChoices)])),
  );
  const [notes, setNotes] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState('');
  const [qty, setQty] = useState(1);

  const toggle = (g: ModifierGroup, optionId: string) =>
    setPicked((cur) => {
      const now = cur[g.id] ?? [];
      if (now.includes(optionId)) return { ...cur, [g.id]: now.filter((x) => x !== optionId) };
      if (g.maxChoices === 1) return { ...cur, [g.id]: [optionId] };
      if (now.length >= g.maxChoices) return cur;
      return { ...cur, [g.id]: [...now, optionId] };
    });

  const missing = visible.find((g) => g.required && !(picked[g.id]?.length));
  const chosen: ChosenModifier[] = visible.flatMap((g) =>
    g.options.filter((o) => picked[g.id]?.includes(o.id)).map((o) => ({ group: g.name, option: o.name, priceCents: o.priceCents })),
  );
  const unit = product.priceCents + chosen.reduce((s, m) => s + m.priceCents, 0);
  const note = [...notes, freeNote.trim()].filter(Boolean).join(', ');

  return (
    <Modal
      title={product.name}
      subtitle={`${fmtRM(product.priceCents)} · Station ${product.station}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3">
          <Stepper label="quantity" value={qty} min={1} onChange={setQty} size="lg" />
          <Button
            variant="primary"
            size="xl"
            className="flex-1"
            disabled={!!missing}
            onClick={() => onAdd(chosen, note, qty)}
          >
            {missing ? `Choose ${missing.name.toLowerCase()}` : `Add · ${fmtRM(unit * qty)}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {visible.map((g) => (
          <div key={g.id} role="group" aria-label={g.name} className="flex flex-col gap-2">
            <span className={`text-xs font-extrabold tracking-wide ${g.required && !picked[g.id]?.length ? 'text-accent' : 'text-soft'}`}>
              {g.name.toUpperCase()} · {g.required ? 'REQUIRED' : 'OPTIONAL'}
              {g.maxChoices > 1 ? ` · UP TO ${g.maxChoices}` : ''}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {g.options.map((o) => {
                const on = picked[g.id]?.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(g, o.id)}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-2 text-sm font-bold ${
                      on ? 'bg-ink text-white' : 'border border-line bg-white'
                    }`}
                  >
                    {o.name}
                    {o.priceCents > 0 && <span className="text-xs font-semibold opacity-80">+{fmtRM(o.priceCents)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-wide text-soft">NOTE TO KITCHEN</span>
          <div className="flex flex-wrap gap-2">
            {NOTE_PRESETS.map((n) => {
              const on = notes.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setNotes((cur) => (on ? cur.filter((x) => x !== n) : [...cur, n]))}
                  className={`h-11 rounded-full px-4 text-[13px] font-semibold ${on ? 'border-2 border-warn bg-warnbg' : 'border border-line'}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <input
            value={freeNote}
            onChange={(e) => setFreeNote(e.target.value)}
            placeholder="Type a special request…"
            aria-label="Special request"
            className="h-12 rounded-xl border border-[#D6D1C7] px-3 text-[15px]"
          />
        </div>
      </div>
    </Modal>
  );
}
