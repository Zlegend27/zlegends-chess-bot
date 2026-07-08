import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./index.css";

/* With registerType "autoUpdate" this reloads the page as soon as a new
   deploy's service worker takes control, instead of quietly caching it
   for the NEXT visit (which left users one version behind and made
   fresh deploys look like they hadn't shipped). The update check only
   happens at page load, so an in-progress game can't be yanked away
   mid-session. */
registerSW({ immediate: true });

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="errBox">
          <h1>Something went sideways</h1>
          <p>Zlegend's Chess Bot hit a snag. Reloading usually fixes it.</p>
          <button className="btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
