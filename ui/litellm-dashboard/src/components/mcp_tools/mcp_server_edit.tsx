import React, { useState, useEffect } from "react";
import { Form, Select, Button as AntdButton, Tooltip, Input, InputNumber } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Button, TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";
import { AUTH_TYPE, OAUTH_FLOW, MCPServer, MCPServerCostInfo, TRANSPORT } from "./types";
import { updateMCPServer, listMCPTools } from "../networking";
import MCPServerCostConfig from "./mcp_server_cost_config";
import MCPPermissionManagement from "./MCPPermissionManagement";
import MCPToolConfiguration from "./mcp_tool_configuration";
import StdioConfiguration from "./StdioConfiguration";
import MCPLogoSelector from "./MCPLogoSelector";
import { validateMCPServerUrl, validateMCPServerName } from "./utils";
import NotificationsManager from "../molecules/notifications_manager";
import { useMcpOAuthFlow } from "@/hooks/useMcpOAuthFlow";
import { getSecureItem, setSecureItem } from "@/utils/secureStorage";

interface MCPServerEditProps {
  mcpServer: MCPServer;
  accessToken: string | null;
  onCancel: () => void;
  onSuccess: (server: MCPServer) => void;
  availableAccessGroups: string[];
}

const AUTH_TYPES_REQUIRING_AUTH_VALUE = [AUTH_TYPE.API_KEY, AUTH_TYPE.BEARER_TOKEN, AUTH_TYPE.TOKEN, AUTH_TYPE.BASIC];
const AUTH_TYPES_REQUIRING_CREDENTIALS = [...AUTH_TYPES_REQUIRING_AUTH_VALUE, AUTH_TYPE.OAUTH2, AUTH_TYPE.AWS_SIGV4];
const EDIT_OAUTH_UI_STATE_KEY = "litellm-mcp-oauth-edit-state";

