const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:30000/v1";
const MODEL_NAME = process.env.LLM_MODEL || "nemotron-30b";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices: {
    message: { content: string };
    finish_reason: string;
  }[];
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text}`);
  }

  const data: ChatResponse = await res.json();
  return data.choices[0]?.message?.content || "";
}

export async function checkLlmHealth(): Promise<{
  online: boolean;
  model?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${LLM_BASE_URL}/models`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { online: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = data.data || [];
    return {
      online: true,
      model: models[0]?.id || MODEL_NAME,
    };
  } catch (e) {
    return { online: false, error: String(e) };
  }
}

export function buildSummarizePrompt(title: string, abstract: string, fullText?: string | null): ChatMessage[] {
  const textContent = fullText
    ? `Full text (first 8000 chars):\n${fullText.slice(0, 8000)}`
    : `Abstract:\n${abstract}`;

  return [
    {
      role: "system",
      content: `You are an expert academic research assistant. Provide clear, structured summaries of research papers. Use markdown formatting. Include: key findings, methodology, contributions, and limitations.`,
    },
    {
      role: "user",
      content: `Summarize the following research paper:\n\nTitle: ${title}\n\n${textContent}\n\nProvide a structured summary with the following sections:\n## Key Findings\n## Methodology\n## Main Contributions\n## Limitations\n## Relevance`,
    },
  ];
}

export function buildSynthesisPrompt(
  collectionName: string,
  papers: { title: string; abstract: string; year: number | null }[]
): ChatMessage[] {
  const paperList = papers
    .map((p, i) => `${i + 1}. "${p.title}" (${p.year || "n.d."})\nAbstract: ${p.abstract.slice(0, 500)}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You are an expert academic researcher conducting a literature review. Synthesize the provided papers into a coherent review. Use markdown formatting. Identify themes, gaps, and future directions.`,
    },
    {
      role: "user",
      content: `Write a literature review for the collection "${collectionName}" based on these ${papers.length} papers:\n\n${paperList}\n\nProvide a structured review with:\n## Overview\n## Key Themes\n## Methodological Approaches\n## Main Findings\n## Research Gaps\n## Future Directions\n## Conclusion`,
    },
  ];
}

export function buildKnowledgeExtractionPrompt(title: string, abstract: string, fullText?: string | null): ChatMessage[] {
  const textContent = fullText
    ? `Full text (first 6000 chars):\n${fullText.slice(0, 6000)}`
    : `Abstract:\n${abstract}`;

  return [
    {
      role: "system",
      content: `You are an expert academic research assistant. Extract structured knowledge from research papers. You MUST respond with ONLY valid JSON — no markdown, no explanation, no text before or after the JSON array.`,
    },
    {
      role: "user",
      content: `Extract key knowledge from this paper. Return a JSON array of objects, each with "category" (one of: finding, method, gap, contribution, limitation, future_work) and "content" (a concise 1-2 sentence description).

Title: ${title}

${textContent}

Extract 3-8 entries covering the most important insights. Return ONLY the JSON array:`,
    },
  ];
}

export function buildCitationClassificationPrompt(
  citingTitle: string,
  citedTitle: string,
  contextText: string
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are an expert at analyzing academic citation relationships. Classify citation relationships as exactly one of: "supports", "contradicts", or "mentions". Respond with ONLY the single word classification.`,
    },
    {
      role: "user",
      content: `In the paper "${citingTitle}", the following text cites the paper "${citedTitle}":\n\n"${contextText}"\n\nDoes this citation support, contradict, or merely mention the cited work? Respond with exactly one word: supports, contradicts, or mentions.`,
    },
  ];
}

export { MODEL_NAME };
