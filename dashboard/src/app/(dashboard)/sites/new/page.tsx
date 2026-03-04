"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Sparkles,
  GitBranch,
  Globe,
  ChevronDown,
  Settings,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";

type CreateMode = "prompt" | "repo" | "existing" | null;
type SiteType = "affiliation" | "media" | "libre";

type AffiliateRow = {
  name: string;
  url: string;
};

type StepStatus = "pending" | "in_progress" | "done" | "error";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
  error?: string;
  detail?: string;
};

const STEPS_PROMPT: Omit<Step, "status">[] = [
  { key: "supabase", label: "Création du site en base..." },
  { key: "generate_arch", label: "Planification de l'architecture..." },
  { key: "generate_layout", label: "Génération du layout et composants..." },
  { key: "generate_pages", label: "Génération des pages..." },
  { key: "github", label: "Push vers GitHub..." },
  { key: "vercel", label: "Déploiement Vercel..." },
  { key: "articles", label: "Génération de 50 idées d'articles..." },
  { key: "finalize", label: "Finalisation..." },
];

const STEPS_REPO: Omit<Step, "status">[] = [
  { key: "analyze", label: "Analyse du repo..." },
  { key: "supabase", label: "Création en base..." },
  { key: "vercel", label: "Déploiement Vercel..." },
  { key: "articles", label: "Génération d'articles..." },
];

const STEPS_EXISTING: Omit<Step, "status">[] = [
  { key: "scrape", label: "Analyse du site..." },
  { key: "supabase", label: "Création en base..." },
  { key: "connect", label: "Connexion..." },
  { key: "vercel", label: "Configuration Vercel..." },
  { key: "articles", label: "Génération d'articles..." },
];

