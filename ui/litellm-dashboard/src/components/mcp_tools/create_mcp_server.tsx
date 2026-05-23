import React, { useState } from "react";
import { Modal, Tooltip, Form, Select, Input, Switch, Collapse } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Button, TextInput } from "@tremor/react";
import { createMCPServer, registerMCPServer } from "../networking";
import { setToken } from "@/utils/mcpTokenStore";
import { AUTH_TYPE, DiscoverableMCPServer, OAUTH_FLOW, MCPServer, MCPServerCostInfo, TRANSPORT } from "./types";
import OAuthFormFields from "./OAuthFormFields";
import MCPServerCostConfig from "./mcp_server_cost_config";
import MCPConnectionStatus from "./mcp_connection_status";
import MCPToolConfiguration from "./mcp_tool_configuration";
import StdioConfiguration from "./StdioConfiguration";
import MCPPermissionManagement from "./MCPPermissionManagement";
import OpenAPIFormSection, { OpenAPIKeyTool } from "./OpenAPIFormSection";
import MCPLogoSelector from "./MCPLogoSelector";
import { isAdminRole } from "@/utils/roles";
import { validateMCPServerUrl, validateMCPServerName } from "./utils";
import NotificationsManager from "../molecules/notifications_manager";
import { useMcpOAuthFlow } from "@/hooks/useMcpOAuthFlow";
import { useTestMCPConnection } from "@/hooks/useTestMCPConnection";
import { getSecureItem, setSecureItem } from "@/utils/secureStorage";

const asset_logos_folder = "../ui/assets/logos/";
export const mcpLogoImg = `${asset_logos_folder}mcp_logo.png`;

interface CreateMCPServerProps {
  userRole: string;
  userID?: string | null;
  accessToken: string | null;
  onCreateSuccess: (newMcpServer: MCPServer) => void;
  isModalVisible: boolean;
  setModalVisible: (visible: boolean) => void;
  availableAccessGroups: string[];
  prefillData?: DiscoverableMCPServer | null;
  onBackToDiscovery?: () => void;
}

const AUTH_TYPES_REQUIRING_AUTH_VALUE = [AUTH_TYPE.API_KEY, AUTH_TYPE.BEARER_TOKEN, AUTH_TYPE.TOKEN, AUTH_TYPE.BASIC];
const AUTH_TYPES_REQUIRING_CREDENTIALS = [...AUTH_TYPES_REQUIRING_AUTH_VALUE, AUTH_TYPE.OAUTH2, AUTH_TYPE.AWS_SIGV4];
const CREATE_OAUTH_UI_STATE_KEY = "litellm-mcp-oauth-create-state";

const reduceStaticHeaders = (list: unknown): Record<string, string> => {
  if (!Array.isArray(list)) return {};
  return list.reduce((acc: Record<string, string>, entry: Record<string, string>) => {
    const header = entry?.header?.trim();
    if (header) acc[header] = entry?.value ?? "";
    return acc;
  }, {});
};

