"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SearchIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  CheckIcon,
  ExternalLinkIcon,
  KeyIcon,
  ServerIcon,
  AlertCircleIcon,
  InfoIcon,
} from "lucide-react";
import { Modal, Form, Input, Select } from "antd";
import {
  listGuardrailSubmissions,
  approveGuardrailSubmission,
  rejectGuardrailSubmission,
  updateGuardrailCall,
  type GuardrailSubmissionItem,
} from "@/components/networking";
import NotificationsManager from "@/components/molecules/notifications_manager";
import TeamDropdown from "@/components/common_components/team_dropdown";
import { useRegisterGuardrail } from "@/app/(dashboard)/hooks/guardrails/useRegisterGuardrail";

type GuardrailStatus = "active" | "pending" | "rejected";

type TeamGuardrail = {
  id: string;
  team: string;
  name: string;
  endpoint: string;
  status: GuardrailStatus;
  model: string;
  forwardKey: boolean;
  description: string;
  method: "POST" | "GET";
  customHeaders: {
    key: string;
    value: string;
  }[];
  extraHeaders: string[];
  submittedAt: string;
  submittedBy: string;
  mode?: string;
  unreachable_fallback?: string;
  additionalProviderParams?: Record<string, unknown>;
  guardrailType?: string;
};

function mapStatus(apiStatus: string): GuardrailStatus {
  if (apiStatus === "pending_review") return "pending";
  if (apiStatus === "active" || apiStatus === "rejected") return apiStatus;
  return "active";
}

function formatSubmissionDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  } catch {
    return value;
  }
}

function submissionToTeamGuardrail(item: GuardrailSubmissionItem): TeamGuardrail {
  const params = item.litellm_params ?? {};
  const info = item.guardrail_info ?? {};
  const headers = params.headers;
  const customHeaders: { key: string; value: string }[] = Array.isArray(headers)
    ? headers.map((h: { key?: string; name?: string; value: string }) => ({
        key: (h.key ?? h.name ?? "").toString(),
        value: String(h.value ?? ""),
      }))
    : typeof headers === "object" && headers !== null
      ? Object.entries(headers).map(([key, value]) => ({
          key,
          value: String(value ?? ""),
        }))
      : [];
  const endpoint =
    (params.api_base as string) ?? (params.url as string) ?? "";
  const model =
    (info.model as string) ?? (params.model as string) ?? "—";
  const forwardKey = (params.forward_api_key as boolean) ?? true;
  const extraHeaders = Array.isArray(params.extra_headers)
    ? (params.extra_headers as string[]).filter((h): h is string => typeof h === "string")
    : [];
  return {
    id: item.guardrail_id,
    team: item.team_id ?? "—",
    name: item.guardrail_name,
    endpoint,
    status: mapStatus(item.status),
    model,
    forwardKey,
    description: (info.description as string) ?? "",
    method: (params.method as "POST" | "GET") ?? "POST",
    customHeaders,
    extraHeaders,
    submittedAt: formatSubmissionDate(item.submitted_at),
    submittedBy: item.submitted_by_email ?? item.submitted_by_user_id ?? "—",
    mode: params.mode as string | undefined,
    unreachable_fallback: params.unreachable_fallback as string | undefined,
    additionalProviderParams: params.additional_provider_specific_params as Record<string, unknown> | undefined,
    guardrailType: params.guardrail as string | undefined,
  };
}

