import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Property Walkthrough",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Walkthrough" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function WalkthroughLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wt-viewer-root h-[100dvh] w-full overflow-hidden bg-black touch-manipulation">
      {children}
    </div>
  );
}
