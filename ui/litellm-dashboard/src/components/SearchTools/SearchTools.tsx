import { isAdminRole } from "@/utils/roles";
import { LoadingOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Text, Title } from "@tremor/react";
import { Form, Input, Modal, Select, Spin, Table } from "antd";
import React, { useState } from "react";
import DeleteResourceModal from "../common_components/DeleteResourceModal";
import NotificationsManager from "../molecules/notifications_manager";
import {
  deleteSearchTool,
  fetchAvailableSearchProviders,
  fetchSearchTools,
  updateSearchTool,
} from "../networking";
import CreateSearchTool from "./CreateSearchTools";
import { searchToolColumns } from "./SearchToolColumn";
import { SearchToolView } from "./SearchToolView";
import { AvailableSearchProvider, SearchTool } from "./types";

interface SearchToolsProps {
  accessToken: string | null;
  userRole: string | null;
  userID: string | null;
}


const SearchTools: React.FC<SearchToolsProps> = ({ accessToken, userRole, userID }) => {
  const {
    data: searchTools,
    isLoading: isLoadingTools,
    refetch,
  } = useQuery({
    queryKey: ["searchTools"],
    queryFn: () => {
      if (!accessToken) throw new Error("Access Token required");
      return fetchSearchTools(accessToken).then((res) => res.search_tools || []);
    },
    enabled: !!accessToken,
  }) as { data: SearchTool[]; isLoading: boolean; refetch: () => void };

  const {
    data: providersResponse,
    isLoading: isLoadingProviders,
  } = useQuery({
    queryKey: ["searchProviders"],
    queryFn: () => {
      if (!accessToken) throw new Error("Access Token required");
      return fetchAvailableSearchProviders(accessToken);
    },
    enabled: !!accessToken,
  }) as { data: { providers: AvailableSearchProvider[] }; isLoading: boolean };

  const availableProviders = providersResponse?.providers || [];

  // State
  const [toolIdToDelete, setToolToDelete] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [editTool, setEditTool] = useState(false);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  const columns = React.useMemo(
    () =>
      searchToolColumns(
        (toolId: string) => {
          setSelectedToolId(toolId);
          setEditTool(false);
        },
        (toolId: string) => {
          const tool = searchTools?.find((t) => t.search_tool_id === toolId);
          if (tool) {
            form.setFieldsValue({
              search_tool_name: tool.search_tool_name,
              search_provider: tool.litellm_params.search_provider,
              api_key: tool.litellm_params.api_key,
              api_base: tool.litellm_params.api_base,
              timeout: tool.litellm_params.timeout,
              max_retries: tool.litellm_params.max_retries,
              description: tool.search_tool_info?.description,
            });
            setSelectedToolId(toolId);
            setEditModalVisible(true);
          }
        },
        handleDelete,
        availableProviders,
      ),
    [availableProviders, searchTools, form],
  );

  function handleDelete(toolId: string) {
    setToolToDelete(toolId);
    setIsDeleteModalOpen(true);
  }

  const confirmDelete = async () => {
    if (toolIdToDelete == null || accessToken == null) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteSearchTool(accessToken, toolIdToDelete);
      NotificationsManager.success("搜索工具已成功删除");
      setIsDeleteModalOpen(false);
      setToolToDelete(null);
      refetch();
    } catch (error) {
      console.error("Error deleting the search tool:", error);
      NotificationsManager.error("删除搜索工具失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setToolToDelete(null);
  };

  const toolToDelete = searchTools?.find((t) => t.search_tool_id === toolIdToDelete);
  const providerInfo = toolToDelete
    ? availableProviders.find((p) => p.provider_name === toolToDelete.litellm_params.search_provider)
    : null;

  const handleCreateSuccess = (newSearchTool: SearchTool) => {
    setCreateModalVisible(false);
    refetch();
  };

  const handleEditSubmit = async () => {
    if (!accessToken || !selectedToolId) return;

    try {
      const values = await form.validateFields();
      const searchToolData = {
        search_tool_name: values.search_tool_name,
        litellm_params: {
          search_provider: values.search_provider,
          api_key: values.api_key,
          api_base: values.api_base,
          timeout: values.timeout ? parseFloat(values.timeout) : undefined,
          max_retries: values.max_retries ? parseInt(values.max_retries) : undefined,
        },
        search_tool_info: values.description ? {
          description: values.description,
        } : undefined,
      };

      await updateSearchTool(accessToken, selectedToolId, searchToolData);
      NotificationsManager.success("搜索工具已成功更新");
      setEditModalVisible(false);
      form.resetFields();
      setSelectedToolId(null);
      refetch();
    } catch (error) {
      console.error("Failed to update search tool:", error);
      NotificationsManager.error("更新搜索工具失败");
    }
  };

  const renderEditForm = () => (
    <Form form={form} layout="vertical">
      <Form.Item
        name="search_tool_name"
        label="搜索工具名称"
        rules={[{ required: true, message: "请输入搜索工具名称" }]}
      >
        <Input placeholder="例如：my-perplexity-search" />
      </Form.Item>

      <Form.Item
        name="search_provider"
        label="搜索提供商"
        rules={[{ required: true, message: "请选择搜索提供商" }]}
      >
        <Select placeholder="选择搜索提供商" loading={isLoadingProviders}>
          {availableProviders.map((provider) => (
            <Select.Option key={provider.provider_name} value={provider.provider_name}>
              {provider.ui_friendly_name}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="api_key" label="API 密钥" extra="搜索提供商的 API 密钥">
        <Input.Password placeholder="输入 API 密钥" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} placeholder="此搜索工具的描述" />
      </Form.Item>
    </Form>
  );

  if (!accessToken || !userRole || !userID) {
    console.log("Missing required authentication parameters", { accessToken, userRole, userID });
    return <div className="p-6 text-center text-gray-500">缺少必需的身份验证参数。</div>;
  }

  const ToolsTab = () =>
    selectedToolId ? (
      <SearchToolView
        searchTool={
          searchTools?.find((tool: SearchTool) => tool.search_tool_id === selectedToolId) || {
            search_tool_id: "",
            search_tool_name: "",
            litellm_params: {
              search_provider: "",
            },
          }
        }
        onBack={() => {
          setEditTool(false);
          setSelectedToolId(null);
          refetch();
        }}
        isEditing={editTool}
        accessToken={accessToken}
        availableProviders={availableProviders}
      />
    ) : (
      <div className="w-full h-full">
        <Spin spinning={isLoadingTools} indicator={<LoadingOutlined spin />} size="large">
          <Table
            bordered
            dataSource={searchTools || []}
            columns={columns}
            rowKey={(record) => record.search_tool_id || record.search_tool_name}
            pagination={false}
            locale={{
              emptyText: "未配置搜索工具",
            }}
            size="small"
          />
        </Spin>

      </div>
    );

  return (
    <div className="w-full h-full p-6">
      <DeleteResourceModal
        isOpen={isDeleteModalOpen}
        title="删除搜索工具"
        message="确定要删除此搜索工具吗？此操作无法撤销。"
        resourceInformationTitle="搜索工具信息"
        resourceInformation={
          toolToDelete
            ? [
              { label: "名称", value: toolToDelete.search_tool_name },
              { label: "ID", value: toolToDelete.search_tool_id, code: true },
              {
                label: "提供商",
                value: providerInfo?.ui_friendly_name || toolToDelete.litellm_params.search_provider,
              },
              { label: "描述", value: toolToDelete.search_tool_info?.description || "-" },
            ]
            : []
        }
        onCancel={cancelDelete}
        onOk={confirmDelete}
        confirmLoading={isDeleting}
      />

      <CreateSearchTool
        userRole={userRole}
        accessToken={accessToken}
        onCreateSuccess={handleCreateSuccess}
        isModalVisible={isCreateModalVisible}
        setModalVisible={setCreateModalVisible}
      />

      {/* Edit Modal */}
      <Modal
        title="编辑搜索工具"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
          setSelectedToolId(null);
        }}
        width={600}
      >
        {renderEditForm()}
      </Modal>

      <Title>搜索工具</Title>
      <Text className="text-tremor-content mt-2">配置和管理您的搜索提供商</Text>
      {isAdminRole(userRole) && (
        <Button className="mt-4 mb-4" onClick={() => setCreateModalVisible(true)}>
          + 添加新搜索工具
        </Button>
      )}

      <ToolsTab />
    </div>
  );
};

export default SearchTools;
