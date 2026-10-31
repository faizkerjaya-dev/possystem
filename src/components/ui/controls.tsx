import type { InputHTMLAttributes, ReactNode } from 'react';

/** Small form controls used across admin and POS screens. */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition disabled:opacity-60 ${checked ? 'justify-end bg-ok' : 'justify-start bg-[#CFCAC0]'}`}
    >
      <span className="h-6 w-6 rounded-full bg-white shadow" />
    </button>
  );
}

export function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#F4F2EE] py-3 last:border-0">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: ReactNode;
}
export function TextField({ label, value, onChange, suffix, className = '', ...rest }: TextFieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold text-soft">{label}</span>
      <span className="flex items-center gap-2">
        <input
          {...rest}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-xl border border-[#D6D1C7] bg-white px-3 text-[15px] font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-black/10"
        />
        {suffix}
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-[#F1EEE8] p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`${size === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-10 px-4 text-sm'} rounded-lg ${
            o.value === value ? 'bg-white font-bold shadow-sm' : 'font-medium text-soft'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, label, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl';
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <button type="button" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={`${box} rounded-xl border border-line bg-cream disabled:opacity-40`}>
        −
      </button>
      <span className="min-w-9 text-center text-xl font-extrabold tabular-nums">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={`${box} rounded-xl border border-line bg-cream disabled:opacity-40`}>
        +
      </button>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-4 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = 'grey' }: { children: ReactNode; tone?: 'grey' | 'ok' | 'warn' | 'danger' | 'accent' | 'blue' | 'dark' }) {
  const tones = {
    grey: 'bg-[#EFEDE8] text-soft',
    ok: 'bg-okbg text-[#1F6440]',
    warn: 'bg-warnbg text-[#6E4A0C]',
    danger: 'bg-dangerbg text-[#8F2A2A]',
    accent: 'bg-[#F8E9E0] text-[#8A4320]',
    blue: 'bg-[#E9ECF3] text-[#34436A]',
    dark: 'bg-ink text-white',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${tones[tone]}`}>{children}</span>;
}

/** Full-area message for loading / empty / error states. */
export function ScreenMessage({ title, detail, tone = 'grey' }: { title: string; detail?: string; tone?: 'grey' | 'error' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
      <span className={`text-base font-bold ${tone === 'error' ? 'text-danger' : 'text-soft'}`}>{title}</span>
      {detail && <span className="max-w-md text-sm text-muted">{detail}</span>}
    </div>
  );
}
