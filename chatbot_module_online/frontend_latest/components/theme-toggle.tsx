"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("arogya-theme") : null
    if (stored === "dark") {
      document.documentElement.classList.add("dark")
      setIsDark(true)
    }
  }, [])

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add("dark")
        localStorage.setItem("arogya-theme", "dark")
      } else {
        document.documentElement.classList.remove("dark")
        localStorage.setItem("arogya-theme", "light")
      }
      return next
    })
  }

  return (
    <Button
      variant="outline"
      onClick={toggleTheme}
      className="transition-all duration-300 hover:scale-[1.02] bg-transparent"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? "Light Mode" : "Dark Mode"}
    </Button>
  )
}
