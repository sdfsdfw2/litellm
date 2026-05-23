import { useUISettings } from "@/app/(dashboard)/hooks/uiSettings/useUISettings";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { Member } from "@/components/networking";
import { formatBudgetReset } from "@/utils/budgetUtils";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { isProxyAdminRole, isUserTeamAdminForSingleTeam } from "@/utils/roles";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Space, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import MemberTable from "@/components/common_components/MemberTable";
import { TeamData } from "./TeamInfo";

interface TeamMemberTabProps {
  teamData: TeamData;
  canEditTeam: boolean;
  handleMemberDelete: (member: Member) => void;
  setSelectedEditMember: (member: Member) => void;
  setIsEditMemberModalVisible: (visible: boolean) => void;
  setIsAddMemberModalVisible: (visible: boolean) => void;
}

export default function TeamMemberTab({
  teamData,
  canEditTeam,
  handleMemberDelete,
  setSelectedEditMember,
  setIsEditMemberModalVisible,
  setIsAddMemberModalVisible,
}: TeamMemberTabProps) {
  const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined) return "0";

    if (typeof value === "number") {
      // Convert scientific notation to normal decimal
      const normalNumber = Number(value);

      // If it's a whole number, return it without decimals
      if (normalNumber === Math.floor(normalNumber)) {
        return normalNumber.toString();
      }

      // For decimal numbers, use toFixed and remove trailing zeros
      return formatNumberWithCommas(normalNumber, 8).replace(/\.?0+$/, "");
    }

    return "0";
  };

  const getUserCurrentCycleSpend = (userId: string | null): number => {
    if (!userId) return 0;
    const membership = teamData.team_memberships.find((tm) => tm.user_id === userId);
    return membership?.spend ?? 0;
  };

  const getUserTotalSpend = (userId: string | null): number => {
    if (!userId) return 0;
    const membership = teamData.team_memberships.find((tm) => tm.user_id === userId);
    return membership?.total_spend ?? 0;
  };

  const getUserBudget = (userId: string | null): string | null => {
    if (!userId) return null;
    const membership = teamData.team_memberships.find((tm) => tm.user_id === userId);
    const maxBudget = membership?.litellm_budget_table?.max_budget;
    if (maxBudget === null || maxBudget === undefined) {
      return null;
    }
    return formatNumber(maxBudget);
  };

  // Helper function to get rate limits for a user
  const getUserRateLimits = (userId: string | null): string => {
    if (!userId) return "无限制";
    const membership = teamData.team_memberships.find((tm) => tm.user_id === userId);
    const rpmLimit = membership?.litellm_budget_table?.rpm_limit;
    const tpmLimit = membership?.litellm_budget_table?.tpm_limit;

    const rpmText = rpmLimit ? `${formatNumber(rpmLimit)} RPM` : null;
    const tpmText = tpmLimit ? `${formatNumber(tpmLimit)} TPM` : null;

    const limits = [rpmText, tpmText].filter(Boolean);
    return limits.length > 0 ? limits.join(" / ") : "无限制";
  };

  const { data: uiSettingsData } = useUISettings();
  const { userId, userRole } = useAuthorized();
  const disableTeamAdminDeleteTeamUser = Boolean(uiSettingsData?.values?.disable_team_admin_delete_team_user);
  const isUserTeamAdmin = isUserTeamAdminForSingleTeam(teamData.team_info.members_with_roles, userId || "");
  const isProxyAdmin = isProxyAdminRole(userRole || "");

  const getUserAllowedModels = (userId: string | null): string[] | null => {
    if (!userId) return null;
    const membership = teamData.team_memberships.find((tm) => tm.user_id === userId);
    const models = membership?.litellm_budget_table?.allowed_models;
    return models && models.length > 0 ? models : null;
  };

  const getUserBudgetReset = (userId: string | null): string | null => {
    if (!userId) return null;
    const membership = teamData.team_memberships.find((tm) => tm.user_id === userId);
    return formatBudgetReset(membership?.litellm_budget_table?.budget_reset_at);
  };

  const extraColumns: ColumnsType<Member> = [
    {
      title: (
        <Space direction="horizontal">
          模型范围
          <Tooltip title="此成员可以访问的模型。留空表示继承所有团队模型。">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      key: "model_scope",
      render: (_: unknown, record: Member) => {
        const models = getUserAllowedModels(record.user_id);
        if (!models) {
          return <Typography.Text type="secondary">（所有团队模型）</Typography.Text>;
        }
        const displayed = models.slice(0, 2);
        const remaining = models.length - displayed.length;
        return (
          <Space wrap>
            {displayed.map((m) => (
              <Typography.Text key={m} code style={{ fontSize: "12px" }}>{m}</Typography.Text>
            ))}
            {remaining > 0 && (
              <Tooltip title={models.slice(2).join(", ")}>
                <Typography.Text type="secondary">+{remaining} 更多</Typography.Text>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: (
        <Space direction="horizontal">
          当前周期消费 (USD)
          <Tooltip title="当前预算周期的消费。当成员的预算窗口滚动时会重置为 $0。这是检查成员预算时使用的值。">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      key: "spend",
      render: (_: unknown, record: Member) => (
        <Typography.Text>${formatNumberWithCommas(getUserCurrentCycleSpend(record.user_id), 4)}</Typography.Text>
      ),
    },
    {
      title: (
        <Space direction="horizontal">
          总消费 (USD)
          <Tooltip title="此成员在此团队内跨所有预算周期的累计消费。跟踪从 2026-04-21 开始；该日期之前的消费不包含在内。">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      key: "total_spend",
      render: (_: unknown, record: Member) => (
        <Typography.Text>${formatNumberWithCommas(getUserTotalSpend(record.user_id), 4)}</Typography.Text>
      ),
    },
    {
      title: "成员预算 (USD)",
      key: "budget",
      render: (_: unknown, record: Member) => {
        const budget = getUserBudget(record.user_id);
        return (
          <Typography.Text>
            {budget ? `$${formatNumberWithCommas(Number(budget), 4)}` : "无限制"}
          </Typography.Text>
        );
      },
    },
    {
      title: "预算重置",
      key: "budget_reset",
      render: (_: unknown, record: Member) => {
        const reset = getUserBudgetReset(record.user_id);
        return reset ? (
          <Typography.Text>{reset}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        );
      },
    },
    {
      title: (
        <Space direction="horizontal">
          成员速率限制
          <Tooltip title="此成员在此团队内的速率限制。">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      key: "rate_limits",
      render: (_: unknown, record: Member) => (
        <Typography.Text>{getUserRateLimits(record.user_id)}</Typography.Text>
      ),
    },
  ];

  return (
    <MemberTable
      members={teamData.team_info.members_with_roles}
      canEdit={canEditTeam}
      onEdit={(record) => {
        const membership = teamData.team_memberships.find(
          (tm) => tm.user_id === record.user_id
        );
        const enhancedMember = {
          ...record,
          max_budget_in_team: membership?.litellm_budget_table?.max_budget || null,
          tpm_limit: membership?.litellm_budget_table?.tpm_limit || null,
          rpm_limit: membership?.litellm_budget_table?.rpm_limit || null,
          allowed_models: membership?.litellm_budget_table?.allowed_models || [],
        };
        setSelectedEditMember(enhancedMember);
        setIsEditMemberModalVisible(true);
      }}
      onDelete={handleMemberDelete}
      onAddMember={() => setIsAddMemberModalVisible(true)}
      roleColumnTitle="团队角色"
      roleTooltip="此角色仅适用于此团队，与用户的代理级别角色无关。"
      extraColumns={extraColumns}
      showDeleteForMember={() =>
        isProxyAdmin || (canEditTeam && !isUserTeamAdmin) || (isUserTeamAdmin && !disableTeamAdminDeleteTeamUser)
      }
    />
  );
}
