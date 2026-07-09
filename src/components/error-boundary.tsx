"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorFallback } from "@/components/error-fallback";

interface Props {
    children: ReactNode;
    /** Optional custom fallback node. Defaults to <ErrorFallback />. */
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 *
 * Catches React rendering errors and delegates the fallback UI to the
 * shared `ErrorFallback` component (the same component used by every
 * route-level `error.tsx`). This is the single source of truth for
 * error presentation across the app — see P5-CONSOLIDATE.
 *
 * Note: As of the consolidation audit, this class component is not
 * imported anywhere in the app, but it is retained (and aligned with
 * the shared ErrorFallback) so that any future use of
 * `withErrorBoundary` renders the same premium fallback as route-level
 * error boundaries.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // Send to Sentry for production error monitoring. The client config
        // (sentry.client.config.ts) no-ops in development, so this is a safe
        // no-op outside production. Component stack is attached as extra
        // context so the Sentry UI can show the React subtree that threw.
        Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack },
        });

        // Log error to console (useful in development)
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Delegate to the shared ErrorFallback so visual treatment
            // matches every other error boundary in the app.
            return (
                <ErrorFallback
                    error={
                        this.state.error as Error & { digest?: string }
                    }
                    reset={this.handleReset}
                    module="This section"
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
): React.FC<P> {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}
