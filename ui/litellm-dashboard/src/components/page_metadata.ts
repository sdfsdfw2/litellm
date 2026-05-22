/**
 * Page metadata for UI Settings configuration
 * This file contains descriptions and metadata for all navigation pages
 */

// Page descriptions for UI Settings configuration
export const pageDescriptions: Record<string, string> = {
  "api-keys": "管理用于 API 访问和身份验证的虚拟密钥",
  "llm-playground": "用于测试 LLM 请求的交互式调试台",
  models: "配置和管理 LLM 模型及端点",
  agents: "创建和管理 AI 代理",
  agentic: "管理智能体资源：代理、工作流运行和记忆",
  workflows: "跟踪和查看持久化工作流运行历史记录",
  "mcp-servers": "配置模型上下文协议（MCP）服务器",
  memory: "查看和管理存储在 /v1/memory 中的代理记忆条目",
  guardrails: "设置内容审核和安全护栏",
  policies: "定义访问控制和使用策略",
  "search-tools": "配置 RAG 搜索和检索工具",
  "tool-policies": "配置工具使用策略和权限",
  "vector-stores": "管理用于嵌入的向量数据库",
  new_usage: "查看使用量分析和指标",
  logs: "访问请求和响应日志",
  "guardrails-monitor": "监控护栏性能并查看日志",
  users: "管理内部用户账户和权限",
  teams: "创建和管理团队以实现访问控制",
  organizations: "管理组织及其成员",
  projects: "管理团队内的项目",
  "access-groups": "管理基于角色的访问组",
  budgets: "设置和监控支出预算",
  "api-reference": "浏览 API 文档和端点",
  "model-hub-table": "探索可用的 AI 模型和提供商",
  "learning-resources": "访问教程和文档",
  caching: "配置响应缓存设置",
  "transform-request": "设置请求转换规则",
  "cost-tracking": "跟踪和分析 API 成本",
  "ui-theme": "自定义仪表盘外观",
  "tag-management": "使用标签组织资源",
  prompts: "管理和版本化提示模板",
  skills: "浏览和管理 Claude Code 技能",
  usage: "查看旧版使用量仪表盘",
  "router-settings": "配置路由和负载均衡设置",
  "logging-and-alerts": "设置日志记录和告警配置",
  "admin-panel": "访问管理面板和设置",
};

export interface PageMetadata {
  page: string;
  label: string;
  group: string;
  description: string;
}
