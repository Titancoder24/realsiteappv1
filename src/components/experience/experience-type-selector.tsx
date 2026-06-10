"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Box, Smartphone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExperienceType } from "@/types/domain";

const options: { type: ExperienceType; title: string; description: string; badge: string; icon: typeof Camera }[] = [
  {
    type: "mobile_360_capture",
    title: "Mobile 360° Capture Walkthrough",
    description: "Walk through the property with your phone. Guided room-by-room capture — no 360 camera needed.",
    badge: "Mobile-first",
    icon: Smartphone,
  },
  {
    type: "360_realistic",
    title: "360° Realistic Experience",
    description: "Upload existing panoramas and room images. Best when you already have 360° photos.",
    badge: "Upload",
    icon: Camera,
  },
  {
    type: "worldlabs_splat",
    title: "Generate 3D Walkthrough",
    description: "World Labs pipeline — multi-image 3D world generation with marble viewer assets.",
    badge: "World Labs",
    icon: Box,
  },
  {
    type: "immersive_world",
    title: "Immersive World",
    description: "Turn a single property photo into an explorable 3D environment. Fast Echo generation from image.",
    badge: "Echo 3D",
    icon: Sparkles,
  },
];

export function ExperienceTypeSelector({
  selected,
  onSelect,
}: {
  selected?: ExperienceType;
  onSelect: (type: ExperienceType) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = selected === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => onSelect(opt.type)}
            className="text-left"
          >
            <Card className={cn("cursor-pointer transition-all hover:border-primary/50", active && "border-primary ring-2 ring-primary/20")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="h-8 w-8 text-primary" />
                  <Badge>{opt.badge}</Badge>
                </div>
                <CardTitle className="mt-4">{opt.title}</CardTitle>
                <CardDescription>{opt.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {opt.type === "mobile_360_capture"
                    ? "Choose rooms → capture with phone → connect → publish"
                    : opt.type === "360_realistic"
                      ? "Upload panoramas → create rooms → add hotspots → publish"
                      : opt.type === "immersive_world"
                        ? "Upload photo → generate 3D world → annotate → publish"
                        : "Upload media → generate 3D world → review → publish"}
                </p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
