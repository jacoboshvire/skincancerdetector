"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { damping: 25, stiffness: 300, mass: 0.5 });
  const ringY = useSpring(y, { damping: 25, stiffness: 300, mass: 0.5 });

  useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || reducedMotion) return;

    document.body.classList.add("cursor-none");
    setEnabled(true);

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setHovering(!!target.closest("a, button, [data-cursor-hover]"));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    return () => {
      document.body.classList.remove("cursor-none");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 z-[200] w-2 h-2 rounded-full bg-primary pointer-events-none"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
      />
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 z-[200] rounded-full border pointer-events-none overflow-hidden"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          borderColor: "var(--primary)",
        }}
        animate={{
          width: hovering ? 56 : 28,
          height: hovering ? 56 : 28,
          opacity: hovering ? 0.6 : 0.35,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ background: "var(--primary)" }}
          animate={{ opacity: hovering ? 0.15 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      </motion.div>
    </>
  );
}
