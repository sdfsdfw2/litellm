/**
 * Allow proxy admin to add other people to view global spend
 * Use this to avoid sharing master key with others
 */
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import {
  Button,
  Callout,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@tremor/react";
import { Alert, Button as Button2, Form, Input, Modal, Space, Tabs, Typography } from "antd";
import React, { useEffect, useState } from "react";
import NewBadge from "./common_components/NewBadge";
import { useBaseUrl } from "./constants";
import NotificationsManager from "./molecules/notifications_manager";
import { addAllowedIP, deleteAllowedIP, getAllowedIPs, getSSOSettings } from "./networking";
import SCIMConfig from "./SCIM";
import LoggingSettings from "./Settings/AdminSettings/LoggingSettings/LoggingSettings";
import SSOSettings from "./Settings/AdminSettings/SSOSettings/SSOSettings";
import UISettings from "./Settings/AdminSettings/UISettings/UISettings";
import HashicorpVault from "./Settings/AdminSettings/HashicorpVault/HashicorpVault";
import SSOModals from "./SSOModals";
import UIAccessControlForm from "./UIAccessControlForm";

const { Title, Paragraph, Text } = Typography;

interface AdminPanelProps {
  proxySettings?: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ proxySettings }) => {
  const { premiumUser, accessToken, userId: userID } = useAuthorized();
  const [form] = Form.useForm();
  const [isAddSSOModalVisible, setIsAddSSOModalVisible] = useState(false);
  const [isInstructionsModalVisible, setIsInstructionsModalVisible] = useState(false);
  const [isAllowedIPModalVisible, setIsAllowedIPModalVisible] = useState(false);
  const [isAddIPModalVisible, setIsAddIPModalVisible] = useState(false);
  const [isDeleteIPModalVisible, setIsDeleteIPModalVisible] = useState(false);
  const [isUIAccessControlModalVisible, setIsUIAccessControlModalVisible] = useState(false);
  const [allowedIPs, setAllowedIPs] = useState<string[]>([]);
  const [ipToDelete, setIPToDelete] = useState<string | null>(null);
  const [ssoConfigured, setSsoConfigured] = useState<boolean>(false);

  const baseUrl = useBaseUrl();
  const all_ip_address_allowed = "允许所有IP地址";

  let nonSssoUrl = baseUrl;
  nonSssoUrl += "/fallback/login";

  const checkSSOConfiguration = async () => {
    if (accessToken) {
      try {
        const ssoData = await getSSOSettings(accessToken);

        if (ssoData && ssoData.values) {
          const hasGoogleSSO = ssoData.values.google_client_id && ssoData.values.google_client_secret;
          const hasMicrosoftSSO = ssoData.values.microsoft_client_id && ssoData.values.microsoft_client_secret;
          const hasGenericSSO = ssoData.values.generic_client_id && ssoData.values.generic_client_secret;

          setSsoConfigured(hasGoogleSSO || hasMicrosoftSSO || hasGenericSSO);
        } else {
          setSsoConfigured(false);
        }
      } catch (error) {
        console.error("Error checking SSO configuration:", error);
        setSsoConfigured(false);
      }
    }
  };

  const handleShowAllowedIPs = async () => {
    try {
      if (premiumUser !== true) {
        NotificationsManager.fromBackend(
          "此功能仅适用于高级用户。请升级您的账户。",
        );
        return;
      }
      if (accessToken) {
        const data = await getAllowedIPs(accessToken);
        setAllowedIPs(data && data.length > 0 ? data : [all_ip_address_allowed]);
      } else {
        setAllowedIPs([all_ip_address_allowed]);
      }
    } catch (error) {
      console.error("Error fetching allowed IPs:", error);
      NotificationsManager.fromBackend(`获取允许的IP地址失败 ${error}`);
      setAllowedIPs([all_ip_address_allowed]);
    } finally {
      if (premiumUser === true) {
        setIsAllowedIPModalVisible(true);
      }
    }
  };

  const handleAddIP = async (values: { ip: string }) => {
    try {
      if (accessToken) {
        await addAllowedIP(accessToken, values.ip);
        // Fetch the updated list of IPs
        const updatedIPs = await getAllowedIPs(accessToken);
        setAllowedIPs(updatedIPs);
        NotificationsManager.success("IP地址添加成功");
      }
    } catch (error) {
      console.error("Error adding IP:", error);
      NotificationsManager.fromBackend(`添加IP地址失败 ${error}`);
    } finally {
      setIsAddIPModalVisible(false);
    }
  };

  const handleDeleteIP = async (ip: string) => {
    setIPToDelete(ip);
    setIsDeleteIPModalVisible(true);
  };

  const confirmDeleteIP = async () => {
    if (ipToDelete && accessToken) {
      try {
        await deleteAllowedIP(accessToken, ipToDelete);
        // Fetch the updated list of IPs
        const updatedIPs = await getAllowedIPs(accessToken);
        setAllowedIPs(updatedIPs.length > 0 ? updatedIPs : [all_ip_address_allowed]);
        NotificationsManager.success("IP地址删除成功");
      } catch (error) {
        console.error("Error deleting IP:", error);
        NotificationsManager.fromBackend(`删除IP地址失败 ${error}`);
      } finally {
        setIsDeleteIPModalVisible(false);
        setIPToDelete(null);
      }
    }
  };

  const handleAddSSOOk = () => {
    setIsAddSSOModalVisible(false);
    form.resetFields();
    if (accessToken && premiumUser) {
      checkSSOConfiguration();
    }
  };

  const handleAddSSOCancel = () => {
    setIsAddSSOModalVisible(false);
    form.resetFields();
  };

  const handleShowInstructions = (formValues: Record<string, any>) => {
    setIsAddSSOModalVisible(false);
    setIsInstructionsModalVisible(true);
  };

  const handleInstructionsOk = () => {
    setIsInstructionsModalVisible(false);
    if (accessToken && premiumUser) {
      checkSSOConfiguration();
    }
  };

  const handleInstructionsCancel = () => {
    setIsInstructionsModalVisible(false);
    if (accessToken && premiumUser) {
      checkSSOConfiguration();
    }
  };

  useEffect(() => {
    checkSSOConfiguration();
  }, [accessToken, premiumUser, checkSSOConfiguration]);

  const handleUIAccessControlOk = () => {
    setIsUIAccessControlModalVisible(false);
  };

  const handleUIAccessControlCancel = () => {
    setIsUIAccessControlModalVisible(false);
  };

  const tabItems = [
    {
      key: "sso-settings",
      label: "SSO 设置",
      children: <SSOSettings />,
    },
    {
      key: "security-settings",
      label: "安全设置",
      children: (
        <>
          <Card>
            <Title level={4}> ✨ 安全设置</Title>
            <Alert
              message="SSO 配置已弃用"
              description="在此页面上编辑 SSO 设置的功能已弃用，将在未来版本中移除。请使用「SSO 设置」选项卡进行 SSO 配置。"
              type="warning"
              showIcon
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                marginTop: "1rem",
                marginLeft: "0.5rem",
              }}
            >
              <div>
                <Button style={{ width: "150px" }} onClick={() => setIsAddSSOModalVisible(true)}>
                  {ssoConfigured ? "编辑 SSO 设置" : "添加 SSO"}
                </Button>
              </div>
              <div>
                <Button style={{ width: "150px" }} onClick={handleShowAllowedIPs}>
                  允许的 IP
                </Button>
              </div>
              <div>
                <Button
                  style={{ width: "150px" }}
                  onClick={() =>
                    premiumUser === true
                      ? setIsUIAccessControlModalVisible(true)
                      : NotificationsManager.fromBackend("只有高级用户才能配置 UI 访问控制")
                  }
                >
UI 访问控制
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-start mb-4">
            <SSOModals
              isAddSSOModalVisible={isAddSSOModalVisible}
              isInstructionsModalVisible={isInstructionsModalVisible}
              handleAddSSOOk={handleAddSSOOk}
              handleAddSSOCancel={handleAddSSOCancel}
              handleShowInstructions={handleShowInstructions}
              handleInstructionsOk={handleInstructionsOk}
              handleInstructionsCancel={handleInstructionsCancel}
              form={form}
              accessToken={accessToken}
              ssoConfigured={ssoConfigured}
            />
            <Modal
              title="管理允许的 IP 地址"
              width={800}
              open={isAllowedIPModalVisible}
              onCancel={() => setIsAllowedIPModalVisible(false)}
              footer={[
                <Button className="mx-1" key="add" onClick={() => setIsAddIPModalVisible(true)}>
                  添加 IP 地址
                </Button>,
                <Button key="close" onClick={() => setIsAllowedIPModalVisible(false)}>
                  关闭
                </Button>,
              ]}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>IP 地址</TableHeaderCell>
                    <TableHeaderCell className="text-right">操作</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allowedIPs.map((ip, index) => (
                    <TableRow key={index}>
                      <TableCell>{ip}</TableCell>
                      <TableCell className="text-right">
                        {ip !== all_ip_address_allowed && (
                          <Button onClick={() => handleDeleteIP(ip)} color="red" size="xs">
                            删除
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Modal>

            <Modal
              title="添加允许的 IP 地址"
              open={isAddIPModalVisible}
              onCancel={() => setIsAddIPModalVisible(false)}
              footer={null}
            >
              <Form onFinish={handleAddIP}>
                <Form.Item name="ip" rules={[{ required: true, message: "请输入 IP 地址" }]}>
                  <Input placeholder="输入 IP 地址" />
                </Form.Item>
                <Form.Item>
                  <Button2 htmlType="submit">添加 IP 地址</Button2>
                </Form.Item>
              </Form>
            </Modal>

            <Modal
              title="确认删除"
              open={isDeleteIPModalVisible}
              onCancel={() => setIsDeleteIPModalVisible(false)}
              onOk={confirmDeleteIP}
              footer={[
                <Button className="mx-1" key="delete" onClick={() => confirmDeleteIP()}>
                  是
                </Button>,
                <Button key="close" onClick={() => setIsDeleteIPModalVisible(false)}>
                  关闭
                </Button>,
              ]}
            >
              <Text>确定要删除 IP 地址：{ipToDelete}？</Text>
            </Modal>

            {/* UI Access Control Modal */}
            <Modal
              title="UI 访问控制设置"
              open={isUIAccessControlModalVisible}
              width={600}
              footer={null}
              onOk={handleUIAccessControlOk}
              onCancel={handleUIAccessControlCancel}
            >
              <UIAccessControlForm
                accessToken={accessToken}
                onSuccess={() => {
                  handleUIAccessControlOk();
                  NotificationsManager.success("UI 访问控制设置更新成功");
                }}
              />
            </Modal>
          </div>
          <Callout title="不使用 SSO 登录" color="teal">
            如果你需要使用非 SSO 方式登录，可以访问{" "}
            <a href={nonSssoUrl} target="_blank" rel="noopener noreferrer">
              <b>{nonSssoUrl}</b>{" "}
            </a>
          </Callout>
        </>
      ),
    },
    {
      key: "scim",
      label: "SCIM 配置",
      children: <SCIMConfig accessToken={accessToken} userID={userID} proxySettings={proxySettings} />,
    },
    {
      key: "ui-settings",
      label: (
        <Space>
          <Text>
            UI 设置 <NewBadge />
          </Text>
        </Space>
      ),
      children: <UISettings />,
    },
    {
      key: "logging-settings",
      label: "日志设置",
      children: <LoggingSettings />,
    },
    {
      key: "hashicorp-vault",
      label: "Hashicorp Vault 配置",
      children: <HashicorpVault />,
    },
  ];

  return (
    <div className="w-full m-2 mt-2 p-8">
      <Title level={4}>管理员访问</Title>
      <Paragraph>前往「内部用户」页面添加其他管理员。</Paragraph>
      <Tabs items={tabItems} />
    </div>
  );
};

export default AdminPanel;
