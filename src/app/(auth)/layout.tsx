// Auth layout — outside the app shell.
// Centers content vertically + horizontally.
// Light theme: bg-background. Dark theme: subtle cyan radial blob manifests via before: pseudo.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center px-4 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,hsl(185_100%_50%/0.08)_0%,transparent_70%)] before:opacity-0 dark:before:opacity-100">
      {children}
    </div>
  )
}
