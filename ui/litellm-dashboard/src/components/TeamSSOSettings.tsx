import React, { useState, useEffect } from "react";
import { Card, Button, InputNumber, Typography, Spin, Select, Tag, Row, Col } from "antd";
import { EditOutlined, SaveOutlined } from "@ant-design/icons";
import { getDefaultTeamSettings, updateDefaultTeamSettings } from "./networking";
import BudgetDurationDropdown, { getBudgetDurationLabel } from "./common_components/budget_duration_dropdown";
import { getModelDisplayName } from "./key_team_helpers/fetch_available_models_team_key";
import NotificationsManager from "./molecules/notifications_manager";
import { ModelSelect } from "./ModelSelect/ModelSelect";

const { Title, Text } = Typography;

interface TeamSSOSettingsProps {
  accessToken: string | null;
  userID: string;
  userRole: string;
}

const PERMISSION_OPTIONS = [
  "/key/generate",
  "/key/update",
  "/key/delete",
  "/key/regenerate",
  "/key/service-account/generate",
  "/key/{key_id}/regenerate",
  "/key/block",
  "/key/unblock",
  "/key/bulk_update",
  "/key/{key_id}/reset_spend",
  "/key/info",
  "/key/list",
  "/key/aliases",
  "/team/daily/activity",
];

interface SettingRowProps {
  label: string;
  description: string;
  isEditing: boolean;
  viewContent: React.ReactNode;
  editContent: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, isEditing, viewContent, editContent }) => (
  <Row className="py-5 border-b border-gray-100 last:border-0">
    <Col span={8} className="pr-6">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</div>
    </Col>
    <Col span={16} className="flex items-center">
      <div className="w-full">{isEditing ? editContent : viewContent}</div>
    </Col>
  </Row>
);

const NotSet = () => <Text className="text-gray-400 italic">未设置</Text>;

const renderTags = (values: string[], displayFn?: (v: string) => string) => {
  if (!values || values.length === 0) return <NotSet />;
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <Tag key={v} color="blue">
          {displayFn ? displayFn(v) : v}
        </Tag>
      ))}
    </div>
  );
};

interface SettingsValues {
  max_budget: number | null;
  budget_duration: string | null;
  tpm_limit: number | null;
  rpm_limit: number | null;
  models: string[];
  team_member_permissions: string[];
}

const DEFAULT_VALUES: SettingsValues = {
  max_budget: null,
  budget_duration: null,
  tpm_limit: null,
  rpm_limit: null,
  models: [],
  team_member_permissions: [],
};

