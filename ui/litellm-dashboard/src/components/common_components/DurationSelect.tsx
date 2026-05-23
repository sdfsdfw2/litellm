import { Select } from "antd";

interface DurationSelectProps {
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function DurationSelect({ className, value, onChange }: DurationSelectProps) {
  return (
    <Select className={className} value={value} onChange={onChange}>
      <Select.Option value="24h">每天</Select.Option>
      <Select.Option value="7d">每周</Select.Option>
      <Select.Option value="30d">每月</Select.Option>
    </Select>
  );
}
