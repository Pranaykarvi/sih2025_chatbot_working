import ThemeToggle from "./theme-toggle"

export default function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Using placeholder image with descriptive alt per guidelines */}
          <img src="/medical-cross-logo.png" alt="ArogyaLink logo (medical cross)" className="h-8 w-8 rounded-md" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-primary">ArogyaLink</span>
            <span className="text-xs text-muted-foreground">Medical AI Assistant</span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
