import React from "react";
import { X, Code, ExternalLink } from "lucide-react";
import { Button } from "antd";

interface ClaudeCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const GOOGLE_FORM_URL = "https://forms.gle/LZeJQ3XytBakckYa9";

export function ClaudeCodeModal({ isOpen, onClose, onComplete }: ClaudeCodeModalProps) {
  if (!isOpen) return null;

  const handleOpenForm = () => {
    window.open(GOOGLE_FORM_URL, "_blank", "noopener,noreferrer");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 ease-out">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 text-purple-600">
            <Code className="h-5 w-5" />
            <span className="font-semibold text-sm tracking-wide uppercase">Claude Code 反馈</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            帮助我们改善你的体验
          </h2>
          <p className="text-gray-600 mb-6">
            我们非常希望了解你在 LiteLLM 中使用 Claude Code 的体验。你的反馈有助于我们为所有人改进产品。
          </p>
          <p className="text-sm text-gray-500 mb-6">
            这份简短的问卷大约需要 2-3 分钟完成。
          </p>

          <Button
            type="primary"
            size="large"
            block
            onClick={handleOpenForm}
            icon={<ExternalLink className="h-4 w-4" />}
            style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
          >
            打开反馈表单
          </Button>
        </div>
      </div>
    </div>
  );
}

