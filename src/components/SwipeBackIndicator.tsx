import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeBackIndicatorProps {
  progress: number;
  isTriggered: boolean;
  isSwiping: boolean;
}

export function SwipeBackIndicator({
  progress,
  isTriggered,
  isSwiping,
}: SwipeBackIndicatorProps) {
  if (!isSwiping && progress === 0) {
    return null;
  }

  // Smooth slide out from left: from -52px (offscreen) to +12px into the screen
  const translateX = progress * 64 - 52;
  const opacity = Math.min(1, progress * 1.8);
  const radius = 21;
  const circumference = 2 * Math.PI * radius; // ~131.95
  const strokeDashoffset = circumference * (1 - Math.min(1, progress));

  return (
    <div
      className="pointer-events-none fixed inset-y-0 left-0 z-50 flex items-center pl-3 select-none"
      aria-hidden="true"
    >
      <div
        className="relative flex size-12 items-center justify-center drop-shadow-lg transition-[transform,opacity] duration-150 ease-out"
        style={{
          transform: `translateX(${translateX}px) scale(${isTriggered ? 1.12 : 1})`,
          opacity,
        }}
      >
        {/* Unified SVG coordinate space centered at (24, 24) */}
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 48 48"
          fill="none"
        >
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className={cn(
              "transition-colors duration-150",
              isTriggered ? "fill-primary" : "fill-card"
            )}
          />

          {/* Track ring */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            strokeWidth="2.5"
            className={cn(
              "transition-colors duration-150",
              isTriggered ? "stroke-primary-foreground/20" : "stroke-border"
            )}
          />

          {/* Progress ring - rotated around exact center (24, 24) in SVG space */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 24 24)"
            className={cn(
              "transition-[stroke-dashoffset,stroke] duration-75",
              isTriggered ? "stroke-primary-foreground" : "stroke-primary"
            )}
          />
        </svg>

        {/* Direction arrow centered */}
        <ArrowLeft
          className={cn(
            "relative z-10 size-5 transition-colors duration-150",
            isTriggered ? "text-primary-foreground" : "text-foreground"
          )}
        />
      </div>
    </div>
  );
}
