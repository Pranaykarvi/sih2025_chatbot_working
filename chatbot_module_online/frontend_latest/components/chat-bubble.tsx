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
          "max-w-[85%] rounded-2xl px-5 py-3 text-base font-medium shadow-2xl transition-all duration-300 break-words border-2 transform-3d hover-lift click-bounce",
          isUser
            ? "bg-gradient-to-r from-purple-600 via-pink-600 via-blue-600 to-cyan-600 text-white border-purple-400/50 hover:shadow-purple-500/50 animate-slide-in-up"
            : "bg-gradient-to-r from-blue-100 via-pink-100 via-purple-100 to-cyan-100 dark:from-blue-900/40 dark:via-pink-900/40 dark:via-purple-900/40 dark:to-cyan-900/40 text-gray-800 dark:text-gray-100 border-blue-300/50 dark:border-blue-700/50 hover:shadow-blue-500/30 animate-slide-in-up"
        )}
      >
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  )
}
