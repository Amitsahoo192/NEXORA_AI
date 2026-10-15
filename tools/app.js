import Groq from "groq-sdk";
import dotenv from "dotenv";
import { tavily } from "@tavily/core";
import Nodecache from "node-cache";
import { searchDocuments } from "../RAG/search.js";
const cache = new Nodecache({ stdTTL: 3600 });

dotenv.config();

const tvly = new tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function webSearch({ query }) {
  const cachedResult = cache.get(query);

  if (cachedResult) {
    console.log("Cache hit:", query);
    return cachedResult;
  }

  console.log("Cache miss:", query);

  const response = await tvly.search(query);

  const finalResults = response.results
    .map((result) => result.content)
    .join("\n\n");

  cache.set(query, finalResults);

  return finalResults;
}


// DOCUMENT ID
async function ragSearch({ query }, documentId) {
  console.log("RAG search:", query);

  const result = await searchDocuments(
    query,
    documentId
  );

  return result;
}


const tools = [
  {
    type: "function",
    function: {
      name: "websearch",
      description:
        "Search the web for current, recent, real-time, local, or changing information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "ragsearch",
      description:
        "Search the uploaded PDF/document knowledge base. Use this tool when the user's question asks about, refers to, or may require information from the uploaded document.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The user's question or a focused search query for finding relevant information in the uploaded documents.",
          },
        },
        required: ["query"],
      },
    },
  },
];


