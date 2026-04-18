import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    errorMessage: string;
}

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
    constructor(props: {children: React.ReactNode}) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, errorMessage: error.message || 'An unknown error occurred.' };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-goodwood-dark text-white p-6">
                    <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 max-w-lg w-full text-center">
                        <h2 className="text-2xl font-bold text-red-500 mb-4">Oops! Something went wrong.</h2>
                        <p className="text-gray-400 mb-6">
                            The application encountered an unexpected error. Please try refreshing the page.
                        </p>
                        <div className="bg-black/50 p-4 rounded text-left overflow-auto text-xs text-red-400 font-mono mb-6">
                            {this.state.errorMessage}
                        </div>
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
