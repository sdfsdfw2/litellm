import React from "react";
import { Button, Spin, Alert, Collapse } from "antd";
import { CheckCircleOutlined, ExclamationCircleOutlined, ReloadOutlined, ToolOutlined } from "@ant-design/icons";
import { Card, Title, Text } from "@tremor/react";

interface MCPConnectionStatusProps {
  formValues: Record<string, any>;
  tools: any[];
  isLoadingTools: boolean;
  toolsError: string | null;
  toolsErrorStackTrace: string | null;
  canFetchTools: boolean;
  fetchTools: () => Promise<void>;
}

const MCPConnectionStatus: React.FC<MCPConnectionStatusProps> = ({
  formValues,
  tools,
  isLoadingTools,
  toolsError,
  toolsErrorStackTrace,
  canFetchTools,
  fetchTools,
}) => {

  // Don't show anything if required fields aren't filled
  if (!canFetchTools && !formValues.url && !formValues.spec_path) {
    return null;
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircleOutlined className="text-blue-600" />
          <Title>连接状态</Title>
        </div>

        {!canFetchTools && (formValues.url || formValues.spec_path) && (
          <div className="text-center py-6 text-gray-400 border rounded-lg border-dashed">
            <ToolOutlined className="text-2xl mb-2" />
            <Text>请填写必填字段以测试连接</Text>
            <br />
            <Text className="text-sm">填写 URL、传输方式和身份验证以测试 MCP 服务器连接</Text>
          </div>
        )}

        {canFetchTools && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Text className="text-gray-700 font-medium">
                  {isLoadingTools
                    ? "正在测试 MCP 服务器连接..."
                    : tools.length > 0
                      ? "连接成功"
                      : toolsError
                        ? "连接失败"
                        : "准备测试连接"}
                </Text>
                <br />
                <Text className="text-gray-500 text-sm">服务器: {formValues.url || formValues.spec_path}</Text>
              </div>

              {isLoadingTools && (
                <div className="flex items-center text-blue-600">
                  <Spin size="small" className="mr-2" />
                  <Text className="text-blue-600">正在连接...</Text>
                </div>
              )}

              {!isLoadingTools && !toolsError && tools.length > 0 && (
                <div className="flex items-center text-green-600">
                  <CheckCircleOutlined className="mr-1" />
                  <Text className="text-green-600 font-medium">已连接</Text>
                </div>
              )}

              {toolsError && (
                <div className="flex items-center text-red-600">
                  <ExclamationCircleOutlined className="mr-1" />
                  <Text className="text-red-600 font-medium">失败</Text>
                </div>
              )}
            </div>

            {isLoadingTools && (
              <div className="flex items-center justify-center py-6">
                <Spin size="large" />
                <Text className="ml-3">正在测试连接并加载工具...</Text>
              </div>
            )}

            {toolsError && (
              <Alert
                message="连接失败"
                description={
                  <div>
                    <div>{toolsError}</div>
                    {toolsErrorStackTrace && (
                      <Collapse
                        items={[
                          {
                            key: "stack-trace",
                            label: "堆栈跟踪",
                            children: (
                              <pre style={{ 
                                whiteSpace: "pre-wrap", 
                                wordBreak: "break-word",
                                fontSize: "12px",
                                fontFamily: "monospace",
                                margin: 0,
                                padding: "8px",
                                backgroundColor: "#f5f5f5",
                                borderRadius: "4px",
                                maxHeight: "400px",
                                overflow: "auto"
                              }}>
                                {toolsErrorStackTrace}
                              </pre>
                            ),
                          },
                        ]}
                        style={{ marginTop: "12px" }}
                      />
                    )}
                  </div>
                }
                type="error"
                showIcon
                action={
                  <Button icon={<ReloadOutlined />} onClick={fetchTools} size="small">
                    重试
                  </Button>
                }
              />
            )}

            {!isLoadingTools && tools.length === 0 && !toolsError && (
              <div className="text-center py-6 text-gray-500 border rounded-lg border-dashed">
                <CheckCircleOutlined className="text-2xl mb-2 text-green-500" />
                <Text className="text-green-600 font-medium">连接成功！</Text>
                <br />
                <Text className="text-gray-500">未找到此 MCP 服务器的工具</Text>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default MCPConnectionStatus;
