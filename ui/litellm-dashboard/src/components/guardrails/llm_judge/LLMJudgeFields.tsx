"use client";

import React from "react";
import { Form, Select, InputNumber, Input, Tooltip } from "antd";
import { PlusOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { Button } from "antd";

interface LLMJudgeFieldsProps {
  availableModels: string[];
  form: any;
}

const LLMJudgeFields: React.FC<LLMJudgeFieldsProps> = ({ availableModels, form }) => {
  return (
    <>
      <div
        style={{
          background: "#f6ffed",
          border: "1px solid #b7eb8f",
          borderRadius: 6,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
          color: "#389e0d",
        }}
      >
        每次 LLM 响应后，<strong>评判模型</strong>会根据您的标准对其打分（0–100）。
        如果加权平均值低于阈值，该响应将被拦截（或记录）。
      </div>

      <Form.Item
        name="judge_model"
        label={
          <span>
            评判模型&nbsp;
            <Tooltip title="阅读每条响应并为其评分的 LLM。请选择一个能力较强的模型——它除了 LLM 返回的内容外，不会看到任何终端用户数据。">
              <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
            </Tooltip>
          </span>
        }
        rules={[{ required: true, message: "请选择评判模型" }]}
      >
        <Select
          showSearch
          placeholder="选择模型"
          options={availableModels.map((m) => ({ label: m, value: m }))}
        />
      </Form.Item>

      <Form.Item
        name="overall_threshold"
        label={
          <span>
            最低通过分数&nbsp;
            <Tooltip title="0–100。如果标准的加权平均分数低于此值，防护栏将被触发。80 是一个不错的默认值。">
              <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
            </Tooltip>
          </span>
        }
        initialValue={80}
      >
        <InputNumber min={0} max={100} addonAfter="/ 100" style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item
        name="on_failure"
        label={
          <span>
            失败时处理&nbsp;
            <Tooltip title="拦截：分数过低时返回 HTTP 422。记录：记录结果但允许响应通过。">
              <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
            </Tooltip>
          </span>
        }
        initialValue="block"
      >
        <Select>
          <Select.Option value="block">拦截（返回 422）</Select.Option>
          <Select.Option value="log">仅记录</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={
          <span>
            评估标准&nbsp;
            <Tooltip title="每条标准都是评判模型检查的内容。权重之和必须为 100%。">
              <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
            </Tooltip>
          </span>
        }
      >
        <Form.List name="criteria" initialValue={[{ name: "", weight: 100, description: "" }]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <div
                  key={key}
                  style={{
                    border: "1px solid #f0f0f0",
                    borderRadius: 6,
                    padding: "12px 12px 0",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <Form.Item
                      {...restField}
                      name={[name, "name"]}
                      rules={[{ required: true, message: "请输入标准名称" }]}
                      style={{ flex: 2, marginBottom: 8 }}
                    >
                      <Input placeholder="标准名称（例如：策略准确性）" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "weight"]}
                      label={
                        <Tooltip title="此标准在最终得分中所占的权重。所有权重之和必须为 100%。">
                          <span style={{ fontSize: 12, color: "#595959" }}>
                            权重 <QuestionCircleOutlined style={{ color: "#bfbfbf" }} />
                          </span>
                        </Tooltip>
                      }
                      rules={[{ required: true, message: "请输入权重" }]}
                      style={{ flex: 1, marginBottom: 8 }}
                    >
                      <InputNumber
                        min={0}
                        max={100}
                        addonAfter="%"
                        style={{ width: "100%" }}
                        placeholder="例如：50"
                      />
                    </Form.Item>
                    <div style={{ marginBottom: 8 }}>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => remove(name)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                  <Form.Item
                    {...restField}
                    name={[name, "description"]}
                    rules={[{ required: true, message: "请描述检查内容" }]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input placeholder="评判模型应检查此标准的哪些内容？" />
                  </Form.Item>
                </div>
              ))}
              <Button
                type="dashed"
                block
                style={{ marginTop: 4 }}
                onClick={() => add({ name: "", weight: 0, description: "" })}
                icon={<PlusOutlined />}
              >
                添加标准
              </Button>
              {fields.length > 0 && (
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const allCriteria: any[] = form.getFieldValue("criteria") || [];
                    const weightTotal = allCriteria.reduce(
                      (sum: number, c: any) => sum + (Number(c?.weight) || 0),
                      0,
                    );
                    const weightOk = weightTotal === 100;
                    return (
                      <div style={{ marginTop: 6, fontSize: 12, color: weightOk ? "#52c41a" : "#faad14" }}>
                        权重总计：{weightTotal}%{weightOk ? " ✓" : " — 必须合计为 100%"}
                      </div>
                    );
                  }}
                </Form.Item>
              )}
            </>
          )}
        </Form.List>
      </Form.Item>
    </>
  );
};

export default LLMJudgeFields;
