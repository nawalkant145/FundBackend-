import React from "react";
import CallCard from "./CallCard";

export const CallHistory = ({
  callLogs,
  filter,
  onFilterChange,
  onSelectCallLog,
  onStartCall,
}) => {
  const FILTERS = [
    { id: "all", label: "All" },
    { id: "missed", label: "Missed" },
    { id: "voice", label: "Voice" },
    { id: "video", label: "Video" },
    { id: "completed", label: "Completed" },
    { id: "today", label: "Today" },
    { id: "this_week", label: "This Week" },
  ];

  return (
    <div className="wa-call-history-container">
      <div className="wa-call-history-header">
        <h2>Call History</h2>
        <div className="wa-call-filter-pills">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`wa-filter-pill ${filter === f.id ? "active" : ""}`}
              onClick={() => onFilterChange(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wa-call-logs-list">
        {callLogs.length === 0 ? (
          <div className="wa-no-calls-found">
            <span>No call logs found</span>
          </div>
        ) : (
          callLogs.map((log) => (
            <CallCard
              key={log._id}
              call={log}
              onSelectCall={onSelectCallLog}
              onStartCall={onStartCall}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CallHistory;
