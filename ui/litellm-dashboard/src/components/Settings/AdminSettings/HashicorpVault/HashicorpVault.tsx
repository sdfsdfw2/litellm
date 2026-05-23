"use client";

import { useState } from "react";
import { useHashicorpVaultConfig } from "@/app/(dashboard)/hooks/configOverrides/useHashicorpVaultConfig";
import { useDeleteHashicorpVaultConfig } from "@/app/(dashboard)/hooks/configOverrides/useDeleteHashicorpVaultConfig";
import { useUpdateHashicorpVaultConfig } from "@/app/(dashboard)/hooks/configOverrides/useUpdateHashicorpVaultConfig";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import DeleteResourceModal from "@/components/common_components/DeleteResourceModal";
import NotificationManager from "@/components/molecules/notifications_manager";
import { testHashicorpVaultConnection } from "@/app/(dashboard)/hooks/configOverrides/hashicorpVaultApi";
import { Alert, Button, Card, Descriptions, Flex, Skeleton, Space, Typography } from "antd";
import { Edit, KeyRound, PlugZap, Trash2 } from "lucide-react";
import { SENSITIVE_FIELDS, FIELD_LABELS } from "./constants";
import EditHashicorpVaultModal from "./EditHashicorpVaultModal";
import HashicorpVaultEmptyPlaceholder from "./HashicorpVaultEmptyPlaceholder";

const { Title, Text } = Typography;

function detectAuthMethod(values: Record<string, any>): string {
  if (values.approle_role_id || values.approle_secret_id) return "AppRole";
  if (values.client_cert && values.client_key) return "TLS Certificate";
  if (values.vault_token) return "Token";
  return "None";
}

const descriptionsConfig = {
  column: { xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 },
};

export default function HashicorpVault() {
  const { accessToken } = useAuthorized();
  const { data, isLoading, isError, error } = useHashicorpVaultConfig();
  const { mutate: deleteConfig, isPending: isDeleting } = useDeleteHashicorpVaultConfig(accessToken);
  const { mutate: updateConfig, isPending: isClearingField } = useUpdateHashicorpVaultConfig(accessToken);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clearingField, setClearingField] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const rawValues = data?.values ?? {};
  const isConfigured = Boolean(rawValues.vault_addr);

  const handleTestConnection = async () => {
    if (!accessToken) return;
    setIsTesting(true);
    try {
      const result = await testHashicorpVaultConnection(accessToken);
      NotificationManager.success(result.message || "Vault 连接成功！");
    } catch (err) {
      NotificationManager.fromBackend(err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = () => {
    deleteConfig(undefined, {
      onSuccess: () => {
        NotificationManager.success("Hashicorp Vault 配置已删除");
        setIsDeleteModalOpen(false);
      },
      onError: (err) => {
        NotificationManager.fromBackend(err);
      },
    });
  };

  const handleClearField = () => {
    if (!clearingField) return;
    updateConfig({ [clearingField]: "" }, {
      onSuccess: () => {
        NotificationManager.success(`${FIELD_LABELS[clearingField] ?? clearingField} 已清除`);
        setClearingField(null);
      },
      onError: (err) => {
        NotificationManager.fromBackend(err);
      },
    });
  };

  const renderValue = (key: string) => {
    const value = rawValues[key];
    if (!value) {
      return <span className="text-gray-400 italic">未配置</span>;
    }
    if (SENSITIVE_FIELDS.has(key)) {
      return (
        <Flex justify="space-between" align="center">
          <Text className="font-mono text-gray-600">{value}</Text>
          <Button
            type="text"
            size="small"
            danger
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setClearingField(key)}
          />
        </Flex>
      );
    }
    return <Text className="font-mono text-gray-600">{value}</Text>;
  };

  const renderSettings = () => {
    // Only show fields that have values, plus auth method
    const fieldsToShow = Object.entries(rawValues).filter(
      ([_, value]) => value != null && value !== ""
    );

    if (fieldsToShow.length === 0) return null;

    return (
      <Descriptions bordered {...descriptionsConfig}>
        <Descriptions.Item label="认证方式">
          <Text>{detectAuthMethod(rawValues)}</Text>
        </Descriptions.Item>
        {fieldsToShow.map(([key]) => (
          <Descriptions.Item key={key} label={FIELD_LABELS[key] ?? key}>
            {renderValue(key)}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  return (
    <>
      {isLoading ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : isError ? (
        <Card>
          <Alert
            type="error"
            message="无法加载 Hashicorp Vault 配置"
            description={error instanceof Error ? error.message : undefined}
          />
        </Card>
      ) : (
        <Card>
          <Space direction="vertical" size="large" className="w-full">
            {/* Header */}
            <Flex justify="space-between" align="center">
              <Flex align="center" gap={12}>
                <KeyRound className="w-6 h-6 text-gray-400" />
                <div>
                  <Title level={3} style={{ marginBottom: 0 }}>Hashicorp Vault</Title>
                  <Text type="secondary">管理密钥管理器配置</Text>
                </div>
              </Flex>

              <Space>
                {isConfigured && (
                  <>
                    <Button
                      icon={<PlugZap className="w-4 h-4" />}
                      loading={isTesting}
                      onClick={handleTestConnection}
                    >
                      测试连接
                    </Button>
                    <Button
                      icon={<Edit className="w-4 h-4" />}
                      onClick={() => setIsEditModalVisible(true)}
                    >
                      编辑配置
                    </Button>
                    <Button
                      danger
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setIsDeleteModalOpen(true)}
                    >
                      删除配置
                    </Button>
                  </>
                )}
              </Space>
            </Flex>

            {isConfigured && (
              <Alert
                type="info"
                showIcon
                message={'密钥必须使用字段名 "key" 存储'}
                description={
                  <>
                    <Text code>vault kv put secret/SECRET_NAME key=secret_value</Text>
                    <br />
                    <Typography.Link
                      href="https://docs.litellm.ai/docs/secret_managers/hashicorp_vault"
                      target="_blank"
                    >
                      查看文档
                    </Typography.Link>
                  </>
                }
              />
            )}

            {isConfigured ? (
              renderSettings()
            ) : (
              <HashicorpVaultEmptyPlaceholder onAdd={() => setIsEditModalVisible(true)} />
            )}
          </Space>
        </Card>
      )}

      <EditHashicorpVaultModal
        isVisible={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onSuccess={() => setIsEditModalVisible(false)}
      />

      <DeleteResourceModal
        isOpen={isDeleteModalOpen}
        title="删除 Hashicorp Vault 配置？"
        message="使用 Vault 密钥的模型在保存新配置前将无法访问其 API 密钥。"
        resourceInformationTitle="Vault 配置"
        resourceInformation={[
          { label: "Vault 地址", value: rawValues.vault_addr },
        ]}
        onCancel={() => setIsDeleteModalOpen(false)}
        onOk={handleDelete}
        confirmLoading={isDeleting}
      />

      <DeleteResourceModal
        isOpen={clearingField !== null}
        title={`清除 ${clearingField ? (FIELD_LABELS[clearingField] ?? clearingField) : ""}？`}
        message="这将移除存储的值。"
        resourceInformationTitle="字段"
        resourceInformation={[
          { label: "字段", value: clearingField ? (FIELD_LABELS[clearingField] ?? clearingField) : "" },
        ]}
        onCancel={() => setClearingField(null)}
        onOk={handleClearField}
        confirmLoading={isClearingField}
      />
    </>
  );
}