const STATUS_CONFIG: Record<
  GuardrailStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  active: {
    label: "活跃",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  pending: {
    label: "待审核",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  rejected: {
    label: "已拒绝",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

const TEAM_COLORS: Record<string, string> = {
  "ML Platform": "bg-purple-100 text-purple-700",
  "Data Science": "bg-blue-100 text-blue-700",
  Security: "bg-red-100 text-red-700",
  "Customer Success": "bg-orange-100 text-orange-700",
  Legal: "bg-gray-100 text-gray-700",
  Finance: "bg-green-100 text-green-700",
};

function buildEquivalentConfigYaml(g: TeamGuardrail): string {
  const lines: string[] = [
    "litellm_settings:",
    "  guardrails:",
    `    - guardrail_name: "${g.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    "      litellm_params:",
    `        guardrail: ${g.guardrailType ?? "generic_guardrail_api"}`,
    `        mode: ${g.mode ?? "pre_call"}  # or post_call, during_call`,
    `        api_base: ${g.endpoint || "https://your-guardrail-api.com"}`,
    "        api_key: os.environ/YOUR_GUARDRAIL_API_KEY  # optional",
    `        unreachable_fallback: ${g.unreachable_fallback ?? "fail_closed"}  # default: fail_closed. Set to fail_open to proceed if the guardrail endpoint is unreachable.`,
    `        forward_api_key: ${g.forwardKey}`,
  ];
  if (g.model && g.model !== "—") {
    lines.push(`        model: "${g.model}"  # LLM model name sent to the guardrail for context`);
  }
  if (g.customHeaders.length > 0) {
    lines.push("        headers:  # static headers (sent with every request)");
    for (const h of g.customHeaders) {
      lines.push(`          ${h.key}: "${String(h.value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    }
  }
  if (g.extraHeaders.length > 0) {
    lines.push("        extra_headers:  # forward these client request headers to the guardrail");
    for (const name of g.extraHeaders) {
      lines.push(`          - ${name}`);
    }
  }
  if (g.additionalProviderParams && Object.keys(g.additionalProviderParams).length > 0) {
    lines.push("        additional_provider_specific_params:");
    for (const [k, v] of Object.entries(g.additionalProviderParams)) {
      const val = typeof v === "string" ? `"${v}"` : String(v);
      lines.push(`          ${k}: ${val}`);
    }
  }
  return lines.join("\n");
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        enabled ? "bg-blue-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

type GuardrailCardProps = {
  guardrail: TeamGuardrail;
  isSelected: boolean;
  isHeadersExpanded: boolean;
  onSelect: () => void;
  onToggleForwardKey: () => void;
  onToggleHeaders: () => void;
  on批准: () => void;
  on拒绝: () => void;
};

function GuardrailCard({
  guardrail: g,
  isSelected,
  isHeadersExpanded,
  onSelect,
  onToggleForwardKey,
  onToggleHeaders,
  on批准,
  on拒绝,
}: GuardrailCardProps) {
  const status = STATUS_CONFIG[g.status];
  const teamColor = TEAM_COLORS[g.team] ?? "bg-gray-100 text-gray-700";
  return (
    <div
      className={`bg-white border rounded-lg p-4 transition-all ${
        isSelected ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
<span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
            >
              团队：{g.team}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{g.name}</h3>
          <p className="text-xs text-gray-500 mb-2 line-clamp-1">
            {g.description}
          </p>
          <div className="flex items-center gap-1.5 mb-2">
            <ServerIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <code className="text-xs text-gray-500 font-mono truncate">
              {g.endpoint}
            </code>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
<span>
               模型：<span className="font-medium text-gray-700">{g.model}</span>
            </span>
<span>
               已提交：{" "}
               <span className="font-medium text-gray-700">{g.submittedAt}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              转发 API 密钥
            </span>
            <Toggle enabled={g.forwardKey} onToggle={onToggleForwardKey} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={onSelect}
              className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors font-medium"
            >
              {isSelected ? "关闭" : "审核"}
            </button>
            {g.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={on批准}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md transition-colors font-medium"
                >
                  批准
                </button>
                <button
                  type="button"
                  onClick={on拒绝}
                  className="text-xs border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors font-medium"
                >
                  拒绝
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onToggleHeaders}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isHeadersExpanded ? (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          静态请求头
          {g.customHeaders.length > 0 && (
            <span className="ml-1 bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">
              {g.customHeaders.length}
            </span>
          )}
        </button>
        {isHeadersExpanded && (
          <div className="mt-2">
            {g.customHeaders.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                未配置静态请求头。
              </p>
            ) : (
              <div className="space-y-1">
                {g.customHeaders.map((h, i) => (
                  <div
                    key={`${h.key}-${i}`}
                    className="flex items-center gap-2 text-xs font-mono"
                  >
                    <span className="text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                      {h.key}
                    </span>
                    <span className="text-gray-400">:</span>
                    <span className="text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

type DetailPanelProps = {
  guardrail: TeamGuardrail;
  onClose: () => void;
  on批准: () => void;
  on拒绝: () => void;
  onToggleForwardKey: () => void;
  onUpdateCustomHeaders: (
    customHeaders: { key: string; value: string }[]
  ) => Promise<void>;
  onUpdateExtraHeaders: (extraHeaders: string[]) => Promise<void>;
};

function DetailPanel({
  guardrail: g,
  onClose,
  on批准,
  on拒绝,
  onToggleForwardKey,
  onUpdateCustomHeaders,
  onUpdateExtraHeaders,
}: DetailPanelProps) {
  const [configExpanded, setConfigExpanded] = useState(false);
  const [newExtraHeader, setNewExtraHeader] = useState("");
  const [newStaticHeaderKey, setNewStaticHeaderKey] = useState("");
  const [newStaticHeaderValue, setNewStaticHeaderValue] = useState("");
  const status = STATUS_CONFIG[g.status];
  const teamColor = TEAM_COLORS[g.team] ?? "bg-gray-100 text-gray-700";
  return (
    <div className="w-96 flex-shrink-0 bg-white overflow-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${teamColor}`}
              >
                团队：{g.team}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900">{g.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {g.submittedBy} 于 {g.submittedAt} 提交
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭详情面板"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-5">{g.description}</p>
        <div className="space-y-4">
          <ConfigRow label="端点">
            <div className="flex items-center gap-1.5">
              <code className="text-xs font-mono text-gray-700 break-all">
                {g.endpoint}
              </code>
              <a
                href={g.endpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-500 flex-shrink-0"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </ConfigRow>
          <ConfigRow label="方法">
            <span className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
              {g.method}
            </span>
          </ConfigRow>
          <div className="border border-blue-100 bg-blue-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <KeyIcon className="h-3.5 w-3.5 text-blue-500" />
<span className="text-xs font-semibold text-blue-800">
                   转发 LiteLLM API 密钥
                 </span>
              </div>
              <Toggle enabled={g.forwardKey} onToggle={onToggleForwardKey} />
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
启用后，调用方的 LiteLLM API 密钥将作为{" "}
               <code className="font-mono bg-blue-100 px-1 rounded">
                 Authorization
               </code>{" "}
               请求头发送到您的防护栏端点。这允许您的防护栏使用原始调用方的凭据对模型调用进行身份验证。
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
<span className="text-xs font-semibold text-gray-700">
                 静态请求头
               </span>
              {g.customHeaders.length > 0 && (
                <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">
                  {g.customHeaders.length}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-2">
              随每次请求发送到防护栏。
            </p>
            {g.customHeaders.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-2">
                未配置静态请求头。
              </p>
            ) : (
              <ul className="list-none space-y-1 mb-2">
                {g.customHeaders.map((h, i) => (
                  <li
                    key={`${h.key}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1.5"
                  >
                    <span className="text-gray-700 truncate">
                      {h.key}: {h.value}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCustomHeaders(
                          g.customHeaders.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-gray-400 hover:text-red-600 flex-shrink-0"
                      aria-label={`删除 ${h.key}`}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                type="text"
                value={newStaticHeaderKey}
                onChange={(e) => setNewStaticHeaderKey(e.target.value)}
                placeholder="请求头名称（例如：X-API-Key）"
                className="flex-1 min-w-0 text-xs font-mono border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const key = newStaticHeaderKey.trim();
                    const value = newStaticHeaderValue.trim();
                    if (key && !g.customHeaders.some((h) => h.key.toLowerCase() === key.toLowerCase())) {
                      onUpdateCustomHeaders([...g.customHeaders, { key, value }]);
                      setNewStaticHeaderKey("");
                      setNewStaticHeaderValue("");
                    }
                  }
                }}
              />
              <input
                type="text"
                value={newStaticHeaderValue}
                onChange={(e) => setNewStaticHeaderValue(e.target.value)}
                placeholder="值"
                className="flex-1 min-w-0 text-xs font-mono border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const key = newStaticHeaderKey.trim();
                    const value = newStaticHeaderValue.trim();
                    if (key && !g.customHeaders.some((h) => h.key.toLowerCase() === key.toLowerCase())) {
                      onUpdateCustomHeaders([...g.customHeaders, { key, value }]);
                      setNewStaticHeaderKey("");
                      setNewStaticHeaderValue("");
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const key = newStaticHeaderKey.trim();
                  const value = newStaticHeaderValue.trim();
                  if (key && !g.customHeaders.some((h) => h.key.toLowerCase() === key.toLowerCase())) {
                    onUpdateCustomHeaders([...g.customHeaders, { key, value }]);
                    setNewStaticHeaderKey("");
                    setNewStaticHeaderValue("");
                  }
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded transition-colors flex-shrink-0"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-semibold text-gray-700">
转发客户端请求头
              </span>
              {g.extraHeaders.length > 0 && (
                <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">
                  {g.extraHeaders.length}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-2">
              允许从客户端请求转发到防护栏的请求头名称（例如：x-request-id）。
            </p>
            {g.extraHeaders.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-2">
                未配置转发客户端请求头。
              </p>
            ) : (
              <ul className="list-none space-y-1 mb-2">
                {g.extraHeaders.map((name, i) => (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1.5"
                  >
                    <span className="text-gray-700 truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateExtraHeaders(
                          g.extraHeaders.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-gray-400 hover:text-red-600 flex-shrink-0"
                      aria-label={`删除 ${name}`}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newExtraHeader}
                onChange={(e) => setNewExtraHeader(e.target.value)}
                placeholder="例如：x-request-id"
                className="flex-1 min-w-0 text-xs font-mono border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = newExtraHeader.trim().toLowerCase();
                    if (name && !g.extraHeaders.map((h) => h.toLowerCase()).includes(name)) {
                      onUpdateExtraHeaders([...g.extraHeaders, name]);
                      setNewExtraHeader("");
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const name = newExtraHeader.trim().toLowerCase();
                  if (name && !g.extraHeaders.map((h) => h.toLowerCase()).includes(name)) {
                    onUpdateExtraHeaders([...g.extraHeaders, name]);
                    setNewExtraHeader("");
                  }
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded transition-colors"
              >
                Add
              </button>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setConfigExpanded(!configExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span>等效配置</span>
              {configExpanded ? (
                <ChevronUpIcon className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5 text-gray-500" />
              )}
            </button>
            {configExpanded && (
              <pre className="p-3 text-xs font-mono text-gray-700 bg-white border-t border-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
                {buildEquivalentConfigYaml(g)}
              </pre>
            )}
          </div>
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <InfoIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
此防护栏在独立实例上运行。它接收用户请求并将结果转发到管道的下一步。有关配置详情，请参阅{" "}
               <a
                 href="https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-blue-500 hover:underline"
               >
                 LiteLLM 通用防护栏 API 文档
               </a>{" "}
               。
            </p>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium py-2 rounded-md transition-colors"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            测试端点
          </button>
          {g.status === "pending" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={on批准}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-md transition-colors"
              >
                <CheckIcon className="h-4 w-4" />
                批准
              </button>
              <button
                type="button"
                onClick={on拒绝}
                className="flex-1 flex items-center justify-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium py-2 rounded-md transition-colors"
              >
                <XIcon className="h-4 w-4" />
                拒绝
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ConfirmDialogProps = {
  action: "approve" | "reject";
  guardrailName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmDialog({
  action,
  guardrailName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isApprove = action === "approve";
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
            isApprove ? "bg-green-100" : "bg-red-100"
          }`}
        >
          {isApprove ? (
            <CheckIcon className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircleIcon className="h-5 w-5 text-red-600" />
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          {isApprove ? "批准防护栏" : "拒绝防护栏"}
        </h3>
        <p className="text-sm text-gray-500 mb-5">
您确定要 {action === "approve" ? "批准" : "拒绝"}{" "}
           <span className="font-medium text-gray-700">&quot;{guardrailName}&quot;</span>?{" "}
           {isApprove
             ? "这将使其激活并可供使用。"
             : "这将标记为已拒绝并通知团队。"}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium py-2 rounded-md transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 text-white text-sm font-medium py-2 rounded-md transition-colors ${
              isApprove
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {isApprove ? "批准" : "拒绝"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TeamGuardrailsTabProps {
  accessToken: string | null;
}

export function TeamGuardrailsTab({ accessToken }: TeamGuardrailsTabProps) {
  const [guardrails, setGuardrails] = useState<TeamGuardrail[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending_review: 0,
    active: 0,
    rejected: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | GuardrailStatus
  >("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "approve" | "reject";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDebounced, setSearchDebounced] = useState("");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitForm] = Form.useForm();
  const registerGuardrail = useRegisterGuardrail();

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSubmissions = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const statusParam =
        statusFilter === "all"
          ? undefined
          : statusFilter === "pending"
            ? "pending_review"
            : statusFilter;
      const res = await listGuardrailSubmissions(accessToken, {
        status: statusParam,
        search: searchDebounced.trim() || undefined,
      });
      setGuardrails(res.submissions.map(submissionToTeamGuardrail));
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载提交失败");
      setGuardrails([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, statusFilter, searchDebounced]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const filtered = guardrails;
  const selected = guardrails.find((g) => g.id === selectedId) ?? null;
  const totalCount = summary.total;
  const pendingCount = summary.pending_review;
  const activeCount = summary.active;
  const rejectedCount = summary.rejected;

  async function toggleForwardKey(id: string) {
    if (!accessToken) return;
    const g = guardrails.find((x) => x.id === id);
    if (!g) return;
    const newValue = !g.forwardKey;
    try {
      await updateGuardrailCall(accessToken, id, {
        litellm_params: { forward_api_key: newValue },
      });
      setGuardrails((prev) =>
        prev.map((x) => (x.id === id ? { ...x, forwardKey: newValue } : x))
      );
      NotificationsManager.success(
        newValue ? "       转发 API 密钥已启用" : "转发 API 密钥已禁用"
      );
    } catch {
      NotificationsManager.fromBackend("更新转发 API 密钥失败");
    }
  }

  async function updateCustomHeaders(
    id: string,
    customHeaders: { key: string; value: string }[]
  ) {
    if (!accessToken) return;
    const headersObj: Record<string, string> = {};
    for (const { key, value } of customHeaders) {
      if (key.trim()) headersObj[key.trim()] = value;
    }
    try {
      await updateGuardrailCall(accessToken, id, {
        litellm_params: { headers: headersObj },
      });
      setGuardrails((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                customHeaders: customHeaders.filter((h) => h.key.trim()),
              }
            : x
        )
      );
      NotificationsManager.success("静态请求头已更新");
    } catch {
      NotificationsManager.fromBackend("更新静态请求头失败");
    }
  }

  async function updateExtraHeaders(id: string, extraHeaders: string[]) {
    if (!accessToken) return;
    try {
      await updateGuardrailCall(accessToken, id, {
        litellm_params: { extra_headers: extraHeaders },
      });
      setGuardrails((prev) =>
        prev.map((x) => (x.id === id ? { ...x, extraHeaders } : x))
      );
      NotificationsManager.success("转发客户端请求头已更新");
    } catch {
      NotificationsManager.fromBackend("更新转发客户端请求头失败");
    }
  }

  async function handle批准(id: string) {
    if (!accessToken) return;
    try {
      await approveGuardrailSubmission(accessToken, id);
      setConfirmAction(null);
      if (selectedId === id) setSelectedId(null);
      await fetchSubmissions();
      NotificationsManager.success("防护栏已批准");
    } catch {
      NotificationsManager.fromBackend("批准防护栏失败");
    }
  }

  async function handle拒绝(id: string) {
    if (!accessToken) return;
    try {
      await rejectGuardrailSubmission(accessToken, id);
      setConfirmAction(null);
      if (selectedId === id) setSelectedId(null);
      await fetchSubmissions();
      NotificationsManager.success("防护栏已拒绝");
    } catch {
      NotificationsManager.fromBackend("拒绝防护栏失败");
    }
  }

  function toggleHeaders(id: string) {
    setExpandedHeaders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full">
      <div
        className={`flex-1 min-w-0 p-6 overflow-auto ${
          selected ? "border-r border-gray-200" : ""
        }`}
      >
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="总计提交" value={totalCount} color="text-gray-900" />
          <StatCard
            label="待审核"
            value={pendingCount}
            color="text-yellow-600"
          />
          <StatCard label="活跃" value={activeCount} color="text-green-600" />
          <StatCard label="已拒绝" value={rejectedCount} color="text-red-600" />
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索防护栏..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="all">全部状态</option>
            <option value="pending">Pending Review</option>
            <option value="active">Active</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="ml-auto flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            添加防护栏
          </button>
        </div>
        <div className="space-y-3">
          {isLoading && (
            <div className="text-center py-12 text-gray-500 text-sm">
              正在加载提交...
            </div>
          )}
          {error && (
            <div className="text-center py-12 text-red-600 text-sm">
              {error}
            </div>
          )}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              没有符合筛选条件的防护栏。
            </div>
          )}
          {!isLoading && !error && filtered.map((g) => (
            <GuardrailCard
              key={g.id}
              guardrail={g}
              isSelected={selectedId === g.id}
              isHeadersExpanded={expandedHeaders.has(g.id)}
              onSelect={() => setSelectedId(selectedId === g.id ? null : g.id)}
              onToggleForwardKey={() => toggleForwardKey(g.id)}
              onToggleHeaders={() => toggleHeaders(g.id)}
              on批准={() => setConfirmAction({ id: g.id, action: "approve" })}
              on拒绝={() => setConfirmAction({ id: g.id, action: "reject" })}
            />
          ))}
        </div>
      </div>
      {selected && (
        <DetailPanel
          guardrail={selected}
          onClose={() => setSelectedId(null)}
          on批准={() =>
            setConfirmAction({ id: selected.id, action: "approve" })
          }
          on拒绝={() =>
            setConfirmAction({ id: selected.id, action: "reject" })
          }
          onToggleForwardKey={() => toggleForwardKey(selected.id)}
          onUpdateCustomHeaders={(customHeaders) =>
            updateCustomHeaders(selected.id, customHeaders)
          }
          onUpdateExtraHeaders={(extraHeaders) =>
            updateExtraHeaders(selected.id, extraHeaders)
          }
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          action={confirmAction.action}
          guardrailName={
            guardrails.find((g) => g.id === confirmAction.id)?.name ?? ""
          }
          onConfirm={() =>
            confirmAction.action === "approve"
              ? handle批准(confirmAction.id)
              : handle拒绝(confirmAction.id)
          }
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <Modal
        title="提交防护栏进行审核"
        open={isSubmitModalOpen}
        onCancel={() => {
          setIsSubmitModalOpen(false);
          submitForm.resetFields();
        }}
        onOk={() => submitForm.submit()}
        okText="提交审核"
      >
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 mb-4">
          您的防护栏将在激活前发送给管理员审核。
        </div>
        <Form
          form={submitForm}
          layout="vertical"
          initialValues={{ mode: "pre_call" }}
          onFinish={async (values) => {
            const litellm_params: Record<string, unknown> = {
              ...(values.extra_litellm_params ? JSON.parse(values.extra_litellm_params) : {}),
              guardrail: "generic_guardrail_api",
              mode: values.mode,
              api_base: values.api_base,
            };
            try {
              await registerGuardrail.mutateAsync({
                team_id: values.team_id,
                guardrail_name: values.guardrail_name,
                litellm_params,
                guardrail_info: values.guardrail_info ? JSON.parse(values.guardrail_info) : undefined,
              });
              NotificationsManager.success("防护栏已提交审核");
              setIsSubmitModalOpen(false);
              submitForm.resetFields();
              fetchSubmissions();
            } catch {
              // error already handled by networking layer
            }
          }}
        >
          <Form.Item
            label="团队"
            name="team_id"
            rules={[{ required: true, message: "选择团队" }]}
          >
            <TeamDropdown />
          </Form.Item>
          <Form.Item
            label="防护栏名称"
            name="guardrail_name"
            rules={[{ required: true, message: "输入防护栏名称" }]}
          >
            <Input placeholder="例如：pii-detection" />
          </Form.Item>
          <Form.Item
            label="模式"
            name="mode"
            rules={[{ required: true, message: "选择模式" }]}
          >
            <Select>
              <Select.Option value="pre_call">调用前</Select.Option>
              <Select.Option value="post_call">调用后</Select.Option>
              <Select.Option value="during_call">调用中</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="API 基础 URL"
            name="api_base"
            rules={[
              { required: true, message: "输入 API 基础 URL" },
              { type: "url", message: "必须是有效的 URL" },
            ]}
          >
            <Input placeholder="https://your-guardrail-api.com/v1/check" className="font-mono" />
          </Form.Item>
          <Form.Item
            label="额外的 litellm_params（可选）"
            name="extra_litellm_params"
            tooltip="合并到 litellm_params 的 JSON 对象。例如：forward_api_key、headers、model、unreachable_fallback"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed !== "object" || Array.isArray(parsed)) {
                      return Promise.reject("必须是 JSON 对象");
                    }
                    return Promise.resolve();
                  } catch {
                    return Promise.reject("无效的 JSON");
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              className="font-mono text-xs"
              placeholder='{"forward_api_key": true, "headers": {"X-Custom": "value"}}'
            />
          </Form.Item>
          <Form.Item
            label="防护栏信息（可选）"
            name="guardrail_info"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject("无效的 JSON");
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              className="font-mono text-xs"
              placeholder='{"description": "Detects PII in requests"}'
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
