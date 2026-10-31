import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Bottom sheet on phones, centred dialog on tablets. Closes with the X button or Escape. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#F1EEE8] px-5 py-4">
          <div className="flex flex-col">
            <span className="text-xl font-extrabold">{title}</span>
            {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-xl border border-line">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-[#F1EEE8] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
