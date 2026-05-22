import { Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import TableIconActionButton from "../common_components/IconActionButton/TableIconActionButtons/TableIconActionButton";
import { SearchTool } from "./types";

export const searchToolColumns = (
  onView: (searchToolId: string) => void,
  onEdit: (searchToolId: string) => void,
  onDelete: (searchToolId: string) => void,
  availableProviders: Array<{ provider_name: string; ui_friendly_name: string }>,
): ColumnsType<SearchTool> => [
    {
      title: "搜索工具 ID",
      dataIndex: "search_tool_id",
      key: "search_tool_id",
      render: (_, tool) => {
        const isFromConfig = tool.is_from_config;

        if (isFromConfig) {
          return <span className="text-xs">-</span>;
        }

        return (
          <button
            onClick={() => onView(tool.search_tool_id!)}
            className="font-mono text-blue-500 bg-blue-50 hover:bg-blue-100 text-xs font-normal px-2 py-0.5 text-left cursor-pointer max-w-40"
          >
            <span className="truncate block">{tool.search_tool_id}</span>
          </button>
        );
      },
    },
    {
      title: "名称",
      dataIndex: "search_tool_name",
      key: "search_tool_name",
      render: (name: string) => <span className="font-medium">{name}</span>,
    },
    {
      title: "提供商",
      key: "provider",
      render: (_, tool) => {
        const provider = tool.litellm_params.search_provider;
        const providerInfo = availableProviders.find((p) => p.provider_name === provider);
        const displayName = providerInfo?.ui_friendly_name || provider;

        return <span className="text-sm">{displayName}</span>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (_, tool) => {
        return <span className="text-xs">{tool.created_at ? new Date(tool.created_at).toLocaleDateString() : "-"}</span>;
      },
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      render: (_, tool) => {
        return <span className="text-xs">{tool.updated_at ? new Date(tool.updated_at).toLocaleDateString() : "-"}</span>;
      },
    },
    {
      title: "来源",
      key: "source",
      render: (_, tool) => {
        const isFromConfig = tool.is_from_config ?? false;

        return (
          <Tag color={isFromConfig ? "default" : "blue"}>
            {isFromConfig ? "配置" : "数据库"}
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      render: (_, tool) => {
        const toolId = tool.search_tool_id;
        const isFromConfig = tool.is_from_config ?? false;

        return (
          <div className="flex items-center gap-2">
            <TableIconActionButton
              variant="Edit"
              tooltipText="编辑搜索工具"
              disabled={isFromConfig}
              disabledTooltipText="配置中的搜索工具无法在仪表板上编辑。请从配置文件中编辑。"
              onClick={() => {
                if (toolId && !isFromConfig) {
                  onEdit(toolId);
                }
              }}
            />
            <TableIconActionButton
              variant="Delete"
              tooltipText="删除搜索工具"
              disabled={isFromConfig}
              disabledTooltipText="配置中的搜索工具无法在仪表板上删除。请从配置文件中删除。"
              onClick={() => {
                if (toolId && !isFromConfig) {
                  onDelete(toolId);
                }
              }}
            />
          </div>
        );
      },
    },
  ];
