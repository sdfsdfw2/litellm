"use client";

import { TextInput } from "@tremor/react";
import { Checkbox, Form, Input, Select } from "antd";
import React from "react";
import { ssoProviderLogoMap, ssoProviderDisplayNames } from "../constants";

export interface BaseSSOSettingsFormProps {
  form: any; // Replace with proper Form type if available
  onFormSubmit: (formValues: Record<string, any>) => Promise<void>;
}

// Define the SSO provider configuration type
export interface SSOProviderConfig {
  envVarMap: Record<string, string>;
  fields: Array<{
    label: string;
    name: string;
    placeholder?: string;
  }>;
}

// Define configurations for each SSO provider
export const ssoProviderConfigs: Record<string, SSOProviderConfig> = {
  google: {
    envVarMap: {
      google_client_id: "GOOGLE_CLIENT_ID",
      google_client_secret: "GOOGLE_CLIENT_SECRET",
    },
    fields: [
      { label: "Google 客户端 ID", name: "google_client_id" },
      { label: "Google 客户端密钥", name: "google_client_secret" },
    ],
  },
  microsoft: {
    envVarMap: {
      microsoft_client_id: "MICROSOFT_CLIENT_ID",
      microsoft_client_secret: "MICROSOFT_CLIENT_SECRET",
      microsoft_tenant: "MICROSOFT_TENANT",
    },
    fields: [
      { label: "Microsoft 客户端 ID", name: "microsoft_client_id" },
      { label: "Microsoft 客户端密钥", name: "microsoft_client_secret" },
      { label: "Microsoft 租户", name: "microsoft_tenant" },
    ],
  },
  okta: {
    envVarMap: {
      generic_client_id: "GENERIC_CLIENT_ID",
      generic_client_secret: "GENERIC_CLIENT_SECRET",
      generic_authorization_endpoint: "GENERIC_AUTHORIZATION_ENDPOINT",
      generic_token_endpoint: "GENERIC_TOKEN_ENDPOINT",
      generic_userinfo_endpoint: "GENERIC_USERINFO_ENDPOINT",
    },
    fields: [
      { label: "通用客户端 ID", name: "generic_client_id" },
      { label: "通用客户端密钥", name: "generic_client_secret" },
      {
        label: "授权端点",
        name: "generic_authorization_endpoint",
        placeholder: "https://your-domain/authorize",
      },
      { label: "Token 端点", name: "generic_token_endpoint", placeholder: "https://your-domain/token" },
      {
        label: "用户信息端点",
        name: "generic_userinfo_endpoint",
        placeholder: "https://your-domain/userinfo",
      },
    ],
  },
  generic: {
    envVarMap: {
      generic_client_id: "GENERIC_CLIENT_ID",
      generic_client_secret: "GENERIC_CLIENT_SECRET",
      generic_authorization_endpoint: "GENERIC_AUTHORIZATION_ENDPOINT",
      generic_token_endpoint: "GENERIC_TOKEN_ENDPOINT",
      generic_userinfo_endpoint: "GENERIC_USERINFO_ENDPOINT",
    },
    fields: [
      { label: "通用客户端 ID", name: "generic_client_id" },
      { label: "通用客户端密钥", name: "generic_client_secret" },
      { label: "授权端点", name: "generic_authorization_endpoint" },
      { label: "Token 端点", name: "generic_token_endpoint" },
      { label: "用户信息端点", name: "generic_userinfo_endpoint" },
    ],
  },
};

// Helper function to render provider fields
export const renderProviderFields = (provider: string) => {
  const config = ssoProviderConfigs[provider];
  if (!config) return null;

  return config.fields.map((field) => (
    <Form.Item
      key={field.name}
      label={field.label}
      name={field.name}
      rules={[{ required: true, message: `请输入${field.label}` }]}
    >
      {field.name.includes("client") ? <Input.Password /> : <TextInput placeholder={field.placeholder} />}
    </Form.Item>
  ));
};

