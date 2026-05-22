import React, { useState } from "react";
import { X, MessageSquare, ArrowRight, ArrowLeft } from "lucide-react";
import { Button, Input, Radio, Space, Progress, Checkbox } from "antd";

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const REASONS_OPTIONS = [
  {
    id: "oss_adoption",
    label: "OSS Adoption",
    description: "Stars, contributors, forks, community support",
  },
  {
    id: "ai_integration",
    label: "AI Integration",
    description: "LiteLLM had the logging/guardrail integration we needed - Langfuse, OTEL, S3 logging, Azure Content Safety guardrails",
  },
  {
    id: "unified_api",
    label: "Unified API",
    description: "LiteLLM had the best OpenAI-compatible API across providers - OpenAI, Anthropic, Gemini, etc.",
  },
  {
    id: "breadth_of_models",
    label: "Breadth of Models/Providers",
    description: "LiteLLM had the provider + endpoint combinations we needed - /ocr endpoint with Mistral OCR, /batches endppint with Bedrock API, etc.",
  },
  {
    id: "other",
    label: "Other",
    description: "Something else not listed above",
  },
];

type SurveyData = {
  usingAtCompany: boolean | null;
  companyName: string;
  startDate: string;
  reasons: string[];
  otherReason: string;
  email: string;
};

