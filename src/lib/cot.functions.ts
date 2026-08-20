import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  problem: z.string().min(1).max(4000),
  apiKey: z.string().trim().max(200).optional(),
});

const SYSTEM = `You are a careful math tutor that solves problems with explicit chain-of-thought reasoning.
Always reply in EXACTLY this format and nothing else:

Step 1: <one reasoning step, show the arithmetic>
Step 2: <next step>
... (as many steps as needed, minimum 2)
FINAL ANSWER: <the final answer only, concise>

Never skip steps. Never add extra commentary before Step 1 or after the final answer.`;

export type CotResult = {
  steps: string[];
  final: string;
  provider: string;
  raw: string;
};

function parse(raw: string, provider: string): CotResult {
  const lines = raw.split("\n").map((l) => l.trim());
  const steps: string[] = [];
  let final = "";
  for (const line of lines) {
    const m = /^step\s*\d+\s*[:.)-]\s*(.+)$/i.exec(line);
    if (m) {
      steps.push(m[1]!);
      continue;
    }
    const f = /^\**final answer\**\s*[:.]?\s*(.+)$/i.exec(line);
    if (f) final = f[1]!.replace(/\*/g, "").trim();
  }
  if (steps.length === 0 && raw.trim()) {
    for (const line of lines.filter(Boolean)) steps.push(line);
  }
  return { steps, final, provider, raw };
}

async function callLovable(problem: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Lovable AI is not configured.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      instructions: SYSTEM,
      input: problem,
      stream: true,
      store: false,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate limited. Please wait a moment and try again.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Lovable to keep solving.");
    throw new Error(`AI request failed (${res.status}). ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt.type === "response.completed" && !text) {
            text = evt.response?.output_text ?? "";
          }
        } catch {
          /* ignore keep-alive chunks */
        }
      }
    }
  }
  return text;
}

async function callOpenAI(problem: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: problem },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}). ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export const solveWithCot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<CotResult> => {
    const key = data.apiKey?.trim();

    if (key) {
      try {
        const text = await callOpenAI(data.problem, key);
        if (text.trim()) return parse(text, "OpenAI (your key)");
      } catch (error) {
        console.error("OpenAI failed, falling back to Lovable AI", error);
      }
    }

    const text = await callLovable(data.problem);
    if (!text.trim()) throw new Error("The model returned an empty response. Try again.");
    return parse(text, key ? "Lovable AI (fallback)" : "Lovable AI");
  });
