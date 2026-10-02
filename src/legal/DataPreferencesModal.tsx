import React, { useState, useEffect } from "react";
import { LEGAL_CONFIG } from "./legalConfig";

interface DataPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPrivacy?: () => void;
}

export const DataPreferencesModal: React.FC<DataPreferencesModalProps> = ({
  isOpen,
  onClose,
  onNavigateToPrivacy,
}) => {
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([]);
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      try {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith("cadence") || k.includes("project") || k.includes("take") || k.includes("mode")
        );
        setLocalStorageKeys(keys);
      } catch {
        setLocalStorageKeys([]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearLocalStorage = () => {
    try {
      // Clear cadence-related local storage items
      const toRemove = Object.keys(localStorage).filter(
        (k) => k.startsWith("cadence") || k.includes("project") || k.includes("take") || k.includes("mode")
      );
      toRemove.forEach((k) => localStorage.removeItem(k));
      setLocalStorageKeys([]);
      setClearedNotice("Cadence local settings and cached sessions cleared successfully from this device.");
      setTimeout(() => setClearedNotice(null), 4000);
    } catch {
      setClearedNotice("Could not access storage to clear keys.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0D0D14] border border-[#1E1A2B] shadow-[0_25px_80px_rgba(0,0,0,0.9)] p-6 text-xs font-mono text-[#CBD5E1] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E1A2B] mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <h3 id="data-modal-title" className="text-sm font-bold text-white uppercase tracking-wider">
              Privacy, Cookies &amp; Local Storage
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#141120] hover:bg-[#1E1A2B] text-[#9C96A8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Status Callout */}
        <div className="p-3.5 rounded-xl bg-[#08080C] border border-[#1E1A2B] mb-4 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748B]">Third-Party Tracking:</span>
            <span className="text-[#10B981] font-bold">0 TRACKERS ACTIVE (DISABLED)</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748B]">Advertising Pixels:</span>
            <span className="text-[#10B981] font-bold">NONE (ZERO ADS)</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748B]">Telemetry / Analytics:</span>
            <span className="text-[#B79A62] font-bold">OFFLINE ONLY (NO TELEMETRY)</span>
          </div>
        </div>

        <p className="text-[#94A3B8] leading-relaxed mb-4">
          Cadence is engineered with extreme data minimization. We do not use third-party analytics cookies. Only strictly essential browser storage is used to maintain your local projects and audio configurations on this device.
        </p>

        {/* Local Storage Inspector */}
        <div className="p-3.5 rounded-xl bg-[#08080C] border border-[#1E1A2B] mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-bold uppercase text-[10px] tracking-wider">
              Active Local Device Storage
            </span>
            <span className="text-[#B79A62] text-[10px]">
              {localStorageKeys.length} {localStorageKeys.length === 1 ? "key" : "keys"} detected
            </span>
          </div>

          {localStorageKeys.length > 0 ? (
            <div className="max-h-24 overflow-y-auto space-y-1 text-[10px] text-[#64748B]">
              {localStorageKeys.map((k) => (
                <div key={k} className="flex items-center justify-between py-0.5 border-b border-[#141A26]">
                  <span className="text-[#CBD5E1] truncate">{k}</span>
                  <span className="text-[#34D399] shrink-0 ml-2">Essential</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[#64748B] text-[10px] block py-1">
              No project data or settings are currently stored in localStorage.
            </span>
          )}
        </div>

        {clearedNotice && (
          <div className="p-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-[11px] mb-4">
            {clearedNotice}
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#182030]">
          <div className="flex items-center gap-2">
            {localStorageKeys.length > 0 && (
              <button
                onClick={handleClearLocalStorage}
                className="px-3 py-1.5 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 border border-[#EF4444]/40 text-[#EF4444] transition-colors cursor-pointer text-[11px]"
              >
                Clear Local Data
              </button>
            )}
            {onNavigateToPrivacy && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToPrivacy();
                }}
                className="text-[11px] text-[#B79A62] hover:underline cursor-pointer"
              >
                Read Full Privacy Policy →
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#141120] hover:bg-[#1E1A2B] text-white transition-colors cursor-pointer font-bold"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
