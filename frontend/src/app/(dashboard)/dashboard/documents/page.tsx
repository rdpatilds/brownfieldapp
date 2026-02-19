import { DocumentList } from "./_components/document-list";
import { DocumentUploadCard } from "./_components/document-upload-card";

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Upload and manage your RAG knowledge base documents</p>
      </div>
      <DocumentUploadCard />
      <DocumentList />
    </div>
  );
}
