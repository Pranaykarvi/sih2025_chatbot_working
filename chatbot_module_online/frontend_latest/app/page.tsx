import Header from "@/components/header"
import WorkspaceTabs from "@/components/workspace-tabs"

export default function Page() {
  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-br from-purple-50 via-pink-50 via-blue-50 to-cyan-50 dark:from-gray-950 dark:via-purple-950 dark:via-pink-950 dark:to-blue-950">
      <Header />
      <section className="container mx-auto max-w-7xl px-4 py-8 flex-1">
        <WorkspaceTabs />
      </section>
      <footer className="border-t-2 border-purple-200/50 dark:border-purple-800/50 py-6 text-center">
        <p className="text-sm font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
          © {new Date().getFullYear()} ArogyaLink - Powered by AI ✨
        </p>
      </footer>
    </main>
  )
}
