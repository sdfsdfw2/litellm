import OrganizationFilters, { FilterState } from "@/app/(dashboard)/organizations/OrganizationFilters";
import { InfoCircleOutlined } from "@ant-design/icons";
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from "@heroicons/react/outline";
import {
  Badge,
  Button,
  Card,
  Col,
  Grid,
  Icon,
  Tab,
  TabGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TabList,
  TabPanel,
  TabPanels,
  Text,
  TextInput,
} from "@tremor/react";
import { Form, Input, Modal, Select as Select2, Tooltip } from "antd";
import React, { useState } from "react";
import { formatNumberWithCommas } from "../utils/dataUtils";
import DeleteResourceModal from "./common_components/DeleteResourceModal";
import TableIconActionButton from "./common_components/IconActionButton/TableIconActionButtons/TableIconActionButton";
import { getModelDisplayName } from "./key_team_helpers/fetch_available_models_team_key";
import MCPServerSelector from "./mcp_server_management/MCPServerSelector";
import { ModelSelect } from "./ModelSelect/ModelSelect";
import NotificationsManager from "./molecules/notifications_manager";
import { Organization, organizationCreateCall, organizationDeleteCall, organizationListCall } from "./networking";
import OrganizationInfoView from "./organization/organization_view";
import NumericalInput from "./shared/numerical_input";
import VectorStoreSelector from "./vector_store_management/VectorStoreSelector";

interface OrganizationsTableProps {
  organizations: Organization[];
  userRole: string;
  userModels: string[];
  accessToken: string | null;
  lastRefreshed?: string;
  handleRefreshClick?: () => void;
  currentOrg?: any;
  guardrailsList?: string[];
  setOrganizations: (organizations: Organization[]) => void;
  premiumUser: boolean;
}

export const fetchOrganizations = async (
  accessToken: string,
  setOrganizations: (organizations: Organization[]) => void,
  org_id: string | null = null,
  org_alias: string | null = null,
) => {
  const organizations = await organizationListCall(accessToken, org_id, org_alias);
  setOrganizations(organizations);
};

