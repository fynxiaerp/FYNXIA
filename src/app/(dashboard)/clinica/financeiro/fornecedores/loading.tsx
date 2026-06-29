// src/app/(dashboard)/clinica/financeiro/fornecedores/loading.tsx
// UI-SPEC §"Loading States": PageHeader skeleton + 4 table row skeletons.
// Pattern mirrors centros-de-custo/loading.tsx.

export default function FornecedoresLoading() {
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
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-20" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-14" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-20 ml-auto" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-14" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-12" />
            <div className="animate-pulse bg-muted rounded-md h-3.5 w-16" />
          </div>

          {/* 4 table row skeletons */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
            >
              {/* Nome col */}
              <div className="flex-[2]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-3/4" />
              </div>
              {/* Tipo col */}
              <div className="flex-[1.5]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-2/3" />
              </div>
              {/* CNPJ col */}
              <div className="flex-[1.5]">
                <div className="animate-pulse bg-muted rounded-md h-4 w-1/2" />
              </div>
              {/* Vínculo col */}
              <div className="flex-1">
                <div className="animate-pulse bg-muted rounded-md h-4 w-1/2" />
              </div>
              {/* Status badge col */}
              <div className="w-16">
                <div className="animate-pulse bg-muted rounded-md h-5 w-14" />
              </div>
              {/* Ações col */}
              <div className="w-32 flex items-center gap-2">
                <div className="animate-pulse bg-muted rounded-md h-7 w-14" />
                <div className="animate-pulse bg-muted rounded-md h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
