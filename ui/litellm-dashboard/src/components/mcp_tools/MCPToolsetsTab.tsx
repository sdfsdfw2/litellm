import React, { useState, useCallback } from "react";
import { Button, Text, Title } from "@tremor/react";
import { Modal, Form, Input, message, Spin, Card, Typography, Space } from "antd";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/outline";
import { ColumnDef } from "@tanstack/react-table";
import { useMCPToolsets } from "@/app/(dashboard)/hooks/mcpServers/useMCPToolsets";
import { useMCPServers } from "@/app/(dashboard)/hooks/mcpServers/useMCPServers";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "../view_logs/table";
import {
  createMCPToolset,
  updateMCPToolset,
  deleteMCPToolset,
  listMCPTools,
  getProxyBaseUrl,
} from "../networking";
import { MCPToolset, MCPToolsetTool } from "./types";

const { Text: AntdText } = Typography;

interface MCPToolsetsTabProps {
  accessToken: string | null;
  userRole: string | null;
}

interface ToolsetFormValues {
  toolset_name: string;
  description?: string;
}

interface MCPToolListProps {
  serverId: string;
  serverName: string;
  accessToken: string | null;
  selectedTools: MCPToolsetTool[];
  onToggle: (tool: MCPToolsetTool) => void;
}

interface ToolEntry {
  name: string;
  description?: string;
}

