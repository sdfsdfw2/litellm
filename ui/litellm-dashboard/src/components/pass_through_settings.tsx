import React, { useState, useEffect } from "react";
import { Text, Button, Icon, Title } from "@tremor/react";
import { deletePassThroughEndpointsCall, getPassThroughEndpointsCall } from "./networking";
import { Badge, Tooltip } from "antd";
import { PencilAltIcon, TrashIcon, InformationCircleIcon } from "@heroicons/react/outline";
import AddPassThroughEndpoint from "./add_pass_through";
import PassThroughInfoView from "./pass_through_info";
import { DataTable } from "./view_logs/table";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, EyeOff } from "lucide-react";
import NotificationsManager from "./molecules/notifications_manager";

interface GeneralSettingsPageProps {
  accessToken: string | null;
  userRole: string | null;
  userID: string | null;
  modelData: any;
  premiumUser?: boolean;
}

interface routingStrategyArgs {
  ttl?: number;
  lowest_latency_buffer?: number;
}

interface nestedFieldItem {
  field_name: string;
  field_type: string;
  field_value: any;
  field_description: string;
  stored_in_db: boolean | null;
}

export interface passThroughItem {
  id?: string;
  path: string;
  target: string;
  headers: object;
  include_subpath?: boolean;
  cost_per_request?: number;
  auth?: boolean;
  methods?: string[];
  guardrails?: Record<string, { request_fields?: string[]; response_fields?: string[] } | null>;
  default_query_params?: Record<string, string>;
}

