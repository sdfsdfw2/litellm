import React from "react";
import { Card, Text } from "@tremor/react";
import { Button, Divider, Empty, Input, Select, Space, Tooltip } from "antd";
import { InfoCircleOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";

export type ToolPermissionDecision = "allow" | "deny";
export type ToolPermissionDefaultAction = "allow" | "deny";
export type ToolPermissionOnDisallowedAction = "block" | "rewrite";

export interface ToolPermissionRuleConfig {
  id: string;
  tool_name?: string;
  tool_type?: string;
  decision: ToolPermissionDecision;
  allowed_param_patterns?: Record<string, string>;
}

export interface ToolPermissionConfig {
  rules: ToolPermissionRuleConfig[];
  default_action: ToolPermissionDefaultAction;
  on_disallowed_action: ToolPermissionOnDisallowedAction;
  violation_message_template?: string;
}

interface ToolPermissionRulesEditorProps {
  value?: ToolPermissionConfig;
  onChange?: (config: ToolPermissionConfig) => void;
  disabled?: boolean;
}

const DEFAULT_CONFIG: ToolPermissionConfig = {
  rules: [],
  default_action: "deny",
  on_disallowed_action: "block",
  violation_message_template: "",
};

const ensureConfig = (config?: ToolPermissionConfig): ToolPermissionConfig => ({
  ...DEFAULT_CONFIG,
  ...(config || {}),
  rules: config?.rules ? [...config.rules] : [],
});

const ToolPermissionRulesEditor: React.FC<ToolPermissionRulesEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const config = ensureConfig(value);

  const updateConfig = (partial: Partial<ToolPermissionConfig>) => {
    const nextConfig: ToolPermissionConfig = {
      ...config,
      ...partial,
    };
    onChange?.(nextConfig);
  };

  const updateRule = (ruleIndex: number, updates: Partial<ToolPermissionRuleConfig>) => {
    const nextRules = config.rules.map((rule, index) =>
      index === ruleIndex ? { ...rule, ...updates } : rule,
    );
    updateConfig({ rules: nextRules });
  };

  const addRule = () => {
    const nextRules = [
      ...config.rules,
      {
        id: `rule_${Math.random().toString(36).slice(2, 8)}`,
        decision: "allow" as ToolPermissionDecision,
        allowed_param_patterns: undefined,
      },
    ];
    updateConfig({ rules: nextRules });
  };

  const removeRule = (ruleIndex: number) => {
    const nextRules = config.rules.filter((_, index) => index !== ruleIndex);
    updateConfig({ rules: nextRules });
  };

  const updateAllowedParamEntries = (
    ruleIndex: number,
    mutate: (entries: [string, string][]) => void,
  ) => {
    const targetRule = config.rules[ruleIndex];
    if (!targetRule) {
      return;
    }
    const entries = Object.entries(targetRule.allowed_param_patterns || {});
    mutate(entries);
    const updatedObject: Record<string, string> = {};
    entries.forEach(([key, value]) => {
      updatedObject[key] = value;
    });
    updateRule(ruleIndex, {
      allowed_param_patterns:
        Object.keys(updatedObject).length > 0 ? updatedObject : undefined,
    });
  };

  const updateAllowedParamPath = (
    ruleIndex: number,
    entryIndex: number,
    nextPath: string,
  ) => {
    updateAllowedParamEntries(ruleIndex, (entries) => {
      if (!entries[entryIndex]) {
        return;
      }
      const [, value] = entries[entryIndex];
      entries[entryIndex] = [nextPath, value];
    });
  };

  const updateAllowedParamPattern = (
    ruleIndex: number,
    entryIndex: number,
    pattern: string,
  ) => {
    updateAllowedParamEntries(ruleIndex, (entries) => {
      if (!entries[entryIndex]) {
        return;
      }
      const [path] = entries[entryIndex];
      entries[entryIndex] = [path, pattern];
    });
  };

  const renderAllowedParamPatterns = (rule: ToolPermissionRuleConfig, index: number) => {
    const entries = Object.entries(rule.allowed_param_patterns || {});
    if (entries.length === 0) {
      return (
        <Button
          disabled={disabled}
          size="small"
          onClick={() => updateRule(index, { allowed_param_patterns: { "": "" } })}
        >
          + 限制工具参数（可选）
        </Button>
      );
    }

    return (
      <div className="space-y-2">
        <Text className="text-sm text-gray-600">参数约束（点号或数组路径）</Text>
        {entries.map(([path, pattern], patternIndex) => (
          <Space key={`${rule.id || index}-${patternIndex}`} align="start">
            <Input
              disabled={disabled}
              placeholder="messages[0].content"
              value={path}
              onChange={(e) => updateAllowedParamPath(index, patternIndex, e.target.value)}
            />
            <Input
              disabled={disabled}
              placeholder="^email@.*$"
              value={pattern}
              onChange={(e) => updateAllowedParamPattern(index, patternIndex, e.target.value)}
            />
            <Button
              disabled={disabled}
              icon={<DeleteOutlined />}
              danger
              onClick={() =>
                updateAllowedParamEntries(index, (entries) => {
                  entries.splice(patternIndex, 1);
                })
              }
            />
          </Space>
        ))}
        <Button
          disabled={disabled}
          size="small"
          onClick={() =>
            updateRule(index, {
              allowed_param_patterns: {
                ...(rule.allowed_param_patterns || {}),
                "": "",
              },
            })
          }
        >
          + 添加另一个约束
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <Text className="text-lg font-semibold">LiteLLM 工具权限防护栏</Text>
          <Text className="text-sm text-gray-500">
            为工具名称或类型提供正则表达式模式（例如 ^mcp__github_.*$），并可选择约束负载字段。
          </Text>
        </div>
        {!disabled && (
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={addRule}
            className="!bg-blue-600 !text-white hover:!bg-blue-500"
          >
            添加规则
          </Button>
        )}
      </div>

      <Divider />

      {config.rules.length === 0 ? (
        <Empty description="尚未添加工具规则" />
      ) : (
        <div className="space-y-4">
          {config.rules.map((rule, index) => (
            <Card key={rule.id || index} className="bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <Text className="font-semibold">规则 {index + 1}</Text>
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  type="text"
                  disabled={disabled}
                  onClick={() => removeRule(index)}
                >
                  移除
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Text className="text-sm font-medium">规则 ID</Text>
                  <Input
                    disabled={disabled}
                    placeholder="唯一规则标识符"
                    value={rule.id}
                    onChange={(e) => updateRule(index, { id: e.target.value })}
                  />
                </div>
                <div>
                  <Text className="text-sm font-medium">工具名称（可选）</Text>
                  <Input
                    disabled={disabled}
                    placeholder="^mcp__github_.*$"
                    value={rule.tool_name ?? ""}
                    onChange={(e) =>
                      updateRule(index, {
                        tool_name: e.target.value.trim() === "" ? undefined : e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                <div>
                  <Text className="text-sm font-medium">工具类型（可选）</Text>
                  <Input
                    disabled={disabled}
                    placeholder="^function$"
                    value={rule.tool_type ?? ""}
                    onChange={(e) =>
                      updateRule(index, {
                        tool_type: e.target.value.trim() === "" ? undefined : e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Text className="text-sm font-medium">决策</Text>
                <Select
                  disabled={disabled}
                  value={rule.decision}
                  style={{ width: 200 }}
                  onChange={(value) => updateRule(index, { decision: value as ToolPermissionDecision })}
                >
                  <Select.Option value="allow">允许</Select.Option>
                  <Select.Option value="deny">拒绝</Select.Option>
                </Select>
              </div>

              <div className="mt-4">{renderAllowedParamPatterns(rule, index)}</div>
            </Card>
          ))}
        </div>
      )}

      <Divider />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Text className="text-sm font-medium">默认操作</Text>
          <Select
            disabled={disabled}
            value={config.default_action}
            onChange={(value) => updateConfig({ default_action: value as ToolPermissionDefaultAction })}
          >
            <Select.Option value="allow">允许</Select.Option>
            <Select.Option value="deny">拒绝</Select.Option>
          </Select>
        </div>
        <div>
          <Text className="text-sm font-medium flex items-center gap-1">
            禁止操作时
            <Tooltip title="拦截：当调用被禁止的工具时返回错误。重写：移除工具调用但让响应的其余部分继续。">
              <InfoCircleOutlined />
            </Tooltip>
          </Text>
          <Select
            disabled={disabled}
            value={config.on_disallowed_action}
            onChange={(value) =>
              updateConfig({ on_disallowed_action: value as ToolPermissionOnDisallowedAction })
            }
          >
            <Select.Option value="block">拦截</Select.Option>
            <Select.Option value="rewrite">重写</Select.Option>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Text className="text-sm font-medium">违规消息（可选）</Text>
        <Input.TextArea
          disabled={disabled}
          rows={3}
          placeholder="这违反了我们的组织策略..."
          value={config.violation_message_template}
          onChange={(e) => updateConfig({ violation_message_template: e.target.value })}
        />
      </div>
    </Card>
  );
};

export default ToolPermissionRulesEditor;
