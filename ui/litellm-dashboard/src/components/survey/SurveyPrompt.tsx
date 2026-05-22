import React from "react";
import { MessageSquare } from "lucide-react";
import { NudgePrompt } from "./NudgePrompt";

interface SurveyPromptProps {
  onOpen: () => void;
  onDismiss: () => void;
  isVisible: boolean;
}

export function SurveyPrompt({ onOpen, onDismiss, isVisible }: SurveyPromptProps) {
  return (
    <NudgePrompt
      onOpen={onOpen}
      onDismiss={onDismiss}
      isVisible={isVisible}
      title="快速反馈"
      description="帮助我们改进 LiteLLM！用 5 个快速问题分享你的体验。"
      buttonText="分享反馈"
      icon={MessageSquare}
      accentColor="#3b82f6"
    />
  );
}

