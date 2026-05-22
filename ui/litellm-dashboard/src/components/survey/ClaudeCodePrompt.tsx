import React from "react";
import { Code } from "lucide-react";
import { NudgePrompt } from "./NudgePrompt";

interface ClaudeCodePromptProps {
  onOpen: () => void;
  onDismiss: () => void;
  isVisible: boolean;
}

export function ClaudeCodePrompt({ onOpen, onDismiss, isVisible }: ClaudeCodePromptProps) {
  return (
    <NudgePrompt
      onOpen={onOpen}
      onDismiss={onDismiss}
      isVisible={isVisible}
      title="Claude Code 反馈"
      description="帮助我们改善你在 LiteLLM 中使用 Claude Code 的体验！用 4 个快速问题分享你的反馈。"
      buttonText="分享反馈"
      icon={Code}
      accentColor="#7c3aed"
      buttonStyle={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
    />
  );
}

