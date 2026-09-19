import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[CodeLaunch ErrorBoundary]:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.reset);
      }
      return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Ocorreu um erro inesperado</h2>
            <p className="text-xs text-muted-foreground">
              Ocorreu um problema ao carregar esta tela. Você pode tentar novamente ou retornar.
            </p>
          </div>
          {this.state.error && (
            <pre className="w-full max-h-48 overflow-auto rounded-lg border border-border bg-muted p-3 text-left font-mono text-xs text-destructive">
              {this.state.error.message || String(this.state.error)}
              {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
            </pre>
          )}
          <Button onClick={this.reset} size="sm">
            <RotateCcw className="size-3.5" />
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
