"use client";

import { MCPServer } from "./types";

export interface RequiredFieldDef {
  key: string;
  label: string;
  description: string;
  check: (server: MCPServer) => boolean;
}

export interface FieldGroup {
  label: string;
  fields: RequiredFieldDef[];
}

export const FIELD_GROUPS: FieldGroup[] = [
  {
    label: "文档",
    fields: [
      {
        key: "description",
        label: "描述",
        description: "必须有非空的描述",
        check: (s) => !!s.description?.trim(),
      },
      {
        key: "alias",
        label: "别名",
        description: "必须有显示别名",
        check: (s) => !!s.alias?.trim(),
      },
    ],
  },
  {
    label: "源代码",
    fields: [
      {
        key: "source_url",
        label: "GitHub / 源代码 URL",
        description: "必须链接到源代码仓库",
        check: (s) => !!s.source_url?.trim(),
      },
    ],
  },
  {
    label: "连接",
    fields: [
      {
        key: "url",
        label: "服务器 URL",
        description: "必须配置 URL",
        check: (s) => !!s.url?.trim(),
      },
    ],
  },
  {
    label: "安全",
    fields: [
      {
        key: "auth_type",
        label: "已配置认证",
        description: "必须使用身份验证（不能为 'none'）",
        check: (s) => !!s.auth_type && s.auth_type !== "none",
      },
    ],
  },
];

export const MCP_REQUIRED_FIELD_DEFS: RequiredFieldDef[] = FIELD_GROUPS.flatMap((g) => g.fields);

export const SETTINGS_KEY = "mcp_required_fields";
