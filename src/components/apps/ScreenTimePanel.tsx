import { Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Screen Time on the App page: a placeholder for now. When tracking arrives, its data goes through a
 * `hooks/useScreenTime` hook (lib/db/screenTime for the SQL, like every other domain) and the content
 * replaces the empty state below; the pane, its title and its place on the page stay as they are.
 */
export function ScreenTimePanel() {
  return (
    <Card className="min-h-[320px] min-w-0">
      <CardHeader>
        <CardTitle>Screen Time</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 pb-6 text-center">
        <Hourglass className="size-5 text-muted-foreground/80" aria-hidden="true" />
        <p className="max-w-[30ch] text-sm text-muted-foreground">Time spent in each app will show here.</p>
      </CardContent>
    </Card>
  );
}
