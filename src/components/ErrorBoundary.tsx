import { Component } from "react";
import type { ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main>
          <section className="load-state" role="alert">
            <h1>SiagaApi belum dapat ditampilkan</h1>
            <p>Terjadi kendala saat menampilkan halaman. Silakan muat ulang.</p>
            <button
              className="outline-button"
              onClick={() => window.location.reload()}
            >
              Muat ulang
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
