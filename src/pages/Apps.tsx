import { QuickAccessPanel } from "@/components/apps/QuickAccessPanel";
import { ScreenTimePanel } from "@/components/apps/ScreenTimePanel";
import { PageHeader } from "@/components/PageHeader";

/**
 * The App page (owner's sketch): Quick Access on the left, your apps and sites as a grid of icons A-Z;
 * Screen Time on the right, a placeholder until tracking is built.
 */
export default function AppsPage() {
  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-3">
      <PageHeader title="App" summary="Your apps and sites, one click away." />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
        <QuickAccessPanel />
        <ScreenTimePanel />
      </div>
    </div>
  );
}
