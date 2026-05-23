import React from "react";
import { Form, Input, InputNumber, Select, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Button, TextInput } from "@tremor/react";
import { OAUTH_FLOW } from "./types";

interface OAuthFlowStatus {
  startOAuthFlow: () => void;
  status: string;
  error: string | null;
  tokenResponse: { access_token?: string; expires_in?: number } | null;
}

interface OAuthFormFieldsProps {
  isM2M: boolean;
  isEditing?: boolean;
  oauthFlow?: OAuthFlowStatus;
  initialFlowType?: string;
  /** Link to provider docs for creating an OAuth app (e.g. GitHub). */
  docsUrl?: string | null;
}

const fieldClassName = "rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500";

const FieldLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <span className="text-sm font-medium text-gray-700 flex items-center">
    {label}
    <Tooltip title={tooltip}>
      <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
    </Tooltip>
  </span>
);

const OAuthFormFields: React.FC<OAuthFormFieldsProps> = ({
  isM2M,
  isEditing = false,
  oauthFlow,
  initialFlowType,
  docsUrl,
}) => {
  const placeholderSuffix = isEditing ? " (leave blank to keep existing)" : "";

  return (
    <>
      <Form.Item
        label={
          <FieldLabel
            label="OAuth 流程类型"
            tooltip="选择代理如何与此 MCP 服务器进行身份验证。M2M 用于使用客户端凭据的服务器到服务器通信。Interactive (PKCE) 用于需要基于浏览器授权的面向用户的流程。"
          />
        }
        name="oauth_flow_type"
        {...(initialFlowType ? { initialValue: initialFlowType } : {})}
      >
        <Select className="rounded-lg" size="large">
          <Select.Option value={OAUTH_FLOW.M2M}>
            <div>
              <span className="font-medium">机器对机器（M2M）</span>
              <span className="text-gray-400 text-xs ml-2">服务器到服务器，无需用户交互</span>
            </div>
          </Select.Option>
          <Select.Option value={OAUTH_FLOW.INTERACTIVE}>
            <div>
              <span className="font-medium">Interactive (PKCE)</span>
              <span className="text-gray-400 text-xs ml-2">基于浏览器的用户授权</span>
            </div>
          </Select.Option>
        </Select>
      </Form.Item>

      {isM2M ? (
        <>
          <Form.Item
            label={<FieldLabel label="客户端 ID" tooltip="用于 client_credentials 授权的 OAuth2 客户端 ID。" />}
            name={["credentials", "client_id"]}
            rules={[{ required: true, message: "M2M OAuth 需要客户端 ID" }]}
          >
            <TextInput type="password" placeholder={`输入 OAuth 客户端 ID${placeholderSuffix}`} className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="客户端密钥" tooltip="用于 client_credentials 授权的 OAuth2 客户端密钥。" />}
            name={["credentials", "client_secret"]}
            rules={[{ required: true, message: "M2M OAuth 需要客户端密钥" }]}
          >
            <TextInput type="password" placeholder={`输入 OAuth 客户端密钥${placeholderSuffix}`} className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="令牌 URL" tooltip="用于 client_credentials 授权的令牌端点 URL。" />}
            name="token_url"
            rules={[{ required: true, message: "M2M OAuth 需要令牌 URL" }]}
          >
            <TextInput placeholder="https://auth.example.com/oauth/token" className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="作用域（可选）" tooltip="与 client_credentials 授权一起请求的可选作用域。" />}
            name={["credentials", "scopes"]}
          >
            <Select mode="tags" tokenSeparators={[","]} placeholder="添加作用域" className="rounded-lg" size="large" />
          </Form.Item>
        </>
      ) : (
        <>
          <Form.Item
            label={
              <span className="flex items-center justify-between w-full">
                <FieldLabel label="客户端 ID（可选）" tooltip="仅在您的 MCP 服务器无法处理动态客户端注册时提供。" />
                {docsUrl && (
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 ml-2 font-normal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    创建 OAuth 应用 →
                  </a>
                )}
              </span>
            }
            name={["credentials", "client_id"]}
          >
            <TextInput type="password" placeholder={`输入客户端 ID${placeholderSuffix}`} className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="客户端密钥（可选）" tooltip="仅在您的 MCP 服务器无法处理动态客户端注册时提供。" />}
            name={["credentials", "client_secret"]}
          >
            <TextInput type="password" placeholder={`输入客户端密钥${placeholderSuffix}`} className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="作用域（可选）" tooltip="令牌交换期间请求的可选作用域。使用回车或逗号分隔多个作用域。" />}
            name={["credentials", "scopes"]}
          >
            <Select mode="tags" tokenSeparators={[","]} placeholder="添加作用域" className="rounded-lg" size="large" />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="授权 URL（可选）" tooltip="授权端点的可选覆盖。" />}
            name="authorization_url"
          >
            <TextInput placeholder="https://example.com/oauth/authorize" className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="令牌 URL（可选）" tooltip="令牌端点的可选覆盖。" />}
            name="token_url"
          >
            <TextInput placeholder="https://example.com/oauth/token" className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={<FieldLabel label="注册 URL（可选）" tooltip="动态客户端注册端点的可选覆盖。" />}
            name="registration_url"
          >
            <TextInput placeholder="https://example.com/oauth/register" className={fieldClassName} />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label="令牌验证规则（可选）"
                tooltip='在存储之前，对 OAuth 令牌响应进行检查的键值规则 JSON 对象。支持嵌套字段的点表示法（例如 {"organization": "my-org", "team.id": "123"}）。验证失败的令牌将被 HTTP 403 拒绝。'
              />
            }
            name="token_validation_json"
            rules={[
              {
                validator: (_: any, value: string) => {
                  if (!value || value.trim() === "") return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error("必须是有效的 JSON"));
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              placeholder={'{\n  "organization": "my-org",\n  "team.id": "123"\n}'}
              rows={4}
              className="font-mono text-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label="令牌存储 TTL（秒，可选）"
                tooltip="在 Redis 中缓存每个用户的 OAuth 访问令牌并在驱逐之前保留的时间（与令牌自身的 expires_in 无关）。留空将根据令牌的 expires_in 推导 TTL，或回退到 12 小时默认值。"
              />
            }
            name="token_storage_ttl_seconds"
          >
            <InputNumber
              min={1}
              placeholder="例如：3600"
              className="w-full rounded-lg"
              style={{ width: "100%" }}
            />
          </Form.Item>
          {oauthFlow && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-2">
              <p className="text-sm text-gray-600">
                使用 OAuth 获取新的访问令牌，并将其临时保存在会话中作为身份验证值。
              </p>
              <Button
                variant="secondary"
                onClick={oauthFlow.startOAuthFlow}
                disabled={oauthFlow.status === "authorizing" || oauthFlow.status === "exchanging"}
              >
                {oauthFlow.status === "authorizing"
                  ? "等待授权..."
                  : oauthFlow.status === "exchanging"
                    ? "正在交换授权码..."
                    : "授权并获取令牌"}
              </Button>
              {oauthFlow.error && <p className="text-sm text-red-500">{oauthFlow.error}</p>}
              {oauthFlow.status === "success" && oauthFlow.tokenResponse?.access_token && (
                <p className="text-sm text-green-600">
                  令牌已获取。在 {oauthFlow.tokenResponse.expires_in ?? "?"} 秒后过期。
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default OAuthFormFields;
