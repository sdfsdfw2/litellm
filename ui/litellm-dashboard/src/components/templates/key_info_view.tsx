import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { useProjects } from "@/app/(dashboard)/hooks/projects/useProjects";
import { useUISettings } from "@/app/(dashboard)/hooks/uiSettings/useUISettings";
import useTeams from "@/app/(dashboard)/hooks/useTeams";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { mapEmptyStringToNull } from "@/utils/keyUpdateUtils";
import { ArrowLeftIcon } from "@heroicons/react/outline";
import { Badge, Button, Card, Grid, Tab, TabGroup, TabList, TabPanel, TabPanels, Text, Title } from "@tremor/react";
import { Form, Modal, Tag } from "antd";
import { KeyInfoHeader } from "./KeyInfoHeader";
import { useEffect, useState } from "react";
import { isProxyAdminRole, isUserTeamAdminForSingleTeam, rolesWithWriteAccess } from "../../utils/roles";
import { mapDisplayToInternalNames, mapInternalToDisplayNames } from "../callback_info_helpers";
import AutoRotationView from "../common_components/AutoRotationView";
import DeleteResourceModal from "../common_components/DeleteResourceModal";
import { extractLoggingSettings, formatMetadataForDisplay, stripTagsFromMetadata } from "../key_info_utils";
import { KeyResponse } from "../key_team_helpers/key_list";
import LoggingSettingsView from "../logging_settings_view";
import NotificationManager from "../molecules/notifications_manager";
import { getPolicyInfoWithGuardrails, keyDeleteCall, keyUpdateCall } from "../networking";
import { useResetKeySpend } from "@/app/(dashboard)/hooks/keys/useResetKeySpend";
import ObjectPermissionsView from "../object_permissions_view";
import { RegenerateKeyModal } from "../organisms/RegenerateKeyModal";
import { parseErrorMessage } from "../shared/errorUtils";
import { KeyEditView } from "./key_edit_view";

interface KeyInfoViewProps {
  keyId: string;
  onClose: () => void;
  keyData: KeyResponse | undefined;
  onKeyDataUpdate?: (data: Partial<KeyResponse>) => void;
  onDelete?: () => void;
  teams: any[] | null;
  backButtonText?: string;
}

// Must stay in sync with LiteLLM_ManagementEndpoint_MetadataFields_Premium
// in litellm/proxy/_types.py — limited to fields the key-edit form submits.
const PREMIUM_METADATA_FIELDS = [
  "policies",
  "guardrails",
  "prompts",
  "tags",
  "allowed_passthrough_routes",
] as const;

const isEmptyValue = (v: unknown): boolean =>
  v == null ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "string" && v.trim() === "");

