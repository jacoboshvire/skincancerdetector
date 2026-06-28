"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ReactLenis } from "lenis/react";
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll } from "framer-motion";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import Cursor from "@/components/landing/Cursor";
import Magnetic from "@/components/landing/Magnetic";
import { useFixedOnScroll } from "@/lib/useFixedOnScroll";

const HeroScene = dynamic(() => import("@/components/landing/HeroScene"), { ssr: false });

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6h10M9 12h10M9 18h10" />
      <path d="M4.5 6l1 1 1.5-2M4.5 12l1 1 1.5-2M4.5 18l1 1 1.5-2" />
    </svg>
  );
}

type DemoStepId = "upload" | "photo" | "scanning" | "result";

const DEMO_STEPS: { id: DemoStepId; duration: number }[] = [
  { id: "upload", duration: 1600 },
  { id: "photo", duration: 1100 },
  { id: "scanning", duration: 2200 },
  { id: "result", duration: 2400 },
];

function useDemoStep(): DemoStepId {
  const [stepId, setStepId] = useState<DemoStepId>(DEMO_STEPS[0].id);

  useEffect(() => {
    let index = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    const advance = () => {
      timeoutId = setTimeout(() => {
        index = (index + 1) % DEMO_STEPS.length;
        setStepId(DEMO_STEPS[index].id);
        advance();
      }, DEMO_STEPS[index].duration);
    };
    advance();
    return () => clearTimeout(timeoutId);
  }, []);

  return stepId;
}

const LESION_SWATCH = "radial-gradient(circle at 35% 35%, #8a5a36, #4a2e1a 70%)";

