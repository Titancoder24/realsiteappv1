export type PropertyTemplate = "residential" | "office" | "rental";

export const ROOM_TEMPLATES: Record<PropertyTemplate, { label: string; rooms: string[] }> = {
  residential: {
    label: "Apartment / Home",
    rooms: ["Living Room", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Bathroom", "Balcony", "Entrance"],
  },
  office: {
    label: "Office / Corporate",
    rooms: ["Reception", "Open Workspace", "Meeting Room", "Cabin", "Pantry", "Corridor", "Breakout Area"],
  },
  rental: {
    label: "Rental Property",
    rooms: ["Exterior", "Hall", "Kitchen", "Bedroom", "Bathroom", "Parking", "Neighborhood View"],
  },
};

/** Legacy discrete angles — sphere capture uses continuous rotation instead. */
export const CAPTURE_ANGLES = [
  { id: "front", label: "Front", hint: "Face the main view of the room" },
  { id: "right", label: "Right", hint: "Turn slowly to your right" },
  { id: "back", label: "Back", hint: "Turn to face behind you" },
  { id: "left", label: "Left", hint: "Turn to your left" },
  { id: "doorway", label: "Doorway", hint: "Capture the doorway to the next area", optional: true },
] as const;

export type CaptureAngleId = (typeof CAPTURE_ANGLES)[number]["id"];