export function SurveyModal({ isOpen, onClose, onComplete }: SurveyModalProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<SurveyData>({
    usingAtCompany: null,
    companyName: "",
    startDate: "",
    reasons: [],
    otherReason: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Steps: 1=company?, 2=company name (conditional), 3=when, 4=why, 5=email
  // If not at company: skip step 2, so total is 4
  // If at company: total is 5
  const totalSteps = data.usingAtCompany === true ? 5 : 4;

  if (!isOpen) return null;

  const handleNext = () => {
    // Skip company name step if not using at company
    if (step === 1 && data.usingAtCompany === false) {
      setStep(3); // Skip to "when did you start"
    } else if (step < 5) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step === 3 && data.usingAtCompany === false) {
      setStep(1); // Go back to first question if we skipped company name
    } else {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Map reason IDs to readable labels
      const reasonLabels: Record<string, string> = {
        oss_adoption: "OSS Adoption (stars, contributors, forks)",
        ai_integration: "AI Integration (Langfuse, OTEL, S3, Azure Content Safety)",
        unified_api: "Unified API (OpenAI-compatible)",
        breadth_of_models: "Breadth of Models/Providers (/ocr, /batches, Bedrock, Azure OCR)",
      };

      const readableReasons = data.reasons.map((r) => {
        if (r === "other" && data.otherReason) {
          return `Other: ${data.otherReason}`;
        }
        return reasonLabels[r] || r;
      });

      // Submit to feedback endpoint (redirects to Google Form)
      const feedbackUrl = "https://feedback.litellm.ai/survey";
      
      const formData = new URLSearchParams({
        "entry.2015264290": data.usingAtCompany ? "Yes" : "No",
        "entry.1876243786": data.companyName || "",
        "entry.1282591459": data.startDate,
        "entry.393456108": readableReasons.join(", "),
        "entry.928142208": data.email || "",
      });

      await fetch(feedbackUrl, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (error) {
      // Silently fail - don't block the user experience
      console.error("Failed to submit survey:", error);
    }
    setIsSubmitting(false);
    onComplete();
  };

  const updateData = (key: keyof SurveyData, value: boolean | string | string[] | null) => {
    setData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleReason = (reasonId: string) => {
    setData((prev) => ({
      ...prev,
      reasons: prev.reasons.includes(reasonId)
        ? prev.reasons.filter((r) => r !== reasonId)
        : [...prev.reasons, reasonId],
    }));
  };

  const isStepValid = () => {
    if (step === 1) return data.usingAtCompany !== null;
    if (step === 2) return data.companyName.trim().length > 0;
    if (step === 3) return data.startDate !== "";
    if (step === 4) {
      // If "other" is selected, require the text field
      if (data.reasons.includes("other")) {
        return data.reasons.length > 0 && data.otherReason.trim().length > 0;
      }
      return data.reasons.length > 0;
    }
    if (step === 5) return true; // Email is optional
    return false;
  };

  const getStepNumber = () => {
    if (data.usingAtCompany === false) {
      // When not at company: skip step 2, so steps 3,4,5 become 2,3,4
      if (step === 1) return 1;
      if (step === 3) return 2;
      if (step === 4) return 3;
      if (step === 5) return 4;
    }
    return step;
  };

  const renderStepContent = () => {
    // Step 1: Using at company?
    if (step === 1) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">你在公司使用 LiteLLM 吗？</h2>
          <p className="text-gray-500">帮助我们了解我们的产品在专业环境中的使用情况。</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <button
              onClick={() => updateData("usingAtCompany", true)}
              className={`p-6 rounded-lg border-2 text-left transition-all ${
                data.usingAtCompany === true
                  ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <span className="block text-lg font-semibold text-gray-900 mb-1">是</span>
              <span className="text-sm text-gray-500">工作中使用</span>
            </button>
            <button
              onClick={() => updateData("usingAtCompany", false)}
              className={`p-6 rounded-lg border-2 text-left transition-all ${
                data.usingAtCompany === false
                  ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <span className="block text-lg font-semibold text-gray-900 mb-1">否</span>
              <span className="text-sm text-gray-500">个人项目/爱好</span>
            </button>
          </div>
        </div>
      );
    }

    // Step 2: Company name (only if using at company)
    if (step === 2 && data.usingAtCompany === true) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">你在哪个公司使用 LiteLLM？</h2>
          <p className="text-gray-500">这有助于我们更好地了解我们的用户群体。</p>
          <Input
            size="large"
            placeholder="输入公司名称"
            value={data.companyName}
            onChange={(e) => updateData("companyName", e.target.value)}
            autoFocus
          />
        </div>
      );
    }

    // Step 3: When did you start?
    if (step === 3) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">你是什么时候开始使用 LiteLLM 的？</h2>
          <Radio.Group
            value={data.startDate}
            onChange={(e) => updateData("startDate", e.target.value)}
            className="w-full"
          >
            <Space direction="vertical" className="w-full">
              {["不到 1 个月", "1-3 个月", "3-6 个月", "超过 6 个月"].map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all w-full ${
                    data.startDate === option
                      ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Radio value={option}>{option}</Radio>
                </label>
              ))}
            </Space>
          </Radio.Group>
        </div>
      );
    }

    // Step 4: Why did you pick LiteLLM?
    if (step === 4) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">为什么选择 LiteLLM 而不是其他 AI 网关？</h2>
          <p className="text-gray-500">选择所有适用的选项。</p>
          <div className="space-y-3">
            {REASONS_OPTIONS.map((option) => {
              const isSelected = data.reasons.includes(option.id);
              return (
                <div key={option.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleReason(option.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleReason(option.id);
                      }
                    }}
                    className={`flex items-start p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Checkbox checked={isSelected} className="mt-0.5 pointer-events-none" />
                    <div className="ml-3">
                      <span className="block font-medium text-gray-900">{option.label}</span>
                      <span className="text-sm text-gray-500">{option.description}</span>
                    </div>
                  </div>
                  {/* Show text input if "Other" is selected */}
                  {option.id === "other" && isSelected && (
                    <Input
                      className="mt-2 ml-7"
                      placeholder="请具体说明..."
                      value={data.otherReason}
                      onChange={(e) => updateData("otherReason", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Step 5: Email (optional)
    if (step === 5) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">想分享更多吗？</h2>
          <p className="text-gray-500">
            留下你的邮箱，我们可能会联系你了解更多体验。这完全是可选的。
          </p>
          <Input
            size="large"
            type="email"
            placeholder="your@email.com（可选）"
            value={data.email}
            onChange={(e) => updateData("email", e.target.value)}
            autoFocus
          />
          <p className="text-xs text-gray-400">
            我们只会在跟进你的反馈时使用此邮箱。绝不发送垃圾邮件。
          </p>
        </div>
      );
    }

    return null;
  };

  const isLastStep = step === 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transform transition-all duration-300 ease-out">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 text-blue-600">
            <MessageSquare className="h-5 w-5" />
            <span className="font-semibold text-sm tracking-wide uppercase">快速反馈</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <Progress percent={(getStepNumber() / totalSteps) * 100} showInfo={false} strokeColor="#2563eb" className="m-0" />

        {/* Content */}
        <div className="p-8 flex-1 overflow-y-auto">{renderStepContent()}</div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500 font-medium">
            Step {getStepNumber()} / {totalSteps}
          </div>
          <div className="flex gap-3">
            {step > 1 && (
              <Button onClick={handleBack} disabled={isSubmitting} icon={<ArrowLeft className="h-4 w-4" />}>
返回
              </Button>
            )}
            <Button
              type="primary"
              onClick={handleNext}
              disabled={!isStepValid() || isSubmitting}
              loading={isSubmitting}
              className="min-w-[100px]"
            >
              {isLastStep ? "提交" : "下一步"}
              {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

