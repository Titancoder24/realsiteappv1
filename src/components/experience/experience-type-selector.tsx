"use client";

import { Camera, Box, Smartphone, Sparkles, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExperienceType } from "@/types/domain";
import "@/styles/scene-studio.css";

type ExperienceOption = {
  type: ExperienceType;
  title: string;
  description: string;
  badge: string;
  badgeVariant?: "default" | "new";
  icon: typeof Camera;
  steps: string;
};

const walkthroughOptions: ExperienceOption[] = [
  {
    type: "mobile_360_capture",
    title: "Mobile 360° Capture",
    description: "Guided room-by-room capture with your phone. No 360 camera required.",
    badge: "Mobile",
    icon: Smartphone,
    steps: "Rooms → capture → connect → publish",
  },
  {
    type: "360_realistic",
    title: "360° Panorama Tour",
    description: "Upload existing 360° panoramas and connect rooms with spatial annotations.",
    badge: "Upload",
    icon: Camera,
    steps: "Panoramas → rooms → hotspots → publish",
  },
  {
    type: "worldlabs_splat",
    title: "3D Walkthrough",
    description: "Generate an explorable 3D world from multiple listing photos via World Labs.",
    badge: "World Labs",
    icon: Box,
    steps: "Media → generate → review → publish",
  },
  {
    type: "immersive_world",
    title: "Immersive World",
    description: "Single-photo to explorable 3D environment. Fast Echo generation pipeline.",
    badge: "Echo 3D",
    icon: Sparkles,
    steps: "Photo → 3D world → annotate → publish",
  },
];

const sceneIntelligenceOption: ExperienceOption = {
  type: "scene_intelligence",
  title: "Scene Intelligence Builder",
  description: "Turn listing photos into cinematic motion scenes with object pins, AI knowledge, and an interactive buyer viewer.",
  badge: "Studio",
  badgeVariant: "new",
  icon: Clapperboard,
  steps: "Images → edit → motion → pins → publish",
};

function PickerCard({
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
      <div
        className={cn("picker-card", featured && "picker-card-featured")}
        data-active={active}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="picker-icon">
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn("picker-badge", opt.badgeVariant === "new" && "picker-badge-new")}>
            {opt.badge}
          </span>
        </div>
        <p className="picker-title">{opt.title}</p>
        <p className="picker-desc">{opt.description}</p>
        <p className="picker-steps">{opt.steps}</p>
      </div>
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
    <div className="experience-picker space-y-6">
      <div>
        <p className="picker-section-label">Virtual tour engines</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {walkthroughOptions.map((opt) => (
            <PickerCard key={opt.type} opt={opt} active={selected === opt.type} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <div>
        <p className="picker-section-label">Interactive listing viewer</p>
        <PickerCard
          opt={sceneIntelligenceOption}
          active={selected === sceneIntelligenceOption.type}
          onSelect={onSelect}
          featured
        />
      </div>
    </div>
  );
}
