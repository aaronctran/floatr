import { ChevronDown } from 'lucide-react';
import type { Deal } from '../../types';
import DealCard from './DealCard';

export default function SkinDealGroup({ name, deals, onDismiss }: { name: string; deals: Deal[]; onDismiss: (target: { id?: string }) => Promise<void> }) {
  if (!deals.length) return null;
  return (
    <details className="group rounded-xl border border-ui-border/[0.06] bg-bg-secondary">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 rounded-xl hover:bg-ui-overlay/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue [&::-webkit-details-marker]:hidden">
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-text-primary">{name}</span>
          <span className="block text-[11px] text-text-muted mt-1">
            {deals.length} listing{deals.length === 1 ? '' : 's'} · Top deal {deals[0].priceDisplay}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2.5 border-t border-ui-border/[0.06] p-2.5">
        {deals.map((deal) => <DealCard key={deal.id} deal={deal} onDismiss={onDismiss} />)}
      </div>
    </details>
  );
}
