import { formatBudgetReset } from "@/utils/budgetUtils";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Card, Col, Row, Space, Tag, Tooltip, Typography } from "antd";
import React from "react";
import { useMyTeamMember } from "./useMyTeamMember";

interface MyUserTabProps {
  teamId: string;
}

const labelWithTooltip = (label: string, tooltip: string) => (
  <Space size={4}>
    <Typography.Text type="secondary">{label}</Typography.Text>
    <Tooltip title={tooltip}>
      <InfoCircleOutlined style={{ color: "#8c8c8c" }} />
    </Tooltip>
  </Space>
);

const formatNumber = (value: number | null | undefined, digits = 4): string => {
  if (value === null || value === undefined) return "0";
  return formatNumberWithCommas(value, digits);
};

const formatRateLimit = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "无限制";
  return formatNumberWithCommas(value, 0);
};

export default function MyUserTab({ teamId }: MyUserTabProps) {
  const { data, isLoading, error } = useMyTeamMember(teamId);

  if (isLoading) {
    return (
      <Card>
        <Typography.Text type="secondary">正在加载您的成员信息…</Typography.Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Typography.Text type="danger">
          {error instanceof Error
            ? error.message
            : "无法加载此团队的成员信息。"}
        </Typography.Text>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <Typography.Text type="secondary">
          当前用户在此团队中没有成员信息。
        </Typography.Text>
      </Card>
    );
  }

  const budgetTable = data.litellm_budget_table ?? null;
  const maxBudget = budgetTable?.max_budget ?? null;
  const spend = data.spend ?? 0;
  const totalSpend = data.total_spend ?? 0;
  const tpmLimit = budgetTable?.tpm_limit ?? null;
  const rpmLimit = budgetTable?.rpm_limit ?? null;
  const budgetReset = formatBudgetReset(budgetTable?.budget_reset_at);
  const allowedModels = budgetTable?.allowed_models ?? null;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">用户</Typography.Text>
            <div style={{ marginTop: 4 }}>
              <Typography.Text strong>{data.user_email || data.user_id}</Typography.Text>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: "monospace" }}>
              {data.user_id}
            </Typography.Text>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">团队角色</Typography.Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={data.role === "admin" ? "blue" : "default"}>
                {data.role || "user"}
              </Tag>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card>
            {labelWithTooltip(
              "当前周期消费 (USD)",
              "当前预算周期的消费。当预算窗口滚动时会重置为 $0。",
            )}
            <div style={{ marginTop: 8 }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                ${formatNumber(spend, 4)}
              </Typography.Title>
              <Typography.Text type="secondary">
                共 {maxBudget === null ? "无限制" : `$${formatNumber(maxBudget, 4)}`}
              </Typography.Text>
            </div>
            {budgetReset && (
              <div style={{ marginTop: 4 }}>
                <Typography.Text type="secondary">重置于 {budgetReset}</Typography.Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card>
            {labelWithTooltip(
              "速率限制",
              "您在此团队中的个人速率限制。",
            )}
            <div style={{ marginTop: 8 }}>
              <Typography.Text>TPM: {formatRateLimit(tpmLimit)}</Typography.Text>
              <br />
              <Typography.Text>RPM: {formatRateLimit(rpmLimit)}</Typography.Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card>
            {labelWithTooltip(
              "总消费 (USD)",
              "在此团队内跨所有预算周期的累计消费。",
            )}
            <div style={{ marginTop: 8 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                ${formatNumber(totalSpend, 4)}
              </Typography.Title>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card>
            {labelWithTooltip(
              "模型范围",
              "您在此团队中可以访问的模型。",
            )}
            <div style={{ marginTop: 8 }}>
              {allowedModels && allowedModels.length > 0 ? (
                <Space wrap>
                  {allowedModels.map((m) => (
                    <Tag key={m}>{m}</Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text>所有团队模型</Typography.Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
