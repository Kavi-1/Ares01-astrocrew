import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return <Tooltip.Root><Tooltip.Trigger asChild><button className="info-trigger" aria-label={label}><Info size={16} aria-hidden="true" /></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="info-tooltip" sideOffset={8} collisionPadding={16}>{children}<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}
