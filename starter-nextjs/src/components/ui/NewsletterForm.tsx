"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface NewsletterFormProps {
  title?: string;
  description?: string;
}

export function NewsletterForm({
  title = "Restez informé",
  description = "Recevez les meilleurs bonus et offres exclusives.",
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Veuillez entrer une adresse email valide.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Inscription réussie ! Bienvenue.");
        setEmail("");
      } else {
        toast.error(data.error ?? "Une erreur est survenue.");
      }
    } catch {
      toast.error("Impossible de se connecter au serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-8 rounded-lg border border-border/50 bg-card p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "..." : "S'inscrire"}
        </Button>
      </form>
    </div>
  );
}
