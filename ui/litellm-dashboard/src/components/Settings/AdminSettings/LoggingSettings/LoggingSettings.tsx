"use client";

import {
  ConfigType,
  GeneralSettingsFieldName,
  useDeleteProxyConfigField,
  useProxyConfig,
} from "@/app/(dashboard)/hooks/proxyConfig/useProxyConfig";
import {
  StoreRequestInSpendLogsParams,
  useStoreRequestInSpendLogs,
} from "@/app/(dashboard)/hooks/storeRequestInSpendLogs/useStoreRequestInSpendLogs";
import NotificationsManager from "@/components/molecules/notifications_manager";
import { parseErrorMessage } from "@/components/shared/errorUtils";
import { ClockCircleOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Skeleton, Space, Switch, Typography } from "antd";
import React, { useMemo } from "react";

const LoggingSettings: React.FC = () => {
  const [form] = Form.useForm();
  const { mutate, isPending } = useStoreRequestInSpendLogs();
  const { mutate: deleteField, isPending: isDeletingField } = useDeleteProxyConfigField();
  const { data: proxyConfigData, isLoading: isLoadingConfig } = useProxyConfig(ConfigType.GENERAL_SETTINGS);
  const storePromptsValue = Form.useWatch("store_prompts_in_spend_logs", form);

  const initialValues = useMemo(() => {
    if (!proxyConfigData) {
      return {
        store_prompts_in_spend_logs: false,
        maximum_spend_logs_retention_period: undefined,
      };
    }

    const storePromptsField = proxyConfigData.find((field) => field.field_name === "store_prompts_in_spend_logs");
    const retentionPeriodField = proxyConfigData.find(
      (field) => field.field_name === "maximum_spend_logs_retention_period",
    );

    return {
      store_prompts_in_spend_logs: storePromptsField?.field_value ?? false,
      maximum_spend_logs_retention_period: retentionPeriodField?.field_value ?? undefined,
    };
  }, [proxyConfigData]);

  const handleFormSubmit = (formValues: StoreRequestInSpendLogsParams) => {
    const retentionPeriodValue = formValues.maximum_spend_logs_retention_period;
    const hasRetentionPeriod =
      typeof retentionPeriodValue === "string" && retentionPeriodValue.trim() !== "";

    const updateParams: StoreRequestInSpendLogsParams = {
      store_prompts_in_spend_logs: formValues.store_prompts_in_spend_logs,
      ...(hasRetentionPeriod && { maximum_spend_logs_retention_period: retentionPeriodValue }),
    };

    const submitUpdate = () =>
      mutate(updateParams, {
        onSuccess: () => NotificationsManager.success("消费日志设置更新成功"),
        onError: (error) =>
          NotificationsManager.fromBackend("保存消费日志设置失败: " + parseErrorMessage(error)),
      });

    if (hasRetentionPeriod) {
      submitUpdate();
      return;
    }

    deleteField(
      {
        config_type: ConfigType.GENERAL_SETTINGS,
        field_name: GeneralSettingsFieldName.MAXIMUM_SPEND_LOGS_RETENTION_PERIOD,
      },
      {
        onError: (deleteError) =>
          console.warn("Failed to delete retention period field (may not exist):", deleteError),
        onSettled: submitUpdate,
      },
    );
  };

  return (
    <Card title="日志记录设置">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
          控制请求和响应数据如何写入消费日志的代理范围设置。
        </Typography.Paragraph>

        <Form
          key={proxyConfigData ? JSON.stringify(initialValues) : "loading"}
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={initialValues}
        >
          <Form.Item
            label="在消费日志中存储提示词"
            name="store_prompts_in_spend_logs"
            tooltip={
              proxyConfigData?.find((f) => f.field_name === "store_prompts_in_spend_logs")?.field_description ||
              "启用后，提示词将存储在消费日志中，用于跟踪和分析。"
            }
            valuePropName="checked"
          >
            {isLoadingConfig ? (
              <Skeleton.Input active block />
            ) : (
              <Switch
                checked={storePromptsValue ?? false}
                onChange={(checked) => form.setFieldValue("store_prompts_in_spend_logs", checked)}
              />
            )}
          </Form.Item>

          <Form.Item
            label="最大消费日志保留期限（可选）"
            name="maximum_spend_logs_retention_period"
            tooltip={
              proxyConfigData?.find((f) => f.field_name === "maximum_spend_logs_retention_period")
                ?.field_description ||
              "设置消费日志的最大保留期限（例如，'7d' 表示 7 天，'30d' 表示 30 天）。留空表示无限制。"
            }
          >
            {isLoadingConfig ? (
              <Skeleton.Input active block />
            ) : (
              <Input placeholder="例如，7d, 30d" prefix={<ClockCircleOutlined />} />
            )}
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isPending || isDeletingField}
              disabled={isLoadingConfig}
            >
              {isPending || isDeletingField ? "保存中..." : "保存设置"}
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
};

export default LoggingSettings;
