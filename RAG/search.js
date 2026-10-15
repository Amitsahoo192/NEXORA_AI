import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

const embeddings =
  new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-embedding-001",
  });

const pinecone =
  new PineconeClient({
    apiKey: process.env.PINECONE_API_KEY,
  });

const pineconeIndex =
  pinecone.Index(
    process.env.PINECONE_INDEX_NAME
  );

const vectorStore =
  new PineconeStore(
    embeddings,
    {
      pineconeIndex,
    }
  );


export async function searchDocuments(
  query,
  documentId
) {

  // No document attached
  if (!documentId) {
    return "No document is currently attached.";
  }


  console.log(
    "RAG SEARCH:",
    query
  );

  console.log(
    "DOCUMENT ID:",
    documentId
  );


  // Search only inside the selected document
  const results =
    await vectorStore.similaritySearchWithScore(
      query,
      4,
      {
        filter: {
          documentId: {
            $eq: documentId,
          },
        },
      }
    );


  console.log(
    "RAG RESULTS:",
    results
  );


  if (results.length === 0) {
    return "No relevant information found in this document.";
  }


  // Remove weak matches
  const relevantResults =
    results.filter(
      ([doc, score]) => {
        return score >= 0.4;
      }
    );


  if (
    relevantResults.length === 0
  ) {
    return "No relevant information found in this document.";
  }


  console.log(
    "RELEVANT RESULTS:",
    relevantResults.length
  );


  console.log(
    "METADATA:",
    relevantResults[0][0].metadata
  );


  return relevantResults
    .map(([doc]) => {
      return doc.pageContent;
    })
    .join("\n\n");
}