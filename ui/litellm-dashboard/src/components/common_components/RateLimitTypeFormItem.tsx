import React from "react";
import { Form, Select, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

const { Option } = Select;

interface RateLimitTypeFormItemProps {
  /** The type of rate limit - either 'tpm' or 'rpm' */
  type: "tpm" | "rpm";
  /** The form field name */
  name: string;
  /** Whether to show detailed descriptions (default: true) */
  showDetailedDescriptions?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Initial value for the field */
  initialValue?: string | null;
  /** Form instance for setting field values */
  form?: any;
  /** Custom onChange handler */
  onChange?: (value: string) => void;
}

export const RateLimitTypeFormItem: React.FC<RateLimitTypeFormItemProps> = ({
  type,
  name,
  showDetailedDescriptions = true,
  className = "",
  initialValue = null,
  form,
  onChange,
}) => {
  const limitTypeUpper = type.toUpperCase();
  const limitTypeLower = type.toLowerCase();

  const handleChange = (value: string) => {
    if (form) {
      form.setFieldValue(name, value);
    }
    if (onChange) {
      onChange(value);
    }
  };

  const tooltipTitle = `选择 'guaranteed_throughput' 以防止在密钥属于具有特定 ${limitTypeUpper} 限制的团队时超额分配 ${limitTypeUpper} 限制。`;

  return (
    <Form.Item
      label={
        <span>
          {limitTypeUpper} Rate Limit Type{" "}
          <Tooltip title={tooltipTitle}>
            <InfoCircleOutlined style={{ marginLeft: "4px" }} />
          </Tooltip>
        </span>
      }
      name={name}
      initialValue={initialValue}
      className={className}
    >
      <Select
        defaultValue={showDetailedDescriptions ? "default" : undefined}
        placeholder="选择速率限制类型"
        style={{ width: "100%" }}
        optionLabelProp={showDetailedDescriptions ? "label" : undefined}
        onChange={handleChange}
      >
        {showDetailedDescriptions ? (
          <>
            <Option value="best_effort_throughput" label="默认">
              <div style={{ padding: "4px 0" }}>
                <div style={{ fontWeight: 500 }}>默认</div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  尽力而为的吞吐量 - 如果超额分配 {limitTypeLower} 不会报错（团队/密钥限制在运行时检查）。
                </div>
              </div>
            </Option>
            <Option value="guaranteed_throughput" label="保证吞吐量">
              <div style={{ padding: "4px 0" }}>
                <div style={{ fontWeight: 500 }}>保证吞吐量</div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  保证吞吐量 - 如果超额分配 {limitTypeLower} 会报错（还会检查模型特定限制）。
                </div>
              </div>
            </Option>
            <Option value="dynamic" label="动态">
              <div style={{ padding: "4px 0" }}>
                <div style={{ fontWeight: 500 }}>动态</div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  如果密钥设置了 {limitTypeUpper}（例如 2 {limitTypeUpper}）且没有 429 错误，则可以在调用的模型未出错时动态超出限制。
                </div>
              </div>
            </Option>
          </>
        ) : (
          <>
            <Option value="best_effort_throughput">尽力而为的吞吐量</Option>
            <Option value="guaranteed_throughput">保证吞吐量</Option>
            <Option value="dynamic">动态</Option>
          </>
        )}
      </Select>
    </Form.Item>
  );
};

export default RateLimitTypeFormItem;
