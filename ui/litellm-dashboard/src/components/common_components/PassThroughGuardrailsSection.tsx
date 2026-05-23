import React, { useState, useEffect } from "react";
import { Card, Title, Subtitle } from "@tremor/react";
import { Form, Select, Tooltip, Alert } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import GuardrailSelector from "../guardrails/GuardrailSelector";

interface PassThroughGuardrailsSectionProps {
  accessToken: string;
  value?: Record<string, { request_fields?: string[]; response_fields?: string[] } | null>;
  onChange?: (guardrails: Record<string, { request_fields?: string[]; response_fields?: string[] } | null>) => void;
  disabled?: boolean;
}

const PassThroughGuardrailsSection: React.FC<PassThroughGuardrailsSectionProps> = ({
  accessToken,
  value = {},
  onChange,
  disabled = false,
}) => {
  const [selectedGuardrails, setSelectedGuardrails] = useState<string[]>(Object.keys(value));
  const [guardrailSettings, setGuardrailSettings] = useState<
    Record<string, { request_fields?: string[]; response_fields?: string[] } | null>
  >(value);

  // Sync external value changes
  useEffect(() => {
    setGuardrailSettings(value);
    setSelectedGuardrails(Object.keys(value));
  }, [value]);

  const handleGuardrailChange = (guardrails: string[]) => {
    setSelectedGuardrails(guardrails);

    // Create new settings object with selected guardrails
    const newSettings: Record<string, { request_fields?: string[]; response_fields?: string[] } | null> = {};
    guardrails.forEach((name) => {
      // Preserve existing settings or set to null (uses entire payload)
      newSettings[name] = guardrailSettings[name] || null;
    });

    setGuardrailSettings(newSettings);
    if (onChange) {
      onChange(newSettings);
    }
  };

  const handleFieldChange = (
    guardrailName: string,
    fieldType: "request_fields" | "response_fields",
    fields: string[]
  ) => {
    const currentSettings = guardrailSettings[guardrailName] || {};
    const newSettings = {
      ...guardrailSettings,
      [guardrailName]: {
        ...currentSettings,
        [fieldType]: fields.length > 0 ? fields : undefined,
      },
    };

    // If no fields are set, set to null (entire payload)
    if (!newSettings[guardrailName]?.request_fields && !newSettings[guardrailName]?.response_fields) {
      newSettings[guardrailName] = null;
    }

    setGuardrailSettings(newSettings);
    if (onChange) {
      onChange(newSettings);
    }
  };

  return (
    <Card className="p-6">
      <Title className="text-lg font-semibold text-gray-900 mb-2">护栏</Title>
      <Subtitle className="text-gray-600 mb-6">
        配置护栏以对请求和响应强制执行策略。护栏对透传端点为可选加入功能。
      </Subtitle>

      <Alert
        message={
          <span>
            字段级定位{" "}
            <a
              href="https://docs.litellm.ai/docs/proxy/pass_through_guardrails#field-level-targeting"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              （了解更多）
            </a>
          </span>
        }
        description={
          <div className="space-y-2">
            <div>
              可选指定要检查的字段。如果留空，则整个请求/响应都会发送到护栏。
            </div>
            <div className="text-xs space-y-1 mt-2">
              <div className="font-medium">常见示例：</div>
              <div>• <code className="bg-gray-100 px-1 rounded">query</code> - Single field</div>
              <div>• <code className="bg-gray-100 px-1 rounded">documents[*].text</code> - All text in documents array</div>
              <div>• <code className="bg-gray-100 px-1 rounded">messages[*].content</code> - All message contents</div>
            </div>
          </div>
        }
        type="info"
        showIcon
        className="mb-4"
      />

      <Form.Item
        label={
          <span className="text-sm font-medium text-gray-700 flex items-center">
            选择护栏
            <Tooltip title="选择此端点应运行的护栏。组织/团队/密钥级别的护栏也会包含在内。">
              <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
            </Tooltip>
          </span>
        }
      >
        <GuardrailSelector
          accessToken={accessToken}
          value={selectedGuardrails}
          onChange={handleGuardrailChange}
          disabled={disabled}
        />
      </Form.Item>

      {selectedGuardrails.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">字段定位（可选）</div>
            <div className="text-xs text-gray-500">
              💡 提示：留空以检查整个负载
            </div>
          </div>
          {selectedGuardrails.map((guardrailName) => (
            <Card key={guardrailName} className="p-4 bg-gray-50">
              <div className="text-sm font-medium text-gray-900 mb-3">{guardrailName}</div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-600 flex items-center">
                      请求字段（pre_call）
                      <Tooltip title={
                        <div>
                          <div className="font-medium mb-1">指定要检查的请求字段</div>
                          <div className="text-xs space-y-1">
                            <div>示例：</div>
                            <div>• query</div>
                            <div>• documents[*].text</div>
                            <div>• messages[*].content</div>
                          </div>
                        </div>
                      }>
                        <InfoCircleOutlined className="ml-1 text-gray-400" />
                      </Tooltip>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const current = guardrailSettings[guardrailName]?.request_fields || [];
                          handleFieldChange(guardrailName, "request_fields", [...current, "query"]);
                        }}
                        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        disabled={disabled}
                      >
                        + query
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = guardrailSettings[guardrailName]?.request_fields || [];
                          handleFieldChange(guardrailName, "request_fields", [...current, "documents[*]"]);
                        }}
                        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        disabled={disabled}
                      >
                        + documents[*]
                      </button>
                    </div>
                  </div>
                  <Select
                    mode="tags"
                    style={{ width: "100%" }}
                    placeholder="输入字段名称或使用上方 + 按钮（例如：query, documents[*].text）"
                    value={guardrailSettings[guardrailName]?.request_fields || []}
                    onChange={(fields) => handleFieldChange(guardrailName, "request_fields", fields)}
                    disabled={disabled}
                    tokenSeparators={[","]}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-600 flex items-center">
                      响应字段（post_call）
                      <Tooltip title={
                        <div>
                          <div className="font-medium mb-1">指定要检查的响应字段</div>
                          <div className="text-xs space-y-1">
                            <div>示例：</div>
                            <div>• results[*].text</div>
                            <div>• choices[*].message.content</div>
                          </div>
                        </div>
                      }>
                        <InfoCircleOutlined className="ml-1 text-gray-400" />
                      </Tooltip>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const current = guardrailSettings[guardrailName]?.response_fields || [];
                          handleFieldChange(guardrailName, "response_fields", [...current, "results[*]"]);
                        }}
                        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        disabled={disabled}
                      >
                        + results[*]
                      </button>
                    </div>
                  </div>
                  <Select
                    mode="tags"
                    style={{ width: "100%" }}
                    placeholder="输入字段名称或使用上方 + 按钮（例如：results[*].text）"
                    value={guardrailSettings[guardrailName]?.response_fields || []}
                    onChange={(fields) => handleFieldChange(guardrailName, "response_fields", fields)}
                    disabled={disabled}
                    tokenSeparators={[","]}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};

export default PassThroughGuardrailsSection;