function StatusIcons() {
  return (
    <div className="flex items-center gap-1 text-foreground/80">
      <svg viewBox="0 0 18 12" className="w-[13px] h-[9px]" fill="currentColor">
        <rect x="0" y="7" width="3" height="5" rx="0.5" />
        <rect x="5" y="5" width="3" height="7" rx="0.5" />
        <rect x="10" y="3" width="3" height="9" rx="0.5" />
        <rect x="15" y="0" width="3" height="12" rx="0.5" />
      </svg>
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M5 9a10 10 0 0 1 14 0" />
        <path d="M8 12.5a6 6 0 0 1 8 0" />
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
      </svg>
      <svg viewBox="0 0 24 12" className="w-[20px] h-[10px]" fill="none" stroke="currentColor" strokeWidth={1}>
        <rect x="1" y="1" width="19" height="10" rx="2.5" />
        <rect x="3" y="3" width="14" height="6" rx="1.5" fill="currentColor" stroke="none" />
        <rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

function DemoScreenContent() {
  const step = useDemoStep();

  return (
    <AnimatePresence mode="wait">
      {step === "upload" && (
        <motion.div
          key="upload"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-foreground/25 flex items-center justify-center mb-3">
            <CameraIcon className="w-7 h-7 text-foreground/35" />
          </div>
          <p className="text-xs text-foreground/50">Upload a lesion photo</p>
        </motion.div>
      )}

      {step === "photo" && (
        <motion.div
          key="photo"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-28 h-28 rounded-full shadow-inner" style={{ background: LESION_SWATCH }} />
          <p className="text-[11px] text-foreground/40 mt-3">lesion_photo.jpg</p>
        </motion.div>
      )}

      {step === "scanning" && (
        <motion.div
          key="scanning"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center text-center"
        >
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full" style={{ background: LESION_SWATCH }} />
            <motion.div
              className="absolute -inset-2 rounded-full border-2 border-dashed"
              style={{ borderColor: "var(--primary)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <motion.p
            className="text-xs text-foreground/50 mt-3"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            Analyzing…
          </motion.p>
        </motion.div>
      )}

      {step === "result" && (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center text-center w-full"
        >
          <div className="w-12 h-12 rounded-full bg-accent-green flex items-center justify-center mb-3">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-accent-green">Likely benign</p>
          <p className="text-xs text-foreground/50 mt-1">96% confidence</p>
          <div className="w-full h-1.5 rounded-full bg-foreground/10 mt-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent-green"
              initial={{ width: "0%" }}
              animate={{ width: "96%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PhoneFrame() {
  return (
    <div className="relative mx-auto w-[250px] sm:w-[270px]">
      {/* Side buttons */}
      <div className="absolute -left-[2px] top-[88px] w-[3px] h-7 bg-neutral-700 rounded-l-sm" />
      <div className="absolute -left-[2px] top-[124px] w-[3px] h-11 bg-neutral-700 rounded-l-sm" />
      <div className="absolute -right-[2px] top-[104px] w-[3px] h-14 bg-neutral-700 rounded-r-sm" />

      {/* Bezel */}
      <div className="relative rounded-[2.6rem] bg-neutral-900 p-[10px] shadow-2xl ring-1 ring-black/20">
        {/* Screen */}
        <div className="relative rounded-[2.1rem] bg-background overflow-hidden">
          {/* Dynamic island */}
          <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-20 h-[22px] bg-black rounded-full z-10" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-foreground/80">
            <span>9:41</span>
            <StatusIcons />
          </div>

          <div className="relative h-[320px] sm:h-[400px] bg-foreground/5 overflow-hidden flex flex-col items-center justify-center px-4">
            <DemoScreenContent />
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-28 h-1 rounded-full bg-foreground/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabletFrame() {
  return (
    <div className="relative mx-auto w-[230px] sm:w-[320px]">
      {/* Power button */}
      <div className="absolute -top-[2px] right-12 w-7 h-[3px] bg-neutral-700 rounded-t-sm" />

      {/* Bezel */}
      <div className="relative rounded-[1.4rem] bg-neutral-900 p-[12px] shadow-2xl ring-1 ring-black/20">
        {/* Screen */}
        <div className="relative rounded-[0.6rem] bg-background overflow-hidden">
          {/* Camera dot */}
          <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] bg-black rounded-full z-10" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[11px] font-semibold text-foreground/80">
            <span>9:41</span>
            <StatusIcons />
          </div>

          <div className="relative h-[300px] sm:h-[400px] bg-foreground/5 overflow-hidden flex flex-col items-center justify-center px-4">
            <DemoScreenContent />
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-24 h-1 rounded-full bg-foreground/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LaptopFrame() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[420px]">
      {/* Screen */}
      <div className="relative rounded-t-[0.9rem] bg-neutral-900 p-[8px] shadow-2xl">
        {/* Camera dot */}
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-neutral-700 rounded-full z-10" />

        <div className="relative rounded-[0.3rem] bg-background overflow-hidden">
          {/* Browser-style top strip */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-foreground/10">
            <span className="w-2 h-2 rounded-full bg-accent-red" />
            <span className="w-2 h-2 rounded-full bg-accent-amber" />
            <span className="w-2 h-2 rounded-full bg-accent-green" />
          </div>

          <div className="relative h-[180px] sm:h-[250px] bg-foreground/5 overflow-hidden flex flex-col items-center justify-center px-4">
            <DemoScreenContent />
          </div>
        </div>
      </div>

      {/* Base / keyboard deck */}
      <div className="relative h-[10px] sm:h-[14px] bg-neutral-800 rounded-b-xl -mx-2 sm:-mx-3">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 sm:w-16 h-[3px] bg-neutral-700 rounded-full" />
      </div>
    </div>
  );
}

type DeviceId = "phone" | "laptop" | "tablet";

const DEVICE_SEQUENCE: { id: DeviceId; duration: number; Frame: () => ReactElement }[] = [
  { id: "phone", duration: 6000, Frame: PhoneFrame },
  { id: "laptop", duration: 6000, Frame: LaptopFrame },
  { id: "tablet", duration: 6000, Frame: TabletFrame },
];

function useDeviceCycle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    const advance = () => {
      timeoutId = setTimeout(() => {
        i = (i + 1) % DEVICE_SEQUENCE.length;
        setIndex(i);
        advance();
      }, DEVICE_SEQUENCE[i].duration);
    };
    advance();
    return () => clearTimeout(timeoutId);
  }, []);

  return DEVICE_SEQUENCE[index];
}

function LiveDemo() {
  const { id, Frame } = useDeviceCycle();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <Frame />
      </motion.div>
    </AnimatePresence>
  );
}

function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 18);
    rotateX.set(py * -18);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={reset} className="relative [perspective:1200px]">
      <div className="absolute inset-0 -m-2 sm:-m-10 pointer-events-none" aria-hidden>
        <HeroScene />
      </div>
      <motion.div style={{ rotateX: springRotateX, rotateY: springRotateY }} className="relative [transform-style:preserve-3d]">
        <LiveDemo />
      </motion.div>
    </div>
  );
}

function Preloader({ done }: { done: boolean }) {
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-background"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="font-bold text-2xl flex items-center gap-2 tracking-tight"
          >
            SkinScan<span className="text-muted">^</span>
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const FEATURES = [
  {
    title: "Instant results",
    body: "Get a clear risk read on a skin lesion in seconds, no appointment or waiting room needed.",
    icon: LightningIcon,
  },
  {
    title: "100% private",
    body: "Your photos are analyzed securely and never shared. Nothing leaves your control unless you choose to save a result.",
    icon: ShieldIcon,
  },
  {
    title: "Secure by design",
    body: "Your account and saved history are protected with strong encryption and two-step verification.",
    icon: LockIcon,
  },
];

const STEPS = [
  {
    title: "Upload a photo",
    body: "Snap or upload a clear photo of the lesion you're concerned about.",
    icon: CameraIcon,
  },
  {
    title: "Get instant analysis",
    body: "Your photo is screened against seven common lesion categories in seconds.",
    icon: LightningIcon,
  },
  {
    title: "Know your next step",
    body: "See a clear risk breakdown and save it to your medical record to track over time.",
    icon: ChecklistIcon,
  },
];

const TRUST_PILLS = ["Instant results", "100% private", "Free to use"];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const HEADLINE_PLAIN = ["Early", "skin", "lesion", "screening,"];
const HEADLINE_GRADIENT = ["made", "effortless"];

const headlineContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const headlineWord = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const { scrollYProgress } = useScroll();
  const { ref: headerRef, scrolled, height: headerHeight } = useFixedOnScroll();

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2 }}>
      <Preloader done={loaded} />
      <Cursor />
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[2px] z-[150] origin-left bg-foreground"
        style={{ scaleX: scrollYProgress }}
      />
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      {scrolled && <div style={{ height: headerHeight }} aria-hidden />}
      <header
        ref={headerRef}
        className={`z-30 glass-header transition-all duration-300 ${
          scrolled
            ? "fixed top-[2%] left-1/2 -translate-x-1/2 w-[94%] max-w-[1300px] rounded-xl border border-foreground/15 shadow-xl"
            : "relative w-full border-b border-foreground/15"
        }`}
      >
        <div className="max-w-[1300px] mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg flex items-center gap-1 tracking-tight">
            SkinScan<span className="text-muted">^</span>
          </span>
          <nav className="flex gap-2 nav-mono items-center">
            <Link
              href="/login"
              transitionTypes={["nav-forward"]}
              data-cursor-hover
              className="px-3 py-2 hover:bg-foreground/5 transition-colors"
            >
              Log in
            </Link>
            <Magnetic>
              <Link
                href="/register"
                transitionTypes={["nav-forward"]}
                className="px-4 py-2 btn-solid block"
              >
                Sign up
              </Link>
            </Magnetic>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative w-full py-20 sm:py-24 overflow-hidden grid-lines">
          <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[40rem] h-[40rem] rounded-full border border-foreground/10" />
            <div className="absolute w-[28rem] h-[28rem] rounded-full border border-foreground/10" />
          </div>

          <div className="relative max-w-[1300px] mx-auto px-6 grid sm:grid-cols-2 gap-12 items-center">
            <div className="text-center sm:text-left">
              <motion.h1
                initial="hidden"
                animate="show"
                variants={headlineContainer}
                className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05]"
              >
                {HEADLINE_PLAIN.map((word, i) => (
                  <motion.span
                    key={`plain-${i}`}
                    variants={headlineWord}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="inline-block mr-[0.25em]"
                  >
                    {word}
                  </motion.span>
                ))}
                {HEADLINE_GRADIENT.map((word, i) => (
                  <motion.span
                    key={`gradient-${i}`}
                    variants={headlineWord}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="inline-block mr-[0.25em] text-muted"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>
              <motion.p
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="mt-6 text-lg text-foreground/70 max-w-xl mx-auto sm:mx-0"
              >
                Upload a photo of a skin lesion and get an instant risk
                assessment across seven common lesion categories, including
                melanoma, basal cell carcinoma, and actinic keratoses.
              </motion.p>
              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="mt-8 flex gap-3 justify-center sm:justify-start"
              >
                <Magnetic>
                  <Link
                    href="/register"
                    transitionTypes={["nav-forward"]}
                    className="block px-7 py-3.5 btn-solid text-sm"
                  >
                    Get started
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    href="/login"
                    transitionTypes={["nav-forward"]}
                    className="block px-7 py-3.5 border border-foreground/25 nav-mono text-sm hover:bg-foreground/5"
                  >
                    I already have an account
                  </Link>
                </Magnetic>
              </motion.div>
              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="mt-6 flex flex-wrap gap-2 justify-center sm:justify-start"
              >
                {TRUST_PILLS.map((label) => (
                  <span key={label} className="tag-mono">
                    {label}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="relative mt-10 sm:mt-0"
            >
              <HeroVisual />
            </motion.div>
          </div>
        </section>

        <section className="max-w-[1300px] mx-auto px-6 py-12 grid sm:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 36, scale: 0.92, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="border border-foreground/15 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <f.icon className="w-6 h-6" />
                <span className="nav-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h2 className="font-bold text-lg mb-2">{f.title}</h2>
              <p className="text-sm text-muted">{f.body}</p>
            </motion.div>
          ))}
        </section>

        <section className="max-w-[1300px] mx-auto px-6 py-12">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight"
          >
            How it <span className="gradient-text">works</span>
          </motion.h2>
          <div className="mt-12 grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 36, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                className="text-center"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl btn-gradient text-primary-foreground flex items-center justify-center mb-4 shadow-glow">
                  <s.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg mb-1">
                  {i + 1}. {s.title}
                </h3>
                <p className="text-sm text-foreground/70">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="max-w-[1300px] mx-auto px-6 py-12">
          <div className="rounded-2xl border border-foreground/15 bg-foreground/5 p-6 text-sm leading-relaxed">
            <strong className="block mb-1">Not a medical device.</strong>
            SkinScan is an educational demonstration of applying machine
            learning to dermoscopic images. It is not FDA-cleared, has not
            been clinically validated, and must never be used as a substitute
            for evaluation by a licensed dermatologist or physician. If you
            are concerned about a skin lesion, seek professional medical care.
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10 py-6 text-center text-sm text-foreground/60">
        © Copyright by Ejiro Jacob Oshevire and built by Ejiro Jacob Oshevire
      </footer>
      </div>
    </ReactLenis>
  );
}
