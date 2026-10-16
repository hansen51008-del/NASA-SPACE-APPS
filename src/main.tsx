import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QualityProvider } from "./components/MapQuality";
import ErrorBoundary from "./components/ErrorBoundary";
import AppIntro from "./components/AppIntro";
import "./styles.css";
import "./visual.css";
import "./atlas.css";
import "./explorer.css";
import "./siaga.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppIntro>
        <QualityProvider><App /></QualityProvider>
      </AppIntro>
    </ErrorBoundary>
  </React.StrictMode>,
);
