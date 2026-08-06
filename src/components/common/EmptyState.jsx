import React from "react";

export const EmptyState = ({ title = "WhatsApp Web", subtitle = "Send and receive messages without keeping your phone online." }) => {
  return (
    <div className="wa-empty-state-container">
      <div className="wa-empty-state-illustration">
        <svg viewBox="0 0 300 150" width="220" height="120" fill="none">
          <circle cx="150" cy="75" r="60" fill="#00a884" fillOpacity="0.1" />
          <path
            d="M130 50h40a10 10 0 0110 10v30a10 10 0 01-10 10h-25l-15 12v-12h-0a10 10 0 01-10-10V60a10 10 0 0110-10z"
            fill="#00a884"
            fillOpacity="0.8"
          />
          <path d="M140 68h20M140 76h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="wa-empty-state-title">{title}</h2>
      <p className="wa-empty-state-subtitle">{subtitle}</p>
      <div className="wa-empty-state-lock">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
        </svg>
        <span>End-to-end encrypted</span>
      </div>
    </div>
  );
};

export default EmptyState;
