import React from "react";
import { Typography, Select, Modal, Space, Button, Input } from "antd";

const { Text } = Typography;
const { Option } = Select;

interface CustomPatternModalProps {
  visible: boolean;
  patternName: string;
  patternRegex: string;
  patternAction: "BLOCK" | "MASK";
  onNameChange: (name: string) => void;
  onRegexChange: (regex: string) => void;
  onActionChange: (action: "BLOCK" | "MASK") => void;
  onAdd: () => void;
  onCancel: () => void;
}

const CustomPatternModal: React.FC<CustomPatternModalProps> = ({
  visible,
  patternName,
  patternRegex,
  patternAction,
  onNameChange,
  onRegexChange,
  onActionChange,
  onAdd,
  onCancel,
}) => {
  return (
    <Modal
      title="添加自定义正则表达式模式"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <div>
          <Text strong>模式名称</Text>
          <Input
            placeholder="例如：internal_id, employee_code"
            value={patternName}
            onChange={(e) => onNameChange(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <div>
          <Text strong>正则表达式</Text>
          <Input
            placeholder="例如：ID-[0-9]{6}"
            value={patternRegex}
            onChange={(e) => onRegexChange(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            输入有效正则表达式以匹配敏感数据
          </Text>
        </div>

        <div>
          <Text strong>操作</Text>
          <Text type="secondary" style={{ display: "block", marginTop: 4, marginBottom: 8 }}>
            选择检测到该模式时防护栏应采取的操作
          </Text>
          <Select
            value={patternAction}
            onChange={onActionChange}
            style={{ width: "100%" }}
          >
            <Option value="BLOCK">拦截</Option>
            <Option value="MASK">遮盖</Option>
          </Select>
        </div>
      </Space>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
        <Button onClick={onCancel}>
          取消
        </Button>
        <Button type="primary" onClick={onAdd}>
          添加
        </Button>
      </div>
    </Modal>
  );
};

export default CustomPatternModal;