/**
 * ─────────────────────────────────────────────────────────────────────────
 * @deprecated
 * This component is being DEPRECATED in favor of src/app/(dashboard)/virtual-keys/components/KeyInfoView.tsx
 * Please contribute to the new refactor.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function KeyInfoView({
  onClose,
  keyData,
  teams,
  onKeyDataUpdate,
  onDelete,
  backButtonText = "返回密钥列表",
}: KeyInfoViewProps) {
  const { accessToken, userId: userID, userRole, premiumUser } = useAuthorized();
  const canEditGuardrails = premiumUser || (userRole != null && rolesWithWriteAccess.includes(userRole));
  const { teams: teamsData } = useTeams();
  const { data: projects } = useProjects();
  const { data: uiSettingsData } = useUISettings();
  const enableProjectsUI = Boolean(uiSettingsData?.values?.enable_projects_ui);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isResetSpendModalOpen, setIsResetSpendModalOpen] = useState(false);
  const { mutate: resetKeySpend, isPending: resetSpendLoading } = useResetKeySpend();
  // Add local state to maintain key data and track regeneration
  const [currentKeyData, setCurrentKeyData] = useState<KeyResponse | undefined>(keyData);
  const [lastRegeneratedAt, setLastRegeneratedAt] = useState<Date | null>(null);
  const [isRecentlyRegenerated, setIsRecentlyRegenerated] = useState(false);
  const [policyGuardrails, setPolicyGuardrails] = useState<Record<string, string[]>>({});
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  // Update local state when keyData prop changes (but don't reset to undefined)
  useEffect(() => {
    if (keyData) {
      setCurrentKeyData(keyData);
    }
  }, [keyData]);

  // Fetch resolved guardrails for all policies
  useEffect(() => {
    const fetchPolicyGuardrails = async () => {
      const policies = currentKeyData?.metadata?.policies;
      if (!accessToken || !policies || !Array.isArray(policies) || policies.length === 0) {
        return;
      }

      setLoadingPolicies(true);
      const guardrailsMap: Record<string, string[]> = {};

      try {
        await Promise.all(
          policies.map(async (policyName: string) => {
            try {
              const policyInfo = await getPolicyInfoWithGuardrails(accessToken, policyName);
              guardrailsMap[policyName] = policyInfo.resolved_guardrails || [];
            } catch (error) {
              console.error(`Failed to fetch guardrails for policy ${policyName}:`, error);
              guardrailsMap[policyName] = [];
            }
          })
        );
        setPolicyGuardrails(guardrailsMap);
      } catch (error) {
        console.error("Failed to fetch policy guardrails:", error);
      } finally {
        setLoadingPolicies(false);
      }
    };

    fetchPolicyGuardrails();
  }, [accessToken, currentKeyData?.metadata?.policies]);

  // Reset recent regeneration indicator after 5 seconds
  useEffect(() => {
    if (isRecentlyRegenerated) {
      const timer = setTimeout(() => {
        setIsRecentlyRegenerated(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isRecentlyRegenerated]);

  // Use currentKeyData instead of keyData throughout the component
  if (!currentKeyData) {
    return (
      <div className="p-4">
        <Button icon={ArrowLeftIcon} variant="light" onClick={onClose} className="mb-4">
          {backButtonText}
        </Button>
        <Text>未找到密钥</Text>
      </div>
    );
  }

  const handleKeyUpdate = async (formValues: Record<string, any>) => {
    try {
      if (!accessToken) return;

      const currentKey = formValues.token;
      formValues.key = currentKey;

      // Guard premium features
      if (!canEditGuardrails) {
        delete formValues.guardrails;
        delete formValues.prompts;
      }

      // Drop premium metadata fields that are empty AND were empty before.
      // The /key/update response echoes defaults like `policies: []` back into
      // state; without this, the next save resends `[]` and trips the premium
      // gate in prepare_metadata_fields for non-premium users.
      for (const field of PREMIUM_METADATA_FIELDS) {
        const previousValue =
          (currentKeyData.metadata as Record<string, unknown> | undefined)?.[field] ??
          (currentKeyData as unknown as Record<string, unknown>)[field];
        if (isEmptyValue(formValues[field]) && isEmptyValue(previousValue)) {
          delete formValues[field];
        }
      }

      // Handle max budget empty string
      formValues.max_budget = mapEmptyStringToNull(formValues.max_budget);

      // Handle object_permission updates
      if (formValues.vector_stores !== undefined) {
        formValues.object_permission = {
          ...currentKeyData.object_permission,
          vector_stores: formValues.vector_stores || [],
        };
        // Remove vector_stores from the top level as it should be in object_permission
        delete formValues.vector_stores;
      }

      if (formValues.mcp_servers_and_groups !== undefined) {
        const { servers, accessGroups, toolsets } = formValues.mcp_servers_and_groups || { servers: [], accessGroups: [], toolsets: [] };
        formValues.object_permission = {
          ...currentKeyData.object_permission,
          mcp_servers: servers || [],
          mcp_access_groups: accessGroups || [],
          mcp_toolsets: toolsets || [],
        };
        // Remove mcp_servers_and_groups from the top level as it should be in object_permission
        delete formValues.mcp_servers_and_groups;
      }

      // Handle MCP tool permissions
      if (formValues.mcp_tool_permissions !== undefined) {
        const mcpToolPermissions = formValues.mcp_tool_permissions || {};
        if (Object.keys(mcpToolPermissions).length > 0) {
          formValues.object_permission = {
            ...formValues.object_permission,
            mcp_tool_permissions: mcpToolPermissions,
          };
        }
        delete formValues.mcp_tool_permissions;
      }

      // Handle agent permissions
      if (formValues.agents_and_groups !== undefined) {
        const { agents, accessGroups } = formValues.agents_and_groups || { agents: [], accessGroups: [] };
        formValues.object_permission = {
          ...formValues.object_permission,
          agents: agents || [],
          agent_access_groups: accessGroups || [],
        };
        delete formValues.agents_and_groups;
      }

      formValues.max_budget = mapEmptyStringToNull(formValues.max_budget);
      formValues.tpm_limit = mapEmptyStringToNull(formValues.tpm_limit);
      formValues.rpm_limit = mapEmptyStringToNull(formValues.rpm_limit);
      formValues.max_parallel_requests = mapEmptyStringToNull(formValues.max_parallel_requests);

      // Convert metadata back to an object if it exists and is a string
      if (formValues.metadata && typeof formValues.metadata === "string") {
        try {
          const parsedMetadata = JSON.parse(formValues.metadata);
          // Ensure tags are controlled via dedicated field, not in metadata textarea
          if ("tags" in parsedMetadata) {
            delete parsedMetadata["tags"];
          }
          formValues.metadata = {
            ...parsedMetadata,
            ...(Array.isArray(formValues.tags) && formValues.tags.length > 0 ? { tags: formValues.tags } : {}),
            ...(formValues.guardrails?.length > 0 ? { guardrails: formValues.guardrails } : {}),
            ...(Array.isArray(formValues.logging_settings) && formValues.logging_settings.length > 0 ? { logging: formValues.logging_settings } : {}),
            ...(formValues.disabled_callbacks?.length > 0
              ? {
                litellm_disabled_callbacks: mapDisplayToInternalNames(formValues.disabled_callbacks),
              }
              : {}),
          };
        } catch (error) {
          console.error("Error parsing metadata JSON:", error);
          NotificationManager.error("元数据 JSON 格式无效");
          return;
        }
      } else {
        const baseMetadata = formValues.metadata || {};
        const { tags: _omitTags, ...rest } = baseMetadata;
        formValues.metadata = {
          ...rest,
          ...(Array.isArray(formValues.tags) && formValues.tags.length > 0 ? { tags: formValues.tags } : {}),
          ...(formValues.guardrails?.length > 0 ? { guardrails: formValues.guardrails } : {}),
          ...(Array.isArray(formValues.logging_settings) && formValues.logging_settings.length > 0 ? { logging: formValues.logging_settings } : {}),
          ...(formValues.disabled_callbacks?.length > 0
            ? {
              litellm_disabled_callbacks: mapDisplayToInternalNames(formValues.disabled_callbacks),
            }
            : {}),
        };
      }

      // tags are merged into metadata; do not send as top-level field
      if ("tags" in formValues) {
        delete formValues.tags;
      }
      delete formValues.logging_settings;

      // Convert budget_duration to API format
      if (formValues.budget_duration) {
        const durationMap: Record<string, string> = {
          daily: "24h",
          weekly: "7d",
          monthly: "30d",
        };
        formValues.budget_duration = durationMap[formValues.budget_duration];
      }

      const newKeyValues = await keyUpdateCall(accessToken, formValues);

      // Update local state
      setCurrentKeyData((prevData) => (prevData ? { ...prevData, ...newKeyValues } : undefined));

      if (onKeyDataUpdate) {
        onKeyDataUpdate(newKeyValues);
      }
      NotificationManager.success("密钥更新成功");
      setIsEditing(false);
      // Refresh key data here if needed
    } catch (error) {
      NotificationManager.fromBackend(parseErrorMessage(error));
      console.error("Error updating key:", error);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      if (!accessToken) return;
      await keyDeleteCall(accessToken as string, currentKeyData.token || currentKeyData.token_id);
      NotificationManager.success("密钥删除成功");
      if (onDelete) {
        onDelete();
      }
      onClose();
    } catch (error) {
      console.error("Error deleting the key:", error);
      NotificationManager.fromBackend(error);
    } finally {
      setDeleteLoading(false);
      setIsDeleteModalOpen(false);
      setDeleteConfirmInput("");
    }
  };

  const handleRegenerateKeyUpdate = (updatedKeyData: Partial<KeyResponse>) => {
    // Update local state immediately with ALL the new data
    setCurrentKeyData((prevData) => {
      if (!prevData) return undefined;
      const newData = {
        ...prevData,
        ...updatedKeyData, // This should include the new token (key-id)
        // Update the created_at to show when it was regenerated
        created_at: new Date().toLocaleString(),
      };
      return newData;
    });

    // Track regeneration timestamp
    setLastRegeneratedAt(new Date());
    setIsRecentlyRegenerated(true);

    if (onKeyDataUpdate) {
      onKeyDataUpdate({
        ...updatedKeyData,
        created_at: new Date().toLocaleString(),
      });
    }
  };

  // Update the formatTimestamp function to use the desired date format
  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString("zh-CN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr} at ${timeStr}`;
  };

  const canModifyKey =
    isProxyAdminRole(userRole || "") ||
    (teamsData &&
      isUserTeamAdminForSingleTeam(
        teamsData?.filter((team) => team.team_id === currentKeyData.team_id)[0]?.members_with_roles,
        userID || "",
      )) ||
    (userID === currentKeyData.user_id && userRole !== "Internal Viewer");

  const canResetSpend =
    isProxyAdminRole(userRole || "") ||
    (teamsData &&
      isUserTeamAdminForSingleTeam(
        teamsData?.filter((team) => team.team_id === currentKeyData.team_id)[0]?.members_with_roles,
        userID || "",
      ));

  const handleResetSpend = () => {
    resetKeySpend(currentKeyData.token || currentKeyData.token_id, {
      onSuccess: () => {
        setCurrentKeyData((prevData) => (prevData ? { ...prevData, spend: 0 } : undefined));
        if (onKeyDataUpdate) {
          onKeyDataUpdate({ spend: 0 });
        }
        NotificationManager.success("密钥消耗已重置为 $0");
        setIsResetSpendModalOpen(false);
      },
      onError: (error) => {
        NotificationManager.fromBackend(parseErrorMessage(error));
        console.error("Error resetting key spend:", error);
      },
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <KeyInfoHeader
        data={{
          keyName: currentKeyData.key_alias || "虚拟密钥",
          keyId: currentKeyData.token_id || currentKeyData.token,
          userId: currentKeyData.user_id || "",
          userEmail: currentKeyData.user_email || "",
          userAlias: currentKeyData.user?.user_alias ?? null,
          createdBy:
            currentKeyData.created_by_user?.user_alias ||
            currentKeyData.created_by_user?.user_email ||
            currentKeyData.created_by ||
            "",
          createdAt: currentKeyData.created_at ? formatTimestamp(currentKeyData.created_at) : "",
          lastUpdated: currentKeyData.updated_at ? formatTimestamp(currentKeyData.updated_at) : "",
          lastActive: currentKeyData.last_active ? formatTimestamp(currentKeyData.last_active) : "从未",
          expires: currentKeyData.expires ? formatTimestamp(currentKeyData.expires) : "从未",
        }}
        onBack={onClose}
        onRegenerate={() => setIsRegenerateModalOpen(true)}
        onDelete={() => setIsDeleteModalOpen(true)}
        onResetSpend={canResetSpend ? () => setIsResetSpendModalOpen(true) : undefined}
        canModifyKey={canModifyKey}
        backButtonText={backButtonText}
        regenerateDisabled={!premiumUser}
        regenerateTooltip={
          !premiumUser
            ? "这是 LiteLLM 企业版功能，需要有效许可证才能使用。"
            : undefined
        }
      />

      {/* Add RegenerateKeyModal */}
      <RegenerateKeyModal
        selectedToken={currentKeyData}
        visible={isRegenerateModalOpen}
        onClose={() => setIsRegenerateModalOpen(false)}
        onKeyUpdate={handleRegenerateKeyUpdate}
      />

      {/* Delete Confirmation Modal */}
      <DeleteResourceModal
        isOpen={isDeleteModalOpen}
        title="删除密钥"
        alertMessage="此操作不可逆，将立即撤销使用此密钥的所有应用程序的访问权限。"
        message="确认删除此虚拟密钥？"
        resourceInformationTitle="密钥信息"
        resourceInformation={[
          {
            label: "密钥别名",
            value: currentKeyData?.key_alias || "-",
          },
          {
            label: "密钥 ID",
            value: currentKeyData?.token_id || currentKeyData?.token || "-",
            code: true,
          },
          {
            label: "团队 ID",
            value: currentKeyData?.team_id || "-",
            code: true,
          },
          {
            label: "消耗",
            value: currentKeyData?.spend ? `$${formatNumberWithCommas(currentKeyData.spend, 4)}` : "$0.0000",
          },
        ]}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setDeleteConfirmInput("");
        }}
        onOk={handleDelete}
        confirmLoading={deleteLoading}
        requiredConfirmation={currentKeyData?.key_alias}
      />

      {/* Reset Spend Confirmation Modal */}
      <Modal
        title="重置密钥消耗"
        open={isResetSpendModalOpen}
        onOk={handleResetSpend}
        onCancel={() => setIsResetSpendModalOpen(false)}
        okText="重置"
        okButtonProps={{ danger: true }}
        confirmLoading={resetSpendLoading}
      >
        <p>
          将 <strong>{currentKeyData?.key_alias || currentKeyData?.token_id || "此密钥"}</strong> 的消耗重置为{" "}
          <strong>$0</strong>？
        </p>
        <p style={{ color: "#666", fontSize: "0.875rem", marginTop: 8 }}>
          当前消耗：<strong>${formatNumberWithCommas(currentKeyData.spend, 4)}</strong>。消耗历史记录保留在日志中。此操作会重置当前周期的消耗计数器，与自动预算重置相同。
        </p>
      </Modal>

      <TabGroup>
        <TabList className="mb-4">
          <Tab>概览</Tab>
          <Tab>设置</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Panel */}
          <TabPanel>
            <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
              <Card>
                <Text>消耗</Text>
                <div className="mt-2">
                  <Title>${formatNumberWithCommas(currentKeyData.spend, 4)}</Title>
                  <Text>
                    上限{" "}
                    {currentKeyData.max_budget !== null
                      ? `$${formatNumberWithCommas(currentKeyData.max_budget)}`
                      : "无限制"}
                  </Text>
                </div>
              </Card>

              <Card>
                <Text>速率限制</Text>
                <div className="mt-2">
                  <Text>TPM：{currentKeyData.tpm_limit !== null ? currentKeyData.tpm_limit : "无限制"}</Text>
                  <Text>RPM：{currentKeyData.rpm_limit !== null ? currentKeyData.rpm_limit : "无限制"}</Text>
                </div>
              </Card>

              <Card>
                <Text>模型</Text>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentKeyData.models && currentKeyData.models.length > 0 ? (
                    currentKeyData.models.map((model, index) => (
                      <Badge key={index} color="red">
                        {model}
                      </Badge>
                    ))
                  ) : (
                    <Text>未指定模型</Text>
                  )}
                </div>
              </Card>

              <Card>
                <ObjectPermissionsView
                  objectPermission={currentKeyData.object_permission}
                  variant="inline"
                  accessToken={accessToken}
                />
              </Card>

              <Card>
                <Text className="font-medium mb-3">护栏</Text>
                {Array.isArray(currentKeyData.metadata?.guardrails) && currentKeyData.metadata.guardrails.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentKeyData.metadata.guardrails.map((guardrail: string, index: number) => (
                      <Badge key={index} color="blue">
                        {guardrail}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Text className="text-gray-500">未配置护栏</Text>
                )}
                {typeof currentKeyData.metadata?.disable_global_guardrails === "boolean" &&
                  currentKeyData.metadata.disable_global_guardrails === true && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <Badge color="gold">全局护栏已禁用</Badge>
                    </div>
                  )}
              </Card>

              <Card>
                <Text className="font-medium mb-3">策略</Text>
                {Array.isArray(currentKeyData.metadata?.policies) && currentKeyData.metadata.policies.length > 0 ? (
                  <div className="space-y-4">
                    {currentKeyData.metadata.policies.map((policy: string, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge color="purple">{policy}</Badge>
                          {loadingPolicies && <Text className="text-xs text-gray-400">正在加载护栏...</Text>}
                        </div>
                        {!loadingPolicies && policyGuardrails[policy] && policyGuardrails[policy].length > 0 && (
                          <div className="ml-4 pl-3 border-l-2 border-gray-200">
                            <Text className="text-xs text-gray-500 mb-1">已解析的护栏：</Text>
                            <div className="flex flex-wrap gap-1">
                              {policyGuardrails[policy].map((guardrail: string, gIndex: number) => (
                                <Badge key={gIndex} color="blue" size="xs">
                                  {guardrail}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text className="text-gray-500">未配置策略</Text>
                )}
              </Card>

              <LoggingSettingsView
                loggingConfigs={extractLoggingSettings(currentKeyData.metadata)}
                disabledCallbacks={
                  Array.isArray(currentKeyData.metadata?.litellm_disabled_callbacks)
                    ? mapInternalToDisplayNames(currentKeyData.metadata.litellm_disabled_callbacks)
                    : []
                }
                variant="card"
              />

              <AutoRotationView
                autoRotate={currentKeyData.auto_rotate}
                rotationInterval={currentKeyData.rotation_interval}
                lastRotationAt={currentKeyData.last_rotation_at}
                keyRotationAt={currentKeyData.key_rotation_at}
                nextRotationAt={currentKeyData.next_rotation_at}
                variant="card"
              />
            </Grid>
          </TabPanel>

          {/* Settings Panel */}
          <TabPanel>
            <Card>
              <div className="flex justify-between items-center mb-4">
                <Title>密钥设置</Title>
                {!isEditing && canModifyKey && (
                  <Button onClick={() => setIsEditing(true)}>编辑设置</Button>
                )}
              </div>

              {isEditing ? (
                <KeyEditView
                  keyData={currentKeyData}
                  onCancel={() => setIsEditing(false)}
                  onSubmit={handleKeyUpdate}
                  teams={teams}
                  accessToken={accessToken}
                  userID={userID}
                  userRole={userRole}
                  premiumUser={premiumUser}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <Text className="font-medium">密钥 ID</Text>
                    <Text className="font-mono">{currentKeyData.token_id || currentKeyData.token}</Text>
                  </div>

                  <div>
                    <Text className="font-medium">密钥别名</Text>
                    <Text>{currentKeyData.key_alias || "未设置"}</Text>
                  </div>

                  <div>
                    <Text className="font-medium">密钥</Text>
                    <Text className="font-mono">{currentKeyData.key_name}</Text>
                  </div>

                  <div>
                    <Text className="font-medium">团队 ID</Text>
                    <Text>{currentKeyData.team_id || "未设置"}</Text>
                  </div>

                  {enableProjectsUI && (
                    <div>
                      <Text className="font-medium">项目</Text>
                      <Text>
                        {currentKeyData.project_id
                          ? (() => {
                              const project = projects?.find((p) => p.project_id === currentKeyData.project_id);
                              return project?.project_alias
                                ? `${project.project_alias} (${currentKeyData.project_id})`
                                : currentKeyData.project_id;
                            })()
                          : "未设置"}
                      </Text>
                    </div>
                  )}

                  <div>
                    <Text className="font-medium">组织</Text>
                    <Text>{(currentKeyData.organization_id ?? currentKeyData.org_id) || "未设置"}</Text>
                  </div>

                  <div>
                    <Text className="font-medium">创建时间</Text>
                    <Text>{formatTimestamp(currentKeyData.created_at)}</Text>
                  </div>

                  {lastRegeneratedAt && (
                    <div>
                      <Text className="font-medium">上次重新生成</Text>
                      <div className="flex items-center gap-2">
                        <Text>{formatTimestamp(lastRegeneratedAt)}</Text>
                        <Badge color="green" size="xs">
                          最近
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div>
                    <Text className="font-medium">过期时间</Text>
                    <Text>{currentKeyData.expires ? formatTimestamp(currentKeyData.expires) : "从不"}</Text>
                  </div>

                  <AutoRotationView
                    autoRotate={currentKeyData.auto_rotate}
                    rotationInterval={currentKeyData.rotation_interval}
                    lastRotationAt={currentKeyData.last_rotation_at}
                    keyRotationAt={currentKeyData.key_rotation_at}
                    nextRotationAt={currentKeyData.next_rotation_at}
                    variant="inline"
                    className="pt-4 border-t border-gray-200"
                  />

                  <div>
                    <Text className="font-medium">消耗</Text>
                    <Text>${formatNumberWithCommas(currentKeyData.spend, 4)} USD</Text>
                  </div>

                  <div>
                    <Text className="font-medium">预算</Text>
                    <Text>
                      {currentKeyData.max_budget !== null
                        ? `$${formatNumberWithCommas(currentKeyData.max_budget, 2)}`
                        : "无限制"}
                    </Text>
                  </div>

                  <div>
                    <Text className="font-medium">标签</Text>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Array.isArray(currentKeyData.metadata?.tags) && currentKeyData.metadata.tags.length > 0
                        ? currentKeyData.metadata.tags.map((tag, index) => (
                          <span key={index} className="px-2 mr-2 py-1 bg-blue-100 rounded text-xs">
                            {tag}
                          </span>
                        ))
                        : "未指定标签"}
                    </div>
                  </div>

                  <div>
                    <Text className="font-medium">提示词</Text>
                    <Text>
                      {Array.isArray(currentKeyData.metadata?.prompts) && currentKeyData.metadata.prompts.length > 0
                        ? currentKeyData.metadata.prompts.map((prompt, index) => (
                          <span key={index} className="px-2 mr-2 py-1 bg-blue-100 rounded text-xs">
                            {prompt}
                          </span>
                        ))
                        : "未指定提示词"}
                    </Text>
                  </div>

                  <div>
                    <Text className="font-medium">允许的路由</Text>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Array.isArray(currentKeyData.allowed_routes) && currentKeyData.allowed_routes.length > 0 ? (
                        currentKeyData.allowed_routes.map((route, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 rounded text-xs">
                            {route}
                          </span>
                        ))
                      ) : (
                        <Tag color="green">所有路由均允许</Tag>
                      )}
                    </div>
                  </div>

                  <div>
                    <Text className="font-medium">允许的透传路由</Text>
                    <Text>
                      {Array.isArray(currentKeyData.metadata?.allowed_passthrough_routes) &&
                        currentKeyData.metadata.allowed_passthrough_routes.length > 0
                        ? currentKeyData.metadata.allowed_passthrough_routes.map((route, index) => (
                          <span key={index} className="px-2 mr-2 py-1 bg-blue-100 rounded text-xs">
                            {route}
                          </span>
                        ))
                        : "未指定透传路由"}
                    </Text>
                  </div>

                  <div>
                    <Text className="font-medium">禁用全局护栏</Text>
                    <Text>
                      {currentKeyData.metadata?.disable_global_guardrails === true ? (
                        <Badge color="gold">已启用 - 全局护栏已绕过</Badge>
                      ) : (
                        <Badge color="green">已禁用 - 全局护栏生效中</Badge>
                      )}
                    </Text>
                  </div>

                  <div>
                    <Text className="font-medium">模型</Text>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {currentKeyData.models && currentKeyData.models.length > 0 ? (
                        currentKeyData.models.map((model, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 rounded text-xs">
                            {model}
                          </span>
                        ))
                      ) : (
                        <Text>未指定模型</Text>
                      )}
                    </div>
                  </div>

                  <div>
                    <Text className="font-medium">速率限制</Text>
                    <Text>TPM：{currentKeyData.tpm_limit !== null ? currentKeyData.tpm_limit : "无限制"}</Text>
                    <Text>RPM：{currentKeyData.rpm_limit !== null ? currentKeyData.rpm_limit : "无限制"}</Text>
                    <Text>
                      最大并行请求数：{" "}
                      {currentKeyData.max_parallel_requests !== null
                        ? currentKeyData.max_parallel_requests
                        : "无限制"}
                    </Text>
                    <Text>
                      模型 TPM 限制：{" "}
                      {currentKeyData.metadata?.model_tpm_limit
                        ? JSON.stringify(currentKeyData.metadata.model_tpm_limit)
                        : "无限制"}
                    </Text>
                    <Text>
                      模型 RPM 限制：{" "}
                      {currentKeyData.metadata?.model_rpm_limit
                        ? JSON.stringify(currentKeyData.metadata.model_rpm_limit)
                        : "无限制"}
                    </Text>
                  </div>

                  <div>
                    <Text className="font-medium">元数据</Text>
                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto mt-1">
                      {formatMetadataForDisplay(stripTagsFromMetadata(currentKeyData.metadata))}
                    </pre>
                  </div>

                  <ObjectPermissionsView
                    objectPermission={currentKeyData.object_permission}
                    variant="inline"
                    className="pt-4 border-t border-gray-200"
                    accessToken={accessToken}
                  />

                  <LoggingSettingsView
                    loggingConfigs={extractLoggingSettings(currentKeyData.metadata)}
                    disabledCallbacks={
                      Array.isArray(currentKeyData.metadata?.litellm_disabled_callbacks)
                        ? mapInternalToDisplayNames(currentKeyData.metadata.litellm_disabled_callbacks)
                        : []
                    }
                    variant="inline"
                    className="pt-4 border-t border-gray-200"
                  />
                </div>
              )}
            </Card>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