const TeamSSOSettings: React.FC<TeamSSOSettingsProps> = ({ accessToken }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [values, setValues] = useState<SettingsValues>(DEFAULT_VALUES);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedValues, setEditedValues] = useState<SettingsValues>(DEFAULT_VALUES);
  const [saving, setSaving] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<boolean>(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const data = await getDefaultTeamSettings(accessToken);
        const fetched = { ...DEFAULT_VALUES, ...(data.values || {}) };
        setValues(fetched);
        setEditedValues(fetched);
      } catch (error) {
        console.error("Error fetching team SSO settings:", error);
        setFetchError(true);
        NotificationsManager.fromBackend("获取团队设置失败");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [accessToken]);

  const handleSave = async () => {
    if (!accessToken) return;

    setSaving(true);
    try {
      const updatedSettings = await updateDefaultTeamSettings(accessToken, editedValues);
      const newValues = { ...DEFAULT_VALUES, ...(updatedSettings.settings || {}) };
      setValues(newValues);
      setEditedValues(newValues);
      setIsEditing(false);
      NotificationsManager.success("默认团队设置已成功更新");
    } catch (error) {
      console.error("Error updating team settings:", error);
      NotificationsManager.fromBackend("更新团队设置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedValues(values);
  };

  const update = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Card>
        <Text>没有可用的团队设置，或者您没有权限查看。</Text>
      </Card>
    );
  }

  return (
    <Card styles={{ body: { padding: 32 } }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <Title level={3} className="m-0 text-gray-900">
            默认团队设置
          </Title>
          <Text className="text-gray-500 mt-1 block">
            创建新团队时将默认应用这些设置。
          </Text>
        </div>
        <div>
          {isEditing ? (
            <div className="flex gap-3">
              <Button onClick={handleCancel} disabled={saving}>
                取消
              </Button>
              <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>
                保存更改
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)} icon={<EditOutlined />}>
              编辑设置
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {/* Budget & Rate Limits */}
        <div className="mb-8">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">预算与速率限制</div>
          <div className="border-t border-gray-100">
            <SettingRow
              label="最大预算"
              description="新自动创建团队的最大预算（美元）。"
              isEditing={isEditing}
              viewContent={
                values.max_budget != null ? <Text>${Number(values.max_budget).toLocaleString()}</Text> : <NotSet />
              }
              editContent={
                <InputNumber
                  className="w-full"
                  style={{ maxWidth: 320 }}
                  value={editedValues.max_budget}
                  onChange={(v) => update("max_budget", v)}
                  placeholder="未设置"
                  prefix="$"
                  min={0}
                />
              }
            />

            <SettingRow
              label="预算周期"
              description="团队预算重置的频率。"
              isEditing={isEditing}
              viewContent={
                values.budget_duration ? <Text>{getBudgetDurationLabel(values.budget_duration)}</Text> : <NotSet />
              }
              editContent={
                <BudgetDurationDropdown
                  value={editedValues.budget_duration || null}
                  onChange={(v) => update("budget_duration", v)}
                  style={{ maxWidth: 320 }}
                />
              }
            />

            <SettingRow
              label="TPM 限制"
              description="所有模型允许的每分钟最大令牌数。"
              isEditing={isEditing}
              viewContent={
                values.tpm_limit != null ? <Text>{values.tpm_limit.toLocaleString()}</Text> : <NotSet />
              }
              editContent={
                <InputNumber
                  className="w-full"
                  style={{ maxWidth: 320 }}
                  value={editedValues.tpm_limit}
                  onChange={(v) => update("tpm_limit", v)}
                  placeholder="未设置"
                  min={0}
                />
              }
            />

            <SettingRow
              label="RPM 限制"
              description="所有模型允许的每分钟最大请求数。"
              isEditing={isEditing}
              viewContent={
                values.rpm_limit != null ? <Text>{values.rpm_limit.toLocaleString()}</Text> : <NotSet />
              }
              editContent={
                <InputNumber
                  className="w-full"
                  style={{ maxWidth: 320 }}
                  value={editedValues.rpm_limit}
                  onChange={(v) => update("rpm_limit", v)}
                  placeholder="未设置"
                  min={0}
                />
              }
            />
          </div>
        </div>

        {/* Access & Permissions */}
        <div className="mb-8">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">访问与权限</div>
          <div className="border-t border-gray-100">
            <SettingRow
              label="模型"
              description="新团队可访问的默认模型列表。"
              isEditing={isEditing}
              viewContent={renderTags(values.models, getModelDisplayName)}
              editContent={
                <ModelSelect
                  value={editedValues.models || []}
                  onChange={(v) => update("models", v)}
                  context="global"
                  style={{ width: "100%" }}
                  options={{ includeSpecialOptions: true }}
                />
              }
            />

            <SettingRow
              label="团队成员权限"
              description="授予新创建团队成员的默认权限。/key/info 和 /key/health 始终包含在内。"
              isEditing={isEditing}
              viewContent={renderTags(values.team_member_permissions)}
              editContent={
                <Select
                  mode="multiple"
                  style={{ width: "100%" }}
                  value={editedValues.team_member_permissions || []}
                  onChange={(v) => update("team_member_permissions", v)}
                  placeholder="选择权限"
                  tagRender={({ label, closable, onClose }) => (
                    <Tag color="blue" closable={closable} onClose={onClose} className="mr-1 mt-1 mb-1">
                      {label}
                    </Tag>
                  )}
                >
                  {PERMISSION_OPTIONS.map((option) => (
                    <Select.Option key={option} value={option}>
                      {option}
                    </Select.Option>
                  ))}
                </Select>
              }
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TeamSSOSettings;
