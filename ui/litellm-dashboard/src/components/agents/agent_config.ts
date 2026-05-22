/**
 * Shared configuration for agent form fields
 * Used across create, view, and update operations
 */

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "url" | "switch" | "list";
  required?: boolean;
  tooltip?: string;
  placeholder?: string;
  defaultValue?: any;
  rows?: number;
  validation?: any[];
}

export interface SectionConfig {
  key: string;
  title: string;
  fields: FieldConfig[];
  defaultExpanded?: boolean;
}

export const AGENT_FORM_CONFIG: {
  basic: SectionConfig;
  skills: SectionConfig;
  capabilities: SectionConfig;
  optional: SectionConfig;
  litellm: SectionConfig;
  cost: SectionConfig;
  tracing: SectionConfig;
} = {
  basic: {
    key: "basic",
    title: "基本信息",
    defaultExpanded: true,
    fields: [
      {
        name: "name",
        label: "显示名称",
        type: "text",
        required: true,
        placeholder: "例如：客户支持助手",
      },
      {
        name: "description",
        label: "描述",
        type: "textarea",
        required: true,
        placeholder: "描述此代理的功能...",
        rows: 3,
      },
      {
        name: "url",
        label: "网址",
        type: "url",
        required: false,
        placeholder: "http://localhost:9999/",
        tooltip: "代理托管的基础网址（可选）",
      },
      {
        name: "version",
        label: "版本",
        type: "text",
        placeholder: "1.0.0",
        defaultValue: "1.0.0",
      },
      {
        name: "protocolVersion",
        label: "协议版本",
        type: "text",
        placeholder: "1.0",
        defaultValue: "1.0",
      },
    ],
  },
  skills: {
    key: "skills",
    title: "技能",
    fields: [
      {
        name: "skills",
        label: "技能",
        type: "list",
        defaultValue: [],
      },
    ],
  },
  capabilities: {
    key: "capabilities",
    title: "能力",
    fields: [
      {
        name: "streaming",
        label: "流式传输",
        type: "switch",
        defaultValue: false,
      },
      {
        name: "pushNotifications",
        label: "推送通知",
        type: "switch",
      },
      {
        name: "stateTransitionHistory",
        label: "状态转换历史",
        type: "switch",
      },
    ],
  },
  optional: {
    key: "optional",
    title: "可选设置",
    fields: [
      {
        name: "iconUrl",
        label: "图标网址",
        type: "url",
        placeholder: "https://example.com/icon.png",
      },
      {
        name: "documentationUrl",
        label: "文档网址",
        type: "url",
        placeholder: "https://docs.example.com",
      },
      {
        name: "supportsAuthenticatedExtendedCard",
        label: "支持认证扩展卡片",
        type: "switch",
      },
    ],
  },
  litellm: {
    key: "litellm",
    title: "LiteLLM 参数",
    fields: [
      {
        name: "model",
        label: "模型（可选）",
        type: "text",
      },
      {
        name: "make_public",
        label: "设为公开",
        type: "switch",
      },
    ],
  },
  cost: {
    key: "cost",
    title: "费用配置",
    fields: [
      {
        name: "cost_per_query",
        label: "每次查询费用（$）",
        type: "text",
        placeholder: "0.0",
        tooltip: "每次查询的固定费用",
      },
      {
        name: "input_cost_per_token",
        label: "每 Token 输入费用（$）",
        type: "text",
        placeholder: "0.000001",
        tooltip: "每输入 Token 的费用",
      },
      {
        name: "output_cost_per_token",
        label: "每 Token 输出费用（$）",
        type: "text",
        placeholder: "0.000002",
        tooltip: "每输出 Token 的费用",
      },
    ],
  },
  tracing: {
    key: "tracing",
    title: "追踪",
    fields: [
      {
        name: "enable_tracing",
        label: "启用追踪",
        type: "switch",
        defaultValue: false,
        tooltip: "为此代理启用请求追踪",
      },
    ],
  },
};

export const SKILL_FIELD_CONFIG = {
  id: {
    name: "id",
    label: "技能 ID",
    required: true,
    placeholder: "例如：hello_world",
  },
  name: {
    name: "name",
    label: "技能名称",
    required: true,
    placeholder: "例如：返回 hello world",
  },
  description: {
    name: "description",
    label: "描述",
    required: true,
    placeholder: "此技能的功能说明",
    rows: 2,
  },
  tags: {
    name: "tags",
    label: "标签（逗号分隔）",
    required: true,
    placeholder: "例如：hello world, greeting",
  },
  examples: {
    name: "examples",
    label: "示例（逗号分隔）",
    placeholder: "例如：hi, hello world",
  },
};

/**
 * Get default form values from configuration
 */
export const getDefaultFormValues = () => {
  const defaults: any = {
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
  };

  Object.values(AGENT_FORM_CONFIG).forEach((section) => {
    section.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
  });

  return defaults;
};

