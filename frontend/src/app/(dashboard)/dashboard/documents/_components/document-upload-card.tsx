"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDocumentUpload } from "@/hooks/use-document-upload";

export function DocumentUploadCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { isUploading, progress, status, error, upload, reset } = useDocumentUpload({
    onComplete: () => {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      window.dispatchEvent(new CustomEvent("document-uploaded"));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset();
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      void upload(selectedFile);
    }
  };

  const handleTryAgain = () => {
    reset();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
        <CardDescription>Upload .md or .txt files to add to the knowledge base</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            onChange={handleFileChange}
            disabled={isUploading}
            className="text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          {selectedFile && !isUploading && !error && (
            <Button onClick={handleUpload}>
              <Upload className="mr-2 size-4" />
              Upload
            </Button>
          )}
        </div>

        {selectedFile && !isUploading && !error && (
          <p className="text-sm text-muted-foreground">
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}

        {isUploading && (
          <div className="space-y-2">
            {progress && <Progress value={progressPercent} className="h-2" />}
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={handleTryAgain}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
