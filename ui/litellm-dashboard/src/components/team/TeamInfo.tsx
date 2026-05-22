import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { organizationKeys, useOrganizations } from "@/app/(dashboard)/hooks/organizations/useOrganizations";
import { useQueryClient } from "@tanstack/react-query";
import UserSearchModal from "@/components/common_components/user_search_modal";
import {
  getPoliciesList,
  getPolicyInfoWithGuardrails,
  Member,
  Organization,
  organizationInfoCall,
  teamInfoCall,
  teamMemberAddCall,
  teamMemberDeleteCall,
  teamMemberUpdateCall,
  teamUpdateCall,
} from "@/components/networking";
import { useGuardrails } from "@/app/(dashboard)/hooks/guardrails/useGuardrails";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { mapEmptyStringToNull } from "@/utils/keyUpdateUtils";
import { isProxyAdminRole } from "@/utils/roles";
import { EditOutlined, GlobalOutlined, InfoCircleOutlined, MinusCircleOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { ArrowLeftIcon } from "@heroicons/react/outline";
import { Accordion, AccordionBody, AccordionHeader, Badge, Card, Grid, Text, TextInput, Title } from "@tremor/react";
import { Button, Form, Input, InputNumber, Select, Space, Switch, Tabs, Tag, Tooltip } from "antd";
import MessageManager from "@/components/molecules/message_manager";
import { CheckIcon, CopyIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { copyToClipboard as utilCopyToClipboard } from "../../utils/dataUtils";
import AccessGroupSelector from "../common_components/AccessGroupSelector";
import AgentSelector from "../agent_management/AgentSelector";
import DeleteResourceModal from "../common_components/DeleteResourceModal";
import DurationSelect from "../common_components/DurationSelect";
import PassThroughRoutesSelector from "../common_components/PassThroughRoutesSelector";
import { unfurlWildcardModelsInList } from "../key_team_helpers/fetch_available_models_team_key";
import GuardrailSettingsView from "../GuardrailSettingsView";
import LoggingSettingsView from "../logging_settings_view";
import MCPServerSelector from "../mcp_server_management/MCPServerSelector";
import MCPToolPermissions from "../mcp_server_management/MCPToolPermissions";
import { ModelSelect } from "../ModelSelect/ModelSelect";
import NotificationsManager from "../molecules/notifications_manager";
import { fetchMCPAccessGroups } from "../networking";
import ObjectPermissionsView from "../object_permissions_view";
import NumericalInput from "../shared/numerical_input";
import VectorStoreSelector from "../vector_store_management/VectorStoreSelector";
import SearchToolSelector from "../SearchTools/SearchToolSelector";
import EditLoggingSettings from "./EditLoggingSettings";
import RouterSettingsAccordion, { RouterSettingsAccordionRef } from "../common_components/RouterSettingsAccordion";
import MemberModal from "./EditMembership";
import MemberPermissions from "./member_permissions";
import MyUserTab from "./MyUserTab";
import {
  getTeamInfoDefaultTab,
  getTeamInfoVisibleTabs,
  TEAM_INFO_TAB_KEYS,
  TEAM_INFO_TAB_LABELS,
} from "./tabVisibilityUtils";
import TeamMembersComponent from "./TeamMemberTab";
import { TeamVirtualKeysTable } from "./TeamVirtualKeysTable";

export interface TeamMembership {
  user_id: string;
  team_id: string;
  budget_id: string;
  spend: number;
  total_spend: number | null;
  litellm_budget_table: {
    budget_id: string;
    soft_budget: number | null;
    max_budget: number | null;
    max_parallel_requests: number | null;
    tpm_limit: number | null;
    rpm_limit: number | null;
    model_max_budget: Record<string, number> | null;
    budget_duration: string | null;
    budget_reset_at: string | null;
    allowed_models?: string[] | null;
  };
}

export interface TeamData {
  team_id: string;
  team_info: {
    team_alias: string;
    team_id: string;
    organization_id: string | null;
    admins: string[];
    members: string[];
    members_with_roles: Member[];
    metadata: Record<string, any>;
    tpm_limit: number | null;
    rpm_limit: number | null;
    max_budget: number | null;
    soft_budget?: number | null;
    budget_duration: string | null;
    models: string[];
    blocked: boolean;
    spend: number;
    max_parallel_requests: number | null;
    budget_reset_at: string | null;
    model_id: string | null;
    litellm_model_table: {
      model_aliases: Record<string, string>;
    } | null;
    created_at: string;
    access_group_ids?: string[];
    default_team_member_models?: string[];
    access_group_models?: string[];
    access_group_mcp_server_ids?: string[];
    access_group_agent_ids?: string[];
    router_settings?: Record<string, any>;
    guardrails?: string[];
    policies?: string[];
    object_permission?: {
      object_permission_id: string;
      mcp_servers: string[];
      mcp_access_groups?: string[];
      mcp_tool_permissions?: Record<string, string[]>;
      mcp_toolsets?: string[];
      vector_stores: string[];
      agents?: string[];
      agent_access_groups?: string[];
      search_tools?: string[];
    };
    team_member_budget_table: {
      max_budget: number;
      budget_duration: string;
      tpm_limit: number | null;
      rpm_limit: number | null;
    } | null;
  };
  keys: any[];
  team_memberships: TeamMembership[];
}

export interface TeamInfoProps {
  teamId: string;
  onUpdate: (data: any) => void;
  onClose: () => void;
  accessToken: string | null;
  is_team_admin: boolean;
  is_proxy_admin: boolean;
  is_org_admin?: boolean;
  userModels: string[];
  editTeam: boolean;
  premiumUser?: boolean;
}

const getOrganizationModels = (organization: Organization | null, userModels: string[]) => {
  let tempModelsToPick = [];

  if (organization) {
    // Check if organization has "all-proxy-models" in its models array
    if (organization.models.includes("all-proxy-models")) {
      // Treat as all-proxy-models (use userModels)
      tempModelsToPick = userModels;
    } else if (organization.models.length > 0) {
      // Organization has specific models
      tempModelsToPick = organization.models;
    } else {
      // Empty array [] is treated as all-proxy-models
      tempModelsToPick = userModels;
    }
  } else {
    // No organization, show all available models
    tempModelsToPick = userModels;
  }

  return unfurlWildcardModelsInList(tempModelsToPick, userModels);
};

const TeamInfoView: React.FC<TeamInfoProps> = ({
  teamId,
  onClose,
  accessToken,
  is_team_admin,
  is_proxy_admin,
  is_org_admin = false,
  userModels,
  editTeam,
  premiumUser = false,
  onUpdate,
}) => {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddMemberModalVisible, setIsAddMemberModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [isEditMemberModalVisible, setIsEditMemberModalVisible] = useState(false);
  const [selectedEditMember, setSelectedEditMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mcpAccessGroups, setMcpAccessGroups] = useState<string[]>([]);
  const [mcpAccessGroupsLoaded, setMcpAccessGroupsLoaded] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const { data: guardrailsData, isLoading: isGuardrailsLoading } = useGuardrails();
  const globalGuardrailNames = guardrailsData?.globalGuardrailNames ?? new Set<string>();
  const [policiesList, setPoliciesList] = useState<string[]>([]);
  const [policyGuardrails, setPolicyGuardrails] = useState<Record<string, string[]>>({});
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTeamSaving, setIsTeamSaving] = useState(false);
  const routerSettingsRef = React.useRef<RouterSettingsAccordionRef>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const { userRole, userId } = useAuthorized();
  const { data: userOrganizations = [] } = useOrganizations();
  const queryClient = useQueryClient();

  // Check if user is org admin for this team's organization
  const isOrgAdminForTeam = useMemo(() => {
    const teamOrgId = teamData?.team_info?.organization_id;
    if (!teamOrgId || !userId) return false;
    const org = userOrganizations.find((o) => o.organization_id === teamOrgId);
    return org?.members?.some((m: any) => m.user_id === userId && m.user_role === "org_admin") ?? false;
  }, [teamData, userOrganizations, userId]);

  // Models currently selected in the team edit form, used to scope the per-model
  // rate limit dropdown to models this team actually has access to.
  const selectedModelsInForm = Form.useWatch("models", form) as string[] | undefined;
  const killSwitchOn = Form.useWatch("disable_global_guardrails", form) as boolean | undefined;
  const availableRateLimitModels = useMemo(() => {
    const selected = selectedModelsInForm ?? teamData?.team_info?.models ?? [];
    if (selected.includes("all-proxy-models") || selected.includes("all-team-models")) {
      return userModels;
    }
    return unfurlWildcardModelsInList(selected, userModels);
  }, [selectedModelsInForm, teamData, userModels]);

  const canEditTeam = is_team_admin || is_proxy_admin || is_org_admin || isOrgAdminForTeam;
  const visibleTabs = useMemo(() => getTeamInfoVisibleTabs(canEditTeam), [canEditTeam]);
  const defaultTabKey = useMemo(
    () => getTeamInfoDefaultTab(editTeam, canEditTeam),
    [editTeam, canEditTeam]
  );

  const fetchTeamInfo = async () => {
    try {
      setLoading(true);
      if (!accessToken) return;
      const response = await teamInfoCall(accessToken, teamId);
      setTeamData(response);
    } catch (error) {
      NotificationsManager.fromBackend("加载团队信息失败");
      console.error("Error fetching team info:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamInfo();
  }, [teamId, accessToken]);

  // Fetch organization data when team has organization_id
  useEffect(() => {
    const fetchOrganization = async () => {
      if (!accessToken || !teamData?.team_info?.organization_id) {
        setOrganization(null);
        return;
      }

      try {
        const orgData = await organizationInfoCall(accessToken, teamData.team_info.organization_id);
        setOrganization(orgData);
      } catch (error) {
        console.error("Error fetching organization info:", error);
        setOrganization(null);
      }
    };

    fetchOrganization();
  }, [accessToken, teamData?.team_info?.organization_id]);

  // Compute modelsToPick based on organization and userModels
  const modelsToPick = useMemo(() => {
    return getOrganizationModels(organization, userModels);
  }, [organization, userModels]);

  const fetchMcpAccessGroups = async () => {
    if (!accessToken) return;
    if (mcpAccessGroupsLoaded) return;
    try {
      const groups = await fetchMCPAccessGroups(accessToken);
      setMcpAccessGroups(groups);
      setMcpAccessGroupsLoaded(true);
    } catch (error) {
      console.error("Failed to fetch MCP access groups:", error);
    }
  };

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        if (!accessToken) return;
        const response = await getPoliciesList(accessToken);
        const policyNames = response.policies.map((p: { policy_name: string }) => p.policy_name);
        setPoliciesList(policyNames);
      } catch (error) {
        console.error("Failed to fetch policies:", error);
      }
    };

    fetchPolicies();
  }, [accessToken]);

  // Fetch resolved guardrails for all policies
  useEffect(() => {
    const fetchPolicyGuardrails = async () => {
      if (!accessToken || !teamData?.team_info?.policies || teamData.team_info.policies.length === 0) {
        return;
      }

      setLoadingPolicies(true);
      const guardrailsMap: Record<string, string[]> = {};

      try {
        await Promise.all(
          teamData.team_info.policies.map(async (policyName: string) => {
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
  }, [accessToken, teamData?.team_info?.policies]);

  const handleMemberCreate = async (values: any) => {
    try {
      if (accessToken == null) return;

      const member: Member = {
        user_email: values.user_email,
        user_id: values.user_id,
        role: values.role,
      };

      await teamMemberAddCall(accessToken, teamId, member);

      NotificationsManager.success("团队成员添加成功");
      setIsAddMemberModalVisible(false);
      form.resetFields();

      // Fetch updated team info
      const updatedTeamData = await teamInfoCall(accessToken, teamId);
      setTeamData(updatedTeamData);

      // Notify parent component of the update
      onUpdate(updatedTeamData);
    } catch (error: any) {
      let errMsg = "添加团队成员失败";

      if (error?.raw?.detail?.error?.includes("Assigning team admins is a premium feature")) {
        errMsg = "分配管理员是企业版功能，请升级您的LiteLLM套餐以启用此功能。";
      } else if (error?.message) {
        errMsg = error.message;
      }

      NotificationsManager.fromBackend(errMsg);
      console.error("Error adding team member:", error);
    }
  };

  const handleMemberUpdate = async (values: any) => {
    try {
      if (accessToken == null) {
        return;
      }

      const member: Member = {
        user_email: values.user_email,
        user_id: values.user_id,
        role: values.role,
        max_budget_in_team: values.max_budget_in_team,
        tpm_limit: values.tpm_limit,
        rpm_limit: values.rpm_limit,
        allowed_models: values.allowed_models,
      };
      MessageManager.destroy(); // Remove all existing toasts

      await teamMemberUpdateCall(accessToken, teamId, member);

      NotificationsManager.success("团队成员更新成功");
      setIsEditMemberModalVisible(false);

      // Fetch updated team info
      const updatedTeamData = await teamInfoCall(accessToken, teamId);
      setTeamData(updatedTeamData);

      // Notify parent component of the update
      onUpdate(updatedTeamData);
    } catch (error: any) {
      let errMsg = "更新团队成员失败";
      if (error?.raw?.detail?.includes("Assigning team admins is a premium feature")) {
        errMsg = "分配管理员是企业版功能，请升级您的LiteLLM套餐以启用此功能。";
      } else if (error?.message) {
        errMsg = error.message;
      }
      setIsEditMemberModalVisible(false);

      MessageManager.destroy(); // Remove all existing toasts

      NotificationsManager.fromBackend(errMsg);
      console.error("Error updating team member:", error);
    }
  };

  const handleMemberDelete = (member: Member) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete || !accessToken) return;

    setIsDeleting(true);
    try {
      await teamMemberDeleteCall(accessToken, teamId, memberToDelete);

      NotificationsManager.success("团队成员移除成功");

      // Fetch updated team info
      const updatedTeamData = await teamInfoCall(accessToken, teamId);
      setTeamData(updatedTeamData);

      // Notify parent component of the update
      onUpdate(updatedTeamData);
    } catch (error) {
      NotificationsManager.fromBackend("移除团队成员失败");
      console.error("Error removing team member:", error);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setMemberToDelete(null);
  };

  const handleTeamUpdate = async (values: any) => {
    try {
      if (!accessToken) return;
      setIsTeamSaving(true);

      let parsedMetadata = {};
      try {
        const rawMetadata = values.metadata ? JSON.parse(values.metadata) : {};
        // Exclude soft_budget_alerting_emails from parsed metadata since it's handled separately
        const { soft_budget_alerting_emails, ...rest } = rawMetadata;
        parsedMetadata = rest;
      } catch (e) {
        NotificationsManager.fromBackend("元数据字段中的JSON无效");
        return;
      }

      let secretManagerSettings: Record<string, any> | undefined;
      if (typeof values.secret_manager_settings === "string") {
        const trimmedSecretConfig = values.secret_manager_settings.trim();
        if (trimmedSecretConfig.length > 0) {
          try {
            secretManagerSettings = JSON.parse(values.secret_manager_settings);
          } catch (e) {
            NotificationsManager.fromBackend("密钥管理设置中的JSON无效");
            return;
          }
        }
      }

      const sanitizeNumeric = (v: any) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "string" && v.trim() === "") return null;
        if (typeof v === "number" && Number.isNaN(v)) return null;
        return v;
      };

      const modelTpmLimit: Record<string, number> = {};
      const modelRpmLimit: Record<string, number> = {};
      for (const entry of (values.modelLimits ?? []) as { model?: string; tpm?: number; rpm?: number }[]) {
        if (entry?.model) {
          if (entry.tpm != null) modelTpmLimit[entry.model] = entry.tpm;
          if (entry.rpm != null) modelRpmLimit[entry.model] = entry.rpm;
        }
      }

      const killSwitchOnAtSave = values.disable_global_guardrails === true;
      const optedOutGlobalGuardrails = killSwitchOnAtSave
        ? Array.from(globalGuardrailNames)
        : Array.from(globalGuardrailNames).filter(
            (n) => !(values.guardrails || []).includes(n),
          );

      // Non-proxy-admins can't set allowed_passthrough_routes; preserve the
      // stored value so an unrelated save can't wipe it.
      const passthroughRoutesMetadata = is_proxy_admin
        ? { allowed_passthrough_routes: values.allowed_passthrough_routes || [] }
        : info.metadata?.allowed_passthrough_routes
          ? { allowed_passthrough_routes: info.metadata.allowed_passthrough_routes }
          : {};

      const updateData: any = {
        team_id: teamId,
        team_alias: values.team_alias,
        models: values.models,
        tpm_limit: sanitizeNumeric(values.tpm_limit),
        rpm_limit: sanitizeNumeric(values.rpm_limit),
        model_tpm_limit: modelTpmLimit,
        model_rpm_limit: modelRpmLimit,
        max_budget: values.max_budget,
        soft_budget: sanitizeNumeric(values.soft_budget),
        budget_duration: values.budget_duration,
        metadata: {
          ...parsedMetadata,
          ...passthroughRoutesMetadata,
          guardrails: (values.guardrails || []).filter((n: string) => !globalGuardrailNames.has(n)),
          opted_out_global_guardrails: optedOutGlobalGuardrails,
          ...(values.logging_settings?.length > 0 ? { logging: values.logging_settings } : {}),
          disable_global_guardrails: killSwitchOnAtSave,
          soft_budget_alerting_emails:
            typeof values.soft_budget_alerting_emails === "string"
              ? values.soft_budget_alerting_emails
                .split(",")
                .map((email: string) => email.trim())
                .filter((email: string) => email.length > 0)
              : values.soft_budget_alerting_emails || [],
          ...(secretManagerSettings !== undefined ? { secret_manager_settings: secretManagerSettings } : {}),
        },
        ...(values.policies?.length > 0 ? { policies: values.policies } : {}),
        ...(values.organization_id !== info.organization_id
          ? { organization_id: values.organization_id ?? null }
          : {}),
      };

      updateData.max_budget = mapEmptyStringToNull(updateData.max_budget);
      updateData.team_member_budget_duration = values.team_member_budget_duration;

      if (values.team_member_budget !== undefined) {
        updateData.team_member_budget = Number(values.team_member_budget);
      }

      if (values.team_member_key_duration !== undefined) {
        updateData.team_member_key_duration = values.team_member_key_duration;
      }

      if (values.team_member_tpm_limit !== undefined || values.team_member_rpm_limit !== undefined) {
        updateData.team_member_tpm_limit = sanitizeNumeric(values.team_member_tpm_limit);
        updateData.team_member_rpm_limit = sanitizeNumeric(values.team_member_rpm_limit);
      }

      // Handle object_permission updates
      const { servers, accessGroups, toolsets } = values.mcp_servers_and_groups || {
        servers: [],
        accessGroups: [],
        toolsets: [],
      };
      const serverIds = new Set(servers || []);
      const mcpToolPermissions = Object.fromEntries(
        Object.entries(values.mcp_tool_permissions || {}).filter(([serverId]) => serverIds.has(serverId)),
      );

      updateData.object_permission = {};
      if (servers) {
        updateData.object_permission.mcp_servers = servers;
      }
      if (accessGroups) {
        updateData.object_permission.mcp_access_groups = accessGroups;
      }
      if (mcpToolPermissions) {
        updateData.object_permission.mcp_tool_permissions = mcpToolPermissions;
      }
      if (toolsets) {
        updateData.object_permission.mcp_toolsets = toolsets;
      }
      delete values.mcp_servers_and_groups;
      delete values.mcp_tool_permissions;

      // Handle agent permissions
      const { agents, accessGroups: agentAccessGroups } = values.agents_and_groups || {
        agents: [],
        accessGroups: [],
      };
      if (agents && agents.length > 0) {
        updateData.object_permission.agents = agents;
      }
      if (agentAccessGroups && agentAccessGroups.length > 0) {
        updateData.object_permission.agent_access_groups = agentAccessGroups;
      }
      delete values.agents_and_groups;

      // Handle vector stores permissions
      if (values.vector_stores && values.vector_stores.length > 0) {
        updateData.object_permission.vector_stores = values.vector_stores;
      }

      if (Array.isArray(values.object_permission_search_tools)) {
        updateData.object_permission.search_tools = values.object_permission_search_tools;
      }

      // Pass access_group_ids to the update request
      if (values.access_group_ids !== undefined) {
        updateData.access_group_ids = values.access_group_ids;
      }

      // Pass default_team_member_models to the update request
      if (values.default_team_member_models !== undefined) {
        updateData.default_team_member_models = values.default_team_member_models;
      }

      // Handle router_settings - read fresh values from DOM at save time.
      const currentRouterSettings = routerSettingsRef.current?.getValue();
      if (currentRouterSettings?.router_settings) {
        const isMeaningfulValue = (value: unknown) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          value !== false &&
          !(Array.isArray(value) && value.length === 0);

        const hasNewValues = Object.values(currentRouterSettings.router_settings).some(isMeaningfulValue);
        const hadExistingSettings = info.router_settings &&
          Object.values(info.router_settings).some(isMeaningfulValue);

        // Send if there are new values OR if the user is clearing existing ones
        if (hasNewValues || hadExistingSettings) {
          updateData.router_settings = currentRouterSettings.router_settings;
        }
      }

      const response = await teamUpdateCall(accessToken, updateData);
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });

      NotificationsManager.success("团队设置更新成功");
      setIsEditing(false);
      fetchTeamInfo();
    } catch (error) {
      console.error("Error updating team:", error);
    } finally {
      setIsTeamSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  if (!teamData?.team_info) {
    return <div className="p-4">未找到团队</div>;
  }

  const { team_info: info } = teamData;

  const initialKillSwitchOn = info.metadata?.disable_global_guardrails === true;
  const optedOutGlobals = new Set<string>(
    Array.isArray(info.metadata?.opted_out_global_guardrails) ? info.metadata.opted_out_global_guardrails : [],
  );
  const nonGlobalOptIns: string[] = (
    Array.isArray(info.metadata?.guardrails) ? info.metadata.guardrails : []
  ).filter((n: string) => !globalGuardrailNames.has(n));
  const effectiveGuardrails: string[] = initialKillSwitchOn
    ? nonGlobalOptIns
    : [
        ...Array.from(globalGuardrailNames).filter((n) => !optedOutGlobals.has(n)),
        ...nonGlobalOptIns,
      ];

  const preventTagMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const renderGuardrailTag = ({ label, value, closable, onClose }: any) => {
    const isGlobal = globalGuardrailNames.has(value);
    return (
      <Tag
        color="blue"
        closable={closable}
        onClose={onClose}
        onMouseDown={preventTagMouseDown}
        style={{ marginInlineEnd: 4 }}
      >
        {isGlobal && <GlobalOutlined style={{ marginInlineEnd: 4 }} aria-label="全局护栏" />}
        {label}
      </Tag>
    );
  };

  const copyToClipboard = async (text: string, key: string) => {
    const success = await utilCopyToClipboard(text);
    if (success) {
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button
            type="text"
            icon={<ArrowLeftIcon className="h-4 w-4" />}
            onClick={onClose}
            className="mb-4"
          >
            返回团队列表
          </Button>
          <Title>{info.team_alias}</Title>
          <div className="flex items-center">
            <Text className="text-gray-500 font-mono">{info.team_id}</Text>
            <Button
              type="text"
              size="small"
              icon={copiedStates["team-id"] ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
              onClick={() => copyToClipboard(info.team_id, "team-id")}
              className={`left-2 z-10 transition-all duration-200 ${copiedStates["team-id"]
                ? "text-green-600 bg-green-50 border-green-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
            />
          </div>
        </div>
      </div>

      <Tabs
        defaultActiveKey={defaultTabKey}
        className="mb-4"
        items={[
          {
            key: TEAM_INFO_TAB_KEYS.OVERVIEW,
            label: TEAM_INFO_TAB_LABELS[TEAM_INFO_TAB_KEYS.OVERVIEW],
            children: (
              <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
                <Card>
                  <Text>预算状态</Text>
                  <div className="mt-2">
                    <Title>${formatNumberWithCommas(info.spend, 4)}</Title>
                    <Text>
                      / {info.max_budget === null ? "无限制" : `$${formatNumberWithCommas(info.max_budget, 4)}`}
                    </Text>
                    {info.budget_duration && <Text className="text-gray-500">重置：{info.budget_duration}</Text>}
                    <br />
                    {info.team_member_budget_table && (
                      <Text className="text-gray-500">
                        团队成员预算：${formatNumberWithCommas(info.team_member_budget_table.max_budget, 4)}
                      </Text>
                    )}
                  </div>
                </Card>

                <Card>
                  <Text>速率限制</Text>
                  <div className="mt-2">
                    <Text>TPM：{info.tpm_limit || "无限制"}</Text>
                    <Text>RPM：{info.rpm_limit || "无限制"}</Text>
                    {info.max_parallel_requests && <Text>最大并行请求数：{info.max_parallel_requests}</Text>}
                    {(() => {
                      const modelTpm = (info.metadata?.model_tpm_limit ?? {}) as Record<string, number>;
                      const modelRpm = (info.metadata?.model_rpm_limit ?? {}) as Record<string, number>;
                      const models = Array.from(new Set([...Object.keys(modelTpm), ...Object.keys(modelRpm)]));
                      if (models.length === 0) return null;
                      return (
                        <div className="mt-3">
                          <Text className="text-gray-500">各模型限制：</Text>
                          {models.map((m) => (
                            <Text key={m} className="text-xs">
                              {m}: TPM {modelTpm[m] ?? "—"}, RPM {modelRpm[m] ?? "—"}
                            </Text>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </Card>

                <Card>
                  <Text>模型</Text>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {info.models.length === 0 || info.models.includes("all-proxy-models") ? (
                      <Badge color="red">所有代理模型</Badge>
                    ) : (
                      <>
                        {info.models.map((model: string, index: number) => (
                          <Badge key={`direct-${index}`} color="blue">
                            {model}
                          </Badge>
                        ))}
                        {(info.access_group_models || []).map((model: string, index: number) => (
                          <Badge key={`ag-${index}`} color="green" title="来自访问组">
                            {model}
                          </Badge>
                        ))}
                      </>
                    )}
                  </div>
                </Card>

                <Card>
                  <Text className="font-semibold text-gray-900">虚拟密钥</Text>
                  <div className="mt-2">
                    <Text>用户密钥：{teamData.keys.filter((key) => key.user_id).length}</Text>
                    <Text>服务账号密钥：{teamData.keys.filter((key) => !key.user_id).length}</Text>
                    <Text className="text-gray-500">总计：{teamData.keys.length}</Text>
                  </div>
                </Card>

                <ObjectPermissionsView
                  objectPermission={info.object_permission}
                  variant="card"
                  accessToken={accessToken}
                />

                <Card>
                  <GuardrailSettingsView
                    globalGuardrailNames={globalGuardrailNames}
                    teamGuardrails={Array.isArray(info.metadata?.guardrails) ? info.metadata.guardrails : []}
                    optedOutGlobalGuardrails={Array.isArray(info.metadata?.opted_out_global_guardrails) ? info.metadata.opted_out_global_guardrails : []}
                    killSwitchOn={initialKillSwitchOn}
                    variant="inline"
                  />
                </Card>

                <Card>
                  <Text className="font-semibold text-gray-900 mb-3">策略</Text>
                  {info.policies && info.policies.length > 0 ? (
                    <div className="space-y-4">
                      {info.policies.map((policy: string, index: number) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge color="purple">{policy}</Badge>
                            {loadingPolicies && <Text className="text-xs text-gray-400">加载护栏中...</Text>}
                          </div>
                          {!loadingPolicies && policyGuardrails[policy] && policyGuardrails[policy].length > 0 && (
                            <div className="ml-4 pl-3 border-l-2 border-gray-200">
                              <Text className="text-xs text-gray-500 mb-1">已解析护栏：</Text>
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
                  loggingConfigs={info.metadata?.logging || []}
                  disabledCallbacks={[]}
                  variant="card"
                />
              </Grid>
            ),
          },
          {
            key: TEAM_INFO_TAB_KEYS.MY_USER,
            label: TEAM_INFO_TAB_LABELS[TEAM_INFO_TAB_KEYS.MY_USER],
            children: <MyUserTab teamId={teamId} />,
          },
          {
            key: TEAM_INFO_TAB_KEYS.VIRTUAL_KEYS,
            label: TEAM_INFO_TAB_LABELS[TEAM_INFO_TAB_KEYS.VIRTUAL_KEYS],
            children: (
              <TeamVirtualKeysTable
                teamId={teamId}
                teamAlias={info.team_alias}
                organization={organization}
              />
            ),
          },
          {
            key: TEAM_INFO_TAB_KEYS.MEMBERS,
            label: TEAM_INFO_TAB_LABELS[TEAM_INFO_TAB_KEYS.MEMBERS],
            children: (
              <TeamMembersComponent
                teamData={teamData}
                canEditTeam={canEditTeam}
                handleMemberDelete={handleMemberDelete}
                setSelectedEditMember={setSelectedEditMember}
                setIsEditMemberModalVisible={setIsEditMemberModalVisible}
                setIsAddMemberModalVisible={setIsAddMemberModalVisible}
              />
            ),
          },
          {
            key: TEAM_INFO_TAB_KEYS.MEMBER_PERMISSIONS,
            label: TEAM_INFO_TAB_LABELS[TEAM_INFO_TAB_KEYS.MEMBER_PERMISSIONS],
            children: (
              <MemberPermissions teamId={teamId} accessToken={accessToken} canEditTeam={canEditTeam} />
            ),
          },
          {
            key: TEAM_INFO_TAB_KEYS.SETTINGS,
            label: TEAM_INFO_TAB_LABELS[TEAM_INFO_TAB_KEYS.SETTINGS],
            children: (
              <Card className="overflow-y-auto max-h-[65vh]">
                <div className="flex justify-between items-center mb-4">
                  <Title>团队设置</Title>
                  {canEditTeam && !isEditing && (
                    <Button icon={<EditOutlined className="h-4 w-4" />} onClick={() => setIsEditing(true)}>编辑设置</Button>
                  )}
                </div>

                {isEditing && isGuardrailsLoading ? (
                  <div className="p-4">加载中...</div>
                ) : isEditing ? (
                  <Form
                    form={form}
                    onFinish={handleTeamUpdate}
                    onValuesChange={(changedValues) => {
                      if ("disable_global_guardrails" in changedValues) {
                        const checked = changedValues.disable_global_guardrails === true;
                        const current = (form.getFieldValue("guardrails") || []) as string[];
                        const nonGlobals = current.filter((n) => !globalGuardrailNames.has(n));
                        form.setFieldValue(
                          "guardrails",
                          checked ? nonGlobals : [...Array.from(globalGuardrailNames), ...nonGlobals],
                        );
                      }
                    }}
                    initialValues={{
                      ...info,
                      team_alias: info.team_alias,
                      models: info.models,
                      tpm_limit: info.tpm_limit,
                      rpm_limit: info.rpm_limit,
                      object_permission_search_tools: info.object_permission?.search_tools || [],
                      modelLimits: Array.from(
                        new Set([
                          ...Object.keys(info.metadata?.model_tpm_limit ?? {}),
                          ...Object.keys(info.metadata?.model_rpm_limit ?? {}),
                        ]),
                      ).map((model) => ({
                        model,
                        tpm: info.metadata?.model_tpm_limit?.[model],
                        rpm: info.metadata?.model_rpm_limit?.[model],
                      })),
                      max_budget: info.max_budget,
                      soft_budget: info.soft_budget,
                      budget_duration: info.budget_duration,
                      team_member_tpm_limit: info.team_member_budget_table?.tpm_limit,
                      team_member_rpm_limit: info.team_member_budget_table?.rpm_limit,
                      team_member_budget: info.team_member_budget_table?.max_budget,
                      team_member_budget_duration: info.team_member_budget_table?.budget_duration,
                      guardrails: effectiveGuardrails,
                      policies: info.policies || [],
                      disable_global_guardrails: info.metadata?.disable_global_guardrails || false,
                      soft_budget_alerting_emails:
                        Array.isArray(info.metadata?.soft_budget_alerting_emails)
                          ? info.metadata.soft_budget_alerting_emails.join(", ")
                          : "",
                      metadata: info.metadata
                        ? JSON.stringify(
                          (({ logging, secret_manager_settings, soft_budget_alerting_emails, model_tpm_limit, model_rpm_limit, allowed_passthrough_routes, ...rest }) => rest)(info.metadata),
                          null,
                          2,
                        )
                        : "",
                      logging_settings: info.metadata?.logging || [],
                      secret_manager_settings: info.metadata?.secret_manager_settings
                        ? JSON.stringify(info.metadata.secret_manager_settings, null, 2)
                        : "",
                      organization_id: info.organization_id,
                      vector_stores: info.object_permission?.vector_stores || [],
                      mcp_servers: info.object_permission?.mcp_servers || [],
                      mcp_access_groups: info.object_permission?.mcp_access_groups || [],
                      mcp_servers_and_groups: {
                        servers: info.object_permission?.mcp_servers || [],
                        accessGroups: info.object_permission?.mcp_access_groups || [],
                        toolsets: info.object_permission?.mcp_toolsets || [],
                      },
                      mcp_tool_permissions: info.object_permission?.mcp_tool_permissions || {},
                      agents_and_groups: {
                        agents: info.object_permission?.agents || [],
                        accessGroups: info.object_permission?.agent_access_groups || [],
                      },
                      access_group_ids: info.access_group_ids || [],
                      default_team_member_models: info.default_team_member_models || [],
                      allowed_passthrough_routes: info.metadata?.allowed_passthrough_routes || [],
                    }}
                    layout="vertical"
                  >
                    <Form.Item
                      label="团队名称"
                      name="team_alias"
                      rules={[{ required: true, message: "请输入团队名称" }]}
                    >
                      <Input type="" />
                    </Form.Item>

                    <Form.Item
                      label="模型"
                      name="models"
                      rules={[{ required: true, message: "请至少选择一个模型" }]}
                    >
                      <ModelSelect
                        value={form.getFieldValue("models") || []}
                        onChange={(values) => form.setFieldValue("models", values)}
                        teamID={teamId}
                        organizationID={teamData?.team_info?.organization_id || undefined}
                        options={{
                          includeSpecialOptions: true,
                          includeUserModels: !teamData?.team_info?.organization_id,
                          showAllProxyModelsOverride: isProxyAdminRole(userRole) && !teamData?.team_info?.organization_id,
                        }}
                        context="team"
                        dataTestId="models-select"
                      />
                    </Form.Item>

                    <Form.Item label="最大预算（美元）" name="max_budget">
                      <NumericalInput step={0.01} precision={2} style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item label="软预算（美元）" name="soft_budget">
                      <NumericalInput step={0.01} precision={2} style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item
                      label="软预算告警邮箱"
                      name="soft_budget_alerting_emails"
                      tooltip="逗号分隔的邮箱地址，当达到软预算时接收告警"
                    >
                      <Input placeholder="example1@test.com, example2@test.com" />
                    </Form.Item>

                    <Accordion className="mt-4 mb-4">
                      <AccordionHeader>
                        <b>团队成员设置</b>
                      </AccordionHeader>
                      <AccordionBody>
                        <Text className="text-xs text-gray-500 mb-4">
                          成员加入此团队时应用的可选默认值。每个成员的所有字段均可覆盖。
                        </Text>
                        <Form.Item
                          label={
                            <span>
                              默认模型访问权限{" "}
                              <Tooltip title="可选。如果设置，新成员默认只能访问这些模型。必须是上述团队模型的子集。留空则所有成员可访问所有团队模型。">
                                <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                              </Tooltip>
                            </span>
                          }
                          name="default_team_member_models"
                        >
                          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.models !== cur.models}>
                            {({ getFieldValue }) => {
                              const teamModels = getFieldValue("models") || info.models || [];
                              return (
                                <Select
                                  mode="multiple"
                                  placeholder="留空 — 所有团队成员可访问所有团队模型"
                                  value={form.getFieldValue("default_team_member_models") || []}
                                  onChange={(values) => form.setFieldValue("default_team_member_models", values)}
                                  options={teamModels.map((m: string) => ({ label: m, value: m }))}
                                />
                              );
                            }}
                          </Form.Item>
                        </Form.Item>
                        <Form.Item
                          label="默认预算（美元）"
                          name="team_member_budget"
                          tooltip="此团队中每个成员的默认消费预算。"
                        >
                          <NumericalInput step={0.01} precision={2} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item label="默认预算周期" name="team_member_budget_duration">
                          <DurationSelect
                            onChange={(value) => form.setFieldValue("team_member_budget_duration", value)}
                            value={form.getFieldValue("team_member_budget_duration")}
                          />
                        </Form.Item>
                        <Form.Item
                          label="默认密钥有效期（例如：1d, 1mo）"
                          name="team_member_key_duration"
                          tooltip="设置团队成员密钥的有效期限制。格式：30s（秒），30m（分钟），30h（小时），30d（天），1mo（月）"
                        >
                          <TextInput placeholder="例如：30d" />
                        </Form.Item>
                        <Form.Item
                          label="默认TPM限制"
                          name="team_member_tpm_limit"
                          tooltip="每个成员的默认每分钟令牌数限制。可在每个成员处覆盖。"
                        >
                          <NumericalInput step={1} style={{ width: "100%" }} placeholder="例如：1000" />
                        </Form.Item>
                        <Form.Item
                          label="默认RPM限制"
                          name="team_member_rpm_limit"
                          tooltip="每个成员的默认每分钟请求数限制。可在每个成员处覆盖。"
                        >
                          <NumericalInput step={1} style={{ width: "100%" }} placeholder="例如：100" />
                        </Form.Item>
                      </AccordionBody>
                    </Accordion>

                    <Form.Item label="预算重置" name="budget_duration">
                      <Select placeholder="不设置">
                        <Select.Option value="24h">每天</Select.Option>
                        <Select.Option value="7d">每周</Select.Option>
                        <Select.Option value="30d">每月</Select.Option>
                      </Select>
                    </Form.Item>

                    <Form.Item label="每分钟令牌数限制（TPM）" name="tpm_limit">
                      <NumericalInput step={1} style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item label="每分钟请求数限制（RPM）" name="rpm_limit">
                      <NumericalInput step={1} style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item
                      label="模型特定速率限制"
                      tooltip="设置适用于整个团队的每个模型的TPM/RPM限制。"
                    >
                      <Form.List name="modelLimits">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <Space
                                key={key}
                                style={{ display: "flex", marginBottom: 8 }}
                                align="baseline"
                              >
                                <Form.Item
                                  {...restField}
                                  name={[name, "model"]}
                                  rules={[
                                    { required: true, message: "缺少模型" },
                                    {
                                      validator: (_, value) => {
                                        if (!value) return Promise.resolve();
                                        const all = form.getFieldValue("modelLimits") ?? [];
                                        const dupes = all.filter(
                                          (entry: { model?: string }) => entry?.model === value,
                                        );
                                        if (dupes.length > 1) {
                                          return Promise.reject(new Error("模型重复"));
                                        }
                                        return Promise.resolve();
                                      },
                                    },
                                  ]}
                                  style={{ minWidth: 240 }}
                                >
                                  <Select
                                    showSearch
                                    placeholder="选择模型"
                                    allowClear
                                    options={availableRateLimitModels.map((m) => ({
                                      value: m,
                                      label: m,
                                    }))}
                                  />
                                </Form.Item>
                                <Form.Item
                                  {...restField}
                                  name={[name, "tpm"]}
                                  rules={[
                                    {
                                      validator: async (_, value) => {
                                        const row = (form.getFieldValue("modelLimits") ?? [])[name] ?? {};
                                        if (row.model && value == null && row.rpm == null) {
                                          return Promise.reject(new Error("请至少设置TPM或RPM中的一个"));
                                        }
                                        return Promise.resolve();
                                      },
                                    },
                                  ]}
                                >
                                  <InputNumber placeholder="TPM限制" min={0} />
                                </Form.Item>
                                <Form.Item {...restField} name={[name, "rpm"]}>
                                  <InputNumber placeholder="RPM限制" min={0} />
                                </Form.Item>
                                <MinusCircleOutlined
                                  onClick={() => remove(name)}
                                  style={{ color: "#ef4444" }}
                                />
                              </Space>
                            ))}
                            <Form.Item>
                              <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                                icon={<PlusOutlined />}
                              >
                                添加模型限制
                              </Button>
                            </Form.Item>
                          </>
                        )}
                      </Form.List>
                    </Form.Item>

                    <Form.Item label="路由设置">
                      <RouterSettingsAccordion
                        ref={routerSettingsRef}
                        accessToken={accessToken || ""}
                        value={info.router_settings ? { router_settings: info.router_settings } : undefined}
                      />
                    </Form.Item>

                    <Form.Item
                      label={
                        <span>
                          护栏{" "}
                          <Tooltip title="选择适用于此团队的护栏。默认启用全局护栏 — 取消选中以退出。其他护栏为选择加入。">
                            <a
                              href="https://docs.litellm.ai/docs/proxy/guardrails/quick_start"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                            </a>
                          </Tooltip>
                        </span>
                      }
                      name="guardrails"
                    >
                      <Select
                        mode="multiple"
                        placeholder="选择护栏"
                        optionLabelProp="label"
                        tagRender={renderGuardrailTag}
                      >
                        <Select.OptGroup
                          label={
                            <>
                              <GlobalOutlined style={{ marginInlineEnd: 4 }} />
全局
                            </>
                          }
                        >
                          {(guardrailsData?.guardrails ?? [])
                            .filter((g) => g.litellm_params?.default_on)
                            .map((g) => (
                              <Select.Option
                                key={g.guardrail_name}
                                value={g.guardrail_name}
                                label={g.guardrail_name}
                                disabled={killSwitchOn}
                              >
                                {g.guardrail_name}
                              </Select.Option>
                            ))}
                        </Select.OptGroup>
                        <Select.OptGroup label="其他">
                          {(guardrailsData?.guardrails ?? [])
                            .filter((g) => !g.litellm_params?.default_on)
                            .map((g) => (
                              <Select.Option
                                key={g.guardrail_name}
                                value={g.guardrail_name}
                                label={g.guardrail_name}
                              >
                                {g.guardrail_name}
                              </Select.Option>
                            ))}
                        </Select.OptGroup>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label={
                        <span>
                          禁用所有全局护栏{" "}
                          <Tooltip title="总开关：绕过此团队的所有全局护栏，包括将来添加的。如需逐个护栏退出，请使用上面的护栏下拉菜单。">
                            <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                          </Tooltip>
                        </span>
                      }
                      name="disable_global_guardrails"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>

                    <Form.Item
                      label={
                        <span>
                          策略{" "}
                          <Tooltip title="对此团队应用策略以控制护栏和其他设置">
                            <a
                              href="https://docs.litellm.ai/docs/proxy/guardrails/guardrail_policies"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                            </a>
                          </Tooltip>
                        </span>
                      }
                      name="policies"
                    >
                      <Select
                        mode="tags"
                        placeholder="选择或输入策略"
                        options={policiesList.map((name) => ({ value: name, label: name }))}
                      />
                    </Form.Item>

                    <Form.Item
                      label={
                        <span>
                          访问组{" "}
                          <Tooltip title="为此团队分配访问组。访问组控制此团队可以使用哪些模型、MCP服务器和代理">
                            <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                          </Tooltip>
                        </span>
                      }
                      name="access_group_ids"
                    >
                      <AccessGroupSelector placeholder="选择访问组（可选）" />
                    </Form.Item>

                    <Form.Item label="向量存储" name="vector_stores" aria-label="向量存储">
                      <VectorStoreSelector
                        onChange={(values: string[]) => form.setFieldValue("vector_stores", values)}
                        value={form.getFieldValue("vector_stores")}
                        accessToken={accessToken || ""}
                        placeholder="选择向量存储"
                      />
                    </Form.Item>

                    <Form.Item label="允许的透传路由" name="allowed_passthrough_routes">
                      <Tooltip
                        title={
                          !premiumUser
                            ? "高级功能 - 升级以设置允许的透传路由"
                            : !is_proxy_admin
                              ? "仅代理管理员可以设置允许的透传路由"
                              : ""
                        }
                        placement="top"
                      >
                        <PassThroughRoutesSelector
                          onChange={(values: string[]) => form.setFieldValue("allowed_passthrough_routes", values)}
                          value={form.getFieldValue("allowed_passthrough_routes")}
                          accessToken={accessToken || ""}
                          placeholder="选择透传路由"
                          disabled={!premiumUser || !is_proxy_admin}
                        />
                      </Tooltip>
                    </Form.Item>

                    <Form.Item label="MCP服务器/访问组" name="mcp_servers_and_groups">
                      <MCPServerSelector
                        onChange={(val) => form.setFieldValue("mcp_servers_and_groups", val)}
                        value={form.getFieldValue("mcp_servers_and_groups")}
                        accessToken={accessToken || ""}
                        placeholder="选择MCP服务器或访问组（可选）"
                      />
                    </Form.Item>

                    {/* Hidden field to register mcp_tool_permissions with the form */}
                    <Form.Item name="mcp_tool_permissions" initialValue={{}} hidden>
                      <Input type="hidden" />
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) =>
                        prevValues.mcp_servers_and_groups !== currentValues.mcp_servers_and_groups ||
                        prevValues.mcp_tool_permissions !== currentValues.mcp_tool_permissions
                      }
                    >
                      {() => (
                        <div className="mb-6">
                          <MCPToolPermissions
                            accessToken={accessToken || ""}
                            selectedServers={form.getFieldValue("mcp_servers_and_groups")?.servers || []}
                            toolPermissions={form.getFieldValue("mcp_tool_permissions") || {}}
                            onChange={(toolPerms) => form.setFieldsValue({ mcp_tool_permissions: toolPerms })}
                          />
                        </div>
                      )}
                    </Form.Item>

                    <Form.Item label="代理/访问组" name="agents_and_groups">
                      <AgentSelector
                        onChange={(val) => form.setFieldValue("agents_and_groups", val)}
                        value={form.getFieldValue("agents_and_groups")}
                        accessToken={accessToken || ""}
                        placeholder="选择代理或访问组（可选）"
                      />
                    </Form.Item>

                    <Accordion className="mt-4 mb-4">
                      <AccordionHeader>
                        <b>搜索工具设置</b>
                      </AccordionHeader>
                      <AccordionBody>
                        <Form.Item
                          label="允许的搜索工具"
                          name="object_permission_search_tools"
                          tooltip="选择此团队可以访问的搜索工具。留空以允许所有搜索工具。"
                        >
                          <SearchToolSelector
                            onChange={(vals: string[]) => form.setFieldValue("object_permission_search_tools", vals)}
                            value={form.getFieldValue("object_permission_search_tools")}
                            accessToken={accessToken || ""}
                            placeholder="选择搜索工具（可选，留空=全部允许）"
                          />
                        </Form.Item>
                      </AccordionBody>
                    </Accordion>

                    <Form.Item label="组织" name="organization_id">
                      <Select
                        allowClear
                        placeholder="选择一个组织"
                        showSearch
                        optionFilterProp="label"
                        options={userOrganizations.map((org) => ({
                          value: org.organization_id,
                          label: org.organization_alias || org.organization_id,
                        }))}
                      />
                    </Form.Item>

                    <Form.Item label="日志设置" name="logging_settings">
                      <EditLoggingSettings
                        value={form.getFieldValue("logging_settings")}
                        onChange={(values) => form.setFieldValue("logging_settings", values)}
                      />
                    </Form.Item>

                    <Form.Item
                      label="密钥管理设置"
                      name="secret_manager_settings"
                      help={
                        premiumUser
                          ? "以JSON对象格式输入密钥管理配置。"
                          : "高级功能 - 升级以管理密钥管理设置。"
                      }
                      rules={[
                        {
                          validator: async (_, value) => {
                            if (!value) {
                              return Promise.resolve();
                            }
                            try {
                              JSON.parse(value);
                              return Promise.resolve();
                            } catch (error) {
                              return Promise.reject(new Error("请输入有效的JSON"));
                            }
                          },
                        },
                      ]}
                    >
                      <Input.TextArea
                        rows={6}
                        placeholder='{"namespace": "admin", "mount": "secret", "path_prefix": "litellm"}'
                        disabled={!premiumUser}
                      />
                    </Form.Item>

                    <Form.Item label="元数据" name="metadata">
                      <Input.TextArea rows={10} />
                    </Form.Item>

                    <div className="sticky z-10 bg-white p-4 pr-0 border-t border-gray-200 bottom-[-1.5rem] inset-x-[-1.5rem]">
                      <div className="flex justify-end items-center gap-2">
                        <Button onClick={() => setIsEditing(false)} disabled={isTeamSaving}>
                          取消
                        </Button>
                        <Button icon={<SaveOutlined className="h-4 w-4" />} type="primary" htmlType="submit" loading={isTeamSaving}>
                          保存更改
                        </Button>
                      </div>
                    </div>
                  </Form>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Text className="font-medium">团队名称</Text>
                      <div>{info.team_alias}</div>
                    </div>
                    <div>
                      <Text className="font-medium">团队ID</Text>
                      <div className="font-mono">{info.team_id}</div>
                    </div>
                    <div>
                      <Text className="font-medium">创建时间</Text>
                      <div>{new Date(info.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <Text className="font-medium">Models</Text>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {info.models.map((model, index) => (
                          <Badge key={index} color="red">
                            {model}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {info.default_team_member_models && info.default_team_member_models.length > 0 && (
                      <div>
                        <Text className="font-medium">默认成员模型</Text>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {info.default_team_member_models.map((model, index) => (
                            <Badge key={index} color="blue">
                              {model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <Text className="font-medium">速率限制</Text>
                      <div>TPM：{info.tpm_limit || "无限制"}</div>
                      <div>RPM：{info.rpm_limit || "无限制"}</div>
                      {(() => {
                        const modelTpm = (info.metadata?.model_tpm_limit ?? {}) as Record<string, number>;
                        const modelRpm = (info.metadata?.model_rpm_limit ?? {}) as Record<string, number>;
                        const models = Array.from(new Set([...Object.keys(modelTpm), ...Object.keys(modelRpm)]));
                        if (models.length === 0) return null;
                        return (
                          <div className="mt-2">
<Text className="text-gray-500">各模型限制：</Text>
                            {models.map((m) => (
                              <div key={m} className="text-xs ml-2">
                                {m}: TPM {modelTpm[m] ?? "—"}, RPM {modelRpm[m] ?? "—"}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <Text className="font-medium">团队预算</Text>
                      <div>
                        最大预算：{" "}
                        {info.max_budget !== null ? `$${formatNumberWithCommas(info.max_budget, 4)}` : "无限制"}
                      </div>
                      <div>
                        软预算：{" "}
                        {info.soft_budget !== null && info.soft_budget !== undefined
                          ? `$${formatNumberWithCommas(info.soft_budget, 4)}`
                          : "无限制"}
                      </div>
                      <div>预算重置：{info.budget_duration || "从不"}</div>
                      {info.metadata?.soft_budget_alerting_emails &&
                        Array.isArray(info.metadata.soft_budget_alerting_emails) &&
                        info.metadata.soft_budget_alerting_emails.length > 0 && (
                          <div>
                            软预算告警邮箱： {info.metadata.soft_budget_alerting_emails.join(", ")}
                          </div>
                        )}
                    </div>
                    <div>
                      <Text className="font-medium">
                        团队成员设置{" "}
                        <Tooltip title="这些是对单个团队成员的限">
                          <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                        </Tooltip>
                      </Text>
                      <div>最大预算：{info.team_member_budget_table?.max_budget || "无限制"}</div>
                      <div>预算周期：{info.team_member_budget_table?.budget_duration || "无限制"}</div>
                      <div>密钥有效期：{info.metadata?.team_member_key_duration || "无限制"}</div>
                      <div>TPM限制：{info.team_member_budget_table?.tpm_limit || "无限制"}</div>
                      <div>RPM限制：{info.team_member_budget_table?.rpm_limit || "无限制"}</div>
                    </div>
                    <div>
                      <Text className="font-medium">路由设置</Text>
                      {info.router_settings && Object.values(info.router_settings).some(
                        (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
                      ) ? (
                        <div className="mt-1 space-y-1">
                          {info.router_settings.routing_strategy && (
                            <div>
                              路由策略：{" "}
                              <Badge color="blue">{info.router_settings.routing_strategy}</Badge>
                            </div>
                          )}
                          {info.router_settings.num_retries != null && (
                            <div>重试次数： {info.router_settings.num_retries}</div>
                          )}
                          {info.router_settings.allowed_fails != null && (
                            <div>允许失败次数： {info.router_settings.allowed_fails}</div>
                          )}
                          {info.router_settings.cooldown_time != null && (
                            <div>冷却时间： {info.router_settings.cooldown_time}s</div>
                          )}
                          {info.router_settings.timeout != null && (
                            <div>超时时间： {info.router_settings.timeout}s</div>
                          )}
                          {info.router_settings.retry_after != null && (
                            <div>重试间隔： {info.router_settings.retry_after}s</div>
                          )}
                          {info.router_settings.fallbacks && Array.isArray(info.router_settings.fallbacks) && info.router_settings.fallbacks.length > 0 && (
                            <div>备用方案：已配置{info.router_settings.fallbacks.length}个</div>
                          )}
                          {info.router_settings.enable_tag_filtering && (
                            <div>标签过滤：已启用</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-400">未配置路由设置</div>
                      )}
                    </div>
                    <div>
                      <Text className="font-medium">组织ID</Text>
                      <div>{info.organization_id}</div>
                    </div>
                    <div>
                      <Text className="font-medium">状态</Text>
                      <Badge color={info.blocked ? "red" : "green"}>{info.blocked ? "已封禁" : "活跃"}</Badge>
                    </div>

                    <ObjectPermissionsView
                      objectPermission={info.object_permission}
                      variant="inline"
                      className="pt-4 border-t border-gray-200"
                      accessToken={accessToken}
                    />

                    <GuardrailSettingsView
                      globalGuardrailNames={globalGuardrailNames}
                      teamGuardrails={Array.isArray(info.metadata?.guardrails) ? info.metadata.guardrails : []}
                      optedOutGlobalGuardrails={Array.isArray(info.metadata?.opted_out_global_guardrails) ? info.metadata.opted_out_global_guardrails : []}
                      killSwitchOn={initialKillSwitchOn}
                      variant="inline"
                      className="pt-4 border-t border-gray-200"
                    />

                    <LoggingSettingsView
                      loggingConfigs={info.metadata?.logging || []}
                      disabledCallbacks={[]}
                      variant="inline"
                      className="pt-4 border-t border-gray-200"
                    />

                    {info.metadata?.secret_manager_settings && (
                      <div className="pt-4 border-t border-gray-200">
                        <Text className="font-medium">Secret Manager Settings</Text>
                        <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(info.metadata.secret_manager_settings, null, 2)}
                        </pre>
                      </div>
                    )}

                  </div>
                )}
              </Card>
            ),
          },
        ].filter(tab => visibleTabs.includes(tab.key))}
      />

      <MemberModal
        visible={isEditMemberModalVisible}
        onCancel={() => setIsEditMemberModalVisible(false)}
        onSubmit={handleMemberUpdate}
        initialData={selectedEditMember}
        mode="edit"
        config={{
          title: "编辑成员",
          showEmail: true,
          showUserId: true,
          roleOptions: [
            { label: "管理员", value: "admin" },
            { label: "用户", value: "user" },
          ],
          additionalFields: [
            {
              name: "max_budget_in_team",
              label: (
                <span>
                  Team Member Budget (USD){" "}
                  <Tooltip title="此成员在此团队内最多可花费的美元金额。此限制独立于任何全局用户预算限制">
                    <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                  </Tooltip>
                </span>
              ),
              type: "numerical" as const,
              step: 0.01,
              min: 0,
              placeholder: "此成员在此团队中的预算限制",
            },
            {
              name: "tpm_limit",
              label: (
                <span>
                  Team Member TPM Limit{" "}
                  <Tooltip title="此成员在此团队内每分钟可使用的最大令牌数。此限制独立于任何全局用户TPM限制">
                    <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                  </Tooltip>
                </span>
              ),
              type: "numerical" as const,
              step: 1,
              min: 0,
              placeholder: "此成员在此团队中的每分钟令牌数限制",
            },
            {
              name: "rpm_limit",
              label: (
                <span>
                  Team Member RPM Limit{" "}
                  <Tooltip title="此成员在此团队内每分钟可发出的最大请求数。此限制独立于任何全局用户RPM限制">
                    <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                  </Tooltip>
                </span>
              ),
              type: "numerical" as const,
              step: 1,
              min: 0,
              placeholder: "此成员在此团队中的每分钟请求数限制",
            },
            {
              name: "allowed_models",
              label: (
                <span>
                  Allowed Models{" "}
                  <Tooltip title="此成员在此团队内可以访问的模型。留空则继承所有团队模型。">
                    <InfoCircleOutlined style={{ marginLeft: "4px" }} />
                  </Tooltip>
                </span>
              ),
              type: "multi-select" as const,
              options: (info.models || []).map((m: string) => ({ label: m, value: m })),
              placeholder: "留空以继承所有团队模型",
            },
          ],
        }}
      />

      <UserSearchModal
        isVisible={isAddMemberModalVisible}
        onCancel={() => setIsAddMemberModalVisible(false)}
        onSubmit={handleMemberCreate}
        accessToken={accessToken}
        teamId={teamId}
      />

      {/* Delete Member Confirmation Modal */}
      <DeleteResourceModal
        isOpen={isDeleteModalOpen}
        title="删除团队成员"
        alertMessage="移除团队成员也将删除由此成员创建或为其创建的所有密钥。"
        message="确定要从团队中移除此成员吗？此操作无法撤销。"
        resourceInformationTitle="团队成员信息"
        resourceInformation={[
          { label: "User ID", value: memberToDelete?.user_id, code: true },
          { label: "Email", value: memberToDelete?.user_email },
          { label: "Role", value: memberToDelete?.role },
        ]}
        onCancel={handleDeleteCancel}
        onOk={handleDeleteConfirm}
        confirmLoading={isDeleting}
      />
    </div>
  );
};

export default TeamInfoView;
