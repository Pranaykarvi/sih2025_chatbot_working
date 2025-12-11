import ThemeToggle from "./theme-toggle"

export default function Header() {
  return (
    <header className="border-b-2 border-purple-200/50 dark:border-purple-800/50 bg-gradient-to-r from-purple-500/10 via-pink-500/10 via-blue-500/10 to-cyan-500/10 backdrop-blur-md shadow-lg">
      <div className="container mx-auto max-w-7xl px-4 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 animate-slide-in-up hover-lift">
          {/* Using placeholder image with descriptive alt per guidelines */}
          <div className="relative">
            <img 
              src="/medical-cross-logo.png" 
              alt="ArogyaLink logo (medical cross)" 
              className="h-12 w-12 rounded-xl shadow-lg border-2 border-purple-300/50 dark:border-purple-700/50 animate-float hover:scale-110 transition-transform duration-300" 
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 animate-pulse"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent animate-gradient-shift">
              ArogyaLink
            </span>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              🏥 Medical AI Assistant
            </span>
          </div>
        </div>
        <div className="animate-slide-in-up">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
