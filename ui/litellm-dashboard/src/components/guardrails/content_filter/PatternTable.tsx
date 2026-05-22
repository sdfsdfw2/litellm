import React from "react";
import { Typography, Select, Table, Tag, Button } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { Option } = Select;

interface Pattern {
  id: string;
  type: "prebuilt" | "custom";
  name: string;
  display_name?: string;
  pattern?: string;
  action: "BLOCK" | "MASK";
}

interface PatternTableProps {
  patterns: Pattern[];
  onActionChange: (id: string, action: "BLOCK" | "MASK") => void;
  onRemove: (id: string) => void;
}

const PatternTable: React.FC<PatternTableProps> = ({
  patterns,
  onActionChange,
  onRemove,
}) => {
  const columns = [
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => (
        <Tag color={type === "prebuilt" ? "blue" : "green"}>
          {type === "prebuilt" ? "预置" : "自定义"}
        </Tag>
      ),
    },
    {
      title: "模式名称",
      dataIndex: "name",
      key: "name",
      render: (_: string, record: Pattern) => record.display_name || record.name,
    },
    {
      title: "正则表达式",
      dataIndex: "pattern",
      key: "pattern",
      render: (pattern: string) => (pattern ? <Text code style={{ fontSize: 12 }}>{pattern.substring(0, 40)}...</Text> : "-"),
    },
    {
      title: "操作",
      dataIndex: "action",
      key: "action",
      width: 150,
      render: (action: string, record: Pattern) => (
        <Select
          value={action}
          onChange={(value) => onActionChange(record.id, value as "BLOCK" | "MASK")}
          style={{ width: 120 }}
          size="small"
        >
          <Option value="BLOCK">拦截</Option>
          <Option value="MASK">遮盖</Option>
        </Select>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_: any, record: Pattern) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => onRemove(record.id)}
        >
          删除
        </Button>
      ),
    },
  ];

  if (patterns.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
        未添加模式。
      </div>
    );
  }

  return (
    <Table
      dataSource={patterns}
      columns={columns}
      rowKey="id"
      pagination={false}
      size="small"
    />
  );
};

export default PatternTable;

