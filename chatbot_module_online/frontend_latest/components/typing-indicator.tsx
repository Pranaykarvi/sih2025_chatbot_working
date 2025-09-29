"use client"
import { cn } from "@/lib/utils"

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1",
        "animate-[in-up_240ms_ease-out]",
        className,
      )}
      aria-label="Assistant is typing"
    >
      <span className="sr-only">Assistant is typing</span>
      <Dot delay="0ms" />
      <Dot delay="120ms" />
      <Dot delay="240ms" />
    </div>
  )
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 rounded-full bg-foreground/60 inline-block animate-[dot_1s_ease-in-out_infinite]"
      style={{ animationDelay: delay }}
    />
  )
}
