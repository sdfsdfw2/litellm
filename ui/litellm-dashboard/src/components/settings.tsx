import {
  Button,
  Card,
  Grid,
  SelectItem,
  Switch,
  Tab,
  TabGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TabList,
  TabPanel,
  TabPanels,
  Text,
  TextInput,
} from "@tremor/react";
import React, { useEffect, useState } from "react";

import { Button as Button2, Form, Input, Modal, Select, Typography } from "antd";
import EmailSettings from "./email_settings";
import NotificationsManager from "./molecules/notifications_manager";

const { Title, Paragraph } = Typography;

import FormItem from "antd/es/form/FormItem";
import AlertingSettings from "./alerting/alerting_settings";
import CloudZeroCostTracking from "./CloudZeroCostTracking/CloudZeroCostTracking";
import DeleteResourceModal from "./common_components/DeleteResourceModal";
import {
  deleteCallback,
  getCallbackConfigsCall,
  getCallbacksCall,
  serviceHealthCheck,
  setCallbacksCall,
} from "./networking";
import { LoggingCallbacksTable } from "./Settings/LoggingAndAlerts/LoggingCallbacks/LoggingCallbacksTable";
import { AlertingObject } from "./Settings/LoggingAndAlerts/LoggingCallbacks/types";
import { parseErrorMessage } from "./shared/errorUtils";
interface SettingsPageProps {
  accessToken: string | null;
  userRole: string | null;
  userID: string | null;
  premiumUser: boolean;
}

interface genericCallbackParams {
  litellm_callback_name: string; // what to send in request
  ui_callback_name: string; // what to show on UI
  litellm_callback_params: string[] | null; // known required params for this callback
}

const assetsLogoFolder = "../ui/assets/logos/";

interface DynamicParamsFieldsProps {
  params: string[];
  callbackConfigs: any[];
  selectedCallback: string | null;
}