// Password field component for headers
const PasswordField: React.FC<{ value: object }> = ({ value }) => {
  const [showPassword, setShowPassword] = useState(false);
  const headerString = JSON.stringify(value);

  return (
    <div className="flex items-center space-x-2">
      <span className="font-mono text-xs">{showPassword ? headerString : "••••••••"}</span>
      <button onClick={() => setShowPassword(!showPassword)} className="p-1 hover:bg-gray-100 rounded" type="button">
        {showPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
      </button>
    </div>
  );
};

const PassThroughSettings: React.FC<GeneralSettingsPageProps> = ({ accessToken, userRole, userID, modelData, premiumUser }) => {
  const [generalSettings, setGeneralSettings] = useState<passThroughItem[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !userRole || !userID) {
      return;
    }
    getPassThroughEndpointsCall(accessToken).then((data) => {
      let general_settings = data["endpoints"];
      setGeneralSettings(general_settings);
    });
  }, [accessToken, userRole, userID]);

  const handleEndpointUpdated = () => {
    // Refresh the endpoints list when an endpoint is updated
    if (accessToken) {
      getPassThroughEndpointsCall(accessToken).then((data) => {
        let general_settings = data["endpoints"];
        setGeneralSettings(general_settings);
      });
    }
  };

  const handleDelete = async (endpointId: string) => {
    // Set the endpoint to delete and open the confirmation modal
    setEndpointToDelete(endpointId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (endpointToDelete == null || !accessToken) {
      return;
    }

    try {
      await deletePassThroughEndpointsCall(accessToken, endpointToDelete);

      const updatedSettings = generalSettings.filter((setting) => setting.id !== endpointToDelete);
      setGeneralSettings(updatedSettings);

      NotificationsManager.success("端点删除成功。");
    } catch (error) {
      console.error("删除端点时出错:", error);
      NotificationsManager.fromBackend("删除端点时出错: " + error);
    }

    // Close the confirmation modal and reset the endpointToDelete
    setIsDeleteModalOpen(false);
    setEndpointToDelete(null);
  };

  const cancelDelete = () => {
    // Close the confirmation modal and reset the endpointToDelete
    setIsDeleteModalOpen(false);
    setEndpointToDelete(null);
  };

  const handleResetField = (endpointId: string, idx: number) => {
    // Use handleDelete instead of direct deletion
    handleDelete(endpointId);
  };

  // Define columns for the DataTable
  const columns: ColumnDef<passThroughItem>[] = [
    {
      header: "ID",
      accessorKey: "id",
      cell: (info: any) => (
        <Tooltip title={info.row.original.id}>
          <div
            className="font-mono text-blue-500 bg-blue-50 hover:bg-blue-100 text-xs font-normal px-2 py-0.5 text-left w-full truncate whitespace-nowrap cursor-pointer max-w-[15ch]"
            onClick={() => info.row.original.id && setSelectedEndpointId(info.row.original.id)}
          >
            {info.row.original.id}
          </div>
        </Tooltip>
      ),
    },
    {
      header: "路径",
      accessorKey: "path",
    },
    {
      header: "目标地址",
      accessorKey: "target",
      cell: (info: any) => <Text>{info.getValue()}</Text>,
    },
    {
      header: () => (
        <div className="flex items-center gap-1">
          <span>方法</span>
          <Tooltip title="此端点支持的HTTP方法">
            <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
          </Tooltip>
        </div>
      ),
      accessorKey: "methods",
      cell: (info: any) => {
        const methods = info.getValue();
        if (!methods || methods.length === 0) {
          return <Badge color="blue">ALL</Badge>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {methods.map((method: string) => (
              <Badge key={method} color="indigo" className="text-xs">
                {method}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: () => (
        <div className="flex items-center gap-1">
          <span>认证</span>
          <Tooltip title="需要LiteLLM虚拟密钥才能调用此端点">
            <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
          </Tooltip>
        </div>
      ),
      accessorKey: "auth",
      cell: (info: any) => <Badge color={info.getValue() ? "green" : "gray"}>{info.getValue() ? "是" : "否"}</Badge>,
    },
    {
      header: "请求头",
      accessorKey: "headers",
      cell: (info: any) => <PasswordField value={info.getValue() || {}} />,
    },
    {
      header: "操作",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex space-x-1">
          <Icon
            icon={PencilAltIcon}
            size="sm"
            onClick={() => row.original.id && setSelectedEndpointId(row.original.id)}
            title="编辑"
          />
          <Icon
            icon={TrashIcon}
            size="sm"
            onClick={() => handleResetField(row.original.id!, row.index)}
            title="删除"
          />
        </div>
      ),
    },
  ];

  if (!accessToken) {
    return null;
  }

  // If a specific endpoint is selected, show the info view
  if (selectedEndpointId) {
    // Find the endpoint by ID to get the endpoint data for the info view
    console.log("selectedEndpointId", selectedEndpointId);
    console.log("generalSettings", generalSettings);
    const selectedEndpoint = generalSettings.find((endpoint) => endpoint.id === selectedEndpointId);

    if (!selectedEndpoint) {
      return <div>未找到端点</div>;
    }

    return (
      <PassThroughInfoView
        endpointData={selectedEndpoint}
        onClose={() => setSelectedEndpointId(null)}
        accessToken={accessToken}
        isAdmin={userRole === "Admin" || userRole === "admin"}
        premiumUser={premiumUser}
        onEndpointUpdated={handleEndpointUpdated}
      />
    );
  }

  return (
    <div>
      <div>
        <Title>Pass Through 端点</Title>
        <Text className="text-tremor-content">配置和管理您的 Pass Through 端点</Text>
      </div>

      <AddPassThroughEndpoint
        accessToken={accessToken}
        setPassThroughItems={setGeneralSettings}
        passThroughItems={generalSettings}
        premiumUser={premiumUser}
      />

      <DataTable
        data={generalSettings}
        columns={columns}
        renderSubComponent={() => <div></div>}
        getRowCanExpand={() => false}
        isLoading={false}
        noDataMessage="未配置 Pass Through 端点"
      />

      {isDeleteModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            {/* Modal Panel */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            {/* Confirmation Modal Content */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">删除 Pass-Through 端点</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        确定要删除此 Pass-Through 端点吗？此操作不可撤销。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Button onClick={confirmDelete} color="red" className="ml-2">
                  删除
                </Button>
                <Button onClick={cancelDelete}>取消</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassThroughSettings;
