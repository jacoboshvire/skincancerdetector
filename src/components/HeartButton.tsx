"use client";

import { motion } from "framer-motion";

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
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.8 }}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className={`transition-colors ${
        active ? "text-accent-pink" : "text-foreground/30 hover:text-accent-pink"
      }`}
    >
      <motion.svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        className={size === "sm" ? "w-4 h-4" : "w-5 h-5"}
        animate={active ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.87187 11.5983C1.79887 8.24832 3.05287 4.41932 6.56987 3.28632C8.41987 2.68932 10.4619 3.04132 11.9999 4.19832C13.4549 3.07332 15.5719 2.69332 17.4199 3.28632C20.9369 4.41932 22.1989 8.24832 21.1269 11.5983C19.4569 16.9083 11.9999 20.9983 11.9999 20.9983C11.9999 20.9983 4.59787 16.9703 2.87187 11.5983Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 6.70001C17.07 7.04601 17.826 8.00101 17.917 9.12201"
        />
      </motion.svg>
    </motion.button>
  );
}
