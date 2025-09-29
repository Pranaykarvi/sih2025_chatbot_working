import Header from "@/components/header"
import WorkspaceTabs from "@/components/workspace-tabs"

export default function Page() {
  return (
    <main className="min-h-dvh flex flex-col">
      <Header />
      <section className="container mx-auto max-w-5xl px-4 py-6 flex-1">
        <WorkspaceTabs />
      </section>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ArogyaLink
      </footer>
    </main>
  )
}
