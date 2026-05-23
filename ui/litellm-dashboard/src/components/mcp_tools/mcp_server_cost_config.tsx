import React from "react";
import { Tooltip, InputNumber, Collapse, Badge } from "antd";
import { InfoCircleOutlined, DollarOutlined, ToolOutlined } from "@ant-design/icons";
import { Card, Title, Text } from "@tremor/react";
import { MCPServerCostInfo } from "./types";

interface MCPServerCostConfigProps {
  value?: MCPServerCostInfo;
  onChange?: (value: MCPServerCostInfo) => void;
  tools?: any[]; // Receive tools from connection component
  disabled?: boolean;
}

const MCPServerCostConfig: React.FC<MCPServerCostConfigProps> = ({
  value = {},
  onChange,
  tools = [],
  disabled = false,
}) => {
  const handleDefaultCostChange = (defaultCost: number | null) => {
    const updated = {
      ...value,
      default_cost_per_query: defaultCost,
    };
    onChange?.(updated);
  };

  const handleToolCostChange = (toolName: string, cost: number | null) => {
    const updated = {
      ...value,
      tool_name_to_cost_per_query: {
        ...value.tool_name_to_cost_per_query,
        [toolName]: cost,
      },
    };
    onChange?.(updated);
  };

  return (
    <Card>
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarOutlined className="text-green-600" />
          <Title>成本配置</Title>
          <Tooltip title="为此 MCP 服务器的工具调用配置成本。设置默认费率和每个工具的覆盖值。">
            <InfoCircleOutlined className="text-gray-400" />
          </Tooltip>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              每次查询默认成本（$）
              <Tooltip title="每次调用此服务器的工具收取的默认成本。">
                <InfoCircleOutlined className="ml-1 text-gray-400" />
              </Tooltip>
            </label>
            <InputNumber
              min={0}
              step={0.0001}
              precision={4}
              placeholder="0.0000"
              value={value.default_cost_per_query}
              onChange={handleDefaultCostChange}
              disabled={disabled}
              style={{ width: "200px" }}
              addonBefore="$"
            />
            <Text className="block mt-1 text-gray-500 text-sm">
              为此服务器的所有工具调用设置默认成本
            </Text>
          </div>

          {tools.length > 0 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                工具特定成本（$）
                <Tooltip title="覆盖特定工具的默认成本。留空以使用默认费率。">
                  <InfoCircleOutlined className="ml-1 text-gray-400" />
                </Tooltip>
              </label>
              <Collapse
                items={[
                  {
                    key: "1",
                    label: (
                      <div className="flex items-center">
                        <ToolOutlined className="mr-2 text-blue-500" />
                        <span className="font-medium">可用工具</span>
                        <Badge
                          count={tools.length}
                          style={{
                            backgroundColor: "#52c41a",
                            marginLeft: "8px",
                          }}
                        />
                      </div>
                    ),
                    children: (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {tools.map((tool, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <Text className="font-medium text-gray-900">{tool.name}</Text>
                              {tool.description && (
                                <Text className="text-gray-500 text-sm block mt-1">{tool.description}</Text>
                              )}
                            </div>
                            <div className="ml-4">
                              <InputNumber
                                min={0}
                                step={0.0001}
                                precision={4}
                                placeholder="使用默认值"
                                value={value.tool_name_to_cost_per_query?.[tool.name]}
                                onChange={(cost) => handleToolCostChange(tool.name, cost)}
                                disabled={disabled}
                                style={{ width: "120px" }}
                                addonBefore="$"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>

        {(value.default_cost_per_query ||
          (value.tool_name_to_cost_per_query && Object.keys(value.tool_name_to_cost_per_query).length > 0)) && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Text className="text-blue-800 font-medium">成本摘要：</Text>
            <div className="mt-2 space-y-1">
              {value.default_cost_per_query && (
                <Text className="text-blue-700">
                    • 默认成本：每次查询 ${value.default_cost_per_query.toFixed(4)}
                </Text>
              )}
              {value.tool_name_to_cost_per_query &&
                Object.entries(value.tool_name_to_cost_per_query).map(
                  ([toolName, cost]) =>
                    cost !== null &&
                    cost !== undefined && (
                      <Text key={toolName} className="text-blue-700">
                        • {toolName}：每次查询 ${cost.toFixed(4)}
                      </Text>
                    ),
                )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MCPServerCostConfig;
