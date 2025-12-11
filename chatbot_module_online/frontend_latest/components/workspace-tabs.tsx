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
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center perspective-3d">
      <AnimatedBg />
      <Tabs value={value} onValueChange={(v) => setValue(v as "upload" | "chat")} className="w-full max-w-6xl z-10">
        <div className="flex items-center justify-between gap-4 mb-6 animate-slide-in-up">
          <h1 className="text-pretty text-4xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent animate-gradient-shift">
            🏥 ArogyaLink Patient Workspace
          </h1>
          <TabsList className="transition-all duration-300 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-2 border-purple-300/50 dark:border-purple-700/50 rounded-xl p-1 shadow-xl">
            <TabsTrigger
              value="upload"
              className="transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:via-pink-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg px-6 py-2 font-bold hover:scale-105 click-bounce data-[state=active]:shadow-lg"
            >
              📁 Upload
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-cyan-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg px-6 py-2 font-bold hover:scale-105 click-bounce data-[state=active]:shadow-lg"
            >
              💬 Chat Assistant
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
