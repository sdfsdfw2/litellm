"use client";

import { useMCPSemanticFilterSettings } from "@/app/(dashboard)/hooks/mcpSemanticFilterSettings/useMCPSemanticFilterSettings";
import { useUpdateMCPSemanticFilterSettings } from "@/app/(dashboard)/hooks/mcpSemanticFilterSettings/useUpdateMCPSemanticFilterSettings";
import NotificationManager from "@/components/molecules/notifications_manager";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Slider,
  Space,
  Switch,
  Typography,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined, CheckCircleOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { fetchAvailableModels, ModelGroup } from "@/components/playground/llm_calls/fetch_models";
import MCPSemanticFilterTestPanel from "./MCPSemanticFilterTestPanel";
import { getCurlCommand, runSemanticFilterTest, TestResult } from "./semanticFilterTestUtils";

interface MCPSemanticFilterSettingsProps {
  accessToken: string | null;
}

export default function MCPSemanticFilterSettings({ accessToken }: MCPSemanticFilterSettingsProps) {
  const { data, isLoading, isError, error } = useMCPSemanticFilterSettings();
  const {
    mutate: updateSettings,
    isPending: isUpdating,
    error: updateError,
  } = useUpdateMCPSemanticFilterSettings(accessToken || "");
  const [form] = Form.useForm();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [embeddingModels, setEmbeddingModels] = useState<ModelGroup[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  // Test section state
  const [testQuery, setTestQuery] = useState("");
  const [testModel, setTestModel] = useState<string>("gpt-4o");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const schema = data?.field_schema;
  const values = data?.values ?? {};

  useEffect(() => {
    const loadEmbeddingModels = async () => {
      if (!accessToken) return;
      try {
        setLoadingModels(true);
        const models = await fetchAvailableModels(accessToken);
        const embeddingOnly = models.filter((model) => model.mode === "embedding");
        setEmbeddingModels(embeddingOnly);
      } catch (error) {
        console.error("Error fetching embedding models:", error);
      } finally {
        setLoadingModels(false);
      }
    };

    loadEmbeddingModels();
  }, [accessToken]);

  useEffect(() => {
    if (values) {
      form.setFieldsValue({
        enabled: values.enabled ?? false,
        embedding_model: values.embedding_model ?? "text-embedding-3-small",
        top_k: values.top_k ?? 10,
        similarity_threshold: values.similarity_threshold ?? 0.3,
      });
      setIsDirty(false);
    }
  }, [values, form]);

  const handleSave = async () => {
    try {
      const formValues = await form.validateFields();
      updateSettings(formValues, {
        onSuccess: () => {
          setIsDirty(false);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
          NotificationManager.success(
            "设置更新成功。更改将在 10 秒内应用于所有 Pod。"
          );
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      });
    } catch (error) {
      console.error("Form validation failed:", error);
    }
  };

  const handleTest = async () => {
    if (!accessToken) {
      return;
    }

    await runSemanticFilterTest({
      accessToken,
      testModel,
      testQuery,
      setIsTesting,
      setTestResult,
    });
  };

  if (!accessToken) {
    return (
      <div className="p-6 text-center text-gray-500">
        请登录以配置语义过滤器设置。
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {isLoading ? (
        <Skeleton active />
      ) : isError ? (
        <Alert
          type="error"
          message="无法加载 MCP 语义过滤器设置"
          description={error instanceof Error ? error.message : undefined}
          style={{ marginBottom: 24 }}
        />
      ) : (
        <>
          <Alert
            type="info"
            message="语义工具过滤"
            description={'基于查询相关性对 MCP 工具进行语义过滤。这可以减少上下文窗口大小并提高工具选择准确性。点击"保存设置"以在所有 Pod 上应用更改（10 秒内生效）。'}
            showIcon
            style={{ marginBottom: 24 }}
          />

          {saveSuccess && (
            <Alert
              type="success"
              message="设置保存成功"
              icon={<CheckCircleOutlined />}
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}

          {updateError && (
            <Alert
              type="error"
              message="无法更新设置"
              description={
                updateError instanceof Error ? updateError.message : undefined
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={24}>
            {/* Left Column - Settings */}
            <Col xs={24} lg={12}>
              <Form
                form={form}
                layout="vertical"
                disabled={isUpdating}
                onValuesChange={() => {
                  setIsDirty(true);
                }}
              >
                <Card style={{ marginBottom: 16 }}>
                  <Form.Item
                    name="enabled"
                    label={
                      <Space>
                        <Typography.Text strong>启用语义过滤</Typography.Text>
                        <Tooltip title="启用后，将仅根据语义相似度在请求中包含最相关的 MCP 工具">
                          <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
                        </Tooltip>
                      </Space>
                    }
                    valuePropName="checked"
                  >
                    <Switch disabled={isUpdating} />
                  </Form.Item>

                  <Typography.Text type="secondary" style={{ display: "block", marginTop: -16, marginBottom: 16 }}>
                    {schema?.properties?.enabled?.description}
                  </Typography.Text>
                </Card>

                <Card title="配置" style={{ marginBottom: 16 }}>
                  <Form.Item
                    name="embedding_model"
                    label={
                      <Space>
                        <Typography.Text strong>嵌入模型</Typography.Text>
                        <Tooltip title="用于生成语义匹配嵌入的模型">
                          <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Select
                      options={embeddingModels.map((model) => ({
                        label: model.model_group,
                        value: model.model_group,
                      }))}
                      placeholder={loadingModels ? "正在加载模型..." : "选择嵌入模型"}
                      showSearch
                      disabled={isUpdating || loadingModels}
                      loading={loadingModels}
                      notFoundContent={
                        loadingModels ? "加载中..." : "无可用嵌入模型"
                      }
                    />
                  </Form.Item>

                  <Form.Item
                    name="top_k"
                    label={
                      <Space>
                        <Typography.Text strong>Top K 结果</Typography.Text>
                        <Tooltip title="过滤后返回的最大工具数量">
                          <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      style={{ width: "100%" }}
                      disabled={isUpdating}
                    />
                  </Form.Item>

                  <Form.Item
                    name="similarity_threshold"
                    label={
                      <Space>
                        <Typography.Text strong>相似度阈值</Typography.Text>
                        <Tooltip title="工具被包含的最低相似度分数（0-1）">
                          <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      marks={{
                        0: "0.0",
                        0.3: "0.3",
                        0.5: "0.5",
                        0.7: "0.7",
                        1: "1.0",
                      }}
                      disabled={isUpdating}
                    />
                  </Form.Item>
                </Card>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={isUpdating}
                    disabled={!isDirty}
                  >
                    保存设置
                  </Button>
                </div>
              </Form>
            </Col>

            {/* Right Column - Test Configuration */}
            <Col xs={24} lg={12}>
              <MCPSemanticFilterTestPanel
                accessToken={accessToken}
                testQuery={testQuery}
                setTestQuery={setTestQuery}
                testModel={testModel}
                setTestModel={setTestModel}
                isTesting={isTesting}
                onTest={handleTest}
                filterEnabled={!!values.enabled}
                testResult={testResult}
                curlCommand={getCurlCommand(testModel, testQuery)}
              />
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