function MCPToolList({ serverId, serverName, accessToken, selectedTools, onToggle }: MCPToolListProps) {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedSet = new Set(selectedTools.filter((t) => t.server_id === serverId).map((t) => t.tool_name));

  const fetchTools = useCallback(async () => {
    if (!accessToken || tools.length > 0) return;
    setLoading(true);
    try {
      const result = await listMCPTools(accessToken, serverId);
      const toolList = Array.isArray(result) ? result : result?.tools ?? [];
      setTools(toolList.map((t: any) => ({ name: t.name ?? t.tool_name ?? t, description: t.description ?? "" })));
    } catch {
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, serverId, tools.length]);

  const handleToggle = () => {
    if (!expanded) fetchTools();
    setExpanded(!expanded);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={handleToggle}
      >
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          {serverName}
          {selectedSet.size > 0 && (
            <span className="ml-1 text-xs text-purple-600 font-semibold">已选 {selectedSet.size} 个</span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="p-2">
          {loading ? (
            <div className="flex justify-center py-3"><Spin size="small" /></div>
          ) : tools.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-2">此服务器未找到工具。</p>
          ) : (
            <div className="flex flex-col gap-1">
              {tools.map((tool) => {
                const selected = selectedSet.has(tool.name);
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => onToggle({ server_id: serverId, tool_name: tool.name })}
                    className={`flex items-start justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      selected
                        ? "bg-purple-50 border border-purple-300"
                        : "bg-white border border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium leading-tight ${selected ? "text-purple-800" : "text-gray-800"}`}>
                        {tool.name}
                      </p>
                      {tool.description && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight line-clamp-2">{tool.description}</p>
                      )}
                    </div>
                    {selected && <span className="text-purple-500 text-xs font-semibold ml-2 flex-shrink-0 mt-0.5">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateToolsetModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string | undefined, tools: MCPToolsetTool[]) => Promise<void>;
  accessToken: string | null;
  initialToolset?: MCPToolset;
}

function CreateToolsetModal({ open, onClose, onSave, accessToken, initialToolset }: CreateToolsetModalProps) {
  const [form] = Form.useForm<ToolsetFormValues>();
  const [selectedTools, setSelectedTools] = useState<MCPToolsetTool[]>(initialToolset?.tools || []);
  const [saving, setSaving] = useState(false);
  const [serverSearch, setServerSearch] = useState("");
  const { data: mcpServers = [] } = useMCPServers();

  React.useEffect(() => {
    if (open) {
      form.setFieldsValue({
        toolset_name: initialToolset?.toolset_name || "",
        description: initialToolset?.description || "",
      });
      setSelectedTools(initialToolset?.tools || []);
      setServerSearch("");
    }
  }, [open, initialToolset]);

  const handleToggleTool = (tool: MCPToolsetTool) => {
    setSelectedTools((prev) => {
      const exists = prev.some((t) => t.server_id === tool.server_id && t.tool_name === tool.tool_name);
      return exists
        ? prev.filter((t) => !(t.server_id === tool.server_id && t.tool_name === tool.tool_name))
        : [...prev, tool];
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSave(values.toolset_name, values.description, selectedTools);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const filteredServers = mcpServers.filter((s) => {
    const q = serverSearch.toLowerCase();
    return (
      !q ||
      (s.alias || "").toLowerCase().includes(q) ||
      (s.server_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={initialToolset ? "编辑工具集" : "新建工具集"}
      width={960}
      footer={null}
      forceRender
    >
      <Form form={form} layout="vertical" className="mt-2">
        <div className="flex gap-4 mb-4">
          <Form.Item
            label="工具集名称"
            name="toolset_name"
            rules={[{ required: true, message: "请输入工具集名称" }]}
            className="flex-1 mb-0"
          >
            <Input placeholder="例如: github-linear-tools" />
          </Form.Item>
          <Form.Item label="描述" name="description" className="flex-1 mb-0">
            <Input placeholder="可选描述" />
          </Form.Item>
        </div>
      </Form>

      <div className="flex gap-4 mt-2" style={{ minHeight: 360 }}>
        {/* Left panel: Available Tools */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-gray-700">可用工具</Text>
          </div>
          <Input
            placeholder="搜索 MCP 服务器..."
            value={serverSearch}
            onChange={(e) => setServerSearch(e.target.value)}
            className="mb-2"
            allowClear
          />
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
            {filteredServers.length === 0 ? (
              <Text className="text-gray-400 text-sm">{mcpServers.length === 0 ? "尚未配置 MCP 服务器" : "没有匹配的服务器"}</Text>
            ) : (
              filteredServers.map((server) => (
                <MCPToolList
                  key={server.server_id}
                  serverId={server.server_id}
                  serverName={server.alias || server.server_name || server.server_id}
                  accessToken={accessToken}
                  selectedTools={selectedTools}
                  onToggle={handleToggleTool}
                />
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-200 flex-shrink-0" />

        {/* Right panel: Your Toolset */}
        <div className="w-72 flex-shrink-0">
          <Text className="text-sm font-semibold text-gray-700 mb-2 block">
            你的工具集{" "}
            <span className="text-xs font-normal text-gray-400">({selectedTools.length} 个工具)</span>
          </Text>
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 340 }}>
            {selectedTools.length === 0 ? (
              <Text className="text-gray-400 text-sm">尚未添加工具</Text>
            ) : (
              selectedTools.map((tool, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleToggleTool(tool)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-red-50 hover:border-red-200 group transition-colors"
                >
                  <div className="min-w-0 text-left">
                    <span className="text-xs font-medium text-purple-800 group-hover:text-red-600 truncate block">{tool.tool_name}</span>
                    <span className="text-[10px] text-purple-400 truncate block">{tool.server_id.slice(0, 8)}…</span>
                  </div>
                  <span className="ml-2 text-purple-300 group-hover:text-red-400 text-xs flex-shrink-0">✕</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
        <Button variant="secondary" onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} loading={saving}>
          {initialToolset ? "保存更改" : "创建工具集"}
        </Button>
      </div>
    </Modal>
  );
}

function toolsetColumns(
  isAdmin: boolean,
  onEdit: (t: MCPToolset) => void,
  onDelete: (id: string) => void,
  proxyBaseUrl: string,
): ColumnDef<MCPToolset>[] {
  return [
    {
      header: "工具集 ID",
      accessorKey: "toolset_id",
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
          {row.original.toolset_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      header: "名称",
      accessorKey: "toolset_name",
      cell: ({ row }) => {
        const url = `${proxyBaseUrl}/toolset/${row.original.toolset_name}/mcp`;
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
              <span className="font-medium text-gray-900">{row.original.toolset_name}</span>
            </div>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-purple-600 font-mono truncate max-w-xs text-left transition-colors"
              onClick={() => navigator.clipboard.writeText(url)}
              title="点击复制端点 URL"
            >
              {url}
            </button>
          </div>
        );
      },
    },
    {
      header: "描述",
      accessorKey: "description",
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">{row.original.description || "—"}</span>
      ),
    },
    {
      header: "工具",
      accessorKey: "tools",
      cell: ({ row }) => {
        const tools = row.original.tools;
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {tools.slice(0, 4).map((t, i) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 text-xs">
                {t.tool_name}
              </span>
            ))}
            {tools.length > 4 && (
              <span className="text-xs text-gray-400 self-center">+{tools.length - 4} 更多</span>
            )}
          </div>
        );
      },
    },
    {
      header: "创建时间",
      accessorKey: "created_at",
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
    ...(isAdmin ? [{
      header: "",
      id: "actions",
      cell: ({ row }: { row: { original: MCPToolset } }) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            onClick={() => onEdit(row.original)}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            onClick={() => onDelete(row.original.toolset_id)}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    } as ColumnDef<MCPToolset>] : []),
  ];
}

function ToolsetUsageGuide() {
  const [copied, setCopied] = useState(false);
  const proxyBaseUrl = getProxyBaseUrl();

  const snippet = `{
  "mcpServers": {
    "my-toolset": {
      "url": "${proxyBaseUrl}/toolset/<toolset-name>/mcp",
      "headers": { "x-litellm-api-key": "Bearer <your-api-key>" }
    }
  }
}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
      <p className="text-sm font-medium text-gray-700 mb-1">工具集工作原理</p>
      <p className="text-sm text-gray-500 mb-3">
        创建工具集，通过 <span className="font-medium text-gray-700">API 密钥 → 编辑密钥 → MCP 服务器</span> 将其分配给密钥，然后将 MCP 客户端指向工具集 URL。客户端只会看到您选择的工具。
      </p>
      <div className="text-xs text-gray-400 mb-1">Claude Code / Cursor 配置</div>
      <div className="relative">
        <pre className="bg-white border border-gray-200 rounded px-4 py-3 text-xs font-mono text-gray-700 overflow-x-auto leading-relaxed pr-14">
          {snippet}
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute top-2 right-2 px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 border-gray-200 transition-colors"
        >
          {copied ? "✓" : "复制"}
        </button>
      </div>
    </div>
  );
}

export function MCPToolsetsTab({ accessToken, userRole }: MCPToolsetsTabProps) {
  const queryClient = useQueryClient();
  const { data: toolsets = [], isLoading } = useMCPToolsets();
  const [createOpen, setCreateOpen] = useState(false);
  const [editToolset, setEditToolset] = useState<MCPToolset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = userRole === "Admin" || userRole === "proxy_admin";

  const handleCreate = async (name: string, description: string | undefined, tools: MCPToolsetTool[]) => {
    if (!accessToken) return;
    await createMCPToolset(accessToken, { toolset_name: name, description, tools });
    message.success("工具集已创建");
    queryClient.invalidateQueries({ queryKey: ["mcpToolsets"] });
  };

  const handleUpdate = async (name: string, description: string | undefined, tools: MCPToolsetTool[]) => {
    if (!accessToken || !editToolset) return;
    await updateMCPToolset(accessToken, { toolset_id: editToolset.toolset_id, toolset_name: name, description, tools });
    message.success("工具集已更新");
    queryClient.invalidateQueries({ queryKey: ["mcpToolsets"] });
    setEditToolset(null);
  };

  const handleDelete = async () => {
    if (!accessToken || !deleteId) return;
    setDeleting(true);
    try {
      await deleteMCPToolset(accessToken, deleteId);
      message.success("工具集已删除");
      queryClient.invalidateQueries({ queryKey: ["mcpToolsets"] });
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const proxyBaseUrl = getProxyBaseUrl();
  const columns = toolsetColumns(isAdmin, setEditToolset, setDeleteId, proxyBaseUrl);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title>MCP 工具集</Title>
          <Text className="text-gray-500 text-sm">
            从一台或多台 MCP 服务器精选的工具集合。通过 MCP 权限下拉菜单将工具集分配给密钥和团队。
          </Text>
        </div>
        {isAdmin && (
          <Button icon={PlusIcon} onClick={() => setCreateOpen(true)}>
新建工具集
          </Button>
        )}
      </div>

      <ToolsetUsageGuide />

      <DataTable
        data={toolsets}
        columns={columns}
        renderSubComponent={() => <div />}
        getRowCanExpand={() => false}
        isLoading={isLoading}
        noDataMessage="暂无工具集。点击'新建工具集'创建一个。"
        loadingMessage="正在加载工具集..."
        enableSorting={true}
      />

      <CreateToolsetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        accessToken={accessToken}
      />

      {editToolset && (
        <CreateToolsetModal
          open={!!editToolset}
          onClose={() => setEditToolset(null)}
          onSave={handleUpdate}
          accessToken={accessToken}
          initialToolset={editToolset}
        />
      )}

      <Modal
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true, loading: deleting }}
        title="删除工具集"
      >
        <p>确定要删除此工具集吗？使用该工具集的密钥和团队将失去对限定工具的访问权限。</p>
      </Modal>
    </div>
  );
}
