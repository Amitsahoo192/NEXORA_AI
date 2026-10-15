import { searchDocuments } from "./search.js";

const result = await searchDocuments(
  "What is Retrieval-Augmented Generation?"
);

console.log("SEARCH RESULT:");
console.log(result);