import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, Loader2, KeyRound, Sparkles } from "lucide-react";

import { solveWithCot } from "@/lib/cot.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chain of Thought Math Solver | Step-by-Step Answers" },
      {
        name: "description",
        content:
          "Solve multi-step math problems with visible chain-of-thought reasoning: every step shown, then the final answer.",
      },
      { property: "og:title", content: "Chain of Thought Math Solver" },
      {
        property: "og:description",
        content: "Multi-step math problems solved step by step with AI chain-of-thought reasoning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EXAMPLES = [
  "A train leaves at 9:15 am travelling 72 km/h and another leaves the same station at 10:00 am at 90 km/h. When does the second catch up?",
  "If 3x + 7 = 2(x - 4) + 15, find x and then evaluate x^2 - 5x.",
  "A shop marks up a item by 40%, then gives 25% discount. Cost is 800. What is the profit percentage?",
];

function Index() {
  const [problem, setProblem] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const solve = useServerFn(solveWithCot);

  const mutation = useMutation({
    mutationFn: (input: { problem: string; apiKey?: string }) => solve({ data: input }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim()) return;
    const key = apiKey.trim();
    mutation.mutate(key ? { problem: problem.trim(), apiKey: key } : { problem: problem.trim() });
  };

  return (
    <main className="min-h-screen bg-background bg-grid px-4 py-14">
      <div className="mx-auto w-full max-w-3xl">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Sparkles className="size-3.5 text-accent" /> Chain of Thought
          </span>
          <h1 className="mt-5 font-display text-4xl leading-tight font-bold text-foreground sm:text-5xl">
            Math, solved step by step
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Drop in a multi-step problem. You get every reasoning step, then the final answer.
          </p>
        </header>

        <form onSubmit={onSubmit} className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. A tank fills in 12 minutes with pipe A and 18 with pipe B. Both open, how long?"
            rows={4}
            className="resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <KeyRound className="size-3.5" />
              {showKey ? "Hide OpenAI key" : "Use my OpenAI key (optional)"}
            </button>
            <Button type="submit" disabled={mutation.isPending || !problem.trim()}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Thinking
                </>
              ) : (
                <>
                  <Brain className="size-4" /> Solve
                </>
              )}
            </Button>
          </div>

          {showKey && (
            <div className="mt-4">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Used only for this request and never stored. If it fails, we fall back to Lovable AI
                automatically.
              </p>
            </div>
          )}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setProblem(ex)}
              className="max-w-full truncate rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        {mutation.isError && (
          <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        {mutation.data && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Reasoning</h2>
              <span className="text-xs text-muted-foreground">{mutation.data.provider}</span>
            </div>

            <ol className="space-y-3">
              {mutation.data.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">
                    {i + 1}
                  </span>
                  <p className="font-mono text-sm leading-relaxed text-foreground">{step}</p>
                </li>
              ))}
            </ol>

            {mutation.data.final && (
              <div className="mt-6 rounded-xl border border-accent/50 bg-accent/10 p-5">
                <p className="text-xs font-medium tracking-wide text-accent uppercase">
                  Final answer
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-foreground">
                  {mutation.data.final}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
