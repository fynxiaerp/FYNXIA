// src/app/(dashboard)/clinica/financeiro/centros-de-custo/loading.tsx
// UI-SPEC §"Loading States": PageHeader skeleton + 4 table row skeletons.
// Skeleton: name col 40%, unit col 30%, badge col 15%, actions col 15%.

export default function CentrosDeCustoLoading() {
  return (
    <div aria-label="Carregando…" aria-busy="true">
      {/* PageHeader skeleton */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="animate-pulse bg-muted rounded-md h-3 w-32" />
          <div className="animate-pulse bg-muted rounded-md h-5 w-44" />
        </div>
        <div className="animate-pulse bg-muted rounded-md h-8 w-36" />
      </div>

      <main className="p-6 max-w-5xl mx-auto w-full">
        <div className="rounded-md border overflow-hidden">
          {/* Table header skeleton */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-12" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-20 ml-auto" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-12" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-14" />
          </div>

          {/* 4 table row skeletons */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
            >
              {/* Nome col (40%) */}
              <div className="flex-[2] space-y-1">
                <div className="animate-pulse bg-muted rounded-md h-4 w-3/4" />
                <div className="animate-pulse bg-muted rounded-md h-3 w-1/2" />
              </div>
              {/* Unidade col (30%) */}
              <div className="flex-[1.5]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-2/3" />
              </div>
              {/* Ativo badge col (15%) */}
              <div className="w-16">
                <div className="animate-pulse bg-muted rounded-md h-5 w-14" />
              </div>
              {/* Ações col (15%) */}
              <div className="w-20 flex items-center gap-2">
                <div className="animate-pulse bg-muted rounded-md h-7 w-14" />
                <div className="animate-pulse bg-muted rounded-full h-5 w-9" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
