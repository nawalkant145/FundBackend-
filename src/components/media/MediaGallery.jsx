import React, { useState, useEffect } from "react";
import chatApi from "../../services/chatApi";

export const MediaGallery = ({ activeChatId }) => {
  const [mediaType, setMediaType] = useState("all");
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  const TABS = [
    { id: "all", label: "All" },
    { id: "images", label: "Images" },
    { id: "videos", label: "Videos" },
    { id: "documents", label: "Documents" },
    { id: "audio", label: "Audio" },
    { id: "links", label: "Links" },
  ];

  useEffect(() => {
    if (!activeChatId) return;
    setLoading(true);
    chatApi
      .getChatMedia(activeChatId, { mediaType, limit: 50 })
      .then((data) => setMediaItems(data))
      .catch((err) => console.error("Error fetching media gallery:", err))
      .finally(() => setLoading(false));
  }, [activeChatId, mediaType]);

  return (
    <div className="wa-media-gallery-container">
      <div className="wa-media-gallery-header">
        <h2>Media, Links and Docs</h2>
        <div className="wa-media-subtabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`wa-media-tab-pill ${mediaType === t.id ? "active" : ""}`}
              onClick={() => setMediaType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wa-media-content-area">
        {!activeChatId ? (
          <div className="wa-no-media-msg">Select a chat to view media items</div>
        ) : loading ? (
          <div className="wa-loading-media">Loading media gallery...</div>
        ) : mediaItems.length === 0 ? (
          <div className="wa-no-media-msg">No media found for this category</div>
        ) : (
          <div className="wa-media-grid">
            {mediaItems.map((item) => {
              const url = item.attachment?.url || item.fileUrl;
              const type = item.messageType || item.type;

              return (
                <div
                  key={item._id}
                  className="wa-media-grid-item"
                  onClick={() => setPreviewItem(item)}
                >
                  {type === "image" && <img src={url} alt="Media" className="wa-media-thumb" />}
                  {type === "video" && <video src={url} className="wa-media-thumb" />}
                  {type === "audio" && (
                    <div className="wa-audio-card-preview">
                      <span>🎵 Audio track</span>
                    </div>
                  )}
                  {(type === "document" || type === "file") && (
                    <div className="wa-doc-card-preview">
                      <span>📄 {item.attachment?.name || "Document"}</span>
                    </div>
                  )}
                  {type === "link" && (
                    <a
                      href={url || item.message}
                      target="_blank"
                      rel="noreferrer"
                      className="wa-link-card-preview"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗 {url || item.message}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="wa-modal-backdrop" onClick={() => setPreviewItem(null)}>
          <div className="wa-media-preview-card" onClick={(e) => e.stopPropagation()}>
            <button className="wa-modal-close-btn" onClick={() => setPreviewItem(null)}>
              ✕
            </button>

            {(previewItem.messageType === "image" || previewItem.type === "image") && (
              <img
                src={previewItem.attachment?.url || previewItem.fileUrl}
                alt="Full preview"
                className="wa-full-media-preview"
              />
            )}

            {(previewItem.messageType === "video" || previewItem.type === "video") && (
              <video
                src={previewItem.attachment?.url || previewItem.fileUrl}
                controls
                autoPlay
                className="wa-full-media-preview"
              />
            )}

            <div className="wa-media-preview-footer">
              <a
                href={previewItem.attachment?.url || previewItem.fileUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="wa-btn wa-btn-primary"
              >
                ⬇ Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
