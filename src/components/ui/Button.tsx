import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'dark' | 'outline' | 'danger' | 'success' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white',
  dark: 'bg-ink text-white',
  outline: 'border border-line bg-white text-ink',
  danger: 'border border-[#E2B4B4] bg-white text-danger',
  success: 'bg-ok text-white',
  ghost: 'bg-transparent text-ink',
};
const SIZE: Record<Size, string> = {
  sm: 'h-10 px-3 text-sm rounded-lg',
  md: 'h-12 px-4 text-[15px] rounded-xl',
  lg: 'h-14 px-5 text-base rounded-xl',
  xl: 'h-16 px-6 text-lg rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  full?: boolean;
}

/** All buttons are ≥ 40px tall for touch. Disabled buttons go grey so staff see they can't tap. */
export function Button({ variant = 'outline', size = 'md', icon, full, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex select-none items-center justify-center gap-2 font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#D6D1C7] disabled:text-white ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
