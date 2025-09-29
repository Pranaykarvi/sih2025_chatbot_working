import type React from "react"
import { cn } from "@/lib/utils"

export type BubbleProps = {
  role: "user" | "assistant"
  children: React.ReactNode
}

export default function ChatBubble({ role, children }: BubbleProps) {
  const isUser = role === "user"

  return (
    <div
      role="listitem"
      aria-label={isUser ? "User message" : "Assistant message"}
      className={cn(
        "flex w-full animate-in fade-in-50 slide-in-from-bottom-2",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2 text-base font-medium shadow-md transition-colors break-words border border-border",
          isUser
            ? "bg-gradient-to-r from-pink-400 via-blue-400 to-green-400 text-white"
            : "bg-gradient-to-r from-blue-100 via-pink-100 to-green-100 text-accent-foreground dark:from-accent/30 dark:to-primary/20"
        )}
      >
        {children}
      </div>
    </div>
  )
}
