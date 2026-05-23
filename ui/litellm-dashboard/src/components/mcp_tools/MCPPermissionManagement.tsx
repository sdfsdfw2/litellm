import React, { useEffect } from "react";
import { Alert, Form, Select, Tooltip, Collapse, Input, Space, Button, Switch } from "antd";
import { InfoCircleOutlined, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { MCPServer, AUTH_TYPE } from "./types";
const { Panel } = Collapse;

interface MCPPermissionManagementProps {
  availableAccessGroups: string[];
  mcpServer: MCPServer | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  getAccessGroupOptions: () => Array<{
    value: string;
    label: React.ReactNode;
  }>;
}

const MCPPermissionManagement: React.FC<MCPPermissionManagementProps> = ({
  availableAccessGroups,
  mcpServer,
  searchValue,
  setSearchValue,
  getAccessGroupOptions,
}) => {
  const form = Form.useFormInstance();
  const watchedAuthType = Form.useWatch("auth_type", form);
  const isOAuth2 = watchedAuthType === AUTH_TYPE.OAUTH2;
  const watchedDelegateAuth = Form.useWatch("delegate_auth_to_upstream", form);
  const watchedPublicInternet = Form.useWatch("available_on_public_internet", form);
  const showInternalDelegatePkceWarning =
    isOAuth2 &&
    watchedDelegateAuth === true &&
    watchedPublicInternet === false;

  // Set initial values when mcpServer changes
  useEffect(() => {
    if (mcpServer) {
      if (mcpServer.static_headers) {
        const staticHeaders = Object.entries(mcpServer.static_headers).map(([header, value]) => ({
          header,
          value: value != null ? String(value) : "",
        }));
        form.setFieldValue("static_headers", staticHeaders);
      }
      if (typeof mcpServer.allow_all_keys === "boolean") {
        form.setFieldValue("allow_all_keys", mcpServer.allow_all_keys);
      }
      if (typeof mcpServer.available_on_public_internet === "boolean") {
        form.setFieldValue("available_on_public_internet", mcpServer.available_on_public_internet);
      }
      if (typeof mcpServer.delegate_auth_to_upstream === "boolean") {
        form.setFieldValue("delegate_auth_to_upstream", mcpServer.delegate_auth_to_upstream);
      }
    } else {
      form.setFieldValue("allow_all_keys", false);
      form.setFieldValue("available_on_public_internet", true);
      form.setFieldValue("delegate_auth_to_upstream", false);
    }
  }, [mcpServer, form]);

  // delegate_auth_to_upstream is only honored server-side when auth_type=oauth2.
  // Force it back to false whenever the user switches away from oauth2 so a
  // stale toggle value doesn't get persisted with another auth type.
  useEffect(() => {
    if (!isOAuth2) {
      form.setFieldValue("delegate_auth_to_upstream", false);
    }
  }, [isOAuth2, form]);

  return (
    <Collapse className="bg-gray-50 border border-gray-200 rounded-lg" expandIconPosition="end" ghost={false}>
      <Panel
        header={
          <div className="flex items-center">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">权限管理 / 访问控制</h3>
            </div>
            <p className="text-sm text-gray-600 ml-4">配置访问权限和安全设置（可选）</p>
          </div>
        }
        key="permissions"
        className="border-0"
        forceRender
      >
        <div className="space-y-6 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center">
                允许所有 LiteLLM 密钥
                <Tooltip title="启用后，每个 API 密钥都可以访问此 MCP 服务器。">
                  <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                </Tooltip>
              </span>
              <p className="text-sm text-gray-600 mt-1">如果此服务器应对所有密钥开放，请启用。</p>
            </div>
            <Form.Item
              name="allow_all_keys"
              valuePropName="checked"
              initialValue={mcpServer?.allow_all_keys ?? false}
              className="mb-0"
            >
              <Switch />
            </Form.Item>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center">
                仅内网
                <Tooltip title="启用后，仅接受来自内部网络的请求。关闭以允许外部客户端（其他集群、ChatGPT 等）。无论此设置如何，始终需要 API 密钥认证。">
                  <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                </Tooltip>
              </span>
              <p className="text-sm text-gray-600 mt-1">启用以限制仅内网调用者访问。</p>
            </div>
            <Form.Item
              name="available_on_public_internet"
              valuePropName="checked"
              getValueProps={(value) => ({ checked: !value })}
              getValueFromEvent={(checked: boolean) => !checked}
              initialValue={true}
              className="mb-0"
            >
              <Switch />
            </Form.Item>
          </div>

          {isOAuth2 && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  委托上游认证（PKCE 透传）
                  <Tooltip title="启用后，LiteLLM 跳过自身的 API 密钥/SSO 检查，让客户端直接与上游 MCP 服务器完成 PKCE。仅在身份验证类型为 oauth2 时生效。此路由上不会进行消费跟踪或按密钥限速。">
                    <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                  </Tooltip>
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  绕过 LiteLLM 认证，使客户端直接与上游 OAuth MCP 服务器进行身份验证。
                </p>
              </div>
              <Form.Item
                name="delegate_auth_to_upstream"
                valuePropName="checked"
                initialValue={mcpServer?.delegate_auth_to_upstream ?? false}
                className="mb-0"
              >
                <Switch />
              </Form.Item>
            </div>
          )}

          {showInternalDelegatePkceWarning && (
            <Alert
              type="warning"
              showIcon
              className="mb-2"
              message="内网服务器的上游 OAuth 委托"
              description="此 MCP 服务器配置为仅内网访问，但将认证委托给上游。匿名用户将能够无需 LiteLLM 会话即可访问上游 OAuth2 /authorize 流程。请确保您的上游提供商和网络强制执行访问控制。"
            />
          )}

          <Form.Item
            label={
              <span className="text-sm font-medium text-gray-700 flex items-center">
                MCP 访问组
                <Tooltip title="为此 MCP 服务器指定访问组。用户必须至少属于其中一个组才能访问此服务器。">
                  <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                </Tooltip>
              </span>
            }
            name="mcp_access_groups"
            className="mb-4"
          >
            <Select
              mode="tags"
              showSearch
              placeholder="选择现有组或输入创建新组"
              optionFilterProp="value"
              filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
              onSearch={(value) => setSearchValue(value)}
              tokenSeparators={[","]}
              options={getAccessGroupOptions()}
              maxTagCount="responsive"
              allowClear
            />
          </Form.Item>

          <Form.Item
            label={
              <span className="text-sm font-medium text-gray-700 flex items-center">
                额外请求头
                <Tooltip title="将来自入站请求的自定义请求头转发到此 MCP 服务器（例如：Authorization、X-Custom-Header、User-Agent）">
                  <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                </Tooltip>
                {mcpServer?.extra_headers && mcpServer.extra_headers.length > 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    已配置 {mcpServer.extra_headers.length} 个
                  </span>
                )}
              </span>
            }
            name="extra_headers"
          >
            <Select
              mode="tags"
              placeholder={
                mcpServer?.extra_headers && mcpServer.extra_headers.length > 0
                  ? `当前: ${mcpServer.extra_headers.join(", ")}`
                  : "输入请求头名称（例如：Authorization, X-Custom-Header）"
              }
              className="rounded-lg"
              size="large"
              tokenSeparators={[","]}
              allowClear
            />
          </Form.Item>

          <Form.Item
            label={
              <span className="text-sm font-medium text-gray-700 flex items-center">
                静态请求头
                <Tooltip title="每次向此 MCP 服务器发送请求时附带这些键值对请求头。">
                  <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                </Tooltip>
              </span>
            }
            required={false}
          >
            <Form.List name="static_headers">
              {(fields, { add, remove }) => (
                <div className="space-y-3">
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} className="flex w-full" align="baseline" size="middle">
                      <Form.Item
                        {...restField}
                        name={[name, "header"]}
                        className="flex-1"
                        rules={[{ required: true, message: "请求头名称不能为空" }]}
                      >
                        <Input
                          size="large"
                          allowClear
                          className="rounded-lg"
                          placeholder="请求头名称（例如：X-API-Key）"
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "value"]}
                        className="flex-1"
                        rules={[{ required: true, message: "请求头值不能为空" }]}
                      >
                        <Input
                          size="large"
                          allowClear
                          className="rounded-lg"
                          placeholder="请求头值"
                        />
                      </Form.Item>
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        className="text-gray-500 hover:text-red-500 cursor-pointer"
                      />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    添加静态请求头
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        </div>
      </Panel>
    </Collapse>
  );
};

export default MCPPermissionManagement;
