"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Box, Smartphone, Sparkles, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExperienceType } from "@/types/domain";

type ExperienceOption = {
  type: ExperienceType;
  title: string;
  description: string;
  badge: string;
  icon: typeof Camera;
  steps: string;
};

const walkthroughOptions: ExperienceOption[] = [
  {
    type: "mobile_360_capture",
    title: "Mobile 360° Capture Walkthrough",
    description: "Walk through the property with your phone. Guided room-by-room capture — no 360 camera needed.",
    badge: "Mobile-first",
    icon: Smartphone,
    steps: "Choose rooms → capture with phone → connect → publish",
  },
  {
    type: "360_realistic",
    title: "360° Realistic Experience",
    description: "Upload existing panoramas and room images. Best when you already have 360° photos.",
    badge: "Upload",
    icon: Camera,
    steps: "Upload panoramas → create rooms → add hotspots → publish",
  },
  {
    type: "worldlabs_splat",
    title: "Generate 3D Walkthrough",
    description: "World Labs pipeline — multi-image 3D world generation with marble viewer assets.",
    badge: "World Labs",
    icon: Box,
    steps: "Upload media → generate 3D world → review → publish",
  },
  {
    type: "immersive_world",
    title: "Immersive World",
    description: "Turn a single property photo into an explorable 3D environment. Fast Echo generation from image.",
    badge: "Echo 3D",
    icon: Sparkles,
    steps: "Upload photo → generate 3D world → annotate → publish",
  },
];

const sceneIntelligenceOption: ExperienceOption = {
  type: "scene_intelligence",
  title: "Scene Intelligence Builder",
  description: "Upload listing photos, add cinematic motion, pin objects, and publish an interactive property viewer with AI knowledge.",
  badge: "New",
  icon: Clapperboard,
  steps: "Upload images → edit → motion → annotate → publish viewer",
};

function ExperienceCard({
  opt,
  active,
  onSelect,
  featured = false,
}: {
  opt: ExperienceOption;
  active: boolean;
  onSelect: (type: ExperienceType) => void;
  featured?: boolean;
}) {
  const Icon = opt.icon;
  return (
    <button type="button" onClick={() => onSelect(opt.type)} className="w-full text-left">
      <Card
        className={cn(
          "cursor-pointer transition-all hover:border-primary/50",
          active && "border-primary ring-2 ring-primary/20",
          featured && "border-dashed bg-muted/20",
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <Icon className="h-8 w-8 text-primary" />
            <Badge>{opt.badge}</Badge>
          </div>
          <CardTitle className="mt-4">{opt.title}</CardTitle>
          <CardDescription>{opt.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{opt.steps}</p>
        </CardContent>
      </Card>
    </button>
  );
}

export function ExperienceTypeSelector({
  selected,
  onSelect,
}: {
  selected?: ExperienceType;
  onSelect: (type: ExperienceType) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Virtual tour engines</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {walkthroughOptions.map((opt) => (
            <ExperienceCard key={opt.type} opt={opt} active={selected === opt.type} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Interactive listing viewer</p>
        <ExperienceCard
          opt={sceneIntelligenceOption}
          active={selected === sceneIntelligenceOption.type}
          onSelect={onSelect}
          featured
        />
      </div>
    </div>
  );
}
