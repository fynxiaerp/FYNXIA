// EmptyState — shared empty-state primitive.
// Used when a list/table returns zero results.
// Props: icon (LucideIcon), title, description, optional cta.
// Per 06-UI-SPEC lines 485-495: icon is text-muted-foreground (NOT text-primary — accent reserved).
import { type LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  /** Lucide icon component (e.g. Users, CalendarX, Receipt) */
  icon: LucideIcon
  /** Short heading — text-xl font-semibold font-display */
  title: string
  /** Explanatory body copy — text-sm text-muted-foreground */
  description: string
  /** Optional CTA element (e.g. a Button or Link) */
  cta?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <Icon className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <h3 className="text-xl font-semibold font-display">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {cta}
    </div>
  )
}