const DynamicParamsFields: React.FC<DynamicParamsFieldsProps> = ({ params, callbackConfigs, selectedCallback }) => {
  if (!params || params.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mt-6 p-4 bg-gray-50 rounded-lg border">
      {params.map((param) => {
        const callbackConfig = callbackConfigs.find((config) => config.id === selectedCallback);
        const paramConfig = callbackConfig?.dynamic_params?.[param] || {};
        const paramType = paramConfig.type || "text";
        const fieldLabel = paramConfig.ui_name || param.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        const isRequired = paramConfig.required || false;

        return (
          <FormItem
            label={<span className="text-sm font-medium text-gray-700">{fieldLabel} </span>}
            name={param}
            key={param}
            className="mb-4"
            rules={
              isRequired
                ? [
                    {
                      required: true,
                      message: `请输入${fieldLabel.toLowerCase()}`,
                    },
                  ]
                : undefined
            }
          >
            {paramType === "password" ? (
              <Input.Password
                size="large"
                placeholder={`请输入您的${fieldLabel.toLowerCase()}`}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : paramType === "number" ? (
              <Input
                type="number"
                size="large"
                placeholder={`请输入${fieldLabel.toLowerCase()}`}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                min={0}
                max={1}
                step={0.1}
              />
            ) : (
              <Input
                size="large"
                placeholder={`请输入您的${fieldLabel.toLowerCase()}`}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            )}
          </FormItem>
        );
      })}
    </div>
  );
};

// Shared component for rendering callback selector
interface CallbackSelectorProps {
  callbackConfigs: any[];
  selectedCallback: string | null;
  onCallbackChange: (value: string) => void;
  disabled?: boolean;
}

const CallbackSelector: React.FC<CallbackSelectorProps> = ({
  callbackConfigs,
  selectedCallback,
  onCallbackChange,
  disabled = false,
}) => {
  return (
    <FormItem
      label="回调"
      name="callback"
      rules={disabled ? undefined : [{ required: true, message: "请选择一个回调" }]}
    >
      <Select
        placeholder="选择日志回调..."
        size="large"
        className="w-full"
        showSearch
        disabled={disabled}
        value={selectedCallback}
        filterOption={(input, option) => {
          return (option?.value?.toString() ?? "").toLowerCase().includes(input.toLowerCase());
        }}
        onChange={onCallbackChange}
      >
        {callbackConfigs.map((callbackConfig) => {
          const logo = callbackConfig.logo;
          const logoSrc =
            logo && (logo.includes("/") || logo.startsWith("data:") || logo.startsWith("http"))
              ? logo
              : `${assetsLogoFolder}${logo}`;

          return (
            <SelectItem key={callbackConfig.id} value={callbackConfig.id}>
              <div className="flex items-center space-x-3 py-1">
                <div className="w-6 h-6 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt={`${callbackConfig.displayName} 标志`}
                    className="w-6 h-6 rounded object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <span className="font-medium text-gray-900">{callbackConfig.displayName}</span>
              </div>
            </SelectItem>
          );
        })}
      </Select>
    </FormItem>
  );
};

// Shared helper function to get dynamic params for a callback
const getDynamicParamsForCallback = (
  callbackName: string | null,
  callbackConfigs: any[],
  fallbackVariables?: Record<string, any>,
): string[] => {
  if (!callbackName) {
    return fallbackVariables ? Object.keys(fallbackVariables) : [];
  }

  const callbackConfig = callbackConfigs.find((config) => config.id === callbackName);
  if (callbackConfig?.dynamic_params) {
    return Object.keys(callbackConfig.dynamic_params);
  }

  return fallbackVariables ? Object.keys(fallbackVariables) : [];
};

// Shared helper function to build callback payload
const buildCallbackPayload = (formValues: Record<string, any>, callbackName: string) => {
  return {
    environment_variables: formValues,
    litellm_settings: {
      success_callback: [callbackName],
    },
  };
};

const Settings: React.FC<SettingsPageProps> = ({ accessToken, userRole, userID, premiumUser }) => {
  const [callbacks, setCallbacks] = useState<AlertingObject[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [selectedCallback, setSelectedCallback] = useState<string | null>(null);
  const [catchAllWebhookURL, setCatchAllWebhookURL] = useState<string>("");
  const [alertToWebhooks, setAlertToWebhooks] = useState<Record<string, string>>({});
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);

  const [showAddCallbacksModal, setShowAddCallbacksModal] = useState(false);
  const [callbackConfigs, setCallbackConfigs] = useState<any[]>([]);
  const [allCallbacks, setAllCallbacks] = useState<
    Record<
      string,
      {
        litellm_callback_name: string;
        litellm_callback_params: string[];
        ui_callback_name: string;
      }
    >
  >({});

  const [selectedCallbackParams, setSelectedCallbackParams] = useState<string[]>([]);

  const [showEditCallback, setShowEditCallback] = useState(false);
  const [selectedEditCallback, setSelectedEditCallback] = useState<any | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [callbackToDelete, setCallbackToDelete] = useState<any | null>(null);
  const [isUpdatingCallback, setIsUpdatingCallback] = useState(false);
  const [isAddingCallback, setIsAddingCallback] = useState(false);
  const [isDeletingCallback, setIsDeletingCallback] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    getCallbackConfigsCall(accessToken)
      .then((data) => {
        setCallbackConfigs(data || []);
      })
      .catch((error) => {
        NotificationsManager.fromBackend("加载回调配置失败：" + parseErrorMessage(error));
      });
  }, [accessToken]);

  useEffect(() => {
    if (showEditCallback && selectedEditCallback) {
      const normalized = Object.fromEntries(
        Object.entries(selectedEditCallback.variables || {}).map(([k, v]) => [k, v ?? ""]),
      );
      editForm.setFieldsValue({
        ...normalized,
        callback: selectedEditCallback.name,
      });
    }
  }, [showEditCallback, selectedEditCallback, editForm]);

  const handleSwitchChange = (alertName: string) => {
    if (activeAlerts.includes(alertName)) {
      setActiveAlerts(activeAlerts.filter((alert) => alert !== alertName));
    } else {
      setActiveAlerts([...activeAlerts, alertName]);
    }
  };
  const alerts_to_UI_NAME: Record<string, string> = {
    llm_exceptions: "LLM 异常",
    llm_too_slow: "LLM 响应过慢",
    llm_requests_hanging: "LLM 请求挂起",
    budget_alerts: "预算告警（API 密钥、用户）",
    db_exceptions: "数据库异常（读/写）",
    daily_reports: "周/月度消费报告",
    outage_alerts: "服务中断告警",
    region_outage_alerts: "区域服务中断告警",
  };

  useEffect(() => {
    if (!accessToken || !userRole || !userID) {
      return;
    }
    getCallbacksCall(accessToken, userID, userRole).then((data) => {
      setCallbacks(data.callbacks);
      setAllCallbacks(data.available_callbacks);
      // setCallbacks(callbacks_data);

      let alerts_data = data.alerts;
      if (alerts_data) {
        if (alerts_data.length > 0) {
          let _alert_info = alerts_data[0];
          let catch_all_webhook = _alert_info.variables.SLACK_WEBHOOK_URL;

          let active_alerts = _alert_info.active_alerts;
          setActiveAlerts(active_alerts);
          setCatchAllWebhookURL(catch_all_webhook);
          setAlertToWebhooks(_alert_info.alerts_to_webhook);
        }
      }

      setAlerts(alerts_data);
    });
  }, [accessToken, userRole, userID]);

  const isAlertOn = (alertName: string) => {
    return activeAlerts && activeAlerts.includes(alertName);
  };

  // Shared handler for callback form submission
  const handleCallbackSubmit = async (formValues: Record<string, any>, callbackName: string, isEdit: boolean) => {
    if (!accessToken) {
      return;
    }

    if (isEdit) {
      setIsUpdatingCallback(true);
    } else {
      setIsAddingCallback(true);
    }

    const payload = buildCallbackPayload(formValues, callbackName);

    try {
      await setCallbacksCall(accessToken, payload);
      NotificationsManager.success(
        isEdit ? "回调更新成功" : `回调 ${callbackName} 添加成功`,
      );

      if (isEdit) {
        setShowEditCallback(false);
        editForm.resetFields();
        setSelectedEditCallback(null);
      } else {
        setShowAddCallbacksModal(false);
        addForm.resetFields();
        setSelectedCallback(null);
        setSelectedCallbackParams([]);
      }

      // Refresh the callbacks list
      if (userID && userRole) {
        const updatedData = await getCallbacksCall(accessToken, userID, userRole);
        setCallbacks(updatedData.callbacks);
      }
    } catch (error) {
      NotificationsManager.fromBackend(error);
    } finally {
      if (isEdit) {
        setIsUpdatingCallback(false);
      } else {
        setIsAddingCallback(false);
      }
    }
  };

  const updateCallbackCall = async (formValues: Record<string, any>) => {
    if (!selectedEditCallback) {
      return;
    }
    await handleCallbackSubmit(formValues, selectedEditCallback.name, true);
  };

  const addNewCallbackCall = async (formValues: Record<string, any>) => {
    const new_callback = formValues?.callback;
    if (!new_callback) {
      return;
    }
    await handleCallbackSubmit(formValues, new_callback, false);
  };

  const handleSelectedCallbackChange = (callbackName: string) => {
    setSelectedCallback(callbackName);
    const params = getDynamicParamsForCallback(callbackName, callbackConfigs);
    setSelectedCallbackParams(params);
  };

  const handleSaveAlerts = async () => {
    if (!accessToken) {
      return;
    }

    const updatedAlertToWebhooks: Record<string, string> = {};
    Object.entries(alerts_to_UI_NAME).forEach(([key, value]) => {
      const webhookInput = document.querySelector(`input[name="${key}"]`) as HTMLInputElement;
      const newWebhookValue = webhookInput?.value || "";
      updatedAlertToWebhooks[key] = newWebhookValue;
    });

    const payload = {
      general_settings: {
        alert_to_webhook_url: updatedAlertToWebhooks,
        alert_types: activeAlerts,
      },
    };

    try {
      await setCallbacksCall(accessToken, payload);
    } catch (error) {
      NotificationsManager.fromBackend(error);
    }
    NotificationsManager.success("告警更新成功");
  };
  const handleSaveChanges = (callback: any) => {
    if (!accessToken) {
      return;
    }

    const updatedVariables = Object.fromEntries(
      Object.entries(callback.variables).map(([key, value]) => [
        key,
        (document.querySelector(`input[name="${key}"]`) as HTMLInputElement)?.value || value,
      ]),
    );

    const payload = {
      environment_variables: updatedVariables,
      litellm_settings: {
        success_callback: [callback.name],
      },
    };

    try {
      setCallbacksCall(accessToken, payload);
    } catch (error) {
      NotificationsManager.fromBackend(error);
    }
    NotificationsManager.success("回调更新成功");
  };

  const handleOk = () => {
    if (!accessToken) {
      return;
    }
    // Handle form submission
    addForm.validateFields().then((values) => {
      // Call API to add the callback
      let payload;
      if (values.callback === "langfuse" || values.callback === "langfuse_otel") {
        payload = {
          environment_variables: {
            LANGFUSE_PUBLIC_KEY: values.langfusePublicKey,
            LANGFUSE_SECRET_KEY: values.langfusePrivateKey,
          },
          litellm_settings: {
            success_callback: [values.callback],
          },
        };
        setCallbacksCall(accessToken, payload);
        let newCallback: AlertingObject = {
          name: values.callback,
          variables: {
            SLACK_WEBHOOK_URL: null,
            LANGFUSE_HOST: null,
            LANGFUSE_PUBLIC_KEY: values.langfusePublicKey,
            LANGFUSE_SECRET_KEY: values.langfusePrivateKey,
            OPENMETER_API_KEY: null,
          },
        };
        // add langfuse to callbacks
        setCallbacks(callbacks ? [...callbacks, newCallback] : [newCallback]);
      } else if (values.callback === "slack") {
        payload = {
          general_settings: {
            alerting: ["slack"],
            alerting_threshold: 300,
          },
          environment_variables: {
            SLACK_WEBHOOK_URL: values.slackWebhookUrl,
          },
        };
        setCallbacksCall(accessToken, payload);

        let newCallback: AlertingObject = {
          name: values.callback,
          variables: {
            SLACK_WEBHOOK_URL: values.slackWebhookUrl,
            LANGFUSE_HOST: null,
            LANGFUSE_PUBLIC_KEY: null,
            LANGFUSE_SECRET_KEY: null,
            OPENMETER_API_KEY: null,
          },
        };
        setCallbacks(callbacks ? [...callbacks, newCallback] : [newCallback]);
      } else if (values.callback == "openmeter") {
        payload = {
          environment_variables: {
            OPENMETER_API_KEY: values.openMeterApiKey,
          },
          litellm_settings: {
            success_callback: [values.callback],
          },
        };
        setCallbacksCall(accessToken, payload);
        let newCallback: AlertingObject = {
          name: values.callback,
          variables: {
            SLACK_WEBHOOK_URL: null,
            LANGFUSE_HOST: null,
            LANGFUSE_PUBLIC_KEY: null,
            LANGFUSE_SECRET_KEY: null,
            OPENMETER_API_KEY: values.openMeterAPIKey,
          },
        };
        // add langfuse to callbacks
        setCallbacks(callbacks ? [...callbacks, newCallback] : [newCallback]);
      } else {
        payload = {
          error: "无效的回调值",
        };
      }
      setIsModalVisible(false);
      addForm.resetFields();
      setSelectedCallback(null);
    });
  };

  const handleDeleteCallback = (callback: any) => {
    setCallbackToDelete(callback);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteCallback = async () => {
    if (!callbackToDelete || !accessToken) {
      return;
    }

    try {
      setIsDeletingCallback(true);
      await deleteCallback(accessToken, callbackToDelete.name);
      NotificationsManager.success(`回调 ${callbackToDelete.name} 删除成功`);

      // Refresh the callbacks list
      if (userID && userRole) {
        const data = await getCallbacksCall(accessToken, userID, userRole);
        setCallbacks(data.callbacks);
      }

      setShowDeleteConfirmModal(false);
      setCallbackToDelete(null);
    } catch (error) {
      console.error("删除回调失败：", error);
      NotificationsManager.fromBackend(error);
    } finally {
      setIsDeletingCallback(false);
    }
  };

  if (!accessToken) {
    return null;
  }

  return (
    <div className="w-full mx-4">
      <Grid numItems={1} className="gap-2 p-8 w-full mt-2">
        <TabGroup>
          <TabList variant="line" defaultValue="1">
            <Tab value="1">日志回调</Tab>
            <Tab value="2">CloudZero 成本追踪</Tab>
            <Tab value="2">告警类型</Tab>
            <Tab value="3">告警设置</Tab>
            <Tab value="4">邮件告警</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <LoggingCallbacksTable
                callbacks={callbacks}
                availableCallbacks={allCallbacks}
                onAdd={() => setShowAddCallbacksModal(true)}
                onEdit={(cb) => {
                  setSelectedEditCallback(cb);
                  setShowEditCallback(true);
                }}
                onDelete={(cb) => handleDeleteCallback(cb)}
                onTest={async (cb) => {
                  try {
                    await serviceHealthCheck(accessToken, cb.name);
                    NotificationsManager.success("健康检查已触发");
                  } catch (error) {
                    NotificationsManager.fromBackend(parseErrorMessage(error));
                  }
                }}
              />
            </TabPanel>
            <TabPanel>
              <div className="p-8">
                <CloudZeroCostTracking />
              </div>
            </TabPanel>
            <TabPanel>
              <Card>
                <Text className="my-2">
                  告警仅支持 Slack Webhook URL。请从{" "}
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" style={{ color: "blue" }}>
                    此处
                  </a>
                  获取您的 Webhook URL
                </Text>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell></TableHeaderCell>
                      <TableHeaderCell></TableHeaderCell>
                      <TableHeaderCell>Slack Webhook URL</TableHeaderCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {Object.entries(alerts_to_UI_NAME).map(([key, value], index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {key == "region_outage_alerts" ? (
                            premiumUser ? (
                              <Switch
                                id="switch"
                                name="switch"
                                checked={isAlertOn(key)}
                                onChange={() => handleSwitchChange(key)}
                              />
                            ) : (
                              <Button className="flex items-center justify-center">
                                <a href="https://forms.gle/W3U4PZpJGFHWtHyA9" target="_blank">
                                  ✨ 企业版功能
                                </a>
                              </Button>
                            )
                          ) : (
                            <Switch
                              id="switch"
                              name="switch"
                              checked={isAlertOn(key)}
                              onChange={() => handleSwitchChange(key)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Text>{value}</Text>
                        </TableCell>
                        <TableCell>
                          <TextInput
                            name={key}
                            type="password"
                            defaultValue={
                              alertToWebhooks && alertToWebhooks[key]
                                ? alertToWebhooks[key]
                                : (catchAllWebhookURL as string)
                            }
                          ></TextInput>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button size="xs" className="mt-2" onClick={handleSaveAlerts}>
                  保存更改
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      await serviceHealthCheck(accessToken, "slack");
                      NotificationsManager.success(
                        "告警测试已触发。已向 Slack 发送测试请求 - 请查看 Slack 上的日志/告警以确认",
                      );
                    } catch (error) {
                      NotificationsManager.fromBackend(parseErrorMessage(error));
                    }
                  }}
                  className="mx-2"
                >
                  测试告警
                </Button>
              </Card>
            </TabPanel>
            <TabPanel>
              <AlertingSettings accessToken={accessToken} premiumUser={premiumUser} />
            </TabPanel>
            <TabPanel>
              <EmailSettings accessToken={accessToken} premiumUser={premiumUser} alerts={alerts} />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Grid>

      <Modal
        title="添加日志回调"
        open={showAddCallbacksModal}
        width={800}
        onCancel={() => {
          setShowAddCallbacksModal(false);
          setSelectedCallback(null);
          setSelectedCallbackParams([]);
        }}
        footer={null}
      >
        <a
          href="https://docs.litellm.ai/docs/proxy/logging"
          className="mb-8 mt-4"
          target="_blank"
          style={{ color: "blue" }}
        >
          {" "}
          LiteLLM 文档：日志
        </a>

        <Form
          form={addForm}
          onFinish={addNewCallbackCall}
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          labelAlign="left"
        >
          <CallbackSelector
            callbackConfigs={callbackConfigs}
            selectedCallback={selectedCallback}
            onCallbackChange={handleSelectedCallbackChange}
          />

          <DynamicParamsFields
            params={selectedCallbackParams}
            callbackConfigs={callbackConfigs}
            selectedCallback={selectedCallback}
          />

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
            <Button2
              onClick={() => {
                setShowAddCallbacksModal(false);
                setSelectedCallback(null);
                setSelectedCallbackParams([]);
                addForm.resetFields();
              }}
              disabled={isAddingCallback}
            >
              取消
            </Button2>
            <Button2 htmlType="submit" loading={isAddingCallback} disabled={isAddingCallback}>
              {isAddingCallback ? "添加中..." : "添加回调"}
            </Button2>
          </div>
        </Form>
      </Modal>

      <Modal
        open={showEditCallback}
        width={800}
        title={"编辑回调设置"}
        onCancel={() => {
          setShowEditCallback(false);
          setSelectedEditCallback(null);
          editForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={editForm}
          onFinish={updateCallbackCall}
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          labelAlign="left"
        >
          {selectedEditCallback && (
            <>
              <CallbackSelector
                callbackConfigs={callbackConfigs}
                selectedCallback={selectedEditCallback.name}
                onCallbackChange={() => {}}
                disabled={true}
              />

              <DynamicParamsFields
                params={getDynamicParamsForCallback(
                  selectedEditCallback.name,
                  callbackConfigs,
                  selectedEditCallback.variables,
                )}
                callbackConfigs={callbackConfigs}
                selectedCallback={selectedEditCallback.name}
              />
            </>
          )}

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
            <Button2
              onClick={() => {
                setShowEditCallback(false);
                setSelectedEditCallback(null);
                editForm.resetFields();
              }}
              disabled={isUpdatingCallback}
            >
              取消
            </Button2>
            <Button2
              onClick={() => {
                editForm.submit();
              }}
              loading={isUpdatingCallback}
              disabled={isUpdatingCallback}
            >
              {isUpdatingCallback ? "保存中..." : "保存更改"}
            </Button2>
          </div>
        </Form>
      </Modal>

      <DeleteResourceModal
        isOpen={showDeleteConfirmModal}
        title="删除回调"
        message="确定要删除此回调吗？此操作无法撤销。"
        resourceInformationTitle="回调信息"
        resourceInformation={[
          { label: "回调名称", value: callbackToDelete?.name },
          { label: "模式", value: callbackToDelete?.mode || "成功" },
        ]}
        onCancel={() => {
          setShowDeleteConfirmModal(false);
          setCallbackToDelete(null);
        }}
        onOk={confirmDeleteCallback}
        confirmLoading={isDeletingCallback}
      />
    </div>
  );
};

export default Settings;
