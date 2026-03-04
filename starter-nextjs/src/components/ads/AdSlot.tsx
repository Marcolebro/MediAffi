"use client";

import { useEffect, useRef } from "react";
import adsConfig from "../../../site-data/ads.json";

interface AdSlotProps {
  placement: string;
}

export function AdSlot({ placement }: AdSlotProps) {
  const adRef = useRef<HTMLDivElement>(null);

  const slot = adsConfig.placements.find((p) => p.id === placement);

  useEffect(() => {
    if (!adsConfig.adsense_id || !slot?.enabled || !slot?.slot) return;

    try {
      // @ts-expect-error - Google AdSense global
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded
    }
  }, [slot]);

  if (!adsConfig.adsense_id || !slot?.enabled || !slot?.slot) {
    return null;
  }

  return (
    <div ref={adRef} className="my-4 flex justify-center">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={adsConfig.adsense_id}
        data-ad-slot={slot.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
