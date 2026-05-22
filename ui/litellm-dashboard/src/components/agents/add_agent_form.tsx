import React, { useState, useEffect } from "react";
import { Modal, Form, Select, Input, Steps, Radio, Tag, Divider, Switch, InputNumber, Collapse } from "antd";
import MessageManager from "@/components/molecules/message_manager";
import { Button } from "@tremor/react";
import { CheckCircleFilled, KeyOutlined, RobotOutlined, AppstoreOutlined, InfoCircleOutlined } from "@ant-design/icons";
import CreatedKeyDisplay from "../shared/CreatedKeyDisplay";
import {
  createAgentCall,
  getAgentCreateMetadata,
  getAgentsList,
  keyCreateForAgentCall,
  keyListCall,
  keyUpdateCall,
  modelAvailableCall,
  AgentCreateInfo,
} from "../networking";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { getModelDisplayName } from "../key_team_helpers/fetch_available_models_team_key";
import { Team } from "../key_team_helpers/key_list";
import TeamDropdown from "../common_components/team_dropdown";
import AgentFormFields from "./agent_form_fields";
import DynamicAgentFormFields, { buildDynamicAgentData } from "./dynamic_agent_form_fields";
import { getDefaultFormValues, buildAgentDataFromForm } from "./agent_config";
import MCPServerSelector from "../mcp_server_management/MCPServerSelector";
import MCPToolPermissions from "../mcp_server_management/MCPToolPermissions";
import GuardrailSelector from "../guardrails/GuardrailSelector";

const { Step } = Steps;

const CUSTOM_AGENT_TYPE = "custom";

interface AddAgentFormProps {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  onSuccess: () => void;
  teams?: Team[] | null;
}

