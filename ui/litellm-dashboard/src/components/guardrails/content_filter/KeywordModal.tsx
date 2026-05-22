import React from "react";
import { Typography, Select, Modal, Space, Button, Input } from "antd";

const { Text } = Typography;
const { Option } = Select;

interface KeywordModalProps {
  visible: boolean;
  keyword: string;
  action: "BLOCK" | "MASK";
  description: string;
  onKeywordChange: (keyword: string) => void;
  onActionChange: (action: "BLOCK" | "MASK") => void;
  onDescriptionChange: (description: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

const KeywordModal: React.FC<KeywordModalProps> = ({
  visible,
  keyword,
  action,
  description,
  onKeywordChange,
  onActionChange,
  onDescriptionChange,
  onAdd,
  onCancel,
}) => {
  return (
    <Modal
      title="添加拦截的关键词"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <div>
          <Text strong>关键词</Text>
          <Input
            placeholder="输入敏感关键词或短语"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <div>
          <Text strong>操作</Text>
          <Text type="secondary" style={{ display: "block", marginTop: 4, marginBottom: 8 }}>
            选择检测到该关键词时防护栏应采取的操作
          </Text>
          <Select
            value={action}
            onChange={onActionChange}
            style={{ width: "100%" }}
          >
            <Option value="BLOCK">拦截</Option>
            <Option value="MASK">遮盖</Option>
          </Select>
        </div>

        <div>
          <Text strong>描述（可选）</Text>
          <Input.TextArea
            placeholder="说明此关键词为何敏感"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            style={{ marginTop: 8 }}
          />
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

export default KeywordModal;

