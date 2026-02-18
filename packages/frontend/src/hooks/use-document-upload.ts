"use client";

import type { UploadProgressEvent } from "@chatapp/shared";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "@chatapp/shared";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";

interface UploadProgress {
  current: number;
  total: number;
}

interface UseDocumentUploadOptions {
  onComplete?: () => void;
}

export function useDocumentUpload(options: UseDocumentUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(null);
    setStatus("");
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
        toast.error("Only .md and .txt files are supported");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File must be under 2MB");
        return;
      }

      setIsUploading(true);
      setProgress(null);
      setStatus("Uploading...");
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await apiFetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response stream");
        }

        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue;
            }
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as UploadProgressEvent;

              switch (event.type) {
                case "status": {
                  setStatus(event.message);
                  break;
                }
                case "progress": {
                  setProgress({ current: event.current, total: event.total });
                  setStatus(event.message);
                  break;
                }
                case "complete": {
                  setProgress(null);
                  setStatus("");
                  setIsUploading(false);
                  toast.success(`Uploaded "${event.title}" (${event.chunksCreated} chunks)`);
                  options.onComplete?.();
                  return;
                }
                case "error": {
                  setError(event.message);
                  setIsUploading(false);
                  toast.error(event.message);
                  return;
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        toast.error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [options],
  );

  return { isUploading, progress, status, error, upload, reset };
}