const PLACEHOLDERS: Record<SiteType, string> = {
  affiliation:
    "Ex: Un site de comparaison de casinos en ligne français. Page d'accueil avec classement des meilleurs casinos, pages bonus, guides de jeux (roulette, blackjack, slots), pages légales. Design moderne et premium avec des couleurs sombres et dorées.",
  media:
    "Ex: Un magazine en ligne sur la tech et l'IA. Homepage magazine avec articles hero + grille, catégories (IA, startups, gadgets, crypto), newsletter, section à propos. Style clean et minimaliste, typographie soignée.",
  libre:
    "Décrivez votre site en détail : pages souhaitées, fonctionnalités, style visuel, contenu...",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── NDJSON stream reader helper ───

async function streamEndpoint(
  url: string,
  body: unknown,
  onEvent: (event: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // JSON response (non-streaming, e.g. init)
  if (contentType.includes("application/json")) {
    const data = await res.json();
    onEvent(data);
    return;
  }

  // NDJSON streaming
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
  }
}

export default function CreateSitePage() {
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Abort / cancel
  const abortControllerRef = useRef<AbortController | null>(null);
  const [aborted, setAborted] = useState(false);
  const siteIdRef = useRef<string | null>(null);

  // Progress
  const [steps, setSteps] = useState<Step[]>([]);
  const [failedStep, setFailedStep] = useState<string | null>(null);
  const [result, setResult] = useState<{
    siteId?: string;
    repoUrl?: string;
    siteUrl?: string;
    articlesQueued?: number;
  } | null>(null);

  // Mode Prompt
  const [siteType, setSiteType] = useState<SiteType>("affiliation");
  const [prompt, setPrompt] = useState("");

  // Mode Repo
  const [repoUrl, setRepoUrl] = useState("");

  // Mode Existing
  const [siteUrl, setSiteUrl] = useState("");
  const [existingRepo, setExistingRepo] = useState("");

  // Advanced config (shared)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [accentColor, setAccentColor] = useState("#10b981");
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [adsenseId, setAdsenseId] = useState("");

  function addAffiliate() {
    setAffiliates([...affiliates, { name: "", url: "" }]);
  }

  function removeAffiliate(index: number) {
    setAffiliates(affiliates.filter((_, i) => i !== index));
  }

  function updateAffiliate(index: number, field: keyof AffiliateRow, value: string) {
    const updated = [...affiliates];
    updated[index] = { ...updated[index], [field]: value };
    setAffiliates(updated);
  }

  const updateStepStatus = useCallback(
    (key: string, status: StepStatus, error?: string) => {
      setSteps((prev) =>
        prev.map((s) => (s.key === key ? { ...s, status, error } : s))
      );
    },
    []
  );

  const markNextInProgress = useCallback((currentKey: string) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.key === currentKey);
      const nextIdx = idx + 1;
      if (nextIdx < prev.length && prev[nextIdx].status === "pending") {
        return prev.map((s, i) =>
          i === nextIdx ? { ...s, status: "in_progress" as StepStatus } : s
        );
      }
      return prev;
    });
  }, []);

  function handleStreamEvent(event: Record<string, unknown>) {
    const step = event.step as string;
    const status = event.status as string;

    if (step === "complete" || step === "deploy_complete" || step === "generate_complete") {
      // Accumulate result data
      setResult((prev) => {
        const next = { ...(prev || {}) };
        if (event.siteId) next.siteId = event.siteId as string;
        if (event.repoUrl) next.repoUrl = event.repoUrl as string;
        if (event.siteUrl) next.siteUrl = event.siteUrl as string;
        if (event.articlesQueued !== undefined) next.articlesQueued = event.articlesQueued as number;
        return next;
      });
      return;
    }

    // Init response (JSON, not NDJSON)
    if (event.siteId && !step) {
      siteIdRef.current = event.siteId as string;
      setResult((prev) => ({ ...prev, siteId: event.siteId as string }));
      updateStepStatus("supabase", "done");
      markNextInProgress("supabase");
      return;
    }

    if (status === "done") {
      updateStepStatus(step, "done");
      markNextInProgress(step);
    } else if (status === "error") {
      updateStepStatus(step, "error", event.error as string);
      markNextInProgress(step);
    } else if (status === "progress") {
      setSteps((prev) =>
        prev.map((s) =>
          s.key === step
            ? {
                ...s,
                status: "in_progress" as StepStatus,
                detail: s.detail
                  ? `${s.detail}, ${event.message}`
                  : (event.message as string),
              }
            : s
        )
      );
    }
  }

  async function handleCancel() {
    setAborted(true);
    abortControllerRef.current?.abort();

    // Cleanup: delete the site if it was created
    const siteId = siteIdRef.current;
    if (siteId) {
      try {
        await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      } catch {
        // Best effort
      }
    }

    setLoading(false);
    toast.info("Création annulée");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;

    // Validation
    if (mode === "prompt" && !prompt.trim()) {
      toast.error("Veuillez décrire votre site.");
      return;
    }
    if (mode === "repo" && !repoUrl.trim()) {
      toast.error("Veuillez entrer l'URL du repo.");
      return;
    }
    if (mode === "existing" && !siteUrl.trim()) {
      toast.error("Veuillez entrer l'URL du site.");
      return;
    }

    const stepsTemplate =
      mode === "prompt"
        ? STEPS_PROMPT
        : mode === "repo"
          ? STEPS_REPO
          : STEPS_EXISTING;

    setSteps(
      stepsTemplate.map((s, i) => ({
        ...s,
        status: i === 0 ? "in_progress" : "pending",
      }))
    );
    setResult(null);
    setCreating(true);
    setLoading(true);
    setAborted(false);
    setFailedStep(null);
    siteIdRef.current = null;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const computedSlug = slugify(siteName || prompt.slice(0, 40));
      const validAffiliates = affiliates.filter((a) => a.name.trim() && a.url.trim());

      if (mode === "prompt") {
        await runPromptFlow(computedSlug, validAffiliates, controller.signal);
      } else if (mode === "repo") {
        await runRepoFlow(computedSlug, controller.signal);
      } else if (mode === "existing") {
        await runExistingFlow(computedSlug, controller.signal);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Erreur lors de la création";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function runPromptFlow(
    computedSlug: string,
    validAffiliates: AffiliateRow[],
    signal: AbortSignal
  ) {
    // Step 1 — Init
    await streamEndpoint(
      "/api/create-site/init",
      {
        mode: "prompt",
        site_type: siteType,
        prompt: prompt.trim(),
        name: siteName.trim() || undefined,
        slug: computedSlug,
        primary_color: primaryColor,
        accent_color: accentColor,
        affiliates: validAffiliates,
        twitter: twitter.trim() || undefined,
        instagram: instagram.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        adsense_id: adsenseId.trim() || undefined,
      },
      handleStreamEvent,
      signal
    );

    if (aborted) return;
    const siteId = siteIdRef.current;
    if (!siteId) {
      setFailedStep("init");
      throw new Error("Site ID not received from init step");
    }

    // Step 2 — Generate (arch + layout + pages)
    try {
      await streamEndpoint(
        "/api/create-site/generate",
        {
          siteId,
          prompt: prompt.trim(),
          siteType,
          config: {
            siteName: siteName.trim() || undefined,
            primaryColor,
            accentColor,
            affiliates: validAffiliates,
            social: { twitter: twitter.trim(), instagram: instagram.trim(), linkedin: linkedin.trim() },
            adsenseId: adsenseId.trim() || undefined,
          },
        },
        handleStreamEvent,
        signal
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setFailedStep("generate");
      throw err;
    }

    if (aborted) return;

    // Step 3 — Deploy (GitHub + Vercel)
    try {
      await streamEndpoint(
        "/api/create-site/deploy",
        { siteId },
        handleStreamEvent,
        signal
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setFailedStep("deploy");
      throw err;
    }

    if (aborted) return;

    // Step 4 — Articles
    try {
      await streamEndpoint(
        "/api/create-site/articles",
        { siteId },
        handleStreamEvent,
        signal
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setFailedStep("articles");
      throw err;
    }
  }

  async function runRepoFlow(computedSlug: string, signal: AbortSignal) {
    // Repo + existing modes still use the old single-endpoint approach
    // Init
    updateStepStatus("analyze", "done");
    markNextInProgress("analyze");

    await streamEndpoint(
      "/api/create-site/init",
      {
        mode: "repo",
        repo_url: repoUrl.trim(),
        name: siteName.trim() || undefined,
        slug: computedSlug,
        primary_color: primaryColor,
        accent_color: accentColor,
        affiliates: affiliates.filter((a) => a.name.trim() && a.url.trim()),
      },
      handleStreamEvent,
      signal
    );

    if (aborted) return;
    const siteId = siteIdRef.current;
    if (!siteId) return;

    // Deploy (GitHub repo already exists, just need Vercel)
    try {
      await streamEndpoint(
        "/api/create-site/deploy",
        { siteId },
        handleStreamEvent,
        signal
      );
    } catch {
      // Non-critical for repo mode
    }

    if (aborted) return;

    // Articles
    updateStepStatus("articles", "done");
    send_complete(siteId);
  }

  async function runExistingFlow(computedSlug: string, signal: AbortSignal) {
    updateStepStatus("scrape", "done");
    markNextInProgress("scrape");

    await streamEndpoint(
      "/api/create-site/init",
      {
        mode: "existing",
        site_url: siteUrl.trim(),
        existing_repo: existingRepo.trim() || undefined,
        name: siteName.trim() || undefined,
        slug: computedSlug,
        primary_color: primaryColor,
        accent_color: accentColor,
      },
      handleStreamEvent,
      signal
    );

    if (aborted) return;
    const siteId = siteIdRef.current;
    if (!siteId) return;

    updateStepStatus("connect", "done");
    markNextInProgress("connect");
    updateStepStatus("vercel", "done");
    markNextInProgress("vercel");
    updateStepStatus("articles", "done");

    send_complete(siteId);
  }

  function send_complete(siteId: string) {
    setResult((prev) => ({ ...prev, siteId }));
  }

  async function handleRetry() {
    if (!failedStep || !siteIdRef.current) return;

    const siteId = siteIdRef.current;
    setLoading(true);
    setFailedStep(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    const validAffiliates = affiliates.filter((a) => a.name.trim() && a.url.trim());

    try {
      if (failedStep === "generate") {
        await streamEndpoint(
          "/api/create-site/generate",
          {
            siteId,
            prompt: prompt.trim(),
            siteType,
            config: {
              siteName: siteName.trim() || undefined,
              primaryColor,
              accentColor,
              affiliates: validAffiliates,
              social: { twitter: twitter.trim(), instagram: instagram.trim(), linkedin: linkedin.trim() },
              adsenseId: adsenseId.trim() || undefined,
            },
          },
          handleStreamEvent,
          signal
        );

        if (aborted) return;

        await streamEndpoint("/api/create-site/deploy", { siteId }, handleStreamEvent, signal);
        if (aborted) return;

        await streamEndpoint("/api/create-site/articles", { siteId }, handleStreamEvent, signal);
      } else if (failedStep === "deploy") {
        await streamEndpoint("/api/create-site/deploy", { siteId }, handleStreamEvent, signal);
        if (aborted) return;

        await streamEndpoint("/api/create-site/articles", { siteId }, handleStreamEvent, signal);
      } else if (failedStep === "articles") {
        await streamEndpoint("/api/create-site/articles", { siteId }, handleStreamEvent, signal);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Erreur lors du retry");
    } finally {
      setLoading(false);
    }
  }

  function getStepIcon(status: StepStatus) {
    switch (status) {
      case "in_progress":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  }

  function getStepBadge(status: StepStatus) {
    switch (status) {
      case "in_progress":
        return <Badge variant="secondary">En cours</Badge>;
      case "done":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            OK
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Erreur</Badge>;
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  }

  // ─── Advanced config section (reused) ───
  function renderAdvancedConfig() {
    return (
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" type="button" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration avancée
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Site name */}
          <div className="space-y-2">
            <Label htmlFor="site-name">Nom du site</Label>
            <Input
              id="site-name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Mon Super Site"
            />
          </div>

          {/* Colors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Couleur principale</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded border bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur d&apos;accent</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded border bg-transparent"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Affiliates */}
          <div className="space-y-3">
            <Label>Programmes d&apos;affiliation</Label>
            {affiliates.map((affiliate, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={affiliate.name}
                  onChange={(e) => updateAffiliate(index, "name", e.target.value)}
                  placeholder="Nom du programme"
                  className="flex-1"
                />
                <Input
                  value={affiliate.url}
                  onChange={(e) => updateAffiliate(index, "url", e.target.value)}
                  placeholder="URL d'affiliation"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAffiliate(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addAffiliate}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un programme
            </Button>
          </div>

          <Separator />

          {/* Social */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Twitter / X</Label>
              <Input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="company/page"
              />
            </div>
          </div>

          {/* AdSense */}
          <div className="space-y-2">
            <Label>AdSense ID</Label>
            <Input
              value={adsenseId}
              onChange={(e) => setAdsenseId(e.target.value)}
              placeholder="ca-pub-1234567890"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // ─── Progress view ───
  if (creating) {
    const hasErrors = steps.some((s) => s.status === "error");
    const allDone = !loading;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Création du site</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progression</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step) => (
              <div key={step.key} className="flex items-center gap-3">
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <span className="text-sm">{step.label}</span>
                  {step.detail && (
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  )}
                </div>
                {getStepBadge(step.status)}
              </div>
            ))}

            {steps
              .filter((s) => s.status === "error")
              .map((step) => (
                <div
                  key={`error-${step.key}`}
                  className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  <strong>{step.label.replace("...", "")}</strong>: {step.error}
                </div>
              ))}

            {/* Cancel button */}
            {loading && (
              <Button
                variant="outline"
                onClick={handleCancel}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                Annuler la création
              </Button>
            )}
          </CardContent>
        </Card>

        {allDone && result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {hasErrors ? "Création partielle" : "Site créé avec succès !"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.siteId && (
                <p className="text-sm">
                  <strong>Site ID :</strong> {result.siteId}
                </p>
              )}
              {result.repoUrl && (
                <p className="text-sm">
                  <strong>GitHub :</strong>{" "}
                  <a
                    href={result.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {result.repoUrl}
                  </a>
                </p>
              )}
              {result.siteUrl && (
                <p className="text-sm">
                  <strong>Site :</strong>{" "}
                  <a
                    href={
                      result.siteUrl.startsWith("http")
                        ? result.siteUrl
                        : `https://${result.siteUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {result.siteUrl}
                  </a>
                </p>
              )}
              {result.articlesQueued !== undefined && result.articlesQueued > 0 && (
                <p className="text-sm">
                  <strong>Articles en queue :</strong> {result.articlesQueued}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                {result.siteId && (
                  <Button onClick={() => router.push(`/sites/${result.siteId}`)}>
                    Voir le dashboard
                  </Button>
                )}
                {hasErrors && failedStep && (
                  <Button variant="outline" onClick={handleRetry}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Réessayer
                  </Button>
                )}
                {hasErrors && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreating(false);
                      setLoading(false);
                    }}
                  >
                    Retour au formulaire
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {allDone && !result && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setLoading(false);
              }}
            >
              Retour au formulaire
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Step 1: Mode selection ───
  if (!mode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/sites">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Nouveau site</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card
            className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
            onClick={() => setMode("prompt")}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Prompt IA</h3>
              <p className="text-sm text-muted-foreground">
                Décrivez votre site et l&apos;IA le construit
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
            onClick={() => setMode("repo")}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <GitBranch className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Repo Git</h3>
              <p className="text-sm text-muted-foreground">
                Connectez un repo GitHub existant
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
            onClick={() => setMode("existing")}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Site existant</h3>
              <p className="text-sm text-muted-foreground">
                Ajoutez un site déjà en ligne
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Step 2: Form based on mode ───
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setMode(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {mode === "prompt"
            ? "Créer avec l'IA"
            : mode === "repo"
              ? "Connecter un repo"
              : "Ajouter un site existant"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── MODE PROMPT ─── */}
        {mode === "prompt" && (
          <>
            {/* Site type selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Type de site</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      { value: "affiliation", label: "Site Affiliation", desc: "Comparatifs, classements, CTA affiliés" },
                      { value: "media", label: "Site Média", desc: "Articles, catégories, newsletter" },
                      { value: "libre", label: "Libre", desc: "Structure personnalisée" },
                    ] as const
                  ).map((type) => (
                    <div
                      key={type.value}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        siteType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-muted-foreground/20"
                      }`}
                      onClick={() => setSiteType(type.value)}
                    >
                      <p className="font-medium">{type.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{type.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prompt textarea */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Décrivez votre site</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={PLACEHOLDERS[siteType]}
                  rows={6}
                  className="resize-none"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Plus votre description est détaillée, meilleur sera le résultat.
                </p>
              </CardContent>
            </Card>

            {/* Advanced config */}
            <Card>
              <CardContent className="pt-6">{renderAdvancedConfig()}</CardContent>
            </Card>
          </>
        )}

        {/* ─── MODE REPO ─── */}
        {mode === "repo" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Repository GitHub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL du repo</Label>
                  <Input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    required
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">{renderAdvancedConfig()}</CardContent>
            </Card>
          </>
        )}

        {/* ─── MODE EXISTING ─── */}
        {mode === "existing" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Site existant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL du site</Label>
                  <Input
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://monsite.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Repo Git (optionnel)</Label>
                  <Input
                    value={existingRepo}
                    onChange={(e) => setExistingRepo(e.target.value)}
                    placeholder="https://github.com/user/repo"
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">{renderAdvancedConfig()}</CardContent>
            </Card>
          </>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setMode(null)}>
            Retour
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer le site"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
