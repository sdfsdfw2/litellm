import React from "react";
import { Select } from "antd";

const { Option } = Select;

interface BudgetDurationDropdownProps {
  value?: string | null;
  onChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const BudgetDurationDropdown: React.FC<BudgetDurationDropdownProps> = ({
  value,
  onChange,
  className = "",
  style = {},
}) => {
  return (
    <Select
      style={{ width: "100%", ...style }}
      value={value || undefined}
      onChange={onChange}
      className={className}
      placeholder="无"
      allowClear
    >
      <Option value="1h">每小时</Option>
      <Option value="24h">每天</Option>
      <Option value="7d">每周</Option>
      <Option value="30d">每月</Option>
    </Select>
  );
};

export const getBudgetDurationLabel = (value: string | null | undefined): string => {
  if (!value) return "未设置";

  const budgetDurationMap: Record<string, string> = {
    "1h": "每小时",
    "24h": "每天",
    "7d": "每周",
    "30d": "每月",
  };

  return budgetDurationMap[value] || value;
};

export default BudgetDurationDropdown;
