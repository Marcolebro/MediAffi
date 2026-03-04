"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

type ProviderKeys = { gemini: boolean; anthropic: boolean; moonshot: boolean; openai: boolean };

type AIModel = {
  id: string;
  label: string;
  provider: "gemini" | "anthropic" | "moonshot" | "openai";
};

const ALL_MODELS: AIModel[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)", provider: "gemini" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)", provider: "gemini" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
  { id: "kimi-k2.5", label: "Kimi K2.5", provider: "moonshot" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
];

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  anthropic: "Anthropic",
  moonshot: "Moonshot",
  openai: "OpenAI",
};

const API_KEY_VARS = [
  { provider: "gemini" as const, key: "GEMINI_API_KEY", label: "Gemini API Key" },
  { provider: "anthropic" as const, key: "ANTHROPIC_API_KEY", label: "Anthropic API Key" },
  { provider: "moonshot" as const, key: "MOONSHOT_API_KEY", label: "Moonshot API Key" },
  { provider: "openai" as const, key: "OPENAI_API_KEY", label: "OpenAI API Key" },
];

const ENV_VARS = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon Key" },
] as const;

export default function SettingsPage() {
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // AI settings state
  const [providerKeys, setProviderKeys] = useState<ProviderKeys | null>(null);
  const [siteModel, setSiteModel] = useState("gemini-2.5-flash");
  const [articleModel, setArticleModel] = useState("gemini-2.5-flash");
  const [savingAI, setSavingAI] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
    }
    loadUser();
  }, [supabase]);

  useEffect(() => {
    async function loadAISettings() {
      const [keysRes, settingsRes] = await Promise.all([
        fetch("/api/settings/check-keys"),
        fetch("/api/settings"),
      ]);
      if (keysRes.ok) setProviderKeys(await keysRes.json());
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.default_site_model) setSiteModel(data.default_site_model);
        if (data.default_article_model) setArticleModel(data.default_article_model);
      }
    }
    loadAISettings();
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error("Failed to update password");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAI() {
    setSavingAI(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_site_model: siteModel,
          default_article_model: articleModel,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Paramètres IA sauvegardés");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingAI(false);
    }
  }

  function getAvailableModels(): AIModel[] {
    if (!providerKeys) return [];
    return ALL_MODELS.filter((m) => providerKeys[m.provider]);
  }

  function renderModelSelect(value: string, onChange: (v: string) => void, label: string) {
    const models = getAvailableModels();
    const grouped = models.reduce<Record<string, AIModel[]>>((acc, m) => {
      (acc[m.provider] ??= []).push(m);
      return acc;
    }, {});

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(grouped).map(([provider, models]) => (
              <SelectGroup key={provider}>
                <SelectLabel>{PROVIDER_LABELS[provider] || provider}</SelectLabel>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  function isConfigured(key: string): boolean {
    if (key === "NEXT_PUBLIC_SUPABASE_URL") {
      return !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
      return !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    return false;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ENV_VARS.map((envVar) => {
              const configured = isConfigured(envVar.key);
              return (
                <div
                  key={envVar.key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{envVar.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {envVar.key}
                    </p>
                  </div>
                  {configured ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <XCircle className="mr-1 h-3 w-3" />
                      Missing
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* IA & API */}
      <Card>
        <CardHeader>
          <CardTitle>IA & API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Clés API configurées</Label>
            {API_KEY_VARS.map((apiVar) => {
              const configured = providerKeys?.[apiVar.provider] ?? false;
              return (
                <div
                  key={apiVar.key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{apiVar.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {apiVar.key}
                    </p>
                  </div>
                  {configured ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Configurée
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <XCircle className="mr-1 h-3 w-3" />
                      Manquante
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Model Selection */}
          <div className="space-y-4">
            {renderModelSelect(siteModel, setSiteModel, "Modèle génération de sites")}
            {renderModelSelect(articleModel, setArticleModel, "Modèle rédaction d'articles")}
          </div>

          <Button onClick={handleSaveAI} disabled={savingAI}>
            {savingAI ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              "Sauvegarder"
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground">
              {email ?? "Loading..."}
            </p>
          </div>

          <Separator />

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <h3 className="text-sm font-medium">Change Password</h3>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
