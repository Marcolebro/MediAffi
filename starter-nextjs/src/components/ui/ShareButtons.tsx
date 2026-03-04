"use client";

import { Twitter, Facebook, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  title: string;
  url?: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

  const links = [
    {
      name: "Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Partager :</span>
      {links.map((link) => (
        <Button
          key={link.name}
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8"
        >
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Partager sur ${link.name}`}
          >
            <link.icon className="h-4 w-4" />
          </a>
        </Button>
      ))}
    </div>
  );
}
