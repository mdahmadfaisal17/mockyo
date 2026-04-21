import { Component, ReactNode } from "react";
import { AlertTriangle, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  statusCode: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      statusCode: 500,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || "An unexpected error occurred",
      statusCode: 500,
    };
  }

  componentDidCatch(error: Error) {
    console.error("Error caught by boundary:", error);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
      statusCode: 500,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>
            <h1 className="mb-2 text-4xl font-bold">Something went wrong</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              We encountered an unexpected error. Our team has been notified.
            </p>
            <p className="mb-6 text-xs text-muted-foreground/50">
              Error ID: {Date.now()}
            </p>
            <button
              onClick={() => {
                this.resetError();
                window.location.href = "/";
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
