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
    <div className="w-full h-[70vh] flex flex-col rounded-2xl shadow-2xl bg-gradient-to-br from-white via-blue-100 to-pink-100 dark:from-background dark:via-accent/30 dark:to-primary/20 border border-border overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center gap-2 bg-gradient-to-r from-pink-200/60 via-blue-200/60 to-green-200/60 dark:from-accent/30 dark:to-primary/10">
        <span className="text-2xl font-bold text-primary">Upload Medical Records</span>
        <span className="ml-auto text-xs text-muted-foreground">Attach multiple PDFs under a single patient ID.</span>
      </header>
      <main className="flex-1 flex flex-col gap-0 p-0">
        <form onSubmit={submitUpload} className="flex flex-col gap-4 h-full px-6 py-4">
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="patient_id">Patient ID</Label>
            <Input
              id="patient_id"
              placeholder="e.g., RURAL-12345"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
            />
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="relative rounded-md border border-dashed p-6 text-center hover:border-primary cursor-pointer bg-background/60"
          >
            <p className="mb-3">Drag and drop PDF files here or click to select</p>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {totalPending > 0 ? `${totalPending} PDF file(s) ready to upload` : "No files selected"}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              className="bg-gradient-to-r from-pink-500 via-blue-500 to-green-500 text-white font-bold shadow-lg hover:scale-105 focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 px-8 py-2 transition-all duration-300"
              size="lg"
              disabled={!patientId || pendingFiles.length === 0 || uploading}
            >
              {uploading ? "Uploading…" : "Upload Medical Records"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingFiles([])}
              disabled={pendingFiles.length === 0 || uploading}
            >
              Clear
            </Button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto">
            {patientId && (uploaded[patientId]?.length ?? 0) > 0 ? (
              <ul className="space-y-2">
                {uploaded[patientId]!.map((f) => (
                  <li
                    key={`${f.name}-${f.lastModified}`}
                    className="rounded-md border p-3 animate-in fade-in-50 slide-in-from-left-2 bg-gradient-to-r from-blue-50 via-pink-50 to-green-50"
                  >
                    <div className="flex items-center justify-between">
                      <span>{f.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Uploaded files will appear here after submission.
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