/**
 * Build agent data from form values according to AgentConfig spec
 */
export const buildAgentDataFromForm = (values: any, existingAgent?: any) => {
  const agentData: any = {
    agent_name: values.agent_name,
    agent_card_params: {
      protocolVersion: values.protocolVersion || "1.0",
      name: values.name || values.agent_name,
      description: values.description || "",
      url: values.url || "",
      version: values.version || "1.0.0",
      defaultInputModes: existingAgent?.agent_card_params?.defaultInputModes || ["text"],
      defaultOutputModes: existingAgent?.agent_card_params?.defaultOutputModes || ["text"],
      capabilities: {
        streaming: values.streaming === true,
        ...(values.pushNotifications !== undefined && { pushNotifications: values.pushNotifications }),
        ...(values.stateTransitionHistory !== undefined && { stateTransitionHistory: values.stateTransitionHistory }),
      },
      skills: values.skills || [],
      ...(values.iconUrl && { iconUrl: values.iconUrl }),
      ...(values.documentationUrl && { documentationUrl: values.documentationUrl }),
      ...(values.supportsAuthenticatedExtendedCard !== undefined && {
        supportsAuthenticatedExtendedCard: values.supportsAuthenticatedExtendedCard,
      }),
    },
  };

  const params: Record<string, any> = {};

  if (values.model) params.model = values.model;
  if (values.make_public !== undefined) params.make_public = values.make_public;
  if (values.cost_per_query) params.cost_per_query = parseFloat(values.cost_per_query);
  if (values.input_cost_per_token) params.input_cost_per_token = parseFloat(values.input_cost_per_token);
  if (values.output_cost_per_token) params.output_cost_per_token = parseFloat(values.output_cost_per_token);

  if (Object.keys(params).length > 0) {
    agentData.litellm_params = params;
  }

  if (values.tpm_limit != null) agentData.tpm_limit = values.tpm_limit;
  if (values.rpm_limit != null) agentData.rpm_limit = values.rpm_limit;
  if (values.session_tpm_limit != null) agentData.session_tpm_limit = values.session_tpm_limit;
  if (values.session_rpm_limit != null) agentData.session_rpm_limit = values.session_rpm_limit;
  // static_headers: convert [{header, value}, ...] → {header: value, ...}
  if (Array.isArray(values.static_headers) && values.static_headers.length > 0) {
    const staticHeaders: Record<string, string> = {};
    values.static_headers.forEach((entry: { header?: string; value?: string }) => {
      const key = entry?.header?.trim();
      if (key) staticHeaders[key] = entry?.value ?? "";
    });
    if (Object.keys(staticHeaders).length > 0) {
      agentData.static_headers = staticHeaders;
    }
  }

  // extra_headers: already an array of strings from Select tags
  if (Array.isArray(values.extra_headers) && values.extra_headers.length > 0) {
    agentData.extra_headers = values.extra_headers;
  }

  return agentData;
};

/**
 * Parse agent data for form fields
 */
export const parseAgentForForm = (agent: any) => {
  const skills =
    agent.agent_card_params?.skills?.map((skill: any) => ({
      ...skill,
      tags: skill.tags,
      examples: skill.examples || [],
    })) || [];

  return {
    agent_name: agent.agent_name,
    name: agent.agent_card_params?.name,
    description: agent.agent_card_params?.description,
    url: agent.agent_card_params?.url,
    version: agent.agent_card_params?.version,
    protocolVersion: agent.agent_card_params?.protocolVersion,
    streaming: agent.agent_card_params?.capabilities?.streaming,
    pushNotifications: agent.agent_card_params?.capabilities?.pushNotifications,
    stateTransitionHistory: agent.agent_card_params?.capabilities?.stateTransitionHistory,
    skills: skills,
    iconUrl: agent.agent_card_params?.iconUrl,
    documentationUrl: agent.agent_card_params?.documentationUrl,
    supportsAuthenticatedExtendedCard: agent.agent_card_params?.supportsAuthenticatedExtendedCard,
    model: agent.litellm_params?.model,
    make_public: agent.litellm_params?.make_public,
    cost_per_query: agent.litellm_params?.cost_per_query,
    input_cost_per_token: agent.litellm_params?.input_cost_per_token,
    output_cost_per_token: agent.litellm_params?.output_cost_per_token,
    tpm_limit: agent.tpm_limit,
    rpm_limit: agent.rpm_limit,
    session_tpm_limit: agent.session_tpm_limit,
    session_rpm_limit: agent.session_rpm_limit,
    // static_headers: {key: value} → [{header, value}, ...]
    static_headers: agent.static_headers
      ? Object.entries(agent.static_headers as Record<string, string>).map(([header, value]) => ({
          header,
          value,
        }))
      : [],
    // extra_headers: already an array of strings
    extra_headers: agent.extra_headers ?? [],
  };
};
