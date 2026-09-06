import { ArrowUpRight, CheckCircle2, CircleAlert, Sparkles } from 'lucide-react';
import { getAssistantItems, type AssistantItem } from '@/lib/assistant';

const styles: Record<AssistantItem['priority'], { icon: typeof CircleAlert; className: string; label: string }> = {
  urgent: { icon: CircleAlert, className: 'border-red/30 bg-red/10 text-red', label: 'Perlu segera' },
  attention: { icon: CircleAlert, className: 'border-amber/30 bg-amber/10 text-amber', label: 'Perlu perhatian' },
  ready: { icon: CheckCircle2, className: 'border-primary/25 bg-primary/10 text-primary', label: 'Siap dikerjakan' },
};

export default function AssistantPanel({ onNavigate }: { onNavigate: (view: AssistantItem['view']) => void }) {
  const items = getAssistantItems();
  return (
    <section aria-labelledby="assistant-title" className="work-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles aria-hidden="true" className="h-4 w-4" /></span>
          <div>
            <h2 id="assistant-title" className="text-base font-extrabold">Asisten hari ini</h2>
            <p className="text-sm text-text2">Prioritas dari jadwal dan progresmu</p>
          </div>
        </div>
        <span className="text-sm font-bold tabular-nums text-text3">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.length ? items.map(item => {
          const state = styles[item.priority];
          const Icon = state.icon;
          return <div key={item.id} className="flex gap-3 py-3">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${state.className}`}><Icon aria-hidden="true" className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-5">{item.title}</p>
              <p className="mt-0.5 text-sm leading-5 text-text2">{item.reason}</p>
              <button onClick={() => onNavigate(item.view)} className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-bold text-primary hover:underline">
                {item.action}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>;
        }) : <div className="py-5 text-sm text-text2">Tidak ada hal mendesak. Agenda dan progres sedang terkendali.</div>}
      </div>
    </section>
  );
}
