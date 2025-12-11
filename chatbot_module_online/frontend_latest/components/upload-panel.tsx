"use client";

import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Uploaded = {
  name: string;
  size: number;
  lastModified: number;
  url?: string;
};

export default function UploadPanel() {
  const [patientId, setPatientId] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<Record<string, Uploaded[]>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const pdfFiles = Array.from(files).filter((f) => f.type === "application/pdf");
    setPendingFiles((prev) => [...prev, ...pdfFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const totalPending = useMemo(() => pendingFiles.length, [pendingFiles]);

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || pendingFiles.length === 0) return;

    setUploading(true);
    const uploadedFiles: Uploaded[] = [];
    const errors: string[] = [];

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        
        try {
          const formData = new FormData();
          formData.append("patientId", patientId);
          formData.append("file", file);

          // Use Next.js API route which proxies to backend
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ 
              error: "Unknown error", 
              message: `Upload failed for ${file.name}` 
            }));
            const errorMsg = errorData.message || errorData.error || `Upload failed for ${file.name}`;
            errors.push(`${file.name}: ${errorMsg}`);
            continue;
          }

          const data = await res.json();
          uploadedFiles.push({
            name: data.name || file.name,
            size: data.size || file.size,
            lastModified: data.lastModified || file.lastModified,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : `Upload failed for ${file.name}`;
          errors.push(`${file.name}: ${errorMsg}`);
          console.error(`Error uploading ${file.name}:`, err);
        }
      }

      // Update uploaded files state
      if (uploadedFiles.length > 0) {
        setUploaded((prev) => {
          const existing = prev[patientId] ?? [];
          return { ...prev, [patientId]: [...existing, ...uploadedFiles] };
        });
      }

      // Show results
      if (errors.length === 0 && uploadedFiles.length > 0) {
        alert(`Successfully uploaded ${uploadedFiles.length} file(s)!`);
        setPendingFiles([]);
      } else if (errors.length > 0 && uploadedFiles.length === 0) {
        alert(`All uploads failed:\n${errors.join('\n')}`);
      } else if (errors.length > 0) {
        alert(`${uploadedFiles.length} file(s) uploaded successfully.\n${errors.length} file(s) failed:\n${errors.join('\n')}`);
        setPendingFiles([]);
      }
    } catch (err) {
      console.error("Upload process error:", err);
      alert(err instanceof Error ? err.message : "Upload failed. See console for details.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full h-[85vh] flex flex-col rounded-3xl shadow-2xl bg-gradient-to-br from-purple-50 via-pink-50 via-blue-50 to-cyan-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:via-blue-950/20 dark:to-cyan-950/20 border-2 border-purple-200/50 dark:border-purple-800/50 overflow-hidden perspective-3d animate-pulse-glow">
      {/* Animated 3D background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-float-reverse"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-rotate-3d"></div>
      </div>
      
      <header className="relative px-6 py-5 border-b-2 border-purple-200/50 dark:border-purple-800/50 flex items-center gap-2 bg-gradient-to-r from-purple-500/80 via-pink-500/80 via-blue-500/80 to-cyan-500/80 dark:from-purple-600/60 dark:via-pink-600/60 dark:via-blue-600/60 dark:to-cyan-600/60 backdrop-blur-sm shadow-lg">
        <span className="text-3xl font-extrabold bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent animate-gradient-shift">
          📁 Upload Medical Records
        </span>
        <span className="ml-auto text-xs font-semibold text-white/90 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          Attach multiple PDFs under a single patient ID.
        </span>
      </header>
      <main className="relative flex-1 flex flex-col gap-0 p-0">
        <form onSubmit={submitUpload} className="flex flex-col gap-5 h-full px-6 py-5">
          <div className="grid gap-2 max-w-md animate-slide-in-up">
            <Label htmlFor="patient_id" className="text-base font-bold text-purple-700 dark:text-purple-300">
              Patient ID
            </Label>
            <Input
              id="patient_id"
              placeholder="e.g., RURAL-12345"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              className="bg-white/90 dark:bg-gray-900/90 border-2 border-purple-300/50 dark:border-purple-700/50 rounded-xl px-4 py-3 font-medium shadow-lg hover:shadow-xl hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 focus:ring-2 focus:ring-purple-500 focus:scale-105 click-bounce"
            />
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="relative rounded-2xl border-3 border-dashed border-purple-400/50 dark:border-purple-600/50 p-8 text-center hover:border-purple-600 dark:hover:border-purple-400 cursor-pointer bg-gradient-to-br from-white/80 via-purple-50/80 to-pink-50/80 dark:from-gray-900/80 dark:via-purple-950/80 dark:to-pink-950/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover-lift click-bounce animate-slide-in-up"
          >
            <div className="text-6xl mb-4 animate-bounce">📄</div>
            <p className="text-lg font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Drag and drop PDF files here or click to select
            </p>
            <p className="text-sm text-muted-foreground">Multiple files supported</p>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          <div className="text-sm font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent animate-slide-in-up">
            {totalPending > 0 ? (
              <span className="flex items-center gap-2">
                <span className="text-2xl animate-bounce">✨</span>
                {totalPending} PDF file(s) ready to upload
              </span>
            ) : (
              "No files selected"
            )}
          </div>

          <div className="flex items-center gap-3 animate-slide-in-up">
            <Button
              type="submit"
              className="bg-gradient-to-r from-purple-600 via-pink-600 via-blue-600 to-cyan-600 hover:from-purple-700 hover:via-pink-700 hover:via-blue-700 hover:to-cyan-700 text-white font-bold shadow-2xl hover:shadow-purple-500/50 hover:scale-110 focus:ring-4 focus:ring-purple-400 focus:ring-offset-2 px-8 py-3 rounded-xl transition-all duration-300 transform hover:-translate-y-1 click-bounce animate-gradient-shift"
              size="lg"
              disabled={!patientId || pendingFiles.length === 0 || uploading}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⚡</span>
                  Uploading…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>🚀</span>
                  Upload Medical Records
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingFiles([])}
              disabled={pendingFiles.length === 0 || uploading}
              className="border-2 border-purple-300/50 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 click-bounce rounded-xl"
            >
              Clear
            </Button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto scroll-smooth">
            {patientId && (uploaded[patientId]?.length ?? 0) > 0 ? (
              <ul className="space-y-3">
                {uploaded[patientId]!.map((f, index) => (
                  <li
                    key={`${f.name}-${f.lastModified}`}
                    className="rounded-xl border-2 border-purple-300/50 dark:border-purple-700/50 p-4 bg-gradient-to-r from-blue-100/80 via-pink-100/80 via-purple-100/80 to-cyan-100/80 dark:from-blue-900/40 dark:via-pink-900/40 dark:via-purple-900/40 dark:to-cyan-900/40 backdrop-blur-sm shadow-lg hover:shadow-xl hover-lift click-bounce scroll-reveal transform-3d"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span className="text-xl">📎</span>
                        {f.name}
                      </span>
                      <span className="text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                  Uploaded files will appear here after submission ✨
                </p>
              </div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
