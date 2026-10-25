import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Tailwind text colour class for the value and icon, e.g. "text-red-500". */
  accent?: string;
}

export function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-3xl font-semibold tabular-nums", accent)}>{value}</p>
        </div>
        <Icon className={cn("size-8 text-muted-foreground/60", accent)} />
      </CardContent>
    </Card>
  );
}