const CreateMCPServer: React.FC<CreateMCPServerProps> = ({
  userID,
  userRole,
  accessToken,
  onCreateSuccess,
  isModalVisible,
  setModalVisible,
  availableAccessGroups,
  prefillData,
  onBackToDiscovery,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [costConfig, setCostConfig] = useState<MCPServerCostInfo>({});
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [pendingRestoredValues, setPendingRestoredValues] = useState<{
    values: Record<string, any>;
    transport?: string;
  } | null>(null);
  const [aliasManuallyEdited, setAliasManuallyEdited] = useState(false);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [toolNameToDisplayName, setToolNameToDisplayName] = useState<Record<string, string>>({});
  const [toolNameToDescription, setToolNameToDescription] = useState<Record<string, string>>({});
  const [transportType, setTransportType] = useState<string>("");
  const [keyTools, setKeyTools] = useState<OpenAPIKeyTool[]>([]);
  const [searchValue, setSearchValue] = useState<string>("");
  const [oauthAccessToken, setOauthAccessToken] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [oauthDocsUrl, setOauthDocsUrl] = useState<string | null>(null);

  // Single hook call shared by MCPConnectionStatus and MCPToolConfiguration to avoid duplicate requests.
  const { tools, isLoadingTools, toolsError, toolsErrorStackTrace, canFetchTools, fetchTools, clearTools } = useTestMCPConnection({
    accessToken,
    oauthAccessToken,
    formValues,
    enabled: true,
  });

  const authType = formValues.auth_type as string | undefined;
  const shouldShowAuthValueField = authType ? AUTH_TYPES_REQUIRING_AUTH_VALUE.includes(authType) : false;
  const isOAuthAuthType = authType === AUTH_TYPE.OAUTH2;
  const isAwsSigV4AuthType = authType === AUTH_TYPE.AWS_SIGV4;
  const isM2MFlow = isOAuthAuthType && formValues.oauth_flow_type === OAUTH_FLOW.M2M;

  const persistCreateUiState = () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const values = form.getFieldsValue(true);
      setSecureItem(
        CREATE_OAUTH_UI_STATE_KEY,
        JSON.stringify({
          modalVisible: isModalVisible,
          formValues: values,
          transportType,
          costConfig,
          allowedTools,
          searchValue,
          aliasManuallyEdited,
          logoUrl,
        }),
      );
    } catch (err) {
      console.warn("Failed to persist MCP create state", err);
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
      const transport = values.transport || transportType;
      // For OpenAPI transport the form has spec_path instead of url.
      // We pass the spec_path as url so the temp-session endpoint has something
      // to store; the backend uses authorization_url / token_url for the actual
      // OAuth redirect, so the spec_path value is never used for OAuth itself.
      const url = values.url || (transport === TRANSPORT.OPENAPI ? values.spec_path : undefined);
      if (!url || !transport) {
        return null;
      }
      const staticHeaders = reduceStaticHeaders(values.static_headers);

      return {
        server_id: undefined,
        server_name: values.server_name,
        alias: values.alias,
        description: values.description,
        url,
        transport: transport === TRANSPORT.OPENAPI ? "http" : transport,
        auth_type: AUTH_TYPE.OAUTH2,
        credentials: values.credentials,
        authorization_url: values.authorization_url,
        token_url: values.token_url,
        registration_url: values.registration_url,
        mcp_access_groups: values.mcp_access_groups,
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
          "OAuth 授权成功！请点击「添加 MCP 服务器」保存配置。",
        );
      }
    },
    onBeforeRedirect: persistCreateUiState,
  });

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedState = getSecureItem(CREATE_OAUTH_UI_STATE_KEY);
    if (!storedState) {
      return;
    }

    try {
      const parsed = JSON.parse(storedState);
      if (parsed.modalVisible) {
        setModalVisible(true);
      }
      const restoredTransport = parsed.formValues?.transport || parsed.transportType || "";
      if (restoredTransport) {
        setTransportType(restoredTransport);
      }
      if (parsed.formValues) {
        setPendingRestoredValues({ values: parsed.formValues, transport: restoredTransport });
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
      if (parsed.logoUrl) {
        setLogoUrl(parsed.logoUrl);
      }
    } catch (err) {
      console.error("Failed to restore MCP create state", err);
    } finally {
      window.sessionStorage.removeItem(CREATE_OAUTH_UI_STATE_KEY);
    }
  }, [form, setModalVisible]);

  React.useEffect(() => {
    if (!pendingRestoredValues) {
      return;
    }
    const transportReady = transportType || pendingRestoredValues.transport || "";
    if (pendingRestoredValues.transport && !transportType) {
      // wait until transportType state catches up so the URL field is mounted
      return;
    }
    form.setFieldsValue(pendingRestoredValues.values);
    setFormValues(pendingRestoredValues.values);
    setPendingRestoredValues(null);
  }, [pendingRestoredValues, form, transportType]);

  // Pre-fill form from discovery selection
  React.useEffect(() => {
    if (!isModalVisible || !prefillData) {
      return;
    }
    // Sanitize server name: strip vendor prefix, replace hyphens with underscores
    const sanitizedName = (prefillData.name || "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    const transport = prefillData.transport || "";
    setTransportType(transport);

    const prefillValues: Record<string, any> = {
      server_name: sanitizedName,
      alias: sanitizedName,
      description: prefillData.description || "",
      transport: transport,
    };

    if (transport === "stdio") {
      const stdioObj: Record<string, any> = {};
      if (prefillData.command) stdioObj.command = prefillData.command;
      if (prefillData.args && prefillData.args.length > 0) stdioObj.args = prefillData.args;
      if (prefillData.env_vars && prefillData.env_vars.length > 0) {
        const envObj: Record<string, string> = {};
        for (const v of prefillData.env_vars) {
          envObj[v.name] = v.description ? `<${v.description}>` : "";
        }
        stdioObj.env = envObj;
      }
      if (Object.keys(stdioObj).length > 0) {
        prefillValues.stdio_config = JSON.stringify(stdioObj, null, 2);
      }
    } else if (prefillData.url) {
      prefillValues.url = prefillData.url;
    }

    form.setFieldsValue(prefillValues);
    setFormValues(prefillValues);
    setAliasManuallyEdited(false);
  }, [isModalVisible, prefillData, form]);

  const handleCreate = async (values: Record<string, any>) => {
    setIsLoading(true);
    try {
      const {
        static_headers: staticHeadersList,
        stdio_config: rawStdioConfig,
        credentials: credentialValues,
        allow_all_keys: allowAllKeysRaw,
        available_on_public_internet: availableOnPublicInternetRaw,
        delegate_auth_to_upstream: delegateAuthToUpstreamRaw,
        token_validation_json: rawTokenValidationJson,
        ...restValues
      } = values;

      // Transform access groups into objects with name property
      const accessGroups = restValues.mcp_access_groups;

      const staticHeaders = reduceStaticHeaders(staticHeadersList);

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

      // Process stdio configuration if present
      let stdioFields = {};
      if (rawStdioConfig && transportType === "stdio") {
        try {
          const stdioConfig = JSON.parse(rawStdioConfig);

          // Handle both formats:
          // 1. Full mcpServers structure: {"mcpServers": {"server-name": {...}}}
          // 2. Direct config: {"command": "...", "args": [...], "env": {...}}

          let actualConfig = stdioConfig;

          // If it's the full mcpServers structure, extract the first server config
          if (stdioConfig.mcpServers && typeof stdioConfig.mcpServers === "object") {
            const serverNames = Object.keys(stdioConfig.mcpServers);
            if (serverNames.length > 0) {
              const firstServerName = serverNames[0];
              actualConfig = stdioConfig.mcpServers[firstServerName];

              // If no alias is provided, use the server name from the JSON
              if (!restValues.server_name) {
                restValues.server_name = firstServerName.replace(/-/g, "_"); // Replace hyphens with underscores
              }
            }
          }

          stdioFields = {
            command: actualConfig.command,
            args: actualConfig.args,
            env: actualConfig.env,
          };

          console.log("Parsed stdio config:", stdioFields);
        } catch (error) {
          NotificationsManager.fromBackend("stdio 配置中的 JSON 无效");
          return;
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
          NotificationsManager.fromBackend("令牌验证规则中的 JSON 无效");
          setIsLoading(false);
          return;
        }
      }

      // Prepare the payload with cost configuration and allowed tools
      const payload: Record<string, any> = {
        ...restValues,
        ...stdioFields,
        // Remove the raw stdio_config field as we've extracted its components
        stdio_config: undefined,
        mcp_info: {
          server_name: restValues.server_name || restValues.url,
          description: restValues.description,
          logo_url: logoUrl || undefined,
          mcp_server_cost_info: Object.keys(costConfig).length > 0 ? costConfig : null,
        },
        mcp_access_groups: accessGroups,
        alias: restValues.alias,
        allowed_tools: allowedTools.length > 0 ? allowedTools : null,
        tool_name_to_display_name: Object.keys(toolNameToDisplayName).length > 0 ? toolNameToDisplayName : null,
        tool_name_to_description: Object.keys(toolNameToDescription).length > 0 ? toolNameToDescription : null,
        allow_all_keys: Boolean(allowAllKeysRaw),
        available_on_public_internet: Boolean(availableOnPublicInternetRaw),
        delegate_auth_to_upstream: Boolean(delegateAuthToUpstreamRaw),
        static_headers: staticHeaders,
        ...(tokenValidation !== null && { token_validation: tokenValidation }),
      };

      payload.static_headers = staticHeaders;
      const includeCredentials =
        restValues.auth_type && AUTH_TYPES_REQUIRING_CREDENTIALS.includes(restValues.auth_type);

      if (includeCredentials && credentialsPayload && Object.keys(credentialsPayload).length > 0) {
        payload.credentials = credentialsPayload;
      }

      console.log(`Payload: ${JSON.stringify(payload)}`);

      if (accessToken != null) {
        const response = isAdmin
          ? await createMCPServer(accessToken, payload)
          : await registerMCPServer(accessToken, payload);

        // Cache the OAuth token in sessionStorage so the Tools tab can use it
        // immediately without re-authenticating.  No backend DB write.
        if (oauthTokenResponse?.access_token && response?.server_id) {
          setToken(
            response.server_id,
            {
              access_token: oauthTokenResponse.access_token,
              expires_in: oauthTokenResponse.expires_in,
              refresh_token: oauthTokenResponse.refresh_token,
              token_type: oauthTokenResponse.token_type,
            },
            userID,
          );
        }

        NotificationsManager.success(
          isAdmin
            ? "MCP 服务器创建成功"
            : "MCP 服务器已提交，待管理员审核"
        );
        form.resetFields();
        setCostConfig({});
        clearTools();
        setAllowedTools([]);
        setAliasManuallyEdited(false);
        setLogoUrl(undefined);
        setModalVisible(false);
        onCreateSuccess(response);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      NotificationsManager.fromBackend(
        isAdmin ? `创建 MCP 服务器失败：${reason}` : `提交 MCP 服务器失败：${reason}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // state
  const handleCancel = () => {
    form.resetFields();
    setCostConfig({});
    clearTools();
    setAllowedTools([]);
    setAliasManuallyEdited(false);
    setLogoUrl(undefined);
    setModalVisible(false);
  };

  const handleTransportChange = (value: string) => {
    setTransportType(value);
    // Clear fields that are not relevant for the selected transport
    if (value === "stdio") {
      form.setFieldsValue({ url: undefined, spec_path: undefined, auth_type: undefined, credentials: undefined });
    } else if (value === TRANSPORT.OPENAPI) {
      form.setFieldsValue({ url: undefined, command: undefined, args: undefined, env: undefined });
    } else {
      form.setFieldsValue({ spec_path: undefined, command: undefined, args: undefined, env: undefined });
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
            <span className="text-gray-400 text-xs ml-1">创建新组</span>
          </div>
        ),
      });
    }

    return existingOptions;
  };

  // Auto-populate alias from server_name unless manually edited
  React.useEffect(() => {
    if (!aliasManuallyEdited && formValues.server_name) {
      const normalized = formValues.server_name.replace(/\s+/g, "_");
      form.setFieldsValue({ alias: normalized });
      setFormValues((prev) => ({ ...prev, alias: normalized }));
    }
  }, [formValues.server_name]);

  // Clear formValues when modal closes to reset child components
  React.useEffect(() => {
    if (!isModalVisible) {
      setFormValues({});
    }
  }, [isModalVisible]);

  const isAdmin = isAdminRole(userRole);

  // rendering
  return (
    <Modal
      title={
        <div className="flex items-center pb-4 border-b border-gray-100" style={{ gap: 12 }}>
          {onBackToDiscovery && (
            <button
              onClick={onBackToDiscovery}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none"
              style={{ flexShrink: 0 }}
            >
              &#8592;
            </button>
          )}
          <img
            src={mcpLogoImg}
            alt="MCP Logo"
            className="w-8 h-8 object-contain"
            style={{
              height: "20px",
              width: "20px",
              objectFit: "contain",
            }}
          />
          <h2 className="text-xl font-semibold text-gray-900">
            {isAdmin ? "添加新 MCP 服务器" : "提交 MCP 服务器以待审核"}
          </h2>
        </div>
      }
      open={isModalVisible}
      width={1000}
      onCancel={handleCancel}
      footer={null}
      forceRender
      className="top-8"
      styles={{
        body: { padding: "24px" },
        header: { padding: "24px 24px 0 24px", border: "none" },
      }}
    >
      <div className="mt-6">
        <Form
          form={form}
          onFinish={handleCreate}
          onValuesChange={(_, allValues) => setFormValues(allValues)}
          layout="vertical"
          className="space-y-6"
        >
          {!isAdmin && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              您的提交将发送给管理员审核，审核通过后才会生效。
              {" "}注意：必须使用团队范围的 API 密钥发起请求。
            </div>
          )}
          <div className="grid grid-cols-1 gap-6">
            <Form.Item
              label={
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  MCP 服务器名称
                  <Tooltip title="最佳实践：使用描述性名称来指示服务器的用途（例如：'GitHub_MCP'、'Email_Service'）。不能包含空格或连字符，请使用下划线代替。名称必须符合 SEP-986 规范，否则将被拒绝（https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-names）。">
                    <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                  </Tooltip>
                </span>
              }
              name="server_name"
              rules={[
                { required: false, message: "请输入服务器名称" },
                { validator: (_, value) => validateMCPServerName(value) },
              ]}
            >
              <TextInput
                placeholder="例如：GitHub_MCP、Zapier_MCP 等"
                className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  别名
                  <Tooltip title="该服务器的简短唯一标识符。未提供时默认使用服务器名称。不能包含空格或连字符，请使用下划线代替。">
                    <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                  </Tooltip>
                </span>
              }
              name="alias"
              rules={[{ required: false }, { validator: (_, value) => validateMCPServerName(value) }]}
            >
              <TextInput
                placeholder="例如：GitHub_MCP、Zapier_MCP 等"
                className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                onChange={() => setAliasManuallyEdited(true)}
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-sm font-medium text-gray-700">描述</span>}
              name="description"
              rules={[
                {
                  required: false,
                  message: "请输入服务器描述",
                },
              ]}
            >
              <TextInput
                placeholder="简要描述该服务器的功能"
                className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </Form.Item>

            <MCPLogoSelector value={logoUrl} onChange={setLogoUrl} />

            <Form.Item
              label={<span className="text-sm font-medium text-gray-700">GitHub / 源码 URL</span>}
              name="source_url"
            >
              <TextInput
                placeholder="https://github.com/org/mcp-server"
                className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-sm font-medium text-gray-700">传输方式</span>}
              name="transport"
              rules={[{ required: true, message: "请选择传输方式" }]}
            >
              <Select
                placeholder="选择传输方式"
                className="rounded-lg"
                size="large"
                onChange={handleTransportChange}
                value={transportType}
              >
                <Select.Option value="http">Streamable HTTP（推荐）</Select.Option>
                <Select.Option value="sse">服务器推送事件 (SSE)</Select.Option>
                <Select.Option value="stdio">标准输入/输出 (stdio)</Select.Option>
                <Select.Option value={TRANSPORT.OPENAPI}>OpenAPI 规范</Select.Option>
              </Select>
            </Form.Item>

            {/* URL field - only show for HTTP and SSE */}
            {(transportType === "http" || transportType === "sse") && (
              <Form.Item
                label={<span className="text-sm font-medium text-gray-700">MCP 服务器 URL</span>}
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

            {/* OpenAPI: logo picker + spec URL input */}
            {transportType === TRANSPORT.OPENAPI && (
              <OpenAPIFormSection
                form={form}
                accessToken={isModalVisible ? accessToken : null}
                onValuesChange={(updates) =>
                  setFormValues((prev) => ({ ...prev, ...updates }))
                }
                onKeyToolsChange={setKeyTools}
                onLogoUrlChange={setLogoUrl}
                onOAuthDocsUrlChange={setOauthDocsUrl}
              />
            )}

            {/* BYOK toggle - only for OpenAPI */}
            {transportType === TRANSPORT.OPENAPI && (
              <>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      BYOK（自带密钥）
                      <Tooltip title="启用后，每个用户为此服务提供自己的 API 密钥。密钥按用户存储，绝不共享。">
                        <InfoCircleOutlined className="text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name="is_byok"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.is_byok !== cur.is_byok || prev.auth_type !== cur.auth_type}>
                  {({ getFieldValue }) =>
                    getFieldValue("is_byok") ? (
                      <>
                        {/* Auth format hint */}
                        {getFieldValue("auth_type") && getFieldValue("auth_type") !== "none" && (
                          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
                            <InfoCircleOutlined className="mt-0.5 flex-shrink-0" />
                            <span>
                              用户密钥将以以下方式发送：{" "}
                              <code className="font-mono bg-blue-100 px-1 rounded">
                                {getFieldValue("auth_type") === "bearer_token" && "Authorization: Bearer {key}"}
                                {getFieldValue("auth_type") === "token" && "Authorization: token {key}"}
                                {getFieldValue("auth_type") === "api_key" && "x-api-key: {key}"}
                                {getFieldValue("auth_type") === "basic" && "Authorization: Basic {key}"}
                                {getFieldValue("auth_type") === "authorization" && "Authorization: {key}"}
                              </code>
                              {!getFieldValue("auth_type") && "请在下方的认证类型中指定格式。"}
                            </span>
                          </div>
                        )}
                        {!getFieldValue("auth_type") && (
                          <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700 flex items-start gap-2">
                            <InfoCircleOutlined className="mt-0.5 flex-shrink-0" />
                            <span>请在下方的<strong>认证类型</strong>中指定用户密钥的发送方式（例如：Bearer Token、API Key Header）。</span>
                          </div>
                        )}
                        <Form.Item
                          label={
                            <span className="text-sm font-medium text-gray-700">
                              访问描述
                              <Tooltip title="连接弹窗中向用户展示的权限列表（例如：'创建和管理 Jira 问题'）">
                                <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                              </Tooltip>
                            </span>
                          }
                          name="byok_description"
                        >
                          <Select
                            mode="tags"
                            placeholder="添加访问描述项（每项后按回车）"
                            className="w-full"
                            tokenSeparators={[","]}
                          />
                        </Form.Item>

                        <Form.Item
                          label={
                            <span className="text-sm font-medium text-gray-700">
                              API Key Help URL
                              <Tooltip title="Optional link shown to users to help them find their API key">
                                <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                              </Tooltip>
                            </span>
                          }
                          name="byok_api_key_help_url"
                        >
                          <Input placeholder="https://docs.example.com/api-keys" />
                        </Form.Item>
                      </>
                    ) : null
                  }
                </Form.Item>
              </>
            )}

            {/* Authentication - show for HTTP, SSE, and OpenAPI */}
            {transportType !== "stdio" && transportType !== "" && (
              <Collapse
                defaultActiveKey={["auth"]}
                className="mb-4"
                items={[
                  {
                    key: "auth",
                    label: <span className="text-sm font-semibold text-gray-700">Authentication</span>,
                    children: (
                      <>
                        <Form.Item
                          name="auth_type"
                          rules={[{ required: true, message: "Please select an auth type" }]}
                        >
                          <Select placeholder="Select auth type" className="rounded-lg" size="large">
                            <Select.Option value="none">None</Select.Option>
                            <Select.Option value="api_key">API Key</Select.Option>
                            <Select.Option value="bearer_token">Bearer Token</Select.Option>
                            <Select.Option value="token">Token</Select.Option>
                            <Select.Option value="basic">Basic Auth</Select.Option>
                            <Select.Option value="oauth2">OAuth</Select.Option>
                            <Select.Option value="aws_sigv4">AWS SigV4 (Bedrock AgentCore MCPs)</Select.Option>
                          </Select>
                        </Form.Item>

                        {shouldShowAuthValueField && (
                          <Form.Item
                            label={
                              <span className="text-sm font-medium text-gray-700 flex items-center">
                                Authentication Value
                                <Tooltip title="Token, password, or header value to send with each request for the selected auth type.">
                                  <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                                </Tooltip>
                              </span>
                            }
                            name={["credentials", "auth_value"]}
                            rules={[
                              {
                                validator: (_, value) =>
                                  value && typeof value === "string" && value.trim() === ""
                                    ? Promise.reject(new Error("Authentication value cannot be empty whitespace"))
                                    : Promise.resolve(),
                              },
                            ]}
                          >
                            <TextInput
                              type="password"
                              placeholder="Enter token or secret"
                              className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                          </Form.Item>
                        )}

                        {isOAuthAuthType && (
                          <OAuthFormFields
                            isM2M={isM2MFlow}
                            initialFlowType={OAUTH_FLOW.INTERACTIVE}
                            docsUrl={oauthDocsUrl}
                            oauthFlow={{
                              startOAuthFlow,
                              status: oauthStatus,
                              error: oauthError,
                              tokenResponse: oauthTokenResponse,
                            }}
                          />
                        )}
                      </>
                    ),
                  },
                ]}
              />
            )}

            {transportType !== "stdio" && transportType !== "" && isAwsSigV4AuthType && (
              <>
                <p className="text-sm text-gray-500 mb-2">
                  For MCP servers hosted on AWS Bedrock AgentCore.{" "}
                  <a href="https://docs.litellm.ai/docs/mcp_aws_sigv4" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                    View docs &rarr;
                  </a>
                </p>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Region
                      <Tooltip title="AWS region for SigV4 signing (e.g., us-east-1)">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_region_name"]}
                  rules={[{ required: true, message: "AWS region is required for SigV4 auth" }]}
                >
                  <Input
                    placeholder="us-east-1"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Service Name
                      <Tooltip title="AWS service name for SigV4 signing. Defaults to 'bedrock-agentcore'.">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_service_name"]}
                >
                  <Input
                    placeholder="bedrock-agentcore"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Access Key ID
                      <Tooltip title="Optional. If not provided, falls back to the boto3 credential chain (IAM role, env vars, etc.).">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_access_key_id"]}
                  dependencies={[["credentials", "aws_secret_access_key"]]}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const secretKey = getFieldValue(["credentials", "aws_secret_access_key"]);
                        if (secretKey && !value) {
                          return Promise.reject(new Error("Access Key ID is required when Secret Access Key is provided"));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    placeholder="AKIA... (optional — uses IAM role if blank)"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Secret Access Key
                      <Tooltip title="Optional. Required if AWS Access Key ID is provided.">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_secret_access_key"]}
                  dependencies={[["credentials", "aws_access_key_id"]]}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const accessKeyId = getFieldValue(["credentials", "aws_access_key_id"]);
                        if (accessKeyId && !value) {
                          return Promise.reject(new Error("Secret Access Key is required when Access Key ID is provided"));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    placeholder="Enter secret key (optional — uses IAM role if blank)"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Session Token
                      <Tooltip title="Optional. Only needed for temporary STS credentials.">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_session_token"]}
                >
                  <Input.Password
                    placeholder="Enter session token (optional)"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Role ARN
                      <Tooltip title="Optional. IAM role ARN to assume via STS before signing. If set, LiteLLM calls sts:AssumeRole to get temporary credentials. Uses ambient credentials (IAM role, env vars) as the source identity unless explicit keys are also provided.">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_role_name"]}
                >
                  <Input
                    placeholder="arn:aws:iam::123456789012:role/MyRole (optional)"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
                <Form.Item
                  label={
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      AWS Session Name
                      <Tooltip title="Optional. Session name for the AssumeRole call — appears in CloudTrail logs. Auto-generated if omitted.">
                        <InfoCircleOutlined className="ml-2 text-blue-400 hover:text-blue-600 cursor-help" />
                      </Tooltip>
                    </span>
                  }
                  name={["credentials", "aws_session_name"]}
                >
                  <Input
                    placeholder="litellm-prod (optional, auto-generated if blank)"
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </Form.Item>
              </>
            )}

            {/* Stdio Configuration - only show for stdio transport */}
            <StdioConfiguration isVisible={transportType === "stdio"} />
          </div>

          {/* Permission Management / Access Control Section */}
          <div className="mt-8">
            <MCPPermissionManagement
              availableAccessGroups={availableAccessGroups}
              mcpServer={null}
              searchValue={searchValue}
              setSearchValue={setSearchValue}
              getAccessGroupOptions={getAccessGroupOptions}
            />
          </div>

          {/* Connection Status Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <MCPConnectionStatus
              formValues={formValues}
              tools={tools}
              isLoadingTools={isLoadingTools}
              toolsError={toolsError}
              toolsErrorStackTrace={toolsErrorStackTrace}
              canFetchTools={canFetchTools}
              fetchTools={fetchTools}
            />
          </div>

          {/* Tool Configuration Section */}
          <div className="mt-6">
            <MCPToolConfiguration
              accessToken={accessToken}
              oauthAccessToken={oauthAccessToken}
              formValues={formValues}
              allowedTools={allowedTools}
              existingAllowedTools={null}
              onAllowedToolsChange={setAllowedTools}
              toolNameToDisplayName={toolNameToDisplayName}
              toolNameToDescription={toolNameToDescription}
              onToolNameToDisplayNameChange={setToolNameToDisplayName}
              onToolNameToDescriptionChange={setToolNameToDescription}
              keyTools={keyTools}
              externalTools={tools}
              externalIsLoading={isLoadingTools}
              externalError={toolsError}
              externalCanFetch={canFetchTools}
            />
          </div>

          {/* Cost Configuration Section */}
          <div className="mt-6">
            <MCPServerCostConfig
              value={costConfig}
              onChange={setCostConfig}
              tools={tools.filter((tool) => allowedTools.includes(tool.name))}
              disabled={false}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-100">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" loading={isLoading}>
              {isLoading ? "Creating..." : "Add MCP Server"}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default CreateMCPServer;
