"use client";

export default function HeartButton({
 active,
 onToggle,
 size = "md",
}: {
 active: boolean;
 onToggle: () => void;
 size?: "sm" | "md";
}) {
 return (
 <button
 type="button"
 onClick={onToggle}
 aria-label={active ? "Remove from favorites" : "Add to favorites"}
 title={active ? "Remove from favorites" : "Add to favorites"}
 className={`transition-colors ${
 active ? "text-accent-pink" : "text-foreground/30 hover:text-pink-400"
 }`}
 >
 <svg
 viewBox="0 0 24 24"
 fill={active ? "currentColor" : "none"}
 stroke="currentColor"
 strokeWidth={2}
 className={size === "sm" ? "w-4 h-4" : "w-5 h-5"}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M12 21s-7.5-4.873-10-9.428C.21 8.36 1.5 4.5 5.25 4.5c2.1 0 3.6 1.2 4.5 2.7.9-1.5 2.4-2.7 4.5-2.7 3.75 0 5.04 3.86 3.25 7.072C19.5 16.127 12 21 12 21z"
 />
 </svg>
 </button>
 );
}
