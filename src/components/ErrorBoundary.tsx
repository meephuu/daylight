import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fill the whole window (for the outermost boundary) instead of just the page area. */
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a crash while rendering and shows what happened with a Reload button, instead of leaving
 * a blank screen. The page-level boundary is keyed by route, so moving to another page recovers.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Page crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${
          this.props.fullScreen ? "h-screen" : "min-h-[60vh]"
        }`}
      >
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }
}
