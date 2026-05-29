"use client";

import { useMemo, useRef, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { clampPosition, type AgentSprite, type PetAsset } from "../lib/pets";

type AgentPetProps = {
  agent: AgentSprite;
  pet: PetAsset;
  stageRef: RefObject<HTMLDivElement | null>;
  isActive: boolean;
  onSelect: (agentId: string) => void;
  onDragStart: (agentId: string) => void;
  onDragMove: (agentId: string, x: number, y: number) => void;
  onDragEnd: (agentId: string) => void;
};

export function AgentPet({ agent, pet, stageRef, isActive, onSelect, onDragStart, onDragMove, onDragEnd }: AgentPetProps) {
  const dragOffset = useRef({ x: 0, y: 0 });

  const cssVars = useMemo(() => {
    return {
      left: `${agent.x}%`,
      top: `${agent.y}%`,
      "--agent-color": agent.color,
      "--pet-frame-w": `${pet.frameWidth}px`,
      "--pet-frame-h": `${pet.frameHeight}px`,
      "--pet-sheet-w": `${pet.columns * pet.frameWidth}px`,
      "--pet-sheet-h": `${pet.rows * pet.frameHeight}px`,
      "--pet-idle-width": `${pet.animation.idleFrames * pet.frameWidth}px`,
      "--pet-run-width": `${pet.animation.runFrames * pet.frameWidth}px`,
      "--pet-idle-row": `${-pet.animation.idleRow * pet.frameHeight}px`,
      "--pet-run-right-row": `${-pet.animation.runRightRow * pet.frameHeight}px`,
      "--pet-run-left-row": `${-pet.animation.runLeftRow * pet.frameHeight}px`
    } as CSSProperties;
  }, [agent.x, agent.y, agent.color, pet]);

  const spriteClass = agent.isMoving ? `run-${agent.direction}` : "idle";
  const bubbleText = agent.thought || agent.status;

  function pointerToStagePercent(event: PointerEvent | globalThis.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return { x: agent.x, y: agent.y };
    const bounds = stage.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startClient = { x: event.clientX, y: event.clientY };
    const pointer = pointerToStagePercent(event);
    let isDragging = false;

    dragOffset.current = {
      x: agent.x - pointer.x,
      y: agent.y - pointer.y
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const pixelDistance = Math.hypot(moveEvent.clientX - startClient.x, moveEvent.clientY - startClient.y);

      if (!isDragging && pixelDistance < 5) return;

      if (!isDragging) {
        isDragging = true;
        onDragStart(agent.id);
      }

      const next = pointerToStagePercent(moveEvent);
      onDragMove(
        agent.id,
        clampPosition(next.x + dragOffset.current.x, 8, 92),
        clampPosition(next.y + dragOffset.current.y, 44, 86)
      );
    };

    const handlePointerUp = () => {
      if (isDragging) {
        onDragEnd(agent.id);
      } else {
        onSelect(agent.id);
      }

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  return (
    <div
      className={`agentPet ${isActive ? "active" : ""} ${agent.mode === "manual" ? "manual" : ""} tone-${agent.bubbleTone}`}
      style={cssVars}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      aria-label={`${agent.name} sprite. Click to chat or drag to move.`}
      title="คลิกเพื่อคุยกับ agent / ลากเพื่อย้ายตำแหน่ง sprite"
    >
      <div className={`agentBubble ${agent.bubbleTone}`}>
        <strong>{agent.name}</strong>
        <span>{bubbleText}</span>
        {agent.bubbleTone === "thinking" && <em aria-hidden="true">...</em>}
      </div>
      <div className="agentPetBody">
        <div
          className={`codexPetSprite ${spriteClass}`}
          style={{ backgroundImage: `url(${pet.spritesheetUrl})` }}
          aria-hidden="true"
        />
      </div>
      <div className="agentFootLabel">
        <span>{agent.role}</span>
        <em>{agent.runtimeRole} / {agent.mode}</em>
      </div>
    </div>
  );
}