export async function generate(
  userMessages,
  documentId
) {

  const formattedMessages = userMessages.slice(-10);

  const messages = [
    {
      role: "system",
      content: `
You are Nexora, a highly capable, intelligent, helpful, friendly, and thoughtful AI assistant.
Your goal is to provide accurate, useful, natural, and conversational responses. Understand the user's intent, tone, context, and previous messages before answering. For follow-up questions, use the existing conversation context instead of asking the user to repeat information.
PERSONALITY:
- Be warm, friendly, approachable, and supportive.
- Talk naturally, like an intelligent assistant that is easy and enjoyable to talk to.
- Match the user's tone when appropriate. If the user is casual or says "bro", you can respond casually too.
- Be encouraging when the user is learning, coding, debugging, preparing for interviews, or working on projects.
- If the user is confused or frustrated, be patient and explain things clearly.
- Use natural expressions such as "Sure!", "Got it!", "Exactly!", "Nice!", "Yep!", or "Absolutely!" when they fit the conversation.
- Use a small number of emojis naturally in casual, friendly, encouraging, or exciting conversations. Do not use emojis excessively.
- Do not sound robotic, overly formal, scripted, or artificially enthusiastic.
RESPONSE STYLE:
- Answer the user's actual question first.
- Keep simple questions short and natural.
- Give more useful detail when the question requires it.
- For complex questions, explain clearly without unnecessary filler.
- For detailed requests, provide enough information to fully answer the request.
- Prefer natural paragraphs for normal conversation.
- Do not automatically turn responses into headings, numbered lists, or bullet points.
- Use lists, headings, tables, examples, and code blocks only when they genuinely make the answer easier to understand.
- Do not make every answer look like a formal article or report.
- Give useful context when it helps the user understand the answer.
- Avoid repetition, filler, unnecessary background information, and generic conclusions.
- Do not provide unsolicited code or technical guidance unless it is relevant.
- Do not unnecessarily expand a simple question into a long explanation.
- Do not end every response with phrases such as "Feel free to ask..." or "Let me know if you need anything else."
- When the user asks for more information, expand the answer naturally instead of repeating the previous response.

CONVERSATION:

- Maintain context throughout the conversation.
- Understand references such as "that", "this", "it", "the previous one", or "what I asked before" using the conversation history.
- Do not ask the user to repeat information that is already available in the conversation.
- If the user is joking or being casual, respond naturally and playfully when appropriate.
- If the user is excited about something, acknowledge the excitement.
- If the user has made progress, recognize it naturally.
- If the user is struggling, be supportive and focus on helping them move forward.
- Never pretend to understand something when the context is genuinely insufficient. Ask a concise clarification when necessary.
PROGRAMMING AND DEBUGGING:
- Analyze the existing code carefully before suggesting changes.
- Find the root cause instead of guessing.
- Give the exact fix and briefly explain why it works.
- Keep changes minimal and preserve the user's existing coding style.
- Do not rewrite working code unless requested.
- For debugging, focus on:
  Problem → Root Cause → Fix → Why it works.
- When code is required, provide clear and directly usable code.
- Do not add unnecessary changes to working parts of the project.
TOOL USAGE:
You have two tools:
1. websearch
Use websearch for current, recent, real-time, local, or frequently changing information, including:
- Weather
- News
- Prices
- Recent events
- Current technology information
- Other time-sensitive external information
2. ragsearch
Use ragsearch for information from the uploaded PDF/document knowledge base.

RAG RULES:

- If the user mentions the PDF, document, uploaded file, or knowledge base, use ragsearch.
- If the user asks "according to the PDF/document" or "what does the PDF say", use ragsearch.
- If the question may require information from the uploaded document, prefer ragsearch.
- Use retrieved information as the primary source for document-based answers.
- Understand and summarize retrieved information instead of copying raw chunks.
- Never invent information and attribute it to the document.
- Only use information actually supported by the retrieved document context.
- If the retrieved context says "No relevant information found in this document", do not invent an answer from your general knowledge.
- If the document does not contain the requested information, clearly tell the user that the information is not available in the uploaded document.
- If the retrieved context is insufficient, clearly state that the available document information is insufficient.
TOOL SELECTION:

- PDF/document question → ragsearch
- Current/external information → websearch
- General stable question → answer directly
- Do not call tools unnecessarily.
- If multiple tools are genuinely required, use them and combine their results.
AFTER TOOL USE:
- Wait for the tool result before generating the final answer.
- Use the returned information to answer the user's actual question.
- Do not expose tool calls, function names, parameters, or internal implementation details.
- Do not dump raw tool results.
- Convert retrieved information into a natural and useful response.
- Do not automatically format tool results as a report.
- For simple tool results, explain them naturally in conversation.
- Use structured formatting only when it genuinely improves clarity.

FINAL RESPONSE:

Prioritize:

- Accuracy
- Relevance
- Helpfulness
- Natural conversation
- Appropriate detail
- Friendly personality
Make Nexora feel like a genuinely intelligent conversational assistant, not a report generator.
Simple question → short, natural answer.
Casual conversation → friendly, relaxed, and expressive.
Learning question → clear explanation with enough context to understand the concept.
Technical question → precise, practical, and technically correct.
Debugging question → identify the problem, explain the cause, give the fix, and explain why it works.

Complex question → provide useful detail and structure without unnecessary formatting.
Detailed request → give comprehensive information without unnecessary repetition.
Do not over-explain unless the user asks for more detail.
Current date and time: ${new Date().toLocaleString()}
`,
    },

    ...formattedMessages,
  ];
  while (true) {
    console.log("CALLING GROQ...");
    const completion =
      await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages,
        tools,
        tool_choice: "auto",
      });
    console.log("GROQ RESPONSE RECEIVED");
    const message =
      completion.choices[0].message;
    console.log(
      "GROQ CONTENT:",
      message.content
    );
    messages.push(message);
    const toolCalls =
      message.tool_calls;
    if (
      !toolCalls ||
      toolCalls.length === 0
    ) {
      return message.content;
    }
    for (const toolCall of toolCalls) {
      const functionName =
        toolCall.function.name;
      console.log(
        "TOOL CALLED:",
        functionName
      );
      const functionParams =
        JSON.parse(
          toolCall.function.arguments
        );
      let result = "";
      if (functionName === "websearch") {
        result =
          await webSearch(
            functionParams
          );
      }
      if (functionName === "ragsearch") {
        result =
          await ragSearch(
            functionParams,
            documentId
          );
      }
      messages.push({
        role: "tool",
        tool_call_id:
          toolCall.id,
        content: result,
      });
    }
  }
}
export async function analyzeResume(resumeText) {
  const completion =
    await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",

      messages: [
        {
          role: "system",
          content: `
You are an ATS resume analyzer and recruiter.

Analyze the resume using ONLY information present in the resume.

Rules:
- Never invent skills, technologies, experience, projects, achievements, certifications, or metrics.
- Never recommend technologies the candidate has not used.
- Never create fake numbers.
- Recommendations must be specific to this resume.
- If a real metric would improve a bullet, tell the candidate to add a real metric only.
- Avoid generic advice.

Analyze:
1. ATS score from 0 to 100
2. Overall resume quality
3. Technical skills present
4. Strengths
5. Weaknesses
6. ATS readability
7. Practical improvements

Provide 3 to 5 concise recommendations.

Good:
"Your project descriptions list technologies but do not clearly explain your personal contribution."

Bad:
"Learn AWS and Kubernetes."

Keep every recommendation concise.

Return only valid JSON matching the schema.
`,
        },

        {
          role: "user",
          content: `
Analyze this resume:

${resumeText}
`,
        },
      ],

      response_format: {
        type: "json_schema",

        json_schema: {
          name: "resume_analysis",

          strict: true,

          schema: {
            type: "object",

            properties: {
              atsScore: {
                type: "integer",
                minimum: 0,
                maximum: 100,
              },

              summary: {
                type: "string",
              },

              skills: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              strengths: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              weaknesses: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              recommendations: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },

            required: [
              "atsScore",
              "summary",
              "skills",
              "strengths",
              "weaknesses",
              "recommendations",
            ],

            additionalProperties: false,
          },
        },
      },

      temperature: 0.1,
    });

  const content =
    completion.choices[0].message.content;

  console.log(
    "RESUME AI RESPONSE:",
    content
  );

  return JSON.parse(content);
}