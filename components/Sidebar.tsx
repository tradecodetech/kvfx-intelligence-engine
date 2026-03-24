"use client";

import React from "react";

// ── Types ───────────────────────────────────────────────

export type SidebarView = "chat" | "saved";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onThesisOpen: () => void;
  savedCount: number;
  hasThesis: boolean;
}

// ── Icons ────────────────────────────────────────────────

function IconChat({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-[18px] h-[18px] transition-colors duration-150 ${active ? "text-[#c9a84c]" : "text-gray-400 group-hover:text-gray-300"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function IconSaved({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-[18px] h-[18px] transition-colors duration-150 ${active ? "text-[#c9a84c]" : "text-gray-400 group-hover:text-gray-300"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function IconThesis() {
  return (
    <svg
      className="w-[18px] h-[18px] text-gray-400 group-hover:text-gray-300 transition-colors duration-150"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function IconChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// ── Sidebar ──────────────────────────────────────────────

export default function Sidebar({
  collapsed,
  onToggle,
  activeView,
  onViewChange,
  onThesisOpen,
  savedCount,
  hasThesis,
}: SidebarProps) {
  const w = collapsed ? "w-14" : "w-52";

  return (
    <aside
      className={`${w} flex-shrink-0 flex flex-col h-full bg-slate-800 border-r border-slate-600 transition-all duration-200 ease-out overflow-hidden`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-600 min-h-[56px]">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d3461] to-[#2a1f5f] flex items-center justify-center border border-slate-500">
          <span className="text-[#c9a84c] text-[10px] font-black tracking-tight">KV</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-gray-100 text-xs font-bold leading-tight truncate">WhisperZonez</p>
            <p className="text-gray-400 text-[9px] font-mono leading-tight truncate">KVFX v3.1</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {/* Assistant */}
        <button
          onClick={() => onViewChange("chat")}
          className={`group w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-all duration-150 ${
            activeView === "chat"
              ? "bg-[#c9a84c]/15 border border-[#c9a84c]/30"
              : "border border-transparent hover:bg-slate-700"
          }`}
        >
          <IconChat active={activeView === "chat"} />
          {!collapsed && (
            <span
              className={`text-xs font-medium tracking-wide transition-colors ${
                activeView === "chat" ? "text-[#c9a84c]" : "text-[#8898b8] group-hover:text-gray-100"
              }`}
            >
              Assistant
            </span>
          )}
        </button>

        {/* Saved Analyses */}
        <button
          onClick={() => onViewChange("saved")}
          className={`group w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-all duration-150 relative ${
            activeView === "saved"
              ? "bg-[#c9a84c]/15 border border-[#c9a84c]/30"
              : "border border-transparent hover:bg-slate-700"
          }`}
        >
          <div className="relative flex-shrink-0">
            <IconSaved active={activeView === "saved"} />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#c9a84c] text-[#07090f] rounded-full text-[8px] font-black flex items-center justify-center">
                {savedCount > 9 ? "9+" : savedCount}
              </span>
            )}
          </div>
          {!collapsed && (
            <span
              className={`text-xs font-medium tracking-wide transition-colors ${
                activeView === "saved" ? "text-[#c9a84c]" : "text-[#8898b8] group-hover:text-gray-100"
              }`}
            >
              Saved
            </span>
          )}
        </button>

        {/* Thesis */}
        <button
          onClick={onThesisOpen}
          className="group w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg border border-transparent hover:bg-slate-700 transition-all duration-150 relative"
        >
          <div className="relative flex-shrink-0">
            <IconThesis />
            {hasThesis && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-violet-400 rounded-full border border-slate-800" />
            )}
          </div>
          {!collapsed && (
            <span className="text-xs font-medium text-[#8898b8] group-hover:text-gray-100 tracking-wide transition-colors">
              Thesis
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="pt-2 pb-1">
          <div className="h-px bg-slate-600 mx-1" />
        </div>
      </nav>

      {/* Footer / Toggle */}
      <div className="px-2 pb-3">
        <button
          onClick={onToggle}
          className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-lg border border-transparent hover:bg-slate-700 transition-all duration-150"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="flex-shrink-0 w-[18px] flex justify-center">
            <IconChevron collapsed={collapsed} />
          </div>
          {!collapsed && (
            <span className="text-[11px] text-gray-400 group-hover:text-gray-300 transition-colors">
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
