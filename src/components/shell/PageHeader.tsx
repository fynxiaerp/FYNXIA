// PageHeader — Server Component (no 'use client').
// Used on every authenticated page: title + optional breadcrumbs + optional actions slot.
// mobileMenuTrigger slot (md:hidden) lets a 'use client' hamburger live inside a Server Component header.
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export interface PageHeaderProps {
  /** Page title rendered as <h1> with Space Grotesk / font-display */
  title: string
  /** Breadcrumb segments. Last item renders as non-link page indicator. */
  breadcrumbs?: { label: string; href?: string }[]
  /** Right-aligned action buttons / controls */
  actions?: React.ReactNode
  /** Mobile hamburger slot — rendered at md:hidden on the left edge */
  mobileMenuTrigger?: React.ReactNode
}

export function PageHeader({ title, breadcrumbs, actions, mobileMenuTrigger }: PageHeaderProps) {
  return (
    <header className="h-16 px-6 border-b border-border bg-background flex items-center justify-between shrink-0">
      {/* Left column: mobile trigger + breadcrumb + title */}
      <div className="flex flex-col justify-center gap-0.5 min-w-0">
        {/* Mobile hamburger — only visible below md breakpoint */}
        {mobileMenuTrigger && (
          <div className="md:hidden mb-1">{mobileMenuTrigger}</div>
        )}

        {/* Breadcrumb */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <BreadcrumbItem key={index}>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : crumb.href ? (
                      <BreadcrumbLink render={<Link href={crumb.href} />}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <span className="text-muted-foreground">{crumb.label}</span>
                    )}
                    {!isLast && <BreadcrumbSeparator />}
                  </BreadcrumbItem>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Page title */}
        <h1 className="text-xl font-semibold font-display leading-tight truncate">
          {title}
        </h1>
      </div>

      {/* Right column: actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {actions}
        </div>
      )}
    </header>
  )
}
