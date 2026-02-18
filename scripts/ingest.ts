/**
 * Document Ingestion Script
 *
 * Ingests .md/.txt files into the documents/chunks tables for RAG.
 * Uses the shared documents feature for chunking, title extraction, and DB operations.
 *
 * Usage:
 *   bun run ingest -- --dir documents/
 *   bun run ingest -- --file path/to/doc.md
 *   bun run ingest -- --dir documents/ --clean
 *   bun run ingest -- --dir documents/ --chunk-size 1000 --chunk-overlap 200
 */

import { readdir, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/core/database/client";
import { chunkText, extractTitle } from "@/features/documents";
import * as documentRepository from "@/features/documents/repository";
import { EMBEDDING_MODEL } from "@/features/rag/constants";
import { generateEmbedding } from "@/features/rag/service";

// --- CLI Argument Parsing ---

interface CliArgs {
  dir?: string | undefined;
  file?: string | undefined;
  clean: boolean;
  chunkSize: number;
  chunkOverlap: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    clean: false,
    chunkSize: 1000,
    chunkOverlap: 200,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--dir":
        parsed.dir = args[++i];
        break;
      case "--file":
        parsed.file = args[++i];
        break;
      case "--clean":
        parsed.clean = true;
        break;
      case "--chunk-size":
        parsed.chunkSize = Number.parseInt(args[++i] ?? "1000", 10);
        break;
      case "--chunk-overlap":
        parsed.chunkOverlap = Number.parseInt(args[++i] ?? "200", 10);
        break;
      default:
        if (arg !== "--") {
          console.error(`Unknown argument: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!parsed.dir && !parsed.file) {
    console.error("Error: Provide --dir or --file");
    console.error("Usage: bun run ingest -- --dir documents/");
    console.error("       bun run ingest -- --file path/to/doc.md");
    process.exit(1);
  }

  return parsed;
}

// --- File Discovery ---

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt"]);

async function discoverFiles(dirPath: string): Promise<string[]> {
  const resolved = resolve(dirPath);
  const entries = await readdir(resolved, { recursive: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(resolved, entry);
    const fileStat = await stat(fullPath);
    if (fileStat.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

// --- Database Operations (raw SQL, script-specific) ---

async function cleanTables(): Promise<void> {
  console.log("Cleaning existing data...");
  await db.execute(sql`DELETE FROM chunks`);
  await db.execute(sql`DELETE FROM documents`);
  console.log("Tables cleaned.");
}

// --- Ingestion Pipeline ---

interface IngestResult {
  file: string;
  documentId: string;
  chunksCreated: number;
}

async function ingestFile(
  filePath: string,
  chunkSize: number,
  chunkOverlap: number,
): Promise<IngestResult> {
  const content = await Bun.file(filePath).text();
  const title = extractTitle(content, filePath);
  const source = filePath;

  console.log(`\n  Processing: ${filePath}`);
  console.log(`  Title: ${title}`);

  // Insert document
  const documentId = await documentRepository.insertDocument(title, source, content);
  console.log(`  Document ID: ${documentId}`);

  // Chunk content
  const chunks = chunkText(content, chunkSize, chunkOverlap);
  console.log(`  Chunks: ${chunks.length}`);

  // Embed and insert each chunk sequentially (rate-limiting)
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.content);
    const tokenCount = Math.ceil(chunk.content.length / 4); // rough estimate
    await documentRepository.insertChunk(
      documentId,
      chunk.content,
      embedding,
      chunk.index,
      tokenCount,
    );
    process.stdout.write(`  Embedded chunk ${chunk.index + 1}/${chunks.length}\r`);
  }
  console.log(`  Embedded ${chunks.length} chunks ✓`);

  return { file: filePath, documentId, chunksCreated: chunks.length };
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs();

  console.log("=== Document Ingestion ===");
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`Chunk size: ${args.chunkSize}, overlap: ${args.chunkOverlap}`);

  // Discover files
  let files: string[];
  if (args.file) {
    files = [resolve(args.file)];
  } else if (args.dir) {
    files = await discoverFiles(args.dir);
  } else {
    files = [];
  }

  if (files.length === 0) {
    console.error("No .md or .txt files found.");
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s)`);

  // Clean if requested
  if (args.clean) {
    await cleanTables();
  }

  // Ingest each file
  const results: IngestResult[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    try {
      const result = await ingestFile(file, args.chunkSize, args.chunkOverlap);
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n  ERROR processing ${file}: ${message}`);
      errors.push({ file, error: message });
    }
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Documents processed: ${results.length}`);
  console.log(`Total chunks created: ${results.reduce((sum, r) => sum + r.chunksCreated, 0)}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    for (const e of errors) {
      console.log(`  - ${e.file}: ${e.error}`);
    }
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