const BaseSSOSettingsForm: React.FC<BaseSSOSettingsFormProps> = ({ form, onFormSubmit }) => {
  return (
    <div>
      <Form form={form} onFinish={onFormSubmit} labelCol={{ span: 8 }} wrapperCol={{ span: 16 }} labelAlign="left">
        <Form.Item
          label="SSO 提供商"
          name="sso_provider"
          rules={[{ required: true, message: "请选择 SSO 提供商" }]}
        >
          <Select>
            {Object.entries(ssoProviderLogoMap).map(([value, logo]) => (
              <Select.Option key={value} value={value}>
                <div style={{ display: "flex", alignItems: "center", padding: "4px 0" }}>
                  {logo && (
                    <img
                      src={logo}
                      alt={value}
                      style={{ height: 24, width: 24, marginRight: 12, objectFit: "contain" }}
                    />
                  )}
                  <span>
                    {ssoProviderDisplayNames[value] || value.charAt(0).toUpperCase() + value.slice(1) + " SSO"}
                  </span>
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.sso_provider !== currentValues.sso_provider}
        >
          {({ getFieldValue }) => {
            const provider = getFieldValue("sso_provider");
            return provider ? renderProviderFields(provider) : null;
          }}
        </Form.Item>

        <Form.Item
          label="代理管理员邮箱"
          name="user_email"
          rules={[{ required: true, message: "请输入代理管理员的邮箱" }]}
        >
          <TextInput />
        </Form.Item>
        <Form.Item
          label="代理基础 URL"
          name="proxy_base_url"
          normalize={(value) => value?.trim()}
          rules={[
            { required: true, message: "请输入代理基础 URL" },
            {
              pattern: /^https?:\/\/.+/,
              message: "URL 必须以 http:// 或 https:// 开头",
            },
            {
              validator: (_, value) => {
                // Only check for trailing slash if the URL starts with http:// or https://
                if (value && /^https?:\/\/.+/.test(value) && value.endsWith("/")) {
                  return Promise.reject("URL 不能以斜杠结尾");
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <TextInput placeholder="https://example.com" />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.sso_provider !== currentValues.sso_provider}
        >
          {({ getFieldValue }) => {
            const provider = getFieldValue("sso_provider");
            return provider === "okta" || provider === "generic" ? (
              <Form.Item label="使用角色映射" name="use_role_mappings" valuePropName="checked">
                <Checkbox />
              </Form.Item>
            ) : null;
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.use_role_mappings !== currentValues.use_role_mappings ||
            prevValues.sso_provider !== currentValues.sso_provider
          }
        >
          {({ getFieldValue }) => {
            const useRoleMappings = getFieldValue("use_role_mappings");
            const provider = getFieldValue("sso_provider");
            const supportsRoleMappings = provider === "okta" || provider === "generic";
            return useRoleMappings && supportsRoleMappings ? (
              <Form.Item
                label="组声明"
                name="group_claim"
                rules={[{ required: true, message: "请输入组声明" }]}
              >
                <TextInput />
              </Form.Item>
            ) : null;
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.use_role_mappings !== currentValues.use_role_mappings ||
            prevValues.sso_provider !== currentValues.sso_provider
          }
        >
          {({ getFieldValue }) => {
            const useRoleMappings = getFieldValue("use_role_mappings");
            const provider = getFieldValue("sso_provider");
            const supportsRoleMappings = provider === "okta" || provider === "generic";
            return useRoleMappings && supportsRoleMappings ? (
              <>
                <Form.Item label="默认角色" name="default_role" initialValue="Internal User">
                  <Select>
                    <Select.Option value="internal_user_viewer">内部查看者</Select.Option>
                    <Select.Option value="internal_user">内部用户</Select.Option>
                    <Select.Option value="proxy_admin_viewer">管理员查看者</Select.Option>
                    <Select.Option value="proxy_admin">代理管理员</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label="代理管理员团队" name="proxy_admin_teams">
                  <TextInput />
                </Form.Item>

                <Form.Item label="管理员查看者团队" name="admin_viewer_teams">
                  <TextInput />
                </Form.Item>

                <Form.Item label="内部用户团队" name="internal_user_teams">
                  <TextInput />
                </Form.Item>

                <Form.Item label="内部查看者团队" name="internal_viewer_teams">
                  <TextInput />
                </Form.Item>
              </>
            ) : null;
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.sso_provider !== currentValues.sso_provider}
        >
          {({ getFieldValue }) => {
            const provider = getFieldValue("sso_provider");
            return provider === "okta" || provider === "generic" ? (
              <Form.Item label="使用团队映射" name="use_team_mappings" valuePropName="checked">
                <Checkbox />
              </Form.Item>
            ) : null;
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.use_team_mappings !== currentValues.use_team_mappings ||
            prevValues.sso_provider !== currentValues.sso_provider
          }
        >
          {({ getFieldValue }) => {
            const useTeamMappings = getFieldValue("use_team_mappings");
            const provider = getFieldValue("sso_provider");
            const supportsTeamMappings = provider === "okta" || provider === "generic";
            return useTeamMappings && supportsTeamMappings ? (
              <Form.Item
                label="团队 ID JWT 字段"
                name="team_ids_jwt_field"
                rules={[{ required: true, message: "请输入团队 ID JWT 字段" }]}
              >
                <TextInput />
              </Form.Item>
            ) : null;
          }}
        </Form.Item>
      </Form>
    </div>
  );
};

export default BaseSSOSettingsForm;