const AddAgentForm: React.FC<AddAgentFormProps> = ({
  visible,
  onClose,
  accessToken,
  onSuccess,
  teams,
}) => {
  const { userId, userRole } = useAuthorized();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentType, setAgentType] = useState<string>("a2a");
  const [agentTypeMetadata, setAgentTypeMetadata] = useState<AgentCreateInfo[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Step 3: key assignment state
  const [keyAssignOption, setKeyAssignOption] = useState<"create_new" | "existing_key" | "skip">("create_new");
  const [newKeyName, setNewKeyName] = useState<string>("");
  const [newKeyModels, setNewKeyModels] = useState<string[]>([]);
  const [existingKeys, setExistingKeys] = useState<any[]>([]);
  const [selectedExistingKey, setSelectedExistingKey] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<{agent_id: string; agent_name: string}[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Step 4: results
  const [createdAgentName, setCreatedAgentName] = useState<string>("");
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [assignedKeyAlias, setAssignedKeyAlias] = useState<string | null>(null);

  // Tracing & guardrails state
  const [requireTraceIdInbound, setRequireTraceIdInbound] = useState(false);
  const [requireTraceIdOutbound, setRequireTraceIdOutbound] = useState(false);
  const [maxIterations, setMaxIterations] = useState<number | null>(null);
  const [maxBudgetPerSession, setMaxBudgetPerSession] = useState<number | null>(null);

  // Fetch agent type metadata on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      setLoadingMetadata(true);
      try {
        const metadata = await getAgentCreateMetadata();
        setAgentTypeMetadata(metadata);
      } catch (error) {
        console.error("Error fetching agent metadata:", error);
      } finally {
        setLoadingMetadata(false);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch existing keys when Agent Management step becomes active (step 3)
  useEffect(() => {
    if (currentStep === 3 && accessToken && existingKeys.length === 0) {
      const fetchKeys = async () => {
        setLoadingKeys(true);
        try {
          const result = await keyListCall(accessToken, null, null, null, null, null, 1, 100);
          setExistingKeys(result?.keys || []);
        } catch (error) {
          console.error("Error fetching keys:", error);
        } finally {
          setLoadingKeys(false);
        }
      };
      fetchKeys();
    }
  }, [currentStep, accessToken]);

  // Fetch available models when Agent Management step is active (same list as key generation)
  useEffect(() => {
    if ((currentStep !== 1 && currentStep !== 3) || !accessToken || !userId || !userRole) return;
    let cancelled = false;
    setLoadingModels(true);
    modelAvailableCall(accessToken, userId, userRole)
      .then((response) => {
        if (cancelled) return;
        const modelsArray = response?.data ?? (Array.isArray(response) ? response : []);
        const ids = modelsArray
          .map((m: { id?: string; model_name?: string }) => m.id ?? m.model_name)
          .filter(Boolean) as string[];
        setAvailableModels(ids);
      })
      .catch((error) => {
        if (!cancelled) console.error("Error fetching models:", error);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentStep, accessToken, userId, userRole]);

  useEffect(() => {
    if (currentStep !== 1 || !accessToken) return;
    let cancelled = false;
    setLoadingAgents(true);
    getAgentsList(accessToken)
      .then((response) => {
        if (cancelled) return;
        const agents = response?.agents ?? [];
        setAvailableAgents(agents.map((a: any) => ({ agent_id: a.agent_id, agent_name: a.agent_name })));
      })
      .catch((error) => {
        if (!cancelled) console.error("Error fetching agents:", error);
      })
      .finally(() => {
        if (!cancelled) setLoadingAgents(false);
      });
    return () => { cancelled = true; };
  }, [currentStep, accessToken]);

  const selectedAgentTypeInfo = agentTypeMetadata.find(
    (info) => info.agent_type === agentType
  );

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(["agent_name"]);
        const agentName = form.getFieldValue("agent_name");
        if (agentName && !newKeyName) {
          setNewKeyName(`${agentName}-key`);
        }
      }
      setCurrentStep((s) => s + 1);
    } catch {
      // validation failed — stay on current step
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const buildAgentData = (values: any) => {
    if (agentType === CUSTOM_AGENT_TYPE) {
      return {
        agent_name: values.agent_name,
        agent_card_params: {
          protocolVersion: "1.0",
          name: values.agent_name,
          description: values.description || "",
          url: "",
          version: "1.0.0",
          defaultInputModes: ["text"],
          defaultOutputModes: ["text"],
          capabilities: { streaming: false },
          skills: [],
        },
      };
    } else if (agentType === "a2a") {
      return buildAgentDataFromForm(values);
    } else if (selectedAgentTypeInfo?.use_a2a_form_fields) {
      const agentData = buildAgentDataFromForm(values);
      if (selectedAgentTypeInfo.litellm_params_template) {
        agentData.litellm_params = {
          ...agentData.litellm_params,
          ...selectedAgentTypeInfo.litellm_params_template,
        };
      }
      for (const field of selectedAgentTypeInfo.credential_fields) {
        const value = values[field.key];
        if (value && field.include_in_litellm_params !== false) {
          agentData.litellm_params[field.key] = value;
        }
      }
      return agentData;
    } else if (selectedAgentTypeInfo) {
      return buildDynamicAgentData(values, selectedAgentTypeInfo);
    }
    return null;
  };

  const handleCreateAgent = async () => {
    if (!accessToken) {
      MessageManager.error("没有可用的访问令牌");
      return;
    }

    setIsSubmitting(true);
    try {
      await form.validateFields();
      const values = { ...form.getFieldsValue(true) };
      const agentData = buildAgentData(values);
      if (!agentData) {
        MessageManager.error("构建代理数据失败");
        setIsSubmitting(false);
        return;
      }

      // Build object_permission from MCP Tools step (allowed_mcp_servers_and_groups, mcp_tool_permissions)
      const mcpServersAndGroups = values.allowed_mcp_servers_and_groups;
      const mcpToolPermissions = values.mcp_tool_permissions || {};
      const entitlementModels = values.entitlement_models || [];
      const entitlementAgents = values.entitlement_agents || [];
      const hasObjectPermission =
        (mcpServersAndGroups?.servers?.length > 0 || mcpServersAndGroups?.accessGroups?.length > 0) ||
        Object.keys(mcpToolPermissions).length > 0 ||
        entitlementModels.length > 0 ||
        entitlementAgents.length > 0;
      if (hasObjectPermission) {
        agentData.object_permission = {};
        if (mcpServersAndGroups?.servers?.length > 0) {
          agentData.object_permission.mcp_servers = mcpServersAndGroups.servers;
        }
        if (mcpServersAndGroups?.accessGroups?.length > 0) {
          agentData.object_permission.mcp_access_groups = mcpServersAndGroups.accessGroups;
        }
        if (Object.keys(mcpToolPermissions).length > 0) {
          agentData.object_permission.mcp_tool_permissions = mcpToolPermissions;
        }
        if (entitlementModels.length > 0) {
          agentData.object_permission.models = entitlementModels;
        }
        if (entitlementAgents.length > 0) {
          agentData.object_permission.agents = entitlementAgents;
        }
      }

      // Wire trace-id flags and budget controls into agent litellm_params (before create call)
      if (requireTraceIdInbound || requireTraceIdOutbound) {
        if (!agentData.litellm_params) agentData.litellm_params = {};
        if (requireTraceIdInbound) {
          agentData.litellm_params.require_trace_id_on_calls_to_agent = true;
        }
        if (requireTraceIdOutbound) {
          agentData.litellm_params.require_trace_id_on_calls_by_agent = true;
          if (maxIterations) agentData.litellm_params.max_iterations = maxIterations;
          if (maxBudgetPerSession) agentData.litellm_params.max_budget_per_session = maxBudgetPerSession;
        }
      }

      const selectedGuardrails = values.guardrails || [];
      if (selectedGuardrails.length > 0) {
        if (!agentData.litellm_params) agentData.litellm_params = {};
        agentData.litellm_params.guardrails = selectedGuardrails;
      }

      const selectedTeamId = values.team_id || null;
      if (selectedTeamId) {
        agentData.team_id = selectedTeamId;
      }

      const agentResponse = await createAgentCall(accessToken, agentData);
      const agentId: string = agentResponse.agent_id;
      const agentName: string = agentResponse.agent_name || values.agent_name || agentId;
      setCreatedAgentName(agentName);

      if (keyAssignOption === "create_new" && newKeyName) {
        const keyResponse = await keyCreateForAgentCall(
          accessToken,
          agentId,
          newKeyName,
          newKeyModels,
          undefined,
          selectedTeamId,
        );
        setCreatedKeyValue(keyResponse.key || null);
      } else if (keyAssignOption === "existing_key") {
        if (!selectedExistingKey) {
          MessageManager.error("请选择要分配的现有密钥");
          setIsSubmitting(false);
          return;
        }
        await keyUpdateCall(accessToken, {
          key: selectedExistingKey,
          agent_id: agentId,
        });
        const keyInfo = existingKeys.find((k) => k.token === selectedExistingKey);
        setAssignedKeyAlias(keyInfo?.key_alias || selectedExistingKey.slice(0, 12) + "…");
      }

      setCurrentStep(4);
      onSuccess();
    } catch (error) {
      console.error("Error creating agent:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      MessageManager.error(errorMessage ? `创建代理失败：${errorMessage}` : "创建代理失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setAgentType("a2a");
    setCurrentStep(0);
    setKeyAssignOption("create_new");
    setNewKeyName("");
    setNewKeyModels([]);
    setSelectedExistingKey(null);
    setCreatedAgentName("");
    setCreatedKeyValue(null);
    setAssignedKeyAlias(null);
    setRequireTraceIdInbound(false);
    setRequireTraceIdOutbound(false);
    setMaxIterations(null);
    setMaxBudgetPerSession(null);
    onClose();
  };

  const renderEntitlementsStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        配置此代理允许使用的模型、代理和 MCP 工具。留空表示允许全部（受密钥/团队权限限制）。
      </p>

      <Form.Item
        label={<span className="text-sm font-medium text-gray-700">允许的模型</span>}
        name="entitlement_models"
        tooltip="限制此代理可以调用的模型。留空表示允许全部。"
      >
        <Select
          mode="tags"
          style={{ width: "100%" }}
          placeholder={loadingModels ? "正在加载模型..." : "选择模型（留空表示允许全部）"}
          tokenSeparators={[","]}
          loading={loadingModels}
          showSearch
          options={availableModels.map((m) => ({
            label: getModelDisplayName(m),
            value: m,
          }))}
        />
      </Form.Item>

      <Form.Item
        label={<span className="text-sm font-medium text-gray-700">允许的代理（子代理）</span>}
        name="entitlement_agents"
        tooltip="限制此代理可以作为子代理调用的其他代理。留空表示允许全部。"
      >
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder={loadingAgents ? "正在加载代理..." : "选择代理（留空表示允许全部）"}
          loading={loadingAgents}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={availableAgents.map((a) => ({
            label: a.agent_name,
            value: a.agent_id,
          }))}
        />
      </Form.Item>

      <Divider className="my-2" />

      <Form.Item
        label={
          <span>
            允许的 MCP 服务器{" "}
            <InfoCircleOutlined title="选择此代理可以访问的 MCP 服务器或访问组" style={{ marginLeft: "4px" }} />
          </span>
        }
        name="allowed_mcp_servers_and_groups"
        initialValue={{ servers: [], accessGroups: [] }}
      >
        <MCPServerSelector
          onChange={(val: { servers?: string[]; accessGroups?: string[] }) =>
            form.setFieldValue("allowed_mcp_servers_and_groups", val)
          }
          value={form.getFieldValue("allowed_mcp_servers_and_groups") || { servers: [], accessGroups: [] }}
          accessToken={accessToken ?? ""}
          placeholder="选择 MCP 服务器或访问组（可选）"
        />
      </Form.Item>
      <Form.Item name="mcp_tool_permissions" initialValue={{}} hidden>
        <Input type="hidden" />
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prev, curr) =>
          prev.allowed_mcp_servers_and_groups !== curr.allowed_mcp_servers_and_groups ||
          prev.mcp_tool_permissions !== curr.mcp_tool_permissions
        }
      >
        {() => (
          <div className="mt-4">
            <MCPToolPermissions
              accessToken={accessToken ?? ""}
              selectedServers={form.getFieldValue("allowed_mcp_servers_and_groups")?.servers ?? []}
              toolPermissions={form.getFieldValue("mcp_tool_permissions") ?? {}}
              onChange={(toolPerms: Record<string, string[]>) => form.setFieldsValue({ mcp_tool_permissions: toolPerms })}
            />
          </div>
        )}
      </Form.Item>
    </div>
  );

  const renderObservabilityStep = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">追踪</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">
                对此代理的调用要求 x-litellm-trace-id
              </span>
              <p className="text-xs text-gray-500 mt-1">
                仅接受带有 trace-id 的代理调用（例如用作子代理时）。
              </p>
            </div>
            <Switch
              checked={requireTraceIdInbound}
              onChange={setRequireTraceIdInbound}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">
                此代理发出的调用要求 x-litellm-trace-id
              </span>
              <p className="text-xs text-gray-500 mt-1">
                要求此代理发出的 LLM/MCP 调用包含 x-litellm-trace-id 以进行会话跟踪。
              </p>
            </div>
            <Switch
              checked={requireTraceIdOutbound}
              onChange={(checked) => {
                setRequireTraceIdOutbound(checked);
                if (!checked) {
                  setMaxIterations(null);
                  setMaxBudgetPerSession(null);
                }
              }}
            />
          </div>
        </div>
      </div>

      <Divider className="my-0" />

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">预算与速率限制</h4>
        <div className="space-y-4">
          {!requireTraceIdOutbound && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              请在追踪中启用&quot;此代理发出的调用要求 x-litellm-trace-id&quot;以配置预算和速率限制。
            </div>
          )}

          <div className="text-sm font-medium text-gray-700">会话预算</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">最大迭代次数</label>
              <InputNumber
                className="w-full"
                min={1}
                placeholder="例如：25"
                disabled={!requireTraceIdOutbound}
                value={maxIterations}
                onChange={(val) => setMaxIterations(val)}
              />
              <p className="text-xs text-gray-400 mt-1">每个会话 LLM 调用的硬性上限</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">每会话最大预算（$）</label>
              <InputNumber
                className="w-full"
                min={0.01}
                step={0.5}
                placeholder="例如：5.00"
                disabled={!requireTraceIdOutbound}
                value={maxBudgetPerSession}
                onChange={(val) => setMaxBudgetPerSession(val)}
              />
              <p className="text-xs text-gray-400 mt-1">每次追踪在返回 429 之前的最大花费</p>
            </div>
          </div>

          <Divider className="my-2" />

          <div className="text-sm font-medium text-gray-700">代理速率限制</div>
          <p className="text-xs text-gray-500">
            应用于此代理所有调用方的全局速率限制。
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="TPM 限制" name="tpm_limit" className="mb-0">
              <InputNumber className="w-full" min={0} placeholder="例如：100000" disabled={!requireTraceIdOutbound} />
            </Form.Item>
            <Form.Item label="RPM 限制" name="rpm_limit" className="mb-0">
              <InputNumber className="w-full" min={0} placeholder="例如：100" disabled={!requireTraceIdOutbound} />
            </Form.Item>
          </div>

          <div className="text-sm font-medium text-gray-700 mt-4">每会话速率限制</div>
          <p className="text-xs text-gray-500">
            每个会话的速率限制（x-litellm-trace-id）。每个会话拥有自己的计数器。
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="会话 TPM 限制" name="session_tpm_limit" className="mb-0">
              <InputNumber className="w-full" min={0} placeholder="例如：10000" disabled={!requireTraceIdOutbound} />
            </Form.Item>
            <Form.Item label="会话 RPM 限制" name="session_rpm_limit" className="mb-0">
              <InputNumber className="w-full" min={0} placeholder="例如：20" disabled={!requireTraceIdOutbound} />
            </Form.Item>
          </div>
        </div>
      </div>

      <Divider className="my-0" />

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">防护措施</h4>
        <p className="text-xs text-gray-500 mb-3">
          为此代理应用防护措施。选中的防护措施将在此代理发出的所有调用上运行。
        </p>
        <Form.Item name="guardrails" initialValue={[]}>
          <GuardrailSelector
            accessToken={accessToken ?? ""}
            value={form.getFieldValue("guardrails") ?? []}
            onChange={(selected: string[]) => form.setFieldsValue({ guardrails: selected })}
          />
        </Form.Item>
      </div>
    </div>
  );

  const handleAgentTypeChange = (value: string) => {
    setAgentType(value);
    form.resetFields();
  };

  const isCustomAgent = agentType === CUSTOM_AGENT_TYPE;
  const selectedLogo = isCustomAgent
    ? null
    : selectedAgentTypeInfo?.logo_url ||
      agentTypeMetadata.find((a) => a.agent_type === "a2a")?.logo_url;

  const renderConfigureStep = () => (
    <>
      <Form.Item
        label={<span className="text-sm font-medium text-gray-700">代理类型</span>}
        required
        tooltip="选择要创建的代理类型"
      >
        <Select
          value={agentType}
          onChange={handleAgentTypeChange}
          size="large"
          style={{ width: "100%" }}
          optionLabelProp="label"
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: "4px 0" }} />
              <div className="px-2 py-1">
                <div className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wide px-2">
                  未列出？
                </div>
                <div
                  className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors ${
                    agentType === CUSTOM_AGENT_TYPE
                      ? "bg-amber-50"
                      : "hover:bg-amber-50"
                  }`}
                  onClick={() => handleAgentTypeChange(CUSTOM_AGENT_TYPE)}
                >
                  <AppstoreOutlined className="text-amber-600 text-lg" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-700">自定义 / 其他</span>
                      <Tag color="orange" style={{ fontSize: 10, padding: "0 4px" }}>通用</Tag>
                    </div>
                    <div className="text-xs text-amber-600">
                      适用于不遵循标准协议的代理——仅需一个虚拟密钥
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        >
          {agentTypeMetadata.map((info) => (
            <Select.Option
              key={info.agent_type}
              value={info.agent_type}
              label={
                <div className="flex items-center gap-2">
                  <img src={info.logo_url || ""} alt="" className="w-4 h-4 object-contain" />
                  <span>{info.agent_type_display_name}</span>
                </div>
              }
            >
              <div className="flex items-center gap-3 py-1">
                <img
                  src={info.logo_url || ""}
                  alt={info.agent_type_display_name}
                  className="w-5 h-5 object-contain"
                />
                <div>
                  <div className="font-medium">{info.agent_type_display_name}</div>
                  {info.description && (
                    <div className="text-xs text-gray-500">{info.description}</div>
                  )}
                </div>
              </div>
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <div className="mt-4">
        {agentType === CUSTOM_AGENT_TYPE ? (
          <div className="space-y-4">
            <Form.Item
              label="代理名称"
              name="agent_name"
              rules={[{ required: true, message: "请输入代理名称" }]}
            >
              <Input placeholder="例如：my-custom-agent" />
            </Form.Item>
            <Form.Item
              label="描述"
              name="description"
            >
              <Input.TextArea placeholder="描述此代理的功能..." rows={3} />
            </Form.Item>
          </div>
        ) : agentType === "a2a" ? (
          <AgentFormFields showAgentName={true} />
        ) : selectedAgentTypeInfo?.use_a2a_form_fields ? (
          <>
            <AgentFormFields showAgentName={true} />
            {selectedAgentTypeInfo.credential_fields.length > 0 && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  {selectedAgentTypeInfo.agent_type_display_name} 设置
                </h4>
                {selectedAgentTypeInfo.credential_fields.map((field) => (
                  <Form.Item
                    key={field.key}
                    label={field.label}
                    name={field.key}
                    rules={
                      field.required
                        ? [{ required: true, message: `请输入 ${field.label}` }]
                        : undefined
                    }
                    tooltip={field.tooltip}
                    initialValue={field.default_value}
                  >
                    {field.field_type === "password" ? (
                      <Input.Password placeholder={field.placeholder || ""} />
                    ) : (
                      <Input placeholder={field.placeholder || ""} />
                    )}
                  </Form.Item>
                ))}
              </div>
            )}
          </>
        ) : selectedAgentTypeInfo ? (
          <DynamicAgentFormFields agentTypeInfo={selectedAgentTypeInfo} />
        ) : null}
      </div>

    </>
  );

  const renderAssignKeyStep = () => {
    const agentName = form.getFieldValue("agent_name") || "your-agent";
    return (
      <div>
        {/* Agent name chip */}
        <div className="flex justify-center mb-6">
          <Tag icon={<RobotOutlined />} color="purple" className="px-3 py-1 text-sm">
            {agentName}
          </Tag>
        </div>

        <Form.Item
          label={<span className="text-sm font-medium text-gray-700">分配到团队</span>}
          name="team_id"
          tooltip="可选：将此代理分配到团队。代理及其密钥将属于所选团队。"
        >
          <TeamDropdown />
        </Form.Item>

        <Divider className="my-4" />

        <div className="space-y-3">
          {/* Option: Create new key */}
          <div
            className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              keyAssignOption === "create_new"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
            onClick={() => setKeyAssignOption("create_new")}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Radio
                  value="create_new"
                  checked={keyAssignOption === "create_new"}
                  onChange={() => setKeyAssignOption("create_new")}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <KeyOutlined className="text-indigo-600" />
                    <span className="font-medium text-gray-900">为此代理创建新密钥</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    专用于此代理的密钥。
                  </p>
                  {keyAssignOption === "create_new" && (
                    <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">密钥名称</label>
                        <Input
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="例如：my-agent-key"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Tag color="green">推荐</Tag>
            </div>
          </div>

          {/* Option: Assign existing key */}
          <div
            className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              keyAssignOption === "existing_key"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
            onClick={() => setKeyAssignOption("existing_key")}
          >
            <div className="flex items-start gap-3">
              <Radio
                value="existing_key"
                checked={keyAssignOption === "existing_key"}
                onChange={() => setKeyAssignOption("existing_key")}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <KeyOutlined className="text-gray-500" />
                  <span className="font-medium text-gray-900">分配现有密钥</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  将已有密钥重新分配到此代理。
                </p>
                {keyAssignOption === "existing_key" && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <Select
                      showSearch
                      style={{ width: "100%" }}
                      placeholder="按密钥名称搜索..."
                      loading={loadingKeys}
                      value={selectedExistingKey}
                      onChange={(value) => setSelectedExistingKey(value)}
                      filterOption={(input, option) =>
                        (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
                      }
                      options={existingKeys.map((k) => ({
                        label: k.key_alias || k.token?.slice(0, 12) + "…",
                        value: k.token,
                      }))}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-4">
          <button
            type="button"
            className="text-sm text-gray-500 underline hover:text-gray-700"
            onClick={() => setKeyAssignOption("skip")}
          >
            暂时跳过——稍后分配密钥
          </button>
        </div>
      </div>
    );
  };

  const renderReadyStep = () => (
    <div className="text-center py-6">
      <CheckCircleFilled className="text-5xl text-green-500 mb-4" style={{ fontSize: 48 }} />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">代理已创建！</h3>
      <div className="flex justify-center mb-4">
        <Tag icon={<RobotOutlined />} color="purple" className="px-3 py-1 text-sm">
          {createdAgentName}
        </Tag>
      </div>
      {createdKeyValue && (
        <div className="mt-4 text-left max-w-md mx-auto">
          <CreatedKeyDisplay apiKey={createdKeyValue} />
        </div>
      )}
      {assignedKeyAlias && (
        <p className="text-sm text-gray-600 mt-2">
          密钥 <span className="font-medium">{assignedKeyAlias}</span> 已分配到此代理。
        </p>
      )}
      {!createdKeyValue && !assignedKeyAlias && keyAssignOption === "skip" && (
        <p className="text-sm text-gray-500 mt-2">
          未分配密钥。您可以从虚拟密钥页面创建一个。
        </p>
      )}
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
          {selectedLogo && currentStep < 1 && (
            <img src={selectedLogo} alt="Agent" className="w-6 h-6 object-contain" />
          )}
          <h2 className="text-xl font-semibold text-gray-900">添加新代理</h2>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={900}
      className="top-8"
      styles={{
        body: { padding: "24px" },
        header: { padding: "24px 24px 0 24px", border: "none" },
      }}
    >
      <div className="mt-4">
        {/* Step indicator */}
        <Steps current={currentStep} size="small" className="mb-8">
          <Step title="配置" />
          <Step title="权限" />
          <Step title="治理" />
          <Step title="代理管理" />
          <Step title="完成" />
        </Steps>

        <Form
          form={form}
          layout="vertical"
          initialValues={
            agentType === "a2a"
              ? { ...getDefaultFormValues(), allowed_mcp_servers_and_groups: { servers: [], accessGroups: [] }, mcp_tool_permissions: {}, entitlement_models: [], entitlement_agents: [], guardrails: [] }
              : { allowed_mcp_servers_and_groups: { servers: [], accessGroups: [] }, mcp_tool_permissions: {}, entitlement_models: [], entitlement_agents: [], guardrails: [] }
          }
          className="space-y-4"
        >
          {currentStep === 0 && renderConfigureStep()}
          {currentStep === 1 && renderEntitlementsStep()}
          {currentStep === 2 && renderObservabilityStep()}
          {currentStep === 3 && renderAssignKeyStep()}
          {currentStep === 4 && renderReadyStep()}
        </Form>

        {/* Footer navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-6">
          <div>
            {currentStep > 0 && currentStep < 4 && (
              <button
                type="button"
                onClick={handleBack}
                className="text-sm text-gray-600 border border-gray-300 rounded px-4 py-2 hover:bg-gray-50"
              >
                ← 返回
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {currentStep < 4 && (
              <Button variant="secondary" onClick={handleClose}>
                取消
              </Button>
            )}
            {currentStep === 0 && (
              <Button variant="primary" onClick={handleNext}>
                下一步 →
              </Button>
            )}
            {currentStep === 1 && (
              <Button variant="primary" onClick={handleNext}>
                下一步 →
              </Button>
            )}
            {currentStep === 2 && (
              <Button variant="primary" onClick={handleNext}>
                下一步 →
              </Button>
            )}
            {currentStep === 3 && (
              <Button variant="primary" loading={isSubmitting} onClick={handleCreateAgent}>
                {isSubmitting ? "正在创建..." : "创建代理 →"}
              </Button>
            )}
            {currentStep === 4 && (
              <Button variant="primary" onClick={handleClose}>
                完成
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddAgentForm;
