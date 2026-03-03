"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import Link from "next/link";

type AffiliateRow = {
  name: string;
  url: string;
  commission: string;
  category: string;
};

type StepStatus = "pending" | "in_progress" | "done" | "error";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
  error?: string;
};

const INITIAL_STEPS: Omit<Step, "status">[] = [
  { key: "supabase", label: "Creation du site en base..." },
  { key: "github", label: "Creation du repo GitHub..." },
  { key: "config", label: "Generation de la configuration..." },
  { key: "vercel", label: "Deploiement Vercel..." },
  { key: "articles", label: "Generation de 50 articles..." },
  { key: "update", label: "Finalisation..." },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CreateSitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  // Progress tracking
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<{
    siteId?: string;
    repoUrl?: string;
    siteUrl?: string;
    articlesQueued?: number;
  } | null>(null);

  // General
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [niche, setNiche] = useState("");
  const [description, setDescription] = useState("");

  // Affiliation
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);

  // Social
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [pinterest, setPinterest] = useState("");
  const [tiktok, setTiktok] = useState("");

  // Monetization
  const [adsenseId, setAdsenseId] = useState("");
  const [autoAds, setAutoAds] = useState(false);

  // Newsletter
  const [resendAudienceId, setResendAudienceId] = useState("");

  // Config
  const [articlesPerDay, setArticlesPerDay] = useState(3);
  const [autoSocial, setAutoSocial] = useState(true);
  const [autoNewsletter, setAutoNewsletter] = useState(true);

  // Technical
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [accentColor, setAccentColor] = useState("#10b981");

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  function addAffiliateRow() {
    setAffiliates([...affiliates, { name: "", url: "", commission: "", category: "" }]);
  }

  function removeAffiliateRow(index: number) {
    setAffiliates(affiliates.filter((_, i) => i !== index));
  }

  function updateAffiliateRow(index: number, field: keyof AffiliateRow, value: string) {
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

  const markNextInProgress = useCallback(
    (currentKey: string) => {
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
    },
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !niche.trim()) {
      toast.error("Name, slug, and niche are required.");
      return;
    }

    // Initialize steps and switch to progress view
    setSteps(
      INITIAL_STEPS.map((s, i) => ({
        ...s,
        status: i === 0 ? "in_progress" : "pending",
      }))
    );
    setResult(null);
    setCreating(true);
    setLoading(true);

    try {
      const res = await fetch("/api/create-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          niche: niche.trim(),
          domain: domain.trim() || undefined,
          description: description.trim() || undefined,
          affiliates,
          instagram: instagram.trim() || undefined,
          twitter: twitter.trim() || undefined,
          linkedin: linkedin.trim() || undefined,
          pinterest: pinterest.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          adsense_id: adsenseId.trim() || undefined,
          auto_ads: autoAds,
          resend_audience_id: resendAudienceId.trim() || undefined,
          articles_per_day: articlesPerDay,
          auto_social: autoSocial,
          auto_newsletter: autoNewsletter,
          primary_color: primaryColor,
          accent_color: accentColor,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

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
            const event = JSON.parse(line);

            if (event.step === "complete") {
              setResult({
                siteId: event.siteId,
                repoUrl: event.repoUrl,
                siteUrl: event.siteUrl,
                articlesQueued: event.articlesQueued,
              });
              continue;
            }

            if (event.status === "done") {
              updateStepStatus(event.step, "done");
              markNextInProgress(event.step);
            } else if (event.status === "error") {
              updateStepStatus(event.step, "error", event.error);
              markNextInProgress(event.step);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create site";
      toast.error(message);
      setCreating(false);
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
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">OK</Badge>;
      case "error":
        return <Badge variant="destructive">Erreur</Badge>;
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  }

  // Progress view
  if (creating) {
    const hasErrors = steps.some((s) => s.status === "error");
    const allDone = !loading;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Creation du site</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progression</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step) => (
              <div key={step.key} className="flex items-center gap-3">
                {getStepIcon(step.status)}
                <span className="flex-1 text-sm">{step.label}</span>
                {getStepBadge(step.status)}
              </div>
            ))}

            {steps.filter((s) => s.status === "error").map((step) => (
              <div
                key={`error-${step.key}`}
                className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                <strong>{step.label.replace("...", "")}</strong>: {step.error}
              </div>
            ))}
          </CardContent>
        </Card>

        {allDone && result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {hasErrors ? "Creation partielle" : "Site cree avec succes !"}
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
                  <strong>Vercel :</strong>{" "}
                  <a
                    href={result.siteUrl}
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
                    Voir le site
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sites">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create Site</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Affiliate Site"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(true);
                  }}
                  placeholder="my-affiliate-site"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niche">Niche</Label>
                <Input
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="tech, health, finance..."
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the site..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Affiliation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Affiliation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {affiliates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No affiliate programs added yet.
              </p>
            )}
            {affiliates.map((affiliate, index) => (
              <div key={index} className="space-y-3">
                {index > 0 && <Separator />}
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Program Name</Label>
                      <Input
                        value={affiliate.name}
                        onChange={(e) => updateAffiliateRow(index, "name", e.target.value)}
                        placeholder="Amazon Associates"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">URL</Label>
                      <Input
                        value={affiliate.url}
                        onChange={(e) => updateAffiliateRow(index, "url", e.target.value)}
                        placeholder="https://affiliate.example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Commission</Label>
                      <Input
                        value={affiliate.commission}
                        onChange={(e) => updateAffiliateRow(index, "commission", e.target.value)}
                        placeholder="5-10%"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Input
                        value={affiliate.category}
                        onChange={(e) => updateAffiliateRow(index, "category", e.target.value)}
                        placeholder="Electronics"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-5 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAffiliateRow(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addAffiliateRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add program
            </Button>
          </CardContent>
        </Card>

        {/* Social */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Social</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@handle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter">Twitter / X</Label>
                <Input
                  id="twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@handle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="company/page-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinterest">Pinterest</Label>
                <Input
                  id="pinterest"
                  value={pinterest}
                  onChange={(e) => setPinterest(e.target.value)}
                  placeholder="@handle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktok">TikTok</Label>
                <Input
                  id="tiktok"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="@handle"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monetization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monetization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adsense_id">AdSense ID</Label>
                <Input
                  id="adsense_id"
                  value={adsenseId}
                  onChange={(e) => setAdsenseId(e.target.value)}
                  placeholder="ca-pub-1234567890"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="auto_ads"
                  checked={autoAds}
                  onCheckedChange={setAutoAds}
                />
                <Label htmlFor="auto_ads">Auto Ads</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Newsletter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Newsletter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="resend_audience_id">Audience ID</Label>
              <Input
                id="resend_audience_id"
                value={resendAudienceId}
                onChange={(e) => setResendAudienceId(e.target.value)}
                placeholder="aud_xxxxxxxx"
              />
            </div>
          </CardContent>
        </Card>

        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Config</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Articles per day</Label>
                <span className="font-mono text-sm font-medium">{articlesPerDay}</span>
              </div>
              <Slider
                value={[articlesPerDay]}
                onValueChange={([v]) => setArticlesPerDay(v)}
                min={1}
                max={10}
                step={1}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="auto_social">Auto Social Posting</Label>
              <Switch
                id="auto_social"
                checked={autoSocial}
                onCheckedChange={setAutoSocial}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto_newsletter">Auto Newsletter</Label>
              <Switch
                id="auto_newsletter"
                checked={autoNewsletter}
                onCheckedChange={setAutoNewsletter}
              />
            </div>
          </CardContent>
        </Card>

        {/* Technical */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="primary_color"
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
                <Label htmlFor="accent_color">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="accent_color"
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
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/sites">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Site"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
