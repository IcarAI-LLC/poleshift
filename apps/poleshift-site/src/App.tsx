import { Suspense, lazy, type ReactElement } from "react";
import { Typewriter } from "@/components/ui/typewriter";
import { Button } from "@/components/ui/button";
import "./App.css";
import { FaWindows, FaApple, FaLinux } from "react-icons/fa";
import { SiSnapcraft } from "react-icons/si";

// Detect user OS up front (avoids reordering after first render)
function getUserPlatform() {
    if (typeof window === "undefined") {
        return "linux" as const;
    }
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes("Win")) return "windows" as const;
    if (userAgent.includes("Mac")) return "mac" as const;
    return "linux" as const;
}

// Pre-load your platform logic
const DMG = new URL(
    "https://releases.poleshift.cloud/poleshift_0.2.2_aarch64.dmg",
    import.meta.url
).href;
const AppImage = new URL(
    "https://releases.poleshift.cloud/poleshift_0.2.2_amd64.AppImage",
    import.meta.url
).href;
const MSI = new URL(
    "https://releases.poleshift.cloud/poleshift_0.2.2_x64_en-US.msi",
    import.meta.url
).href;

const SNAP_STORE_LINK = "https://snapcraft.io/poleshift";

// Define platforms
type PlatformId = "windows" | "mac" | "linux" | "snap";
interface Platform {
    id: PlatformId;
    label: string;
    link: string;
}

// All possible platforms
const allPlatforms: Platform[] = [
    { id: "windows", label: "Download for Windows", link: MSI },
    { id: "mac",     label: "Download for Mac",     link: DMG },
    { id: "linux",   label: "Download for Linux",   link: AppImage },
    { id: "snap",    label: "Download from Snap Store", link: SNAP_STORE_LINK },
];

const platformIcons: Record<PlatformId, ReactElement> = {
    windows: <FaWindows />,
    mac: <FaApple />,
    linux: <FaLinux />,
    snap: <SiSnapcraft />,
};

const texts = [" elegant", " intuitive", " fun", " your data"];

// Lazy-load the globe, but give it a sized fallback
const GlobeComponent = lazy(() => import("@/components/Globe.tsx"));

// Page metadata
export function meta() {
    return [
        { title: "Poleshift" },
        {
            name: "description",
            content: "Our scientific data management platform is launching soon.",
        },
    ];
}

export default function App() {
    // 1) Detect user platform once, no effect (avoids re-render shift)
    const userPlatform = getUserPlatform();

    // 2) Reorder platforms array so that user's platform is always first
    const primaryPlatform =
        allPlatforms.find((p) => p.id === userPlatform) ?? allPlatforms[2];
    const rest = allPlatforms.filter((p) => p.id !== primaryPlatform.id);
    const platformsInOrder = [primaryPlatform, ...rest];

    return (
        <main className="relative h-screen w-screen overflow-auto bg-background text-foreground">
            <section className="relative z-10 grid h-screen grid-cols-1 md:grid-cols-2 items-center justify-items-center overflow-hidden">
                {/* Left Column: Text */}
                <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 pb-10">
                    <p className="font-mono text-3xl font-semibold">Poleshift data is</p>
                    <p className="mt-2 text-sm font-semibold text-base-900">
                        <Typewriter texts={texts} delay={0.5} baseText="" />
                    </p>

                    {/* Buttons in a single column */}
                    {platformsInOrder.length > 0 && (
                        <div className="m-16 flex flex-col items-center gap-3 w-full max-w-sm">
                            {platformsInOrder.map((platform) => (
                                <Button
                                    key={platform.id}
                                    variant="default"
                                    asChild
                                    className="w-full flex justify-center gap-2"
                                >
                                    <a
                                        href={platform.link}
                                        className="flex items-center gap-2 justify-center"
                                    >
                                        {platformIcons[platform.id]}
                                        {platform.label}
                                    </a>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Globe */}
                <div className="flex items-center justify-center w-full h-full">
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    width: 800,
                                    height: 800,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <p>Loading globe...</p>
                            </div>
                        }
                    >
                        <GlobeComponent />
                    </Suspense>
                </div>
            </section>

            {/* Footer */}
            <footer className="fixed bottom-0 w-full text-xs text-center p-2 z-30">
                &copy; {new Date().getFullYear()} IcarAI LLC. All rights reserved.&nbsp;
                <a
                    href="https://icarai.io"
                    className="text-fuchsia-600 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                >
                    icarai.io
                </a>
            </footer>
        </main>
    );
}
