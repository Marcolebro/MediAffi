"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createSponsor } from "@/lib/queries/newsletter";
import type { Site } from "@/lib/types/database";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type SponsorFormProps = {
  sites: Site[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function SponsorForm({
  sites,
  open,
  onOpenChange,
  onSuccess,
}: SponsorFormProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [placement, setPlacement] = useState<"top" | "middle" | "bottom">("top");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [price, setPrice] = useState("");

  function resetForm() {
    setSiteId("");
    setName("");
    setContent("");
    setLink("");
    setImageUrl("");
    setPlacement("top");
    setStartDate("");
    setEndDate("");
    setPrice("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!siteId || !name || !content || !link) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await createSponsor(supabase, {
        site_id: siteId,
        name,
        content,
        link,
        image_url: imageUrl || null,
        placement,
        start_date: startDate || null,
        end_date: endDate || null,
        price: price ? parseFloat(price) : null,
      });
      resetForm();
      onSuccess();
    } catch (err) {
      toast.error("Failed to create sponsor");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Sponsor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sponsor-site">Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger id="sponsor-site">
                <SelectValue placeholder="Select a site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsor-name">Name</Label>
            <Input
              id="sponsor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sponsor name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsor-content">Content</Label>
            <Textarea
              id="sponsor-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Sponsor ad copy / HTML content"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsor-link">Link</Label>
            <Input
              id="sponsor-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://sponsor-url.com"
              type="url"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsor-image">Image URL</Label>
            <Input
              id="sponsor-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              type="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsor-placement">Placement</Label>
            <Select
              value={placement}
              onValueChange={(v) => setPlacement(v as "top" | "middle" | "bottom")}
            >
              <SelectTrigger id="sponsor-placement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="middle">Middle</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sponsor-start">Start Date</Label>
              <Input
                id="sponsor-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sponsor-end">End Date</Label>
              <Input
                id="sponsor-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsor-price">Price</Label>
            <Input
              id="sponsor-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Sponsor"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
