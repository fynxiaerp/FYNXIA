// src/app/(dashboard)/clinica/financeiro/contas-correntes/loading.tsx
// UI-SPEC §"Loading States": PageHeader skeleton + 3 table row skeletons.
// Skeleton: name col 30%, bank col 25%, account col 25%, balance col 20%.

export default function ContasCorrentesLoading() {
  return (
    <div aria-label="Carregando…" aria-busy="true">
      {/* PageHeader skeleton */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="animate-pulse bg-muted rounded-md h-3 w-32" />
          <div className="animate-pulse bg-muted rounded-md h-5 w-40" />
        </div>
        <div className="animate-pulse bg-muted rounded-md h-8 w-40" />
      </div>

      <main className="p-6 max-w-5xl mx-auto w-full">
        <div className="rounded-md border overflow-hidden">
          {/* Table header skeleton */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-24" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-16" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-24" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-20 ml-auto" />
          </div>

          {/* 3 table row skeletons */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
            >
              {/* Nome col (30%) */}
              <div className="flex-[1.5]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-3/4" />
              </div>
              {/* Banco col (25%) */}
              <div className="flex-[1.25]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-2/3" />
              </div>
              {/* Agência/Conta col (25%) */}
              <div className="flex-[1.25]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-3/4 font-mono" />
              </div>
              {/* Saldo col (20%) — right-aligned */}
              <div className="w-28 flex justify-end">
                <div className="animate-pulse bg-muted rounded-md h-4 w-20" />
              </div>
              {/* Ações */}
              <div className="w-16">
                <div className="animate-pulse bg-muted rounded-md h-7 w-14" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
