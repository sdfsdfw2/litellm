import React, { useState } from "react";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "@heroicons/react/outline";
import { Title, Card, Button, Text, Grid, TabGroup, TabList, TabPanel, TabPanels, Tab, Icon } from "@tremor/react";

import { MCPServer, handleTransport, handleAuth } from "./types";
// TODO: Move Tools viewer from index file
import { MCPToolsViewer } from ".";
import MCPServerEdit from "./mcp_server_edit";
import MCPServerCostDisplay from "./mcp_server_cost_display";
import { getMaskedAndFullUrl } from "./utils";
import { copyToClipboard as utilCopyToClipboard } from "@/utils/dataUtils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button as AntdButton } from "antd";

interface MCPServerViewProps {
  mcpServer: MCPServer;
  onBack: () => void;
  isProxyAdmin: boolean;
  isEditing: boolean;
  accessToken: string | null;
  userRole: string | null;
  userID: string | null;
  availableAccessGroups: string[];
}

export const MCPServerView: React.FC<MCPServerViewProps> = ({
  mcpServer,
  onBack,
  isEditing,
  isProxyAdmin,
  accessToken,
  userRole,
  userID,
  availableAccessGroups,
}) => {
  const [editing, setEditing] = useState(isEditing);
  const [showFullUrl, setShowFullUrl] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const handleSuccess = (updated: MCPServer) => {
    setEditing(false);
    onBack();
  };

  const urlValue = mcpServer.url ?? "";
  const { maskedUrl, hasToken } = urlValue ? getMaskedAndFullUrl(urlValue) : { maskedUrl: "—", hasToken: false };

  const renderUrlWithToggle = (url: string | null | undefined, showFull: boolean) => {
    if (!url) return "—";
    if (!hasToken) return url;
    return showFull ? url : maskedUrl;
  };

  const copyToClipboard = async (text: string | null | undefined, key: string) => {
    const success = await utilCopyToClipboard(text);
    if (success) {
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    }
  };

  const getTransportBadge = (transport: string) => {
    const label = transport.toUpperCase();
    return <span className="inline-flex items-center text-sm font-medium px-2.5 py-0.5 rounded border bg-gray-50 text-gray-700 border-gray-200">{label}</span>;
  };

  const getAuthBadge = (authType: string) => {
    return <span className="inline-flex items-center text-sm font-medium px-2.5 py-0.5 rounded border bg-gray-50 text-gray-700 border-gray-200">{authType}</span>;
  };

  return (
    <div className="p-4 max-w-full">
      <div className="mb-6">
        <Button icon={ArrowLeftIcon} variant="light" className="mb-4" onClick={onBack}>
          返回所有服务器
        </Button>
        <div className="flex items-center gap-2">
          <Title className="text-2xl">{mcpServer.server_name || mcpServer.alias || "未命名服务器"}</Title>
          <AntdButton
            type="text"
            size="small"
            icon={copiedStates["mcp-server_name"] ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            onClick={() => copyToClipboard(mcpServer.server_name || mcpServer.alias, "mcp-server_name")}
            className={`transition-all duration-200 ${copiedStates["mcp-server_name"]
              ? "text-green-600 bg-green-50 border-green-200"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
          />
          {mcpServer.alias && mcpServer.server_name && mcpServer.alias !== mcpServer.server_name && (
            <span className="ml-2 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 font-mono">
              {mcpServer.alias}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Text className="text-gray-400 font-mono text-xs">{mcpServer.server_id}</Text>
          <AntdButton
            type="text"
            size="small"
            icon={copiedStates["mcp-server-id"] ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
            onClick={() => copyToClipboard(mcpServer.server_id, "mcp-server-id")}
            className={`transition-all duration-200 ${copiedStates["mcp-server-id"]
              ? "text-green-600 bg-green-50 border-green-200"
              : "text-gray-300 hover:text-gray-500 hover:bg-gray-50"
              }`}
          />
        </div>
        {mcpServer.description && (
          <Text className="text-gray-500 mt-2">{mcpServer.description}</Text>
        )}
      </div>

      {/* TODO: magic number for index */}
      <TabGroup index={selectedTabIndex} onIndexChange={setSelectedTabIndex}>
        <TabList className="mb-4">
          {[
            <Tab key="overview">概览</Tab>,
            <Tab key="tools">MCP 工具</Tab>,
            ...(isProxyAdmin ? [<Tab key="settings">设置</Tab>] : []),
          ]}
        </TabList>

        <TabPanels>
          {/* Overview Panel */}
          <TabPanel>
            <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-4">
              <Card className="p-4">
                <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">传输方式</Text>
                <div className="mt-3">
                  {getTransportBadge(handleTransport(mcpServer.transport ?? undefined, mcpServer.spec_path ?? undefined))}
                </div>
              </Card>

              <Card className="p-4">
                <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">身份验证</Text>
                <div className="mt-3">
                  {getAuthBadge(handleAuth(mcpServer.auth_type ?? undefined))}
                </div>
              </Card>

              <Card className="p-4">
                <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">主机 URL</Text>
                <div className="mt-3 flex items-center gap-2">
                  <Text className="break-all overflow-wrap-anywhere font-mono text-sm">
                    {renderUrlWithToggle(mcpServer.url, showFullUrl)}
                  </Text>
                  {/* Only proxy admins may reveal the raw URL — non-admins
                      receive a sanitized server object from the backend
                      with `url=null`, but hide the toggle anyway as
                      defense-in-depth in case the URL ever leaks back
                      into the response. */}
                  {hasToken && isProxyAdmin && (
                    <button onClick={() => setShowFullUrl(!showFullUrl)} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
                      <Icon icon={showFullUrl ? EyeOffIcon : EyeIcon} size="sm" className="text-gray-500" />
                    </button>
                  )}
                </div>
              </Card>
            </Grid>
            <Card className="mt-4 p-4">
              <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">费用配置</Text>
              <div className="mt-3">
                <MCPServerCostDisplay costConfig={mcpServer.mcp_info?.mcp_server_cost_info} />
              </div>
            </Card>
          </TabPanel>

          {/* Tool Panel */}
          <TabPanel>
            <MCPToolsViewer
              serverId={mcpServer.server_id}
              accessToken={accessToken}
              auth_type={mcpServer.auth_type}
              tokenUrl={mcpServer.token_url}
              userRole={userRole}
              userID={userID}
              serverAlias={mcpServer.alias}
              extraHeaders={mcpServer.extra_headers}
            />
          </TabPanel>

          {/* Settings Panel */}
          <TabPanel>
            <Card>
              <div className="flex justify-between items-center mb-4">
                <Title>MCP 服务器设置</Title>
                {editing ? null : (
                  <Button variant="light" onClick={() => setEditing(true)}>
                    编辑设置
                  </Button>
                )}
              </div>
              {editing ? (
                <MCPServerEdit
                  mcpServer={mcpServer}
                  accessToken={accessToken}
                  onCancel={() => setEditing(false)}
                  onSuccess={handleSuccess}
                  availableAccessGroups={availableAccessGroups}
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">服务器名称</Text>
                    <div className="col-span-2 text-sm text-gray-900">{mcpServer.server_name || <span className="text-gray-400">—</span>}</div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">别名</Text>
                    <div className="col-span-2 text-sm font-mono text-gray-900">{mcpServer.alias || <span className="text-gray-400">—</span>}</div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">描述</Text>
                    <div className="col-span-2 text-sm text-gray-900">{mcpServer.description || <span className="text-gray-400">—</span>}</div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">URL</Text>
                    <div className="col-span-2 text-sm font-mono text-gray-900 break-all flex items-center gap-2">
                      {renderUrlWithToggle(mcpServer.url, showFullUrl)}
                      {hasToken && (
                        <button onClick={() => setShowFullUrl(!showFullUrl)} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
                          <Icon icon={showFullUrl ? EyeOffIcon : EyeIcon} size="sm" className="text-gray-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">传输方式</Text>
                    <div className="col-span-2">{getTransportBadge(handleTransport(mcpServer.transport, mcpServer.spec_path))}</div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">身份验证</Text>
                    <div className="col-span-2">{getAuthBadge(handleAuth(mcpServer.auth_type))}</div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">额外请求头</Text>
                    <div className="col-span-2 text-sm text-gray-900">
                      {mcpServer.extra_headers && mcpServer.extra_headers.length > 0
                        ? mcpServer.extra_headers.join(", ")
                        : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">允许所有密钥</Text>
                    <div className="col-span-2">
                      {mcpServer.allow_all_keys ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                          已启用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full border border-gray-200 text-xs font-medium">
                          已禁用
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">网络访问</Text>
                    <div className="col-span-2">
                      {mcpServer.available_on_public_internet ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                          公开
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                          仅内网
                        </span>
                      )}
                    </div>
                  </div>
                  {handleAuth(mcpServer.auth_type) === "oauth2" && (
                    <div className="py-3 grid grid-cols-3 gap-4">
                      <Text className="text-sm font-medium text-gray-500">委托上游认证</Text>
                      <div className="col-span-2">
                        {mcpServer.delegate_auth_to_upstream ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            已启用（PKCE 透传）
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full border border-gray-200 text-xs font-medium">
                            已禁用
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">访问组</Text>
                    <div className="col-span-2">
                      {mcpServer.mcp_access_groups && mcpServer.mcp_access_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mcpServer.mcp_access_groups.map((group: any, index: number) => (
                            <span key={index} className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                              {typeof group === "string" ? group : group?.name ?? ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">允许的工具</Text>
                    <div className="col-span-2">
                      {mcpServer.allowed_tools && mcpServer.allowed_tools.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mcpServer.allowed_tools.map((tool: string, index: number) => (
                            <span key={index} className="inline-flex items-center text-xs font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              {tool}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">所有工具已启用</span>
                      )}
                    </div>
                  </div>
                  <div className="py-3 grid grid-cols-3 gap-4">
                    <Text className="text-sm font-medium text-gray-500">费用</Text>
                    <div className="col-span-2">
                      <MCPServerCostDisplay costConfig={mcpServer.mcp_info?.mcp_server_cost_info} />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};