const OrganizationsTable: React.FC<OrganizationsTableProps> = ({
  organizations,
  userRole,
  userModels,
  accessToken,
  lastRefreshed,
  handleRefreshClick,
  currentOrg,
  guardrailsList = [],
  setOrganizations,
  premiumUser,
}) => {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [editOrg, setEditOrg] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOrgModalVisible, setIsOrgModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    org_id: "",
    org_alias: "",
    sort_by: "created_at",
    sort_order: "desc",
  });

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // Call organizationListCall with the new filters
    if (accessToken) {
      organizationListCall(accessToken, newFilters.org_id || null, newFilters.org_alias || null)
        .then((response) => {
          if (response) {
            setOrganizations(response);
          }
        })
        .catch((error) => {
          console.error("Error fetching organizations:", error);
        });
    }
  };

  const handleFilterReset = () => {
    setFilters({
      org_id: "",
      org_alias: "",
      sort_by: "created_at",
      sort_order: "desc",
    });
    // Reset organizations list
    if (accessToken) {
      organizationListCall(accessToken, null, null)
        .then((response) => {
          if (response) {
            setOrganizations(response);
          }
        })
        .catch((error) => {
          console.error("Error fetching organizations:", error);
        });
    }
  };

  const handleDelete = (orgId: string | null) => {
    if (!orgId) return;

    setOrgToDelete(orgId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!orgToDelete || !accessToken) return;

    try {
      setIsDeleting(true);
      await organizationDeleteCall(accessToken, orgToDelete);
      NotificationsManager.success("Organization deleted successfully");

      setIsDeleteModalOpen(false);
      setOrgToDelete(null);
      // Refresh organizations list
      await fetchOrganizations(accessToken, setOrganizations, filters.org_id || null, filters.org_alias || null);
    } catch (error) {
      console.error("Error deleting organization:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setOrgToDelete(null);
  };

  const handleCreate = async (values: any) => {
    try {
      if (!accessToken) return;

      console.log(`values in organizations new create call: ${JSON.stringify(values)}`);

      // Transform allowed_vector_store_ids and allowed_mcp_servers_and_groups into object_permission
      if (
        (values.allowed_vector_store_ids && values.allowed_vector_store_ids.length > 0) ||
        (values.allowed_mcp_servers_and_groups &&
          (values.allowed_mcp_servers_and_groups.servers?.length > 0 ||
            values.allowed_mcp_servers_and_groups.accessGroups?.length > 0))
      ) {
        values.object_permission = {};
        if (values.allowed_vector_store_ids && values.allowed_vector_store_ids.length > 0) {
          values.object_permission.vector_stores = values.allowed_vector_store_ids;
          delete values.allowed_vector_store_ids;
        }
        if (values.allowed_mcp_servers_and_groups) {
          if (values.allowed_mcp_servers_and_groups.servers?.length > 0) {
            values.object_permission.mcp_servers = values.allowed_mcp_servers_and_groups.servers;
          }
          if (values.allowed_mcp_servers_and_groups.accessGroups?.length > 0) {
            values.object_permission.mcp_access_groups = values.allowed_mcp_servers_and_groups.accessGroups;
          }
          delete values.allowed_mcp_servers_and_groups;
        }
      }

      await organizationCreateCall(accessToken, values);
      NotificationsManager.success("Organization created successfully");
      setIsOrgModalVisible(false);
      form.resetFields();
      // Refresh organizations list
      fetchOrganizations(accessToken, setOrganizations, filters.org_id || null, filters.org_alias || null);
    } catch (error) {
      console.error("Error creating organization:", error);
    }
  };

  const handleCancel = () => {
    setIsOrgModalVisible(false);
    form.resetFields();
  };

  if (!premiumUser) {
    return (
      <div>
        <Text>
          这是 LiteLLM 企业版功能，需要有效的密钥才能使用。在此获取试用密钥{" "}
          <a href="https://www.litellm.ai/#pricing" target="_blank" rel="noopener noreferrer">
            获取试用密钥
          </a>
          。
        </Text>
      </div>
    );
  }

  return (
    <div className="w-full mx-4 h-[75vh]">
      <Grid numItems={1} className="gap-2 p-8 w-full mt-2">
        <Col numColSpan={1} className="flex flex-col gap-2">
          {(userRole === "Admin" || userRole === "Org Admin") && (
            <Button className="w-fit" onClick={() => setIsOrgModalVisible(true)}>
              + 创建新组织
            </Button>
          )}
          {selectedOrgId ? (
            <OrganizationInfoView
              organizationId={selectedOrgId}
              onClose={() => {
                setSelectedOrgId(null);
                setEditOrg(false);
              }}
              accessToken={accessToken}
              is_org_admin={true} // You'll need to implement proper org admin check
              is_proxy_admin={userRole === "Admin"}
              userModels={userModels}
              editOrg={editOrg}
            />
          ) : (
            <TabGroup className="gap-2 h-[75vh] w-full">
              <TabList className="flex justify-between mt-2 w-full items-center">
                <div className="flex">
                  <Tab>我的组织</Tab>
                </div>
                <div className="flex items-center space-x-2">
                  {lastRefreshed &&                   <Text>上次刷新: {lastRefreshed}</Text>}
                  <Icon
                    icon={RefreshIcon}
                    variant="shadow"
                    size="xs"
                    className="self-center"
                    onClick={handleRefreshClick}
                  />
                </div>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <Text>点击"组织 ID"查看组织详情。</Text>
                  <Grid numItems={1} className="gap-2 pt-2 pb-2 h-[75vh] w-full mt-2">
                    <Col numColSpan={1}>
                      <Card className="w-full mx-auto flex-auto overflow-hidden overflow-y-auto max-h-[50vh]">
                        <div className="border-b px-6 py-4">
                          <div className="flex flex-col space-y-4">
                            <OrganizationFilters
                              filters={filters}
                              showFilters={showFilters}
                              onToggleFilters={setShowFilters}
                              onChange={handleFilterChange}
                              onReset={handleFilterReset}
                            />
                          </div>
                        </div>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableHeaderCell>组织 ID</TableHeaderCell>
                              <TableHeaderCell>组织名称</TableHeaderCell>
                              <TableHeaderCell>创建时间</TableHeaderCell>
                              <TableHeaderCell>消费 (USD)</TableHeaderCell>
                              <TableHeaderCell>预算 (USD)</TableHeaderCell>
                              <TableHeaderCell>模型</TableHeaderCell>
                              <TableHeaderCell>TPM / RPM 限制</TableHeaderCell>
                              <TableHeaderCell>信息</TableHeaderCell>
                              <TableHeaderCell>操作</TableHeaderCell>
                            </TableRow>
                          </TableHead>

                          <TableBody>
                            {organizations && organizations.length > 0
                              ? organizations
                                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                  .map((org: Organization) => (
                                    <TableRow key={org.organization_id}>
                                      <TableCell>
                                        <div className="overflow-hidden">
                                          <Tooltip title={org.organization_id}>
                                            <Button
                                              size="xs"
                                              variant="light"
                                              className="font-mono text-blue-500 bg-blue-50 hover:bg-blue-100 text-xs font-normal px-2 py-0.5 text-left overflow-hidden truncate max-w-[200px]"
                                              onClick={() => setSelectedOrgId(org.organization_id)}
                                            >
                                              {org.organization_id?.slice(0, 7)}
                                              ...
                                            </Button>
                                          </Tooltip>
                                        </div>
                                      </TableCell>
                                      <TableCell>{org.organization_alias}</TableCell>
                                      <TableCell>
                                        {org.created_at ? new Date(org.created_at).toLocaleDateString() : "无"}
                                      </TableCell>
                                      <TableCell>{formatNumberWithCommas(org.spend, 4)}</TableCell>
                                      <TableCell>
                                        {org.litellm_budget_table?.max_budget !== null &&
                                        org.litellm_budget_table?.max_budget !== undefined
                                          ? org.litellm_budget_table?.max_budget
                                          : "无限制"}
                                      </TableCell>
                                      <TableCell
                                        style={{
                                          maxWidth: "8-x",
                                          whiteSpace: "pre-wrap",
                                          overflow: "hidden",
                                        }}
                                        className={org.models.length > 3 ? "px-0" : ""}
                                      >
                                        <div className="flex flex-col">
                                          {Array.isArray(org.models) ? (
                                            <div className="flex flex-col">
                                              {org.models.length === 0 ? (
                                                <Badge size={"xs"} className="mb-1" color="red">
                                                  <Text>所有代理模型</Text>
                                                </Badge>
                                              ) : (
                                                <>
                                                  <div className="flex items-start">
                                                    {org.models.length > 3 && (
                                                      <div>
                                                        <Icon
                                                          icon={
                                                            expandedAccordions[org.organization_id || ""]
                                                              ? ChevronDownIcon
                                                              : ChevronRightIcon
                                                          }
                                                          className="cursor-pointer"
                                                          size="xs"
                                                          onClick={() => {
                                                            setExpandedAccordions((prev) => ({
                                                              ...prev,
                                                              [org.organization_id || ""]:
                                                                !prev[org.organization_id || ""],
                                                            }));
                                                          }}
                                                        />
                                                      </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1">
                                                      {org.models.slice(0, 3).map((model, index) =>
                                                        model === "all-proxy-models" ? (
                                                          <Badge key={index} size={"xs"} color="red">
                                                            <Text>所有代理模型</Text>
                                                          </Badge>
                                                        ) : (
                                                          <Badge key={index} size={"xs"} color="blue">
                                                            <Text>
                                                              {model.length > 30
                                                                ? `${getModelDisplayName(model).slice(0, 30)}...`
                                                                : getModelDisplayName(model)}
                                                            </Text>
                                                          </Badge>
                                                        ),
                                                      )}
                                                      {org.models.length > 3 &&
                                                        !expandedAccordions[org.organization_id || ""] && (
                                                          <Badge size={"xs"} color="gray" className="cursor-pointer">
                                                            <Text>
                                                              +{org.models.length - 3}{" "}
                                                               {org.models.length - 3 === 1
                                                                 ? "更多模型"
                                                                 : "更多模型"}
                                                            </Text>
                                                          </Badge>
                                                        )}
                                                      {expandedAccordions[org.organization_id || ""] && (
                                                        <div className="flex flex-wrap gap-1">
                                                          {org.models.slice(3).map((model, index) =>
                                                            model === "all-proxy-models" ? (
                                                              <Badge key={index + 3} size={"xs"} color="red">
                                                                 <Text>所有代理模型</Text>
                                                               </Badge>
                                                             ) : (
                                                               <Badge key={index + 3} size={"xs"} color="blue">
                                                                 <Text>
                                                                   {model.length > 30
                                                                     ? `${getModelDisplayName(model).slice(0, 30)}...`
                                                                     : getModelDisplayName(model)}
                                                                 </Text>
                                                               </Badge>
                                                             ),
                                                           )}
                                                         </div>
                                                       )}
                                                     </div>
                                                   </div>
                                                 </>
                                               )}
                                             </div>
                                           ) : null}
                                         </div>
                                       </TableCell>
                                       <TableCell>
                                         <Text>
                                           TPM:{" "}
                                           {org.litellm_budget_table?.tpm_limit
                                             ? org.litellm_budget_table?.tpm_limit
                                             : "无限制"}
                                           <br />
                                           RPM:{" "}
                                           {org.litellm_budget_table?.rpm_limit
                                             ? org.litellm_budget_table?.rpm_limit
                                             : "无限制"}
                                        </Text>
                                      </TableCell>
                                      <TableCell>
                                        <Text>{org.members?.length || 0} 个成员</Text>
                                      </TableCell>
                                      <TableCell>
                                        {userRole === "Admin" && (
                                          <>
                                            <TableIconActionButton
                                              variant="Edit"
                                              tooltipText="编辑组织"
                                              onClick={() => {
                                                setSelectedOrgId(org.organization_id);
                                                setEditOrg(true);
                                              }}
                                            />
                                            <TableIconActionButton
                                              variant="Delete"
                                              tooltipText="删除组织"
                                              onClick={() => handleDelete(org.organization_id)}
                                            />
                                          </>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                              : null}
                          </TableBody>
                        </Table>
                      </Card>
                    </Col>
                  </Grid>
                </TabPanel>
              </TabPanels>
            </TabGroup>
          )}
        </Col>
      </Grid>
      <Modal title="创建组织" visible={isOrgModalVisible} width={800} footer={null} onCancel={handleCancel}>
        <Form form={form} onFinish={handleCreate} labelCol={{ span: 8 }} wrapperCol={{ span: 16 }} labelAlign="left">
          <Form.Item
            label="组织名称"
            name="organization_alias"
            rules={[
              {
                required: true,
                message: "请输入组织名称",
              },
            ]}
          >
            <TextInput placeholder="" />
          </Form.Item>
          <Form.Item label="模型" name="models">
            <ModelSelect
              options={{ showAllProxyModelsOverride: true, includeSpecialOptions: true }}
              value={form.getFieldValue("models")}
              onChange={(values) => form.setFieldValue("models", values)}
              context="organization"
            />
          </Form.Item>

          <Form.Item label="最大预算 (USD)" name="max_budget">
            <NumericalInput step={0.01} precision={2} width={200} />
          </Form.Item>
          <Form.Item label="预算重置周期" name="budget_duration">
            <Select2 defaultValue={null} placeholder="无">
              <Select2.Option value="24h">每日</Select2.Option>
              <Select2.Option value="7d">每周</Select2.Option>
              <Select2.Option value="30d">每月</Select2.Option>
            </Select2>
          </Form.Item>
          <Form.Item label="每分钟令牌数限制 (TPM)" name="tpm_limit">
            <NumericalInput step={1} width={400} />
          </Form.Item>
          <Form.Item label="每分钟请求数限制 (RPM)" name="rpm_limit">
            <NumericalInput step={1} width={400} />
          </Form.Item>

          <Form.Item
            label={
              <span>
                允许的向量存储{" "}
                <Tooltip title="选择此组织默认可以访问的向量存储。留空表示可以访问所有向量存储。">
                  <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                </Tooltip>
              </span>
            }
            name="allowed_vector_store_ids"
            className="mt-4"
            help="选择此组织可以访问的向量存储。留空表示可以访问所有向量存储。"
          >
            <VectorStoreSelector
              onChange={(values) => form.setFieldValue("allowed_vector_store_ids", values)}
              value={form.getFieldValue("allowed_vector_store_ids")}
              accessToken={accessToken || ""}
              placeholder="选择向量存储（可选）"
            />
          </Form.Item>

          <Form.Item
            label={
              <span>
                允许的 MCP 服务器{" "}
                <Tooltip title="选择此组织默认可以访问的 MCP 服务器和访问组。">
                  <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                </Tooltip>
              </span>
            }
            name="allowed_mcp_servers_and_groups"
            className="mt-4"
            help="选择此组织可以访问的 MCP 服务器和访问组。"
          >
            <MCPServerSelector
              onChange={(values) => form.setFieldValue("allowed_mcp_servers_and_groups", values)}
              value={form.getFieldValue("allowed_mcp_servers_and_groups")}
              accessToken={accessToken || ""}
              placeholder="选择 MCP 服务器和访问组（可选）"
            />
          </Form.Item>

          <Form.Item label="元数据" name="metadata">
            <Input.TextArea rows={4} />
          </Form.Item>

          <div style={{ textAlign: "right", marginTop: "10px" }}>
            <Button type="submit">创建组织</Button>
          </div>
        </Form>
      </Modal>

      <DeleteResourceModal
        isOpen={isDeleteModalOpen}
        title="删除组织？"
        message="确定要删除此组织吗？此操作无法撤销。"
        resourceInformationTitle="组织信息"
        resourceInformation={[{ label: "组织 ID", value: orgToDelete, code: true }]}
        onCancel={cancelDelete}
        onOk={confirmDelete}
        confirmLoading={isDeleting}
      />
    </div>
  );
};

export default OrganizationsTable;
