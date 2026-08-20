import React, { useState, useEffect } from "react";

export const DealRoomModal = ({ isOpen, onClose, chat, currentUser }) => {
  const [dealRoom, setDealRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, workflow, docs, checklist, review
  const [terms, setTerms] = useState({ fundingAmount: 0, proposedValuation: 0, equityPercentage: 0 });
  const [savingTerms, setSavingTerms] = useState(false);

  useEffect(() => {
    if (!isOpen || !chat) return;

    fetchDealRoom();
  }, [isOpen, chat]);

  const fetchDealRoom = async () => {
    setLoading(true);
    try {
      // Find or create deal room
      const res = await fetch(`/api/v1/deal-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chat._id,
          founderId: chat.founderId?._id || chat.founderId,
          investorId: chat.investorId?._id || chat.investorId,
        }),
      });
      const data = await res.json();
      if (data?.data?.dealRoom) {
        const room = data.data.dealRoom;
        setDealRoom(room);
        setTerms({
          fundingAmount: room.fundingAmount || 0,
          proposedValuation: room.proposedValuation || 0,
          equityPercentage: room.equityPercentage || 0,
        });
      }
    } catch (e) {
      console.error("Failed to fetch Deal Room:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTerms = async (e) => {
    e.preventDefault();
    if (!dealRoom) return;
    setSavingTerms(true);
    try {
      const res = await fetch(`/api/v1/deal-room/${dealRoom._id}/terms`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(terms),
      });
      const data = await res.json();
      if (data?.data?.dealRoom) {
        setDealRoom(data.data.dealRoom);
      }
    } catch (e) {
      console.error("Failed to update terms:", e);
    } finally {
      setSavingTerms(false);
    }
  };

  const handleUpdateStage = async (newStage) => {
    if (!dealRoom) return;
    try {
      const res = await fetch(`/api/v1/deal-room/${dealRoom._id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (data?.data?.dealRoom) {
        setDealRoom(data.data.dealRoom);
      }
    } catch (e) {
      console.error("Failed to update stage:", e);
    }
  };

  const handleToggleChecklist = async (key, currentStatus) => {
    if (!dealRoom) return;
    const nextStatus = currentStatus === "passed" ? "pending" : "passed";
    try {
      const res = await fetch(`/api/v1/deal-room/${dealRoom._id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, status: nextStatus }),
      });
      const data = await res.json();
      if (data?.data?.dealRoom) {
        setDealRoom(data.data.dealRoom);
      }
    } catch (e) {
      console.error("Failed to update checklist:", e);
    }
  };

  const handleAcceptRequest = async () => {
    if (!dealRoom) return;
    try {
      const res = await fetch(`/api/v1/deal-room/${dealRoom._id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data?.data?.dealRoom) {
        setDealRoom(data.data.dealRoom);
      }
    } catch (e) {
      console.error("Failed to accept Deal Room request:", e);
    }
  };

  const handleDeclineRequest = async () => {
    if (!dealRoom) return;
    try {
      const res = await fetch(`/api/v1/deal-room/${dealRoom._id}/decline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data?.data?.dealRoom) {
        setDealRoom(data.data.dealRoom);
      }
    } catch (e) {
      console.error("Failed to decline Deal Room request:", e);
    }
  };

  if (!isOpen) return null;

  const isPendingAcceptance = dealRoom?.status === "pending_acceptance";
  const isDeclined = dealRoom?.status === "declined";
  const isTargetInvestor =
    dealRoom?.requestedTo?._id === currentUser?._id ||
    dealRoom?.requestedTo === currentUser?._id ||
    (currentUser?.role === "investor" && dealRoom?.requestedBy !== currentUser?._id);

  const STAGES = [
    { key: "deal_agreed", label: "Deal Agreed" },
    { key: "term_sheet", label: "Term Sheet" },
    { key: "legal_compliance_review", label: "Legal / Compliance Review" },
    { key: "investment_documentation", label: "Investment Documentation" },
    { key: "payment_route", label: "Payment Route" },
    { key: "share_issuance", label: "Share Issuance" },
    { key: "statutory_filings", label: "Statutory Filings" },
  ];

  return (
    <div className="deal-room-modal-overlay" style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div className="deal-room-modal-card" style={{
        backgroundColor: "#111827",
        color: "#f3f4f6",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "900px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        border: "1px solid #374151"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #374151",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(to right, #1f2937, #111827)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🔐</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#fff" }}>
                Deal Room — Investment Workspace
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#9ca3af" }}>
                Centralized deal workflow, legal compliance, due diligence & document vault
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Workflow Stepper (rendered for active rooms) */}
        {!isPendingAcceptance && !isDeclined && (
          <div style={{
            padding: "12px 24px",
            backgroundColor: "#1f2937",
            borderBottom: "1px solid #374151",
            overflowX: "auto"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "max-content" }}>
              {STAGES.map((s, idx) => {
                const currentIdx = STAGES.findIndex((st) => st.key === dealRoom?.stage);
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={s.key}
                    onClick={() => handleUpdateStage(s.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      backgroundColor: isCurrent ? "#8b5cf6" : isCompleted ? "rgba(16, 185, 129, 0.2)" : "#374151",
                      color: isCurrent ? "#fff" : isCompleted ? "#10b981" : "#9ca3af",
                      border: isCurrent ? "1px solid #a78bfa" : "none",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>{idx + 1}.</span>
                    <span>{s.label}</span>
                    {isCompleted && <span>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Tabs (rendered for active rooms) */}
        {!isPendingAcceptance && !isDeclined && (
          <div style={{
            display: "flex",
            borderBottom: "1px solid #374151",
            backgroundColor: "#111827",
            padding: "0 24px"
          }}>
            {[
              { id: "overview", label: "📊 Deal Overview" },
              { id: "docs", label: "📁 Document Vault" },
              { id: "checklist", label: "✅ Due Diligence" },
              { id: "review", label: "⚖️ Professional Review" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "12px 16px",
                  border: "none",
                  background: "none",
                  color: activeTab === t.id ? "#8b5cf6" : "#9ca3af",
                  fontWeight: activeTab === t.id ? 700 : 500,
                  borderBottom: activeTab === t.id ? "2px solid #8b5cf6" : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
              Loading Deal Room Workspace...
            </div>
          ) : isPendingAcceptance ? (
            isTargetInvestor ? (
              <div style={{ padding: "32px", textAlign: "center", backgroundColor: "#1f2937", borderRadius: "12px", border: "1px solid #374151" }}>
                <span style={{ fontSize: "40px" }}>🔐</span>
                <h3 style={{ margin: "16px 0 8px 0", fontSize: "18px", color: "#fff" }}>
                  Deal Room Request
                </h3>
                <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "24px" }}>
                  <strong>{chat?.founderId?.name || "Founder"}</strong> wants to proceed with a Deal Room.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button
                    onClick={handleAcceptRequest}
                    style={{ backgroundColor: "#10b981", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}
                  >
                    ✓ Accept Request
                  </button>
                  <button
                    onClick={handleDeclineRequest}
                    style={{ backgroundColor: "#ef4444", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center", backgroundColor: "#1f2937", borderRadius: "12px", border: "1px solid #374151" }}>
                <span style={{ fontSize: "40px" }}>⏳</span>
                <h3 style={{ margin: "16px 0 8px 0", fontSize: "18px", color: "#f59e0b" }}>
                  Deal Room Request Pending
                </h3>
                <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
                  Deal Room request sent. Waiting for investor approval.
                </p>
              </div>
            )
          ) : isDeclined ? (
            <div style={{ padding: "40px 20px", textAlign: "center", backgroundColor: "#1f2937", borderRadius: "12px", border: "1px solid #374151" }}>
              <span style={{ fontSize: "40px" }}>🚫</span>
              <h3 style={{ margin: "16px 0 8px 0", fontSize: "18px", color: "#ef4444" }}>
                Deal Room Request Declined
              </h3>
              <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "16px" }}>
                The investor has declined this Deal Room request.
              </p>
              <button
                onClick={onClose}
                style={{ backgroundColor: "#374151", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          ) : activeTab === "overview" ? (
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Proposed Deal Terms</h3>
              <form onSubmit={handleUpdateTerms} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                    Funding Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={terms.fundingAmount}
                    onChange={(e) => setTerms({ ...terms, fundingAmount: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #374151",
                      backgroundColor: "#1f2937",
                      color: "#fff"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                    Proposed Valuation (₹)
                  </label>
                  <input
                    type="number"
                    value={terms.proposedValuation}
                    onChange={(e) => setTerms({ ...terms, proposedValuation: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #374151",
                      backgroundColor: "#1f2937",
                      color: "#fff"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                    Equity Offered (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={terms.equityPercentage}
                    onChange={(e) => setTerms({ ...terms, equityPercentage: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #374151",
                      backgroundColor: "#1f2937",
                      color: "#fff"
                    }}
                  />
                </div>
                <div style={{ gridColumn: "span 3", textAlign: "right", marginTop: "8px" }}>
                  <button
                    type="submit"
                    disabled={savingTerms}
                    style={{
                      backgroundColor: "#8b5cf6",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {savingTerms ? "Saving..." : "Save Deal Terms"}
                  </button>
                </div>
              </form>
            </div>
          ) : activeTab === "docs" ? (
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Deal Document Repository</h3>
              {dealRoom?.documents?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {dealRoom.documents.map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#1f2937", borderRadius: "8px", border: "1px solid #374151" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "13px" }}>{d.name}</span>
                        <span style={{ marginLeft: "8px", fontSize: "11px", color: "#9ca3af", textTransform: "uppercase" }}>({d.category})</span>
                      </div>
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: "12px", textDecoration: "underline" }}>
                        View Document
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", backgroundColor: "#1f2937", borderRadius: "8px" }}>
                  No deal documents uploaded yet.
                </div>
              )}
            </div>
          ) : activeTab === "checklist" ? (
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Due Diligence Checklist</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {dealRoom?.checklist?.map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#1f2937", borderRadius: "8px", border: "1px solid #374151" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{item.title}</div>
                      <div style={{ fontSize: "11px", color: "#9ca3af" }}>Category: {item.category}</div>
                    </div>
                    <button
                      onClick={() => handleToggleChecklist(item.key, item.status)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: item.status === "passed" ? "rgba(16, 185, 129, 0.2)" : "#374151",
                        color: item.status === "passed" ? "#10b981" : "#9ca3af"
                      }}
                    >
                      {item.status === "passed" ? "✓ Verified" : "Mark Verified"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Professional Compliance Review</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "16px", backgroundColor: "#1f2937", borderRadius: "12px", border: "1px solid #374151" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#a78bfa" }}>CA / CS Compliance Review</h4>
                  <p style={{ fontSize: "12px", color: "#9ca3af" }}>Status: {dealRoom?.reviewStatus?.caCsStatus || "pending"}</p>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#1f2937", borderRadius: "12px", border: "1px solid #374151" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#a78bfa" }}>Startup Lawyer Legal Review</h4>
                  <p style={{ fontSize: "12px", color: "#9ca3af" }}>Status: {dealRoom?.reviewStatus?.lawyerStatus || "pending"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealRoomModal;
