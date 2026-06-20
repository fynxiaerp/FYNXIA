// src/app/(dashboard)/clinica/financeiro/categorias/loading.tsx
// UI-SPEC §"Loading States": PageHeader skeleton + 5 table row skeletons.

export default function CategoriasLoading() {
  return (
    <div aria-label="Carregando…" aria-busy="true">
      {/* PageHeader skeleton */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="animate-pulse bg-muted rounded-md h-3 w-32" />
          <div className="animate-pulse bg-muted rounded-md h-5 w-56" />
        </div>
      </div>

      <main className="p-6 max-w-5xl mx-auto w-full">
        {/* Alert skeleton */}
        <div className="animate-pulse bg-muted rounded-md h-10 w-full mb-4" />

        <div className="rounded-md border">
          {/* Table header skeleton */}
          <div className="flex items-center gap-4 px-4 h-10 border-b border-border">
            <div className="animate-pulse bg-muted rounded-md h-4 w-[35%]" />
            <div className="animate-pulse bg-muted rounded-md h-4 w-[15%]" />
            <div className="animate-pulse bg-muted rounded-md h-4 w-[35%]" />
            <div className="animate-pulse bg-muted rounded-md h-4 w-[15%]" />
          </div>

          {/* 5 table row skeletons */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 h-12 border-b border-border last:border-b-0">
              <div className="animate-pulse bg-muted rounded-md h-4 w-[35%]" />
              <div className="animate-pulse bg-muted rounded-md h-5 w-[12%]" />
              <div className="animate-pulse bg-muted rounded-md h-8 w-[35%]" />
              <div className="animate-pulse bg-muted rounded-md h-5 w-[13%]" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
