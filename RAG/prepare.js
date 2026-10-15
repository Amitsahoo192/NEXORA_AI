import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

// Create Google embedding model
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-embedding-001",
});

// Create Pinecone client
const pinecone = new PineconeClient({
  apiKey: process.env.PINECONE_API_KEY,
});

// Connect to Pinecone index
const pineconeIndex = pinecone.Index(
  process.env.PINECONE_INDEX_NAME
);

// Load PDF, split it, and store embeddings in Pinecone
export async function indexTheDocument(filePath) {

  // Load PDF
  const loader = new PDFLoader(filePath);

  // Extract PDF content
  const docs = await loader.load();

  console.log(`Loaded ${docs.length} document pages`);

  // Split documents into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunkedDocs = await splitter.splitDocuments(docs);

  console.log(`Created ${chunkedDocs.length} chunks`);

  // Store chunks + embeddings in Pinecone
  await PineconeStore.fromDocuments(
    chunkedDocs,
    embeddings,
    {
      pineconeIndex,
    }
  );

  console.log("Document indexed successfully!");
}

// Start indexing
indexTheDocument(
  "./Artificial_Intelligence_Generative_AI_RAG_Agentic_AI (1).pdf"
);