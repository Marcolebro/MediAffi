"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updatePrompt } from "@/lib/queries/prompts";
import type { Prompt } from "@/lib/types/database";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PromptTestModal } from "./prompt-test-modal";
import { ChevronDown, ChevronRight, Save, FlaskConical } from "lucide-react";

const CATEGORIES = [
  { value: "articles", label: "Articles" },
  { value: "social", label: "Social" },
  { value: "newsletter", label: "Newsletter" },
  { value: "seo", label: "SEO" },
] as const;

type PromptEditorState = {
  system_prompt: string;
  template: string;
  model: string;
  temperature: number;
  max_tokens: number;
};

export function PromptsClient({ prompts }: { prompts: Prompt[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorState, setEditorState] = useState<PromptEditorState | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPrompt, setTestPrompt] = useState<{ template: string; systemPrompt: string }>({
    template: "",
    systemPrompt: "",
  });

  function toggleExpand(prompt: Prompt) {
    if (expandedId === prompt.id) {
      setExpandedId(null);
      setEditorState(null);
    } else {
      setExpandedId(prompt.id);
      setEditorState({
        system_prompt: prompt.system_prompt ?? "",
        template: prompt.template,
        model: prompt.model,
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
      });
    }
  }

  async function handleToggleActive(prompt: Prompt) {
    try {
      await updatePrompt(supabase, prompt.id, { is_active: !prompt.is_active });
      toast.success(`Prompt ${!prompt.is_active ? "activated" : "deactivated"}`);
      router.refresh();
    } catch (err) {
      toast.error("Failed to update prompt status");
      console.error(err);
    }
  }

  async function handleSave(prompt: Prompt) {
    if (!editorState) return;
    setSaving(true);
    try {
      await updatePrompt(supabase, prompt.id, {
        system_prompt: editorState.system_prompt || null,
        template: editorState.template,
        model: editorState.model,
        temperature: editorState.temperature,
        max_tokens: editorState.max_tokens,
        version: prompt.version + 1,
      });
      toast.success(`Prompt saved (v${prompt.version + 1})`);
      router.refresh();
    } catch (err) {
      toast.error("Failed to save prompt");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleTest(prompt: Prompt) {
    setTestPrompt({
      template: editorState?.template ?? prompt.template,
      systemPrompt: editorState?.system_prompt ?? prompt.system_prompt ?? "",
    });
    setTestModalOpen(true);
  }

  function getFilteredPrompts(category: string) {
    return prompts.filter((p) => p.category === category);
  }

  return (
    <>
      <Tabs defaultValue="articles">
        <TabsList>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="space-y-2">
            {getFilteredPrompts(cat.value).length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No prompts in this category.
              </div>
            ) : (
              getFilteredPrompts(cat.value).map((prompt) => (
                <div key={prompt.id} className="rounded-lg border bg-card">
                  {/* Prompt Row */}
                  <div
                    className="flex cursor-pointer items-center gap-4 p-4"
                    onClick={() => toggleExpand(prompt)}
                  >
                    {expandedId === prompt.id ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}

                    <span className="font-medium">{prompt.name}</span>

                    <Badge variant="outline" className="shrink-0">
                      {prompt.type}
                    </Badge>

                    <span className="text-sm text-muted-foreground">{prompt.model}</span>

                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                      v{prompt.version}
                    </Badge>

                    <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={prompt.is_active}
                        onCheckedChange={() => handleToggleActive(prompt)}
                      />
                    </div>
                  </div>

                  {/* Inline Editor */}
                  {expandedId === prompt.id && editorState && (
                    <div className="border-t p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`system-prompt-${prompt.id}`}>System Prompt</Label>
                        <Textarea
                          id={`system-prompt-${prompt.id}`}
                          rows={4}
                          value={editorState.system_prompt}
                          onChange={(e) =>
                            setEditorState({ ...editorState, system_prompt: e.target.value })
                          }
                          className="font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`template-${prompt.id}`}>Template</Label>
                        <Textarea
                          id={`template-${prompt.id}`}
                          rows={8}
                          value={editorState.template}
                          onChange={(e) =>
                            setEditorState({ ...editorState, template: e.target.value })
                          }
                          className="font-mono text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`model-${prompt.id}`}>Model</Label>
                          <Input
                            id={`model-${prompt.id}`}
                            value={editorState.model}
                            onChange={(e) =>
                              setEditorState({ ...editorState, model: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`temperature-${prompt.id}`}>Temperature</Label>
                          <Input
                            id={`temperature-${prompt.id}`}
                            type="number"
                            step={0.1}
                            min={0}
                            max={2}
                            value={editorState.temperature}
                            onChange={(e) =>
                              setEditorState({
                                ...editorState,
                                temperature: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`max-tokens-${prompt.id}`}>Max Tokens</Label>
                          <Input
                            id={`max-tokens-${prompt.id}`}
                            type="number"
                            step={100}
                            min={100}
                            value={editorState.max_tokens}
                            onChange={(e) =>
                              setEditorState({
                                ...editorState,
                                max_tokens: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(prompt)} disabled={saving}>
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? "Saving..." : "Save"}
                        </Button>
                        <Button variant="outline" onClick={() => handleTest(prompt)}>
                          <FlaskConical className="mr-2 h-4 w-4" />
                          Test
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <PromptTestModal
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        template={testPrompt.template}
        systemPrompt={testPrompt.systemPrompt}
      />
    </>
  );
}
