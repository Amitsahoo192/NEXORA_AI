import fs from "fs";
import os from "os";
import path from "path";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

import dotenv from "dotenv";

dotenv.config();

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-embedding-001",
});

const pinecone = new PineconeClient({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.Index(
  process.env.PINECONE_INDEX_NAME
);

export async function processDocument(
  buffer,
  fileName,
  documentId
) {
  const filePath = path.join(
    os.tmpdir(),
    `${Date.now()}-${fileName}`
  );

  try {
    // Save PDF temporarily
    fs.writeFileSync(filePath, buffer);

    // Read PDF
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    // Split PDF
    const splitter =
      new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

    const chunks =
      await splitter.splitDocuments(docs);

    // Add document ID to every chunk
    chunks.forEach((chunk) => {
      chunk.metadata.documentId = documentId;
    });

    // Store in Pinecone
    await PineconeStore.fromDocuments(
      chunks,
      embeddings,
      { pineconeIndex }
    );

    return {
      pages: docs.length,
      chunks: chunks.length,
    };

  } finally {
    // Delete temporary PDF
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}