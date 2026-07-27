import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The page hit an unexpected error. Reload to continue, or sign in again if this keeps happening.
          </p>
          <Button type="button" onClick={() => window.location.assign("/")}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
