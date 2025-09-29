"use client"

import { useEffect, useState } from "react"
import UploadPanel from "@/components/upload-panel"
import ChatPanel from "@/components/chat-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Shared animated background SVG
const AnimatedBg = () => (
  <svg className="absolute inset-0 w-full h-full -z-10 animate-gradient-move" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
      </radialGradient>
      <radialGradient id="g2" cx="80%" cy="20%" r="60%">
        <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#f87171" stopOpacity="0.05" />
      </radialGradient>
    </defs>
    <circle cx="400" cy="300" r="350" fill="url(#g1)" />
    <circle cx="650" cy="100" r="200" fill="url(#g2)" />
  </svg>
)

export default function WorkspaceTabs() {
  const [value, setValue] = useState<"upload" | "chat">("upload")
  const [opened, setOpened] = useState<{ upload: boolean; chat: boolean }>({
    upload: true,
    chat: false,
  })

  useEffect(() => {
    setOpened((prev) => ({ ...prev, [value]: true }))
  }, [value])

  return (
    <div className="relative min-h-[70vh] flex flex-col items-center justify-center">
      <AnimatedBg />
      <Tabs value={value} onValueChange={(v) => setValue(v as "upload" | "chat")} className="w-full max-w-3xl z-10">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="text-pretty text-2xl font-semibold text-primary transition-colors">
            ArogyaLink Patient Workspace
          </h1>
          <TabsList className="transition-colors">
            <TabsTrigger
              value="upload"
              className="transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Upload
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="transition-all duration-300 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              Chat Assistant
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="upload"
          className="data-[state=inactive]:hidden data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-top-2"
        >
          {opened.upload ? <UploadPanel /> : null}
        </TabsContent>

        <TabsContent
          value="chat"
          className="data-[state=inactive]:hidden data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2"
        >
          {opened.chat ? <ChatPanel /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
