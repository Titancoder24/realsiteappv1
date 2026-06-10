"use client";

import { Camera, Box, Smartphone, Sparkles, Clapperboard, ArrowRight } from "lucide-react";
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
  nextLabel: string;
};

const walkthroughOptions: ExperienceOption[] = [
  {
    type: "mobile_360_capture",
    title: "Mobile 360° Capture",
    description: "Guided room-by-room capture with your phone. No 360 camera required.",
    badge: "Mobile",
    icon: Smartphone,
    steps: "Rooms → capture → connect → publish",
    nextLabel: "Start capture",
  },
  {
    type: "360_realistic",
    title: "360° Panorama Tour",
    description: "Upload existing 360° panoramas and connect rooms with spatial annotations.",
    badge: "Upload",
    icon: Camera,
    steps: "Panoramas → rooms → hotspots → publish",
    nextLabel: "Open tour builder",
  },
  {
    type: "worldlabs_splat",
    title: "3D Walkthrough",
    description: "Generate an explorable 3D world from multiple listing photos via World Labs.",
    badge: "World Labs",
    icon: Box,
    steps: "Media → generate → review → publish",
    nextLabel: "Open 3D builder",
  },
  {
    type: "immersive_world",
    title: "Immersive World",
    description: "Single-photo to explorable 3D environment. Fast Echo generation pipeline.",
    badge: "Echo 3D",
    icon: Sparkles,
    steps: "Photo → 3D world → annotate → publish",
    nextLabel: "Open world builder",
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
  nextLabel: "Open Scene Studio",
};

function PickerCard({
  opt,
  active,
  disabled,
  loading,
  onContinue,
}: {
  opt: ExperienceOption;
  active: boolean;
  disabled?: boolean;
  loading?: boolean;
  onContinue: (type: ExperienceType) => void;
}) {
  const Icon = opt.icon;
  const featured = opt.type === "scene_intelligence";

  return (
    <div
      className={cn("picker-card group", featured && "picker-card-featured")}
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

      <button
        type="button"
        className="picker-next mt-4 flex w-full items-center justify-center gap-2"
        disabled={disabled || loading}
        onClick={() => onContinue(opt.type)}
      >
        {loading && active ? "Opening…" : opt.nextLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ExperienceTypeSelector({
  selected,
  onContinue,
  continuing,
  canContinue,
}: {
  selected?: ExperienceType;
  onContinue: (type: ExperienceType) => void;
  continuing?: boolean;
  canContinue?: boolean;
}) {
  const disabled = !canContinue;

  return (
    <div className="experience-picker space-y-6">
      <div>
        <p className="picker-section-label">Virtual tour engines</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {walkthroughOptions.map((opt) => (
            <PickerCard
              key={opt.type}
              opt={opt}
              active={selected === opt.type}
              disabled={disabled}
              loading={continuing && selected === opt.type}
              onContinue={onContinue}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="picker-section-label">Interactive listing viewer</p>
        <PickerCard
          opt={sceneIntelligenceOption}
          active={selected === sceneIntelligenceOption.type}
          disabled={disabled}
          loading={continuing && selected === sceneIntelligenceOption.type}
          onContinue={onContinue}
        />
      </div>
    </div>
  );
}
