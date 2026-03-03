"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Play } from "lucide-react";

type PromptTestModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: string;
  systemPrompt: string;
};

export function PromptTestModal({
  open,
  onOpenChange,
  template,
  systemPrompt,
}: PromptTestModalProps) {
  const variables = useMemo(() => {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
  }, [template]);

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateVariable(name: string, value: string) {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);

    let filledTemplate = template;
    for (const varName of variables) {
      filledTemplate = filledTemplate.replaceAll(
        `{{${varName}}}`,
        variableValues[varName] ?? ""
      );
    }

    try {
      const res = await fetch("/api/prompt-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          template: filledTemplate,
          model: "gemini-2.5-flash",
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Prompt</DialogTitle>
        </DialogHeader>

        {variables.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Fill in the template variables:
            </p>
            {variables.map((varName) => (
              <div key={varName} className="space-y-1">
                <Label htmlFor={`var-${varName}`} className="font-mono text-sm">
                  {`{{${varName}}}`}
                </Label>
                <Input
                  id={`var-${varName}`}
                  value={variableValues[varName] ?? ""}
                  onChange={(e) => updateVariable(varName, e.target.value)}
                  placeholder={`Enter value for ${varName}`}
                />
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleRun} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run
            </>
          )}
        </Button>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <Label>Result</Label>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted p-4 font-mono text-sm">
              <code>{result}</code>
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
