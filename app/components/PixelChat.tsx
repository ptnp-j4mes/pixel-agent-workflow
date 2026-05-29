"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { AgentSprite } from "../lib/pets";
import { PixelIcon } from "./PixelIcon";

export type PixelChatMessage = {
  id: string;
  from: "user" | "agent" | "system";
  agentId?: string;
  author: string;
  body: string;
  time: string;
};

type PixelChatProps = {
  agents: AgentSprite[];
  selectedAgentId: string;
  onSelectedAgentChange: (agentId: string) => void;
  messages: PixelChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export function PixelChat({
  agents,
  selectedAgentId,
  onSelectedAgentChange,
  messages,
  draft,
  onDraftChange,
  onSend
}: PixelChatProps) {
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <section className="pixelChat" aria-label="Pixel chat for agent conversation">
      <div className="pixelChatHeader">
        <div>
          <p className="miniLabel"><PixelIcon name="paperplane" /> Pixel chat</p>
          <h2>คุยกับ Agent</h2>
        </div>
        <span className="onlineDot">LIVE</span>
      </div>

      <label className="fieldLabel" htmlFor="chatAgentSelect">เลือก sprite / agent</label>
      <select
        id="chatAgentSelect"
        className="pixelSelect"
        value={selectedAgent?.id ?? ""}
        onChange={(event) => onSelectedAgentChange(event.target.value)}
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name} - {agent.role}
          </option>
        ))}
      </select>

      <div className="chatAgentMiniCard" style={{ "--agent-color": selectedAgent?.color ?? "#42d9ff" } as CSSProperties}>
        <strong>{selectedAgent?.name ?? "No agent"}</strong>
        <span>{selectedAgent?.status ?? "ยังไม่มี agent ใน scene"}</span>
      </div>

      <div className="pixelMessages" role="log" aria-live="polite">
        {messages.map((message) => (
          <article className={`pixelMessage ${message.from}`} key={message.id}>
            <div className="pixelMessageMeta">
              <strong>{message.author}</strong>
              <time>{message.time}</time>
            </div>
            <p>{message.body}</p>
          </article>
        ))}
      </div>

      <div className="pixelComposer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์คำสั่งให้ agent เช่น สรุป workflow นี้ หรือ เดินไปตรวจ node Planner"
          aria-label="Message to selected agent"
        />
        <button type="button" onClick={onSend} disabled={!draft.trim() || !selectedAgent}>
          <PixelIcon name="paperplane" />
          Send
        </button>
      </div>
    </section>
  );
}
