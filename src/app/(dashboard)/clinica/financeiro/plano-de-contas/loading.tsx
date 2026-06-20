// src/app/(dashboard)/clinica/financeiro/plano-de-contas/loading.tsx
// UI-SPEC §"Loading States": PageHeader skeleton + 3 group skeletons with child rows.

export default function PlanoDeContasLoading() {
  return (
    <div aria-label="Carregando…" aria-busy="true">
      {/* PageHeader skeleton */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="animate-pulse bg-muted rounded-md h-3 w-32" />
          <div className="animate-pulse bg-muted rounded-md h-5 w-44" />
        </div>
        <div className="animate-pulse bg-muted rounded-md h-8 w-24" />
      </div>

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <div className="rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden">
          {/* Card header skeleton */}
          <div className="px-4 pt-4 pb-2 space-y-1.5">
            <div className="animate-pulse bg-muted rounded-md h-5 w-40" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-72" />
          </div>

          {/* Tree skeleton: 3 groups with 2 children each */}
          <div className="px-4 pb-4 space-y-1">
            {[0, 1, 2].map((g) => (
              <div key={g}>
                {/* Group row */}
                <div className="flex h-10 items-center gap-3">
                  <div className="animate-pulse bg-muted rounded-md h-4 w-4 shrink-0" />
                  <div className="animate-pulse bg-muted rounded-md h-4 w-16 shrink-0" />
                  <div className="animate-pulse bg-muted rounded-md h-4 flex-1 max-w-48" />
                  <div className="animate-pulse bg-muted rounded-md h-5 w-14 shrink-0" />
                </div>
                {/* 2 child rows — indented */}
                {[0, 1].map((c) => (
                  <div key={c} className="flex h-10 items-center gap-3 pl-6">
                    <div className="animate-pulse bg-muted rounded-md h-4 w-20 shrink-0" />
                    <div className="animate-pulse bg-muted rounded-md h-4 flex-1 max-w-56" />
                    <div className="animate-pulse bg-muted rounded-md h-5 w-14 shrink-0" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
