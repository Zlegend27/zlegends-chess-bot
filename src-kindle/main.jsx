import React from "react";
import ReactDOM from "react-dom/client";
import KindleApp from "./KindleApp.jsx";
import "./KindleApp.css";

class KindleErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="kErrBox">
          <p>Something went wrong. Reload the page.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <KindleErrorBoundary>
    <KindleApp />
  </KindleErrorBoundary>
);
