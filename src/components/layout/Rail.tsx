import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  ChefHat,
  LayoutGrid,
  ListPlus,
  Printer,
  Receipt,
  Settings as SettingsIcon,
  SlidersHorizontal,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { can, type Permission } from '@/config/permissions';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

interface RailItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
  end?: boolean;
}

/** Left icon rail. Items the signed-in role cannot use are hidden. Add new pages here. */
export const POS_RAIL: RailItem[] = [
  { to: '/pos', label: 'Floor', icon: LayoutGrid, perm: 'takeOrders', end: true },
  { to: '/pos/checks', label: 'Checks', icon: Receipt, perm: 'takeOrders' },
  { to: '/kds', label: 'Kitchen', icon: ChefHat, perm: 'kitchen' },
  { to: '/admin/printer', label: 'Printer', icon: Printer, perm: 'takePayment' },
  { to: '/admin', label: 'Office', icon: BarChart3, perm: 'reports', end: true },
];

export const ADMIN_RAIL: RailItem[] = [
  { to: '/pos', label: 'POS', icon: UtensilsCrossed, perm: 'takeOrders', end: true },
  { to: '/admin', label: 'Overview', icon: BarChart3, perm: 'reports', end: true },
  { to: '/admin/menu', label: 'Menu', icon: ListPlus, perm: 'editMenu' },
  { to: '/admin/modifiers', label: 'Add-ons', icon: SlidersHorizontal, perm: 'editMenu' },
  { to: '/admin/printer', label: 'Printer', icon: Printer, perm: 'takePayment' },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon, perm: 'settings' },
];

export function Rail({ items }: { items: RailItem[] }) {
  const { staff } = useAuth();
  const { settings } = useSettings();
  const mono =
    settings.business.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'POS';

  return (
    <nav aria-label="Main" className="flex w-20 shrink-0 flex-col items-center gap-1 bg-rail py-3">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-extrabold text-white">{mono}</div>
      {items
        .filter((i) => !i.perm || can(staff?.role, i.perm))
        .map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) =>
              `flex h-[62px] w-[68px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${
                isActive ? 'bg-[#2F3135] text-white [&_svg]:text-[#E39A74]' : 'text-[#B5B1A8] [&_svg]:text-[#9C988F]'
              }`
            }
          >
            <i.icon size={22} strokeWidth={1.9} aria-hidden />
            {i.label}
          </NavLink>
        ))}
    </nav>
  );
}
