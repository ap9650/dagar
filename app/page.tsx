import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, MASTERY_LABEL } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * Day 0 placeholder. Slice 1.1 replaces this with the real splash that redirects
 * by auth state (docs/SCREENS.md Flow 1).
 *
 * It exists now so the first Vercel deploy renders something real: it proves the
 * fonts load, the tokens resolve, and both scripts render at their correct sizes.
 */
export default function Home() {
  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-2xl flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1 text-ink">Saathi</h1>
        <p className="text-body text-body">
          Your learning companion. NCERT mathematics for Classes 6–8.
        </p>
        <p lang="hi" className="text-body">
          तुम्हारा साथी। कक्षा 6–8 के लिए गणित।
        </p>
      </header>

      <Card className="flex flex-col gap-lg">
        <div className="flex items-center justify-between gap-md">
          <h2 className="text-h3 text-ink">Fractions</h2>
          <Badge tone="developing">{MASTERY_LABEL.developing}</Badge>
        </div>
        <ProgressBar value={3} max={5} label="3 of 5 lessons" />
        <Button>Continue</Button>
      </Card>

      <p className="text-caption text-muted">
        Day 0 — setup verified. Screens land in slice 1.1.
      </p>
    </main>
  );
}
