"use client";

import { useUISettings } from "@/app/(dashboard)/hooks/uiSettings/useUISettings";
import { useUpdateUISettings } from "@/app/(dashboard)/hooks/uiSettings/useUpdateUISettings";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import NotificationManager from "@/components/molecules/notifications_manager";
import PageVisibilitySettings from "./PageVisibilitySettings";
import { Alert, Card, Divider, Skeleton, Space, Switch, Typography } from "antd";

export default function UISettings() {
  const { accessToken } = useAuthorized();
  const { data, isLoading, isError, error } = useUISettings();
  const { mutate: updateSettings, isPending: isUpdating, error: updateError } = useUpdateUISettings(accessToken);

  const schema = data?.field_schema;
  const property = schema?.properties?.disable_model_add_for_internal_users;
  const disableTeamAdminDeleteProperty = schema?.properties?.disable_team_admin_delete_team_user;
  const requireAuthForPublicAIHubProperty = schema?.properties?.require_auth_for_public_ai_hub;
  const forwardClientHeadersProperty = schema?.properties?.forward_client_headers_to_llm_api;
  const forwardLLMProviderAuthHeadersProperty =
    schema?.properties?.forward_llm_provider_auth_headers;
  const enableProjectsUIProperty = schema?.properties?.enable_projects_ui;
  const enabledPagesProperty = schema?.properties?.enabled_ui_pages_internal_users;
  const disableAgentsProperty = schema?.properties?.disable_agents_for_internal_users;
  const allowAgentsTeamAdminsProperty = schema?.properties?.allow_agents_for_team_admins;
  const disableVectorStoresProperty = schema?.properties?.disable_vector_stores_for_internal_users;
  const allowVectorStoresTeamAdminsProperty = schema?.properties?.allow_vector_stores_for_team_admins;
  const scopeUserSearchProperty = schema?.properties?.scope_user_search_to_org;
  const disableCustomApiKeysProperty = schema?.properties?.disable_custom_api_keys;
  const values = data?.values ?? {};
  const isDisabledForInternalUsers = Boolean(values.disable_model_add_for_internal_users);
  const isDisabledTeamAdminDeleteTeamUser = Boolean(values.disable_team_admin_delete_team_user);
  const isAgentsDisabled = Boolean(values.disable_agents_for_internal_users);
  const isVectorStoresDisabled = Boolean(values.disable_vector_stores_for_internal_users);

  const handleToggle = (checked: boolean) => {
    updateSettings(
      { disable_model_add_for_internal_users: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleTeamAdminDelete = (checked: boolean) => {
    updateSettings(
      { disable_team_admin_delete_team_user: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleUpdatePageVisibility = (settings: { enabled_ui_pages_internal_users: string[] | null }) => {
    updateSettings(settings, {
      onSuccess: () => {
        NotificationManager.success("页面可见性设置已成功更新");
      },
      onError: (error) => {
        NotificationManager.fromBackend(error);
      },
    });
  };

  const handleToggleForwardClientHeaders = (checked: boolean) => {
    updateSettings(
      { forward_client_headers_to_llm_api: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleForwardLLMProviderAuthHeaders = (checked: boolean) => {
    updateSettings(
      { forward_llm_provider_auth_headers: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleEnableProjectsUI = (checked: boolean) => {
    updateSettings(
      { enable_projects_ui: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新，正在刷新页面...");
          setTimeout(() => window.location.reload(), 1000);
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleRequireAuthForPublicAIHub = (checked: boolean) => {
    updateSettings(
      { require_auth_for_public_ai_hub: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleDisableAgents = (checked: boolean) => {
    updateSettings(
      { disable_agents_for_internal_users: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleAllowAgentsTeamAdmins = (checked: boolean) => {
    updateSettings(
      { allow_agents_for_team_admins: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleDisableVectorStores = (checked: boolean) => {
    updateSettings(
      { disable_vector_stores_for_internal_users: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleAllowVectorStoresTeamAdmins = (checked: boolean) => {
    updateSettings(
      { allow_vector_stores_for_team_admins: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleScopeUserSearch = (checked: boolean) => {
    updateSettings(
      { scope_user_search_to_org: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  const handleToggleDisableCustomApiKeys = (checked: boolean) => {
    updateSettings(
      { disable_custom_api_keys: checked },
      {
        onSuccess: () => {
          NotificationManager.success("UI 设置已成功更新");
        },
        onError: (error) => {
          NotificationManager.fromBackend(error);
        },
      },
    );
  };

  return (
    <Card title="UI Settings">
      {isLoading ? (
        <Skeleton active />
      ) : isError ? (
        <Alert
          type="error"
          message="无法加载 UI 设置"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {schema?.description && (
            <Typography.Paragraph style={{ marginBottom: 0 }}>{schema.description}</Typography.Paragraph>
          )}

          {updateError && (
            <Alert
              type="error"
              message="无法更新 UI 设置"
              description={updateError instanceof Error ? updateError.message : undefined}
            />
          )}

          <Space align="start" size="middle">
            <Switch
              checked={isDisabledForInternalUsers}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggle}
              aria-label={property?.description ?? "Disable model add for internal users"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>禁用内部用户添加模型</Typography.Text>
              {property?.description && <Typography.Text type="secondary">{property.description}</Typography.Text>}
            </Space>
          </Space>

          <Space align="start" size="middle">
            <Switch
              checked={isDisabledTeamAdminDeleteTeamUser}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleTeamAdminDelete}
              aria-label={disableTeamAdminDeleteProperty?.description ?? "Disable team admin delete team user"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>禁用团队管理员删除团队成员</Typography.Text>
              {disableTeamAdminDeleteProperty?.description && (
                <Typography.Text type="secondary">{disableTeamAdminDeleteProperty.description}</Typography.Text>
              )}
            </Space>
          </Space>

          <Space align="start" size="middle">
            <Switch
              checked={values.require_auth_for_public_ai_hub}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleRequireAuthForPublicAIHub}
              aria-label={requireAuthForPublicAIHubProperty?.description ?? "Require authentication for public AI Hub"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>公共 AI Hub 需要身份验证</Typography.Text>
              {requireAuthForPublicAIHubProperty?.description && (
                <Typography.Text type="secondary">{requireAuthForPublicAIHubProperty.description}</Typography.Text>
              )}
            </Space>
          </Space>

          <Space align="start" size="middle">
            <Switch
              checked={Boolean(values.forward_client_headers_to_llm_api)}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleForwardClientHeaders}
              aria-label={forwardClientHeadersProperty?.description ?? "Forward client headers to LLM API"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>转发客户端请求头到 LLM API</Typography.Text>
              <Typography.Text type="secondary">
                {forwardClientHeadersProperty?.description ??
                  "将客户端请求头（Authorization、anthropic-beta 和 x-* 自定义请求头）转发到上游 LLM。为 Claude Code Max 订阅启用（转发 OAuth 令牌），或将自定义/跟踪请求头传递到提供商。与 BYOK 开关独立——仅启用您需要的选项。"}
              </Typography.Text>
            </Space>
          </Space>

          <Space align="start" size="middle">
            <Switch
              checked={Boolean(values.forward_llm_provider_auth_headers)}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleForwardLLMProviderAuthHeaders}
              aria-label={
                forwardLLMProviderAuthHeadersProperty?.description ??
                "Forward LLM provider auth headers"
              }
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>转发 LLM 提供商认证请求头</Typography.Text>
              <Typography.Text type="secondary">
                {forwardLLMProviderAuthHeadersProperty?.description ??
                  "将提供商认证请求头（x-api-key、x-goog-api-key、api-key、ocp-apim-subscription-key）转发到上游 LLM，覆盖该请求的任何部署配置密钥。为 Claude Code BYOK 启用（客户端自带 API 密钥）。与客户端请求头开关独立——仅启用您需要的选项。"}
              </Typography.Text>
            </Space>
          </Space>

          {enableProjectsUIProperty && (
            <Space align="start" size="middle">
              <Switch
                checked={Boolean(values.enable_projects_ui)}
                disabled={isUpdating}
                loading={isUpdating}
                onChange={handleToggleEnableProjectsUI}
                aria-label={enableProjectsUIProperty.description ?? "Enable Projects UI"}
              />
              <Space direction="vertical" size={4}>
                <Typography.Text strong>[BETA] 启用项目（页面将刷新）</Typography.Text>
                <Typography.Text type="secondary">
                  {enableProjectsUIProperty.description ??
                    "启用后，在 UI 侧边栏显示项目功能，在密钥管理中显示项目字段。"}
                </Typography.Text>
              </Space>
            </Space>
          )}

          <Divider />

          {/* Agents access control */}
          <Space align="start" size="middle">
            <Switch
              checked={isAgentsDisabled}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleDisableAgents}
              aria-label={disableAgentsProperty?.description ?? "Disable agents for internal users"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>禁用内部用户的代理功能</Typography.Text>
              {disableAgentsProperty?.description && (
                <Typography.Text type="secondary">{disableAgentsProperty.description}</Typography.Text>
              )}
            </Space>
          </Space>

          <Space align="start" size="middle" style={{ marginLeft: 32 }}>
            <Switch
              checked={Boolean(values.allow_agents_for_team_admins)}
              disabled={isUpdating || !isAgentsDisabled}
              loading={isUpdating}
              onChange={handleToggleAllowAgentsTeamAdmins}
              aria-label={allowAgentsTeamAdminsProperty?.description ?? "Allow agents for team admins"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong type={!isAgentsDisabled ? "secondary" : undefined}>
                允许团队管理员使用代理
              </Typography.Text>
              {allowAgentsTeamAdminsProperty?.description && (
                <Typography.Text type="secondary">{allowAgentsTeamAdminsProperty.description}</Typography.Text>
              )}
            </Space>
          </Space>

          <Divider />

          {/* Vector Stores access control */}
          <Space align="start" size="middle">
            <Switch
              checked={isVectorStoresDisabled}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleDisableVectorStores}
              aria-label={disableVectorStoresProperty?.description ?? "Disable vector stores for internal users"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>禁用内部用户的向量存储功能</Typography.Text>
              {disableVectorStoresProperty?.description && (
                <Typography.Text type="secondary">{disableVectorStoresProperty.description}</Typography.Text>
              )}
            </Space>
          </Space>

          <Space align="start" size="middle" style={{ marginLeft: 32 }}>
            <Switch
              checked={Boolean(values.allow_vector_stores_for_team_admins)}
              disabled={isUpdating || !isVectorStoresDisabled}
              loading={isUpdating}
              onChange={handleToggleAllowVectorStoresTeamAdmins}
              aria-label={allowVectorStoresTeamAdminsProperty?.description ?? "Allow vector stores for team admins"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong type={!isVectorStoresDisabled ? "secondary" : undefined}>
                允许团队管理员使用向量存储
              </Typography.Text>
              {allowVectorStoresTeamAdminsProperty?.description && (
                <Typography.Text type="secondary">{allowVectorStoresTeamAdminsProperty.description}</Typography.Text>
              )}
            </Space>
          </Space>

          <Divider />

          {/* Scope user search to organization */}
          <Space align="start" size="middle">
            <Switch
              checked={Boolean(values.scope_user_search_to_org)}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleScopeUserSearch}
              aria-label={scopeUserSearchProperty?.description ?? "Scope user search to organization"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>将用户搜索限定于组织内</Typography.Text>
              <Typography.Text type="secondary">
                {scopeUserSearchProperty?.description ??
                  "启用后，用户搜索端点将按组织限制结果。关闭时，任何经过身份验证的用户都可以搜索所有用户。"}
              </Typography.Text>
            </Space>
          </Space>

          <Divider />

          {/* Disable custom Virtual key values */}
          <Space align="start" size="middle">
            <Switch
              checked={Boolean(values.disable_custom_api_keys)}
              disabled={isUpdating}
              loading={isUpdating}
              onChange={handleToggleDisableCustomApiKeys}
              aria-label={disableCustomApiKeysProperty?.description ?? "Disable custom Virtual key values"}
            />
            <Space direction="vertical" size={4}>
              <Typography.Text strong>禁用自定义虚拟密钥值</Typography.Text>
              <Typography.Text type="secondary">
                {disableCustomApiKeysProperty?.description ??
                  "如果启用，用户无法指定自定义密钥值。所有密钥必须自动生成。"}
              </Typography.Text>
            </Space>
          </Space>

          <Divider />

          {/* Page Visibility for Internal Users */}
          <PageVisibilitySettings
            enabledPagesInternalUsers={values.enabled_ui_pages_internal_users}
            enabledPagesPropertyDescription={enabledPagesProperty?.description}
            isUpdating={isUpdating}
            onUpdate={handleUpdatePageVisibility}
          />
        </Space>
      )}
    </Card>
  );
}
