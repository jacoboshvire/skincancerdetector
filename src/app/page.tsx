import Link from "next/link";

const FEATURES = [
  {
    title: "On-device inference",
    body: "Images are classified directly in your browser with TensorFlow.js — photos never leave your device unless you choose to save a result to your history.",
  },
  {
    title: "Trained on HAM10000",
    body: "The model is fine-tuned from MobileNetV2 on the HAM10000 dataset, 10,015 dermoscopic images across 7 lesion categories, the standard public benchmark for this task.",
  },
  {
    title: "Secured with JWT + MFA",
    body: "Accounts are protected by password + email one-time-code verification, with short-lived JWT sessions stored in httpOnly cookies.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold text-lg">SkinScan</span>
          <nav className="flex gap-4 text-sm">
            <Link href="/login" className="px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10">
              Log in
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 rounded bg-foreground text-background hover:opacity-90"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Early-stage skin lesion screening, powered by your browser
          </h1>
          <p className="mt-6 text-lg text-black/70 dark:text-white/70 max-w-2xl mx-auto">
            Upload a photo of a skin lesion and get an instant, on-device risk
            assessment across the seven HAM10000 lesion categories — including
            melanoma, basal cell carcinoma, and actinic keratoses.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-md bg-foreground text-background font-medium hover:opacity-90"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-md border border-black/15 dark:border-white/20 font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12 grid sm:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-black/10 dark:border-white/10 p-6">
              <h2 className="font-semibold mb-2">{f.title}</h2>
              <p className="text-sm text-black/70 dark:text-white/70">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm leading-relaxed">
            <strong className="block mb-1">Not a medical device.</strong>
            SkinScan is an educational demonstration of applying machine
            learning to dermoscopic images. It is not FDA-cleared, has not
            been clinically validated, and must never be used as a substitute
            for evaluation by a licensed dermatologist or physician. If you
            are concerned about a skin lesion, seek professional medical care.
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 dark:border-white/10 py-6 text-center text-sm text-black/60 dark:text-white/60">
        Built with Next.js &amp; TensorFlow.js · Model trained on the HAM10000
        dataset
      </footer>
    </div>
  );
}