const MCPServerEdit: React.FC<MCPServerEditProps> = ({
  mcpServer,
  accessToken,
  onCancel,
  onSuccess,
  availableAccessGroups,
}) => {
  const [form] = Form.useForm();
  const [costConfig, setCostConfig] = useState<MCPServerCostInfo>({});
  const [tools, setTools] = useState<any[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState<string>("");
  const [aliasManuallyEdited, setAliasManuallyEdited] = useState(false);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [toolNameToDisplayName, setToolNameToDisplayName] = useState<Record<string, string>>({});
  const [toolNameToDescription, setToolNameToDescription] = useState<Record<string, string>>({});
  const [pendingRestoredValues, setPendingRestoredValues] = useState<Record<string, any> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(mcpServer.mcp_info?.logo_url || undefined);
  const authType = Form.useWatch("auth_type", form) as string | undefined;
  const transportType = Form.useWatch("transport", form) as string | undefined;
  const isStdioTransport = transportType === "stdio";
  const isOpenAPITransport = transportType === TRANSPORT.OPENAPI;
  const isMCPTransport = !isStdioTransport && !isOpenAPITransport;
  const shouldShowAuthValueField = authType ? AUTH_TYPES_REQUIRING_AUTH_VALUE.includes(authType) : false;
  const isOAuthAuthType = authType === AUTH_TYPE.OAUTH2;
  const isAwsSigV4AuthType = authType === AUTH_TYPE.AWS_SIGV4;
  const oauthFlowTypeValue = Form.useWatch("oauth_flow_type", form) as string | undefined;
  const isM2MFlow = isOAuthAuthType && oauthFlowTypeValue === OAUTH_FLOW.M2M;

  const [oauthAccessToken, setOauthAccessToken] = useState<string | null>(null);

  // Watch form fields that affect tool fetching
  const currentUrl = Form.useWatch("url", form);
  const currentSpecPath = Form.useWatch("spec_path", form);
  const currentServerName = Form.useWatch("server_name", form);
  const currentAuthType = Form.useWatch("auth_type", form);
  const currentStaticHeaders = Form.useWatch("static_headers", form);
  const currentCredentials = Form.useWatch("credentials", form);
  const currentAuthorizationUrl = Form.useWatch("authorization_url", form);
  const currentTokenUrl = Form.useWatch("token_url", form);
  const currentRegistrationUrl = Form.useWatch("registration_url", form);

  const persistEditUiState = () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const values = form.getFieldsValue(true);
      setSecureItem(
        EDIT_OAUTH_UI_STATE_KEY,
        JSON.stringify({
          serverId: mcpServer.server_id,
          formValues: values,
          costConfig,
          allowedTools,
          searchValue,
          aliasManuallyEdited,
        }),
      );
    } catch (err) {
      console.warn("Failed to persist MCP edit state", err);
    }
  };

  const {
    startOAuthFlow,
    status: oauthStatus,
    error: oauthError,
    tokenResponse: oauthTokenResponse,
  } = useMcpOAuthFlow({
    accessToken,
    getCredentials: () => form.getFieldValue("credentials"),
    getTemporaryPayload: () => {
      const values = form.getFieldsValue(true);
      const url = values.url || mcpServer.url;
      const transport = values.transport || mcpServer.transport;
      if (!url || !transport) {
        return null;
      }
      const staticHeaders = Array.isArray(values.static_headers)
        ? values.static_headers.reduce((acc: Record<string, string>, entry: Record<string, string>) => {
            const header = entry?.header?.trim();
            if (!header) {
              return acc;
            }
            acc[header] = entry?.value ?? "";
            return acc;
          }, {})
        : ({} as Record<string, string>);

      return {
        server_id: mcpServer.server_id,
        server_name: values.server_name || mcpServer.server_name || mcpServer.alias,
        alias: values.alias || mcpServer.alias,
        description: values.description || mcpServer.description,
        url,
        transport,
        auth_type: AUTH_TYPE.OAUTH2,
        credentials: values.credentials,
        mcp_access_groups: values.mcp_access_groups || mcpServer.mcp_access_groups,
        static_headers: staticHeaders,
        command: values.command,
        args: values.args,
        env: values.env,
      };
    },
    onTokenReceived: (token) => {
      setOauthAccessToken(token?.access_token ?? null);
      
      if (token?.access_token) {
        const credentials = {
          access_token: token.access_token,
          ...(token.refresh_token && { refresh_token: token.refresh_token }),
          ...(token.expires_in && { expires_in: token.expires_in }),
          ...(token.scope && { scope: token.scope }),
        };
        
        form.setFieldsValue({ credentials });
        
        NotificationsManager.success(
          'OAuth 授权成功！请点击"更新 MCP 服务器"以保存凭证。'
        );
      }
    },
    onBeforeRedirect: persistEditUiState,
  });

  const initialStaticHeaders = React.useMemo(() => {
    if (!mcpServer.static_headers) {
      return [];
    }
    return Object.entries(mcpServer.static_headers).map(([header, value]) => ({
      header,
      value: value != null ? String(value) : "",
    }));
  }, [mcpServer.static_headers]);

  const initialEnvJson = React.useMemo(() => {
    const env = mcpServer.env ?? undefined;
    if (!env || Object.keys(env).length === 0) {
      return "";
    }
    try {
      return JSON.stringify(env, null, 2);
    } catch {
      return "";
    }
  }, [mcpServer.env]);


  // If server has spec_path, show it as "openapi" transport in the UI
  const effectiveTransport = React.useMemo(() => {
    if (mcpServer.spec_path && mcpServer.transport !== "stdio") {
      return TRANSPORT.OPENAPI;
    }
    return mcpServer.transport;
  }, [mcpServer]);

  const initialValues = React.useMemo(
    () => ({
      ...mcpServer,
      transport: effectiveTransport,
      static_headers: initialStaticHeaders,
      extra_headers: mcpServer.extra_headers || [],
      oauth_flow_type: mcpServer.token_url ? OAUTH_FLOW.M2M : OAUTH_FLOW.INTERACTIVE,
      token_validation_json: mcpServer.token_validation
        ? JSON.stringify(mcpServer.token_validation, null, 2)
        : undefined,
    }),
    [mcpServer, effectiveTransport, initialStaticHeaders, initialEnvJson],
  );

  // Initialize cost config from existing server data
  useEffect(() => {
    if (mcpServer.mcp_info?.mcp_server_cost_info) {
      setCostConfig(mcpServer.mcp_info.mcp_server_cost_info);
    }
  }, [mcpServer]);

  // Initialize allowed tools and tool overrides from existing server data
  useEffect(() => {
    if (mcpServer.allowed_tools) {
      setAllowedTools(mcpServer.allowed_tools);
    }
    setToolNameToDisplayName(mcpServer.tool_name_to_display_name ?? {});
    setToolNameToDescription(mcpServer.tool_name_to_description ?? {});
  }, [mcpServer]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedState = getSecureItem(EDIT_OAUTH_UI_STATE_KEY);
    if (!storedState) {
      return;
    }

    try {
      const parsed = JSON.parse(storedState);
      if (!parsed || parsed.serverId !== mcpServer.server_id) {
        return;
      }
      if (parsed.formValues) {
        setPendingRestoredValues({ ...mcpServer, ...parsed.formValues });
      }
      if (parsed.costConfig) {
        setCostConfig(parsed.costConfig);
      }
      if (parsed.allowedTools) {
        setAllowedTools(parsed.allowedTools);
      }
      if (parsed.searchValue) {
        setSearchValue(parsed.searchValue);
      }
      if (typeof parsed.aliasManuallyEdited === "boolean") {
        setAliasManuallyEdited(parsed.aliasManuallyEdited);
      }
    } catch (err) {
      console.error("Failed to restore MCP edit state", err);
    } finally {
      window.sessionStorage.removeItem(EDIT_OAUTH_UI_STATE_KEY);
    }
  }, [form, mcpServer]);

  useEffect(() => {
    if (!pendingRestoredValues) {
      return;
    }
    const transport = pendingRestoredValues.transport || mcpServer.transport;
    if (transport && transport !== form.getFieldValue("transport")) {
      form.setFieldsValue({ transport });
      return;
    }
    form.setFieldsValue(pendingRestoredValues);
    setPendingRestoredValues(null);
  }, [pendingRestoredValues, form, mcpServer.transport]);

  // Transform string array to object array for initial form values
  useEffect(() => {
    if (mcpServer.mcp_access_groups) {
      // If access groups are objects, extract the name property; if strings, use as is
      const groupNames = mcpServer.mcp_access_groups.map((g: any) => (typeof g === "string" ? g : g.name || String(g)));
      form.setFieldValue("mcp_access_groups", groupNames);
    }
  }, [mcpServer]);

  // Fetch tools when component mounts for a saved server
  useEffect(() => {
    if (!mcpServer.server_id || mcpServer.server_id.trim() === "") {
      return;
    }
    fetchTools();
  }, [mcpServer, accessToken]);

  const fetchTools = async () => {
    if (!accessToken || !mcpServer.server_id) return;

    setIsLoadingTools(true);
    setToolsError(null);

    try {
      // Use the GET endpoint which looks up stored credentials by server_id,
      // rather than POST /test/tools/list which requires inline credentials.
      const toolsResponse = await listMCPTools(accessToken, mcpServer.server_id);

      if (toolsResponse.tools && !toolsResponse.error) {
        setTools(toolsResponse.tools);
      } else {
        console.error("Failed to fetch tools:", toolsResponse.message);
        setTools([]);
          setToolsError(toolsResponse.message || "加载工具失败");
      }
    } catch (error) {
      console.error("Tools fetch error:", error);
      setTools([]);
      setToolsError(error instanceof Error ? error.message : "加载工具失败");
    } finally {
      setIsLoadingTools(false);
    }
  };

  // Generate options with existing groups and potential new group
  const getAccessGroupOptions = () => {
    const existingOptions = availableAccessGroups.map((group: string) => ({
      value: group,
      label: (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="font-medium">{group}</span>
        </div>
      ),
    }));

    // If search value doesn't match any existing group and is not empty, add "create new group" option
    if (
      searchValue &&
      !availableAccessGroups.some((group) => group.toLowerCase().includes(searchValue.toLowerCase()))
    ) {
      existingOptions.push({
        value: searchValue,
        label: (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="font-medium">{searchValue}</span>
            <span className="text-gray-400 text-xs ml-1">创建新分组</span>
          </div>
        ),
      });
    }

    return existingOptions;
  };

  const handleTransportChange = (value: string) => {
    // Clear fields that are not relevant for the selected transport.
    if (value === "stdio") {
      form.setFieldsValue({
        url: undefined,
        spec_path: undefined,
        auth_type: undefined,
        credentials: undefined,
        authorization_url: undefined,
        token_url: undefined,
        registration_url: undefined,
      });
    } else if (value === TRANSPORT.OPENAPI) {
      form.setFieldsValue({
        url: undefined,
        command: undefined,
        args: undefined,
        env_json: undefined,
        stdio_config: undefined,
      });
    } else {
      form.setFieldsValue({
        spec_path: undefined,
        command: undefined,
        args: undefined,
        env_json: undefined,
        stdio_config: undefined,
      });
    }
  };

  const handleSave = async (values: Record<string, any>) => {
    if (!accessToken) return;
    try {
      // Ensure access groups is always a string array
      const {
        static_headers: staticHeadersList,
        credentials: credentialValues,
        stdio_config: rawStdioConfig,
        env_json: rawEnvJson,
        command: rawCommand,
        args: rawArgs,
        allow_all_keys: allowAllKeysRaw,
        available_on_public_internet: availableOnPublicInternetRaw,
        delegate_auth_to_upstream: delegateAuthToUpstreamRaw,
        token_validation_json: rawTokenValidationJson,
        ...restValues
      } = values;

      const accessGroups = (restValues.mcp_access_groups || []).map((g: any) =>
        typeof g === "string" ? g : g.name || String(g),
      );

      const staticHeaders = Array.isArray(staticHeadersList)
        ? staticHeadersList.reduce((acc: Record<string, string>, entry: Record<string, string>) => {
            const header = entry?.header?.trim();
            if (!header) {
              return acc;
            }
            acc[header] = entry?.value ?? "";
            return acc;
          }, {})
        : ({} as Record<string, string>);

      const credentialsPayload =
        credentialValues && typeof credentialValues === "object"
          ? Object.entries(credentialValues).reduce((acc: Record<string, any>, [key, value]) => {
              if (value === undefined || value === null || value === "") {
                return acc;
              }
              if (key === "scopes") {
                if (Array.isArray(value)) {
                  const filteredScopes = value.filter((scope) => scope != null && scope !== "");
                  if (filteredScopes.length > 0) {
                    acc[key] = filteredScopes;
                  }
                }
              } else {
                acc[key] = value;
              }
              return acc;
            }, {})
          : undefined;

      let stdioFields: Record<string, any> = {};

      if (restValues.transport === "stdio") {
        // Prefer JSON config if provided (matches Create screen behavior)
        if (rawStdioConfig) {
          try {
            const stdioConfig = JSON.parse(rawStdioConfig);

            let actualConfig = stdioConfig;
            if (stdioConfig?.mcpServers && typeof stdioConfig.mcpServers === "object") {
              const serverNames = Object.keys(stdioConfig.mcpServers);
              if (serverNames.length > 0) {
                actualConfig = stdioConfig.mcpServers[serverNames[0]];
              }
            }

            const parsedArgs = Array.isArray(actualConfig?.args)
              ? actualConfig.args.map((v: any) => String(v)).filter((v: string) => v.trim() !== "")
              : [];

            const parsedEnv =
              actualConfig?.env && typeof actualConfig.env === "object" && !Array.isArray(actualConfig.env)
                ? Object.entries(actualConfig.env).reduce((acc: Record<string, string>, [k, v]) => {
                    if (k == null || String(k).trim() === "") return acc;
                    acc[String(k)] = v == null ? "" : String(v);
                    return acc;
                  }, {})
                : {};

            stdioFields = {
              command: actualConfig?.command ? String(actualConfig.command) : undefined,
              args: parsedArgs,
              env: parsedEnv,
            };

            if (!stdioFields.command) {
              NotificationsManager.fromBackend("Stdio 配置必须包含命令");
              return;
            }
          } catch {
            NotificationsManager.fromBackend("Stdio 配置中的 JSON 无效");
            return;
          }
        } else {
          // Dedicated fields path (command/args + env JSON)
          let parsedEnv: Record<string, string> = {};
          if (rawEnvJson) {
            try {
              const env = JSON.parse(rawEnvJson);
              if (env && typeof env === "object" && !Array.isArray(env)) {
                parsedEnv = Object.entries(env).reduce((acc: Record<string, string>, [k, v]) => {
                  if (k == null || String(k).trim() === "") return acc;
                  acc[String(k)] = v == null ? "" : String(v);
                  return acc;
                }, {});
              }
            } catch {
              NotificationsManager.fromBackend("Stdio 环境变量配置中的 JSON 无效");
              return;
            }
          }
          const parsedArgs = Array.isArray(rawArgs)
            ? rawArgs.map((v: any) => String(v)).filter((v: string) => v.trim() !== "")
            : [];

          const parsedCommand = rawCommand ? String(rawCommand).trim() : "";
          if (!parsedCommand) {
            NotificationsManager.fromBackend("Stdio 传输类型需要命令");
            return;
          }

          stdioFields = {
            command: parsedCommand,
            args: parsedArgs,
            env: parsedEnv,
          };
        }
      }

      // Map "openapi" transport to "http" for the backend
      if (restValues.transport === TRANSPORT.OPENAPI) {
        restValues.transport = "http";
      }

      // Parse token_validation JSON if provided
      let tokenValidation: Record<string, any> | null = null;
      if (rawTokenValidationJson && rawTokenValidationJson.trim() !== "") {
        try {
          tokenValidation = JSON.parse(rawTokenValidationJson);
        } catch {
          NotificationsManager.fromBackend("Token 验证规则中的 JSON 无效");
          return;
        }
      }

      // Prepare the payload with cost configuration and permission fields
      const mcpInfoServerName =
        restValues.server_name ||
        restValues.url ||
        mcpServer.server_name ||
        mcpServer.url ||
        restValues.alias ||
        mcpServer.alias ||
        "unknown";

      const payload: Record<string, any> = {
        ...restValues,
        ...stdioFields,
        // Remove UI-only fields
        stdio_config: undefined,
        env_json: undefined,
        server_id: mcpServer.server_id,
        mcp_info: {
          server_name: mcpInfoServerName,
          description: restValues.description,
          logo_url: logoUrl || undefined,
          mcp_server_cost_info: Object.keys(costConfig).length > 0 ? costConfig : null,
        },
        mcp_access_groups: accessGroups,
        alias: restValues.alias,
        // Include permission management fields
        extra_headers: restValues.extra_headers || [],
        allowed_tools: allowedTools.length > 0 ? allowedTools : null,
        tool_name_to_display_name: Object.keys(toolNameToDisplayName).length > 0 ? toolNameToDisplayName : null,
        tool_name_to_description: Object.keys(toolNameToDescription).length > 0 ? toolNameToDescription : null,
        disallowed_tools: restValues.disallowed_tools || [],
        static_headers: staticHeaders,
        allow_all_keys: Boolean(allowAllKeysRaw ?? mcpServer.allow_all_keys),
        available_on_public_internet: Boolean(availableOnPublicInternetRaw ?? mcpServer.available_on_public_internet),
        // ``delegate_auth_to_upstream`` is only honored server-side for
        // ``auth_type=oauth2``. The Form.Item is conditionally rendered so the
        // value drops out of the form on auth_type change; force false for any
        // non-oauth2 server to avoid persisting a stale ``true`` that would
        // silently re-activate if auth_type is later switched back to oauth2.
        delegate_auth_to_upstream:
          restValues.auth_type === AUTH_TYPE.OAUTH2
            ? Boolean(delegateAuthToUpstreamRaw ?? mcpServer.delegate_auth_to_upstream)
            : false,
        // Include token_validation when it is set (non-null) or when clearing an existing value
        ...(tokenValidation !== null || mcpServer.token_validation
          ? { token_validation: tokenValidation }
          : {}),
      };

      const includeCredentials = restValues.auth_type && AUTH_TYPES_REQUIRING_CREDENTIALS.includes(restValues.auth_type);

      if (includeCredentials && credentialsPayload && Object.keys(credentialsPayload).length > 0) {
        payload.credentials = credentialsPayload;
      }

      const updated = await updateMCPServer(accessToken, payload);
      NotificationsManager.success("MCP 服务器更新成功");
      onSuccess(updated);
    } catch (error: any) {
      NotificationsManager.fromBackend("更新 MCP 服务器失败" + (error?.message ? `: ${error.message}` : ""));
    }
  };

  return (
    <TabGroup>
      <TabList className="grid w-full grid-cols-2">
        <Tab>服务器配置</Tab>
        <Tab>成本配置</Tab>
      </TabList>
      <TabPanels className="mt-6">
        <TabPanel>
          <Form form={form} onFinish={handleSave} initialValues={initialValues} layout="vertical">
            <Form.Item
              label="MCP 服务器名称"
              name="server_name"
              rules={[
                {
                  validator: (_, value) => validateMCPServerName(value),
                },
              ]}
            >
              <Input className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
            </Form.Item>
            <Form.Item
              label="别名"
              name="alias"
              rules={[
                {
                  validator: (_, value) => validateMCPServerName(value),
                },
              ]}
            >
              <Input
                onChange={() => setAliasManuallyEdited(true)}
                className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </Form.Item>
            <Form.Item label="描述" name="description">
              <Input className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
            </Form.Item>
            <MCPLogoSelector value={logoUrl} onChange={setLogoUrl} />
            <Form.Item label="传输类型" name="transport" rules={[{ required: true }]}>
              <Select onChange={handleTransportChange}>
                <Select.Option value="http">Streamable HTTP（推荐）</Select.Option>
                <Select.Option value="sse">服务器推送事件 (SSE)</Select.Option>
                <Select.Option value="stdio">标准输入/输出 (stdio)</Select.Option>
                <Select.Option value={TRANSPORT.OPENAPI}>OpenAPI 规范</Select.Option>
              </Select>
            </Form.Item>

            {/* URL field - only for HTTP/SSE */}
            {isMCPTransport && (
              <Form.Item
                label="MCP 服务器 URL"
                name="url"
                rules={[
                  { required: true, message: "请输入服务器 URL" },
                  { validator: (_, value) => validateMCPServerUrl(value) },
                ]}
              >
                <Input
                  placeholder="https://your-mcp-server.com"
                  className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </Form.Item>
            )}

            {/* OpenAPI Spec URL - only for OpenAPI transport */}
            {isOpenAPITransport && (
              <Form.Item
                label={
                  <span className="text-sm font-medium text-gray-700 flex items-center">
                    OpenAPI 规范 URL
                    <Tooltip title="OpenAPI 规范（JSON 或 YAML）的 URL。将根据规范中定义的 API 端点自动生成 MCP 工具。">
                      <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                    </Tooltip>
                  </span>
                }
                name="spec_path"
                rules={[{ required: true, message: "请输入 OpenAPI 规范 URL" }]}
              >
                <Input
                  placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                  className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </Form.Item>
            )}

            {/* Authentication - for HTTP, SSE, and OpenAPI */}
            {!isStdioTransport && (
              <Form.Item label="身份验证" name="auth_type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="none">无</Select.Option>
                  <Select.Option value="api_key">API 密钥</Select.Option>
                  <Select.Option value="bearer_token">Bearer Token</Select.Option>
                  <Select.Option value="token">Token</Select.Option>
                  <Select.Option value="basic">基本认证</Select.Option>
                  <Select.Option value="oauth2">OAuth</Select.Option>
                  <Select.Option value="aws_sigv4">AWS SigV4（Bedrock AgentCore MCP）</Select.Option>
                </Select>
              </Form.Item>
            )}

            {isStdioTransport && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <p className="text-sm text-gray-600">
                  配置用于启动 MCP 服务器进程的 stdio 传输。您可以填写以下字段或粘贴 JSON 配置。
                </p>

                <Form.Item
                  label="命令"
                  name="command"
                  rules={[{ required: true, message: "请输入 stdio 传输的命令" }]}
                >
                  <Input
                    placeholder="例如：npx"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>

                <Form.Item
                  label="参数"
                  name="args"
                >
                  <Select
                    mode="tags"
                    size="large"
                    tokenSeparators={[","]}
                    placeholder="添加参数（按回车或逗号）"
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  label="环境变量（JSON 对象）"
                  name="env_json"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        try {
                          const parsed = JSON.parse(value);
                          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("环境变量必须是 JSON 对象"));
                        } catch {
                          return Promise.reject(new Error("请输入有效的 JSON"));
                        }
                      },
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={6}
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                    placeholder={`{\n  \"KEY\": \"value\"\n}`}
                  />
                </Form.Item>

                {/* Optional JSON config (if provided, it overrides command/args/env on save) */}
                <StdioConfiguration isVisible={true} required={false} />
              </div>
            )}

            {!isStdioTransport && shouldShowAuthValueField && (
              <Form.Item
                label={
                  <span className="text-sm font-medium text-gray-700 flex items-center">
                    认证值
                    <Tooltip title="用于每次请求的 Token、密码或标头值，对应所选认证类型。">
                      <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                    </Tooltip>
                  </span>
                }
                name={["credentials", "auth_value"]}
                rules={[
                  {
                    validator: (_, value) =>
                      value && typeof value === "string" && value.trim() === ""
                        ? Promise.reject(new Error("认证值不能为空"))
                        : Promise.resolve(),
                  },
                ]}
              >
                <Input.Password
                  placeholder="输入 Token 或密钥（留空则保留现有值）"
                  className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </Form.Item>
            )}

            {!isStdioTransport && isOAuthAuthType && (
              <>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      OAuth 客户端 ID（可选）
                      <Tooltip title="仅当您的 MCP 服务器无法处理动态客户端注册时才提供。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "client_id"]}
                >
                  <Input.Password
                    placeholder="输入 OAuth 客户端 ID（留空则保留现有值）"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      OAuth 客户端密钥（可选）
                      <Tooltip title="仅当您的 MCP 服务器无法处理动态客户端注册时才提供。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "client_secret"]}
                >
                  <Input.Password
                    placeholder="输入 OAuth 客户端密钥（留空则保留现有值）"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      OAuth 作用域（可选）
                      <Tooltip title="添加作用域以覆盖此 MCP 服务器使用的默认作用域列表。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "scopes"]}
                >
                  <Select
                    mode="tags"
                    tokenSeparators={[","]}
                    placeholder="添加作用域"
                    className="rounded-lg"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      授权 URL 覆盖（可选）
                      <Tooltip title="授权端点的可选覆盖。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name="authorization_url"
                >
                  <Input
                    placeholder="https://example.com/oauth/authorize"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      Token URL 覆盖（可选）
                      <Tooltip title="Token 端点的可选覆盖。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name="token_url"
                >
                  <Input
                    placeholder="https://example.com/oauth/token"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      注册 URL 覆盖（可选）
                      <Tooltip title="动态客户端注册端点的可选覆盖。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name="registration_url"
                >
                  <Input
                    placeholder="https://example.com/oauth/register"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                {!isM2MFlow && (
                  <>
                    <Form.Item
                      label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      Token 验证规则（可选）
                      <Tooltip title='存储前根据 OAuth Token 响应检查的键值规则 JSON 对象。支持嵌套字段的点号表示法（例如 {"organization": "my-org", "team.id": "123"}）。验证失败的 Token 将返回 HTTP 403。'>
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
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
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      Token 存储 TTL（秒，可选）
                      <Tooltip title="在 Redis 中缓存每个用户的 OAuth 访问令牌的时间（无论令牌自身的 expires_in 如何）。留空则从令牌的 expires_in 派生 TTL，否则回退到 12 小时默认值。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name="token_storage_ttl_seconds"
                >
                  <InputNumber
                    min={1}
                    placeholder="例如 3600"
                        style={{ width: "100%" }}
                        className="rounded-lg"
                      />
                    </Form.Item>
                  </>
                )}
                <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-2">
                  <p className="text-sm text-gray-600">使用 OAuth 获取新的访问令牌，并将其临时保存在会话中作为认证值。</p>
                  <Button
                    variant="secondary"
                    onClick={startOAuthFlow}
                    disabled={oauthStatus === "authorizing" || oauthStatus === "exchanging"}
                  >
                    {oauthStatus === "authorizing"
                      ? "等待授权..."
                      : oauthStatus === "exchanging"
                        ? "正在交换授权码..."
                        : "授权并获取 Token"}
                  </Button>
                  {oauthError && <p className="text-sm text-red-500">{oauthError}</p>}
                  {oauthStatus === "success" && oauthTokenResponse?.access_token && (
                    <p className="text-sm text-green-600">
                      Token 已获取。{oauthTokenResponse.expires_in ?? "?"} 秒后过期。
                    </p>
                  )}
                </div>
              </>
            )}

            {!isStdioTransport && isAwsSigV4AuthType && (
              <>
                <p className="text-sm text-gray-500 mb-2">
                  适用于托管在 AWS Bedrock AgentCore 上的 MCP 服务器。{" "}
                  <a href="https://docs.litellm.ai/docs/mcp_aws_sigv4" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                    查看文档 &rarr;
                  </a>
                </p>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 区域
                      <Tooltip title="SigV4 签名的 AWS 区域（例如 us-east-1）">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_region_name"]}
                  rules={[]}
                >
                  <Input
                    placeholder="us-east-1（留空则保留现有值）"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 服务名称
                      <Tooltip title="SigV4 签名的 AWS 服务名称。默认为 'bedrock-agentcore'。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_service_name"]}
                >
                  <Input
                    placeholder="bedrock-agentcore（留空则保留现有值）"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 访问密钥 ID
                      <Tooltip title="可选。如果未提供，则回退到 boto3 凭证链（IAM 角色、环境变量等）。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_access_key_id"]}
                  rules={[]}
                >
                  <Input.Password
                    placeholder="留空以保留现有值"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 秘密访问密钥
                      <Tooltip title="可选。如果提供了 AWS 访问密钥 ID，则需要此项。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_secret_access_key"]}
                  rules={[]}
                >
                  <Input.Password
                    placeholder="留空以保留现有值"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 会话 Token
                      <Tooltip title="可选。仅临时 STS 凭证需要。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_session_token"]}
                >
                  <Input.Password
                    placeholder="留空以保留现有值"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 角色 ARN
                      <Tooltip title="可选。签名前通过 STS 扮演的 IAM 角色 ARN。如果设置，LiteLLM 将调用 sts:AssumeRole 获取临时凭证。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_role_name"]}
                >
                  <Input
                    placeholder="留空以保留现有值"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS 会话名称
                      <Tooltip title="可选。AssumeRole 调用的会话名称——将出现在 CloudTrail 日志中。省略时自动生成。">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_session_name"]}
                >
                  <Input
                    placeholder="留空以保留现有值"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
              </>
            )}

            {/* Permission Management / Access Control Section */}
            <div className="mt-6">
              <MCPPermissionManagement
                availableAccessGroups={availableAccessGroups}
                mcpServer={mcpServer}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                getAccessGroupOptions={getAccessGroupOptions}
              />
            </div>

            {/* Tool Configuration Section */}
            <div className="mt-6">
              <MCPToolConfiguration
                accessToken={accessToken}
                oauthAccessToken={oauthAccessToken}
                formValues={{
                  server_id: mcpServer.server_id,
                  server_name: currentServerName ?? mcpServer.server_name,
                  url: currentUrl ?? mcpServer.url,
                  spec_path: currentSpecPath ?? mcpServer.spec_path,
                  transport: transportType ?? mcpServer.transport,
                  auth_type: currentAuthType ?? mcpServer.auth_type,
                  mcp_info: mcpServer.mcp_info,
                  oauth_flow_type: (currentTokenUrl ?? mcpServer.token_url) ? OAUTH_FLOW.M2M : OAUTH_FLOW.INTERACTIVE,
                  static_headers: currentStaticHeaders ?? mcpServer.static_headers,
                  credentials: currentCredentials,
                  authorization_url: currentAuthorizationUrl ?? mcpServer.authorization_url,
                  token_url: currentTokenUrl ?? mcpServer.token_url,
                  registration_url: currentRegistrationUrl ?? mcpServer.registration_url,
                }}
                allowedTools={allowedTools}
                existingAllowedTools={mcpServer.allowed_tools || null}
                onAllowedToolsChange={setAllowedTools}
                toolNameToDisplayName={toolNameToDisplayName}
                toolNameToDescription={toolNameToDescription}
                onToolNameToDisplayNameChange={setToolNameToDisplayName}
                onToolNameToDescriptionChange={setToolNameToDescription}
              />
            </div>

            <div className="flex justify-end gap-2">
              <AntdButton onClick={onCancel}>取消</AntdButton>
              <Button type="submit">保存更改</Button>
            </div>
          </Form>
        </TabPanel>

        <TabPanel>
          <div className="space-y-6">
            <MCPServerCostConfig value={costConfig} onChange={setCostConfig} tools={tools} disabled={isLoadingTools} />

            <div className="flex justify-end gap-2">
              <AntdButton onClick={onCancel}>取消</AntdButton>
              <Button onClick={() => form.submit()}>保存更改</Button>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </TabGroup>
  );
};

export default MCPServerEdit;
