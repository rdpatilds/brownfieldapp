"use client";

import type { DocumentSummary } from "@chatapp/shared";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

export function DocumentList() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await apiFetch("/api/documents");
      if (response.ok) {
        const data = (await response.json()) as { documents: DocumentSummary[] };
        setDocuments(data.documents);
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();

    const handleUploaded = () => {
      void fetchDocuments();
    };
    window.addEventListener("document-uploaded", handleUploaded);
    return () => {
      window.removeEventListener("document-uploaded", handleUploaded);
    };
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    try {
      const response = await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        toast.success("Document deleted");
      } else {
        toast.error("Failed to delete document");
      }
    } catch {
      toast.error("Failed to delete document");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No documents yet. Upload a file to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-[1fr_100px_100px_48px] gap-4 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
        <div>Title</div>
        <div className="text-right">Chunks</div>
        <div className="text-right">Tokens</div>
        <div />
      </div>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="grid grid-cols-[1fr_100px_100px_48px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{doc.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {new Date(doc.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right text-sm">{doc.chunk_count}</div>
          <div className="text-right text-sm">{doc.total_tokens.toLocaleString()}</div>
          <div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &ldquo;{doc.title}&rdquo; and all its chunks. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDelete(doc.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}
