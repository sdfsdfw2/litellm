import { CodeOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Space, Tabs, Typography } from "antd";
import ModelSelector from "@/components/common_components/ModelSelector";
import { TestResult } from "./semanticFilterTestUtils";

interface MCPSemanticFilterTestPanelProps {
  accessToken: string | null;
  testQuery: string;
  setTestQuery: (value: string) => void;
  testModel: string;
  setTestModel: (value: string) => void;
  isTesting: boolean;
  onTest: () => void;
  filterEnabled: boolean;
  testResult: TestResult | null;
  curlCommand: string;
}

export default function MCPSemanticFilterTestPanel({
  accessToken,
  testQuery,
  setTestQuery,
  testModel,
  setTestModel,
  isTesting,
  onTest,
  filterEnabled,
  testResult,
  curlCommand,
}: MCPSemanticFilterTestPanelProps) {
  return (
    <Card title="测试配置" style={{ marginBottom: 16 }}>
      <Tabs
        defaultActiveKey="test"
        items={[
          {
            key: "test",
            label: "测试",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              <PlayCircleOutlined /> 测试查询
            </Typography.Text>
            <Input.TextArea
              placeholder="输入测试查询以查看将选择哪些工具..."
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              rows={4}
              disabled={isTesting}
            />
          </div>

          <div>
            <ModelSelector
              accessToken={accessToken || ""}
              value={testModel}
              onChange={setTestModel}
              disabled={isTesting}
              showLabel={true}
              labelText="选择模型"
            />
          </div>

          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onTest}
            loading={isTesting}
            disabled={!testQuery || !testModel || !filterEnabled}
            block
          >
            测试过滤器
          </Button>

          {!filterEnabled && (
            <Alert
              type="warning"
              message="语义过滤已禁用"
              description="启用语义过滤并保存设置以测试过滤器。"
              showIcon
            />
          )}

          {testResult && (
            <div>
              <Typography.Title level={5}>结果</Typography.Title>
              <Alert
                type="success"
                message={`已选择 ${testResult.selectedTools} 个工具`}
                description={`从 ${testResult.totalTools} 个可用工具中过滤`}
                showIcon
                style={{ marginBottom: 16 }}
              />
              <div>
                <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                  已选工具：
                </Typography.Text>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {testResult.tools.map((tool, index) => (
                    <li key={index} style={{ marginBottom: 4 }}>
                      <Typography.Text>{tool}</Typography.Text>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
              </Space>
            ),
          },
          {
            key: "api",
            label: "API 使用",
            children: (
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <CodeOutlined />
                  <Typography.Text strong>API 使用</Typography.Text>
                </Space>
                <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  使用此 curl 命令测试当前配置的语义过滤器。
                </Typography.Text>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              要检查的响应头：
            </Typography.Text>
            <ul style={{ paddingLeft: 20, margin: "0 0 12px 0" }}>
              <li>
                <Typography.Text>
                  x-litellm-semantic-filter：显示总工具数 → 已选工具数
                </Typography.Text>
                <Typography.Text type="secondary" style={{ display: "block" }}>
                  示例：10→3
                </Typography.Text>
              </li>
              <li>
                <Typography.Text>
                  x-litellm-semantic-filter-tools：已选工具名称的 CSV
                </Typography.Text>
                <Typography.Text type="secondary" style={{ display: "block" }}>
                  示例：wikipedia-fetch,github-search,slack-post
                </Typography.Text>
              </li>
            </ul>
            <pre
              style={{
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 4,
                overflow: "auto",
                fontSize: 12,
                margin: 0,
              }}
            >
              {curlCommand}
            </pre>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
