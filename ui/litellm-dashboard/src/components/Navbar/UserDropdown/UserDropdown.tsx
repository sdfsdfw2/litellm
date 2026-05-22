import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { useDisableBlogPosts } from "@/app/(dashboard)/hooks/useDisableBlogPosts";
import { useDisableBouncingIcon } from "@/app/(dashboard)/hooks/useDisableBouncingIcon";
import { useDisableShowPrompts } from "@/app/(dashboard)/hooks/useDisableShowPrompts";
import { useDisableUsageIndicator } from "@/app/(dashboard)/hooks/useDisableUsageIndicator";
import {
  emitLocalStorageChange,
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "@/utils/localStorageUtils";
import {
  CrownOutlined,
  DownOutlined,
  LogoutOutlined,
  MailOutlined,
  SafetyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Divider, Dropdown, Space, Switch, Tag, Tooltip, Typography } from "antd";
import React, { useEffect, useState } from "react";

const { Text } = Typography;

interface UserDropdownProps {
  onLogout: () => void;
}

const UserDropdown: React.FC<UserDropdownProps> = ({ onLogout }) => {
  const { userId, userEmail, userRole, premiumUser } = useAuthorized();
  const disableShowPrompts = useDisableShowPrompts();
  const disableUsageIndicator = useDisableUsageIndicator();
  const disableBlogPosts = useDisableBlogPosts();
  const disableBouncingIcon = useDisableBouncingIcon();
  const [disableShowNewBadge, setDisableShowNewBadge] = useState(false);

  useEffect(() => {
    const storedValue = getLocalStorageItem("disableShowNewBadge");
    setDisableShowNewBadge(storedValue === "true");
  }, []);

  const userItems: MenuProps["items"] = [
    {
      key: "logout",
      label: (
        <Space>
          <LogoutOutlined />
退出登录
        </Space>
      ),
      onClick: onLogout,
    },
  ];

  const renderUserInfoSection = () => (
    <Space direction="vertical" size="small" style={{ width: "100%", padding: "12px" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Space>
          <MailOutlined />
          <Text type="secondary">{userEmail || "-"}</Text>
        </Space>
        {premiumUser ? (
          <Tag
            icon={<CrownOutlined />}
            color="gold"
          >
高级版
          </Tag>
        ) : (
          <Tooltip title="升级到高级版以获取更多功能" placement="left">
            <Tag
              icon={<CrownOutlined />}
            >
              标准版
            </Tag>
          </Tooltip>
        )}
      </Space>
      <Divider style={{ margin: "8px 0" }} />
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Space>
          <UserOutlined />
          <Text type="secondary">用户ID</Text>
        </Space>
        <Text
          copyable
          ellipsis
          style={{ maxWidth: "150px" }}
          title={userId || "-"}
        >
          {userId || "-"}
        </Text>
      </Space>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Space>
          <SafetyOutlined />
          <Text type="secondary">角色</Text>
        </Space>
        <Text>{userRole}</Text>
      </Space>
      <Divider style={{ margin: "8px 0" }} />
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text type="secondary">隐藏新功能提示</Text>
        <Switch
          size="small"
          checked={disableShowNewBadge}
          onChange={(checked) => {
            setDisableShowNewBadge(checked);
            if (checked) {
              setLocalStorageItem("disableShowNewBadge", "true");
              emitLocalStorageChange("disableShowNewBadge");
            } else {
              removeLocalStorageItem("disableShowNewBadge");
              emitLocalStorageChange("disableShowNewBadge");
            }
          }}
          aria-label="切换隐藏新功能提示"
        />
      </Space>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text type="secondary">隐藏所有提示</Text>
        <Switch
          size="small"
          checked={disableShowPrompts}
          onChange={(checked) => {
            if (checked) {
              setLocalStorageItem("disableShowPrompts", "true");
              emitLocalStorageChange("disableShowPrompts");
            } else {
              removeLocalStorageItem("disableShowPrompts");
              emitLocalStorageChange("disableShowPrompts");
            }
          }}
          aria-label="切换隐藏所有提示"
        />
      </Space>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text type="secondary">隐藏使用量指示器</Text>
        <Switch
          size="small"
          checked={disableUsageIndicator}
          onChange={(checked) => {
            if (checked) {
              setLocalStorageItem("disableUsageIndicator", "true");
              emitLocalStorageChange("disableUsageIndicator");
            } else {
              removeLocalStorageItem("disableUsageIndicator");
              emitLocalStorageChange("disableUsageIndicator");
            }
          }}
          aria-label="切换隐藏使用量指示器"
        />
      </Space>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text type="secondary">隐藏博客文章</Text>
        <Switch
          size="small"
          checked={disableBlogPosts}
          onChange={(checked) => {
            if (checked) {
              setLocalStorageItem("disableBlogPosts", "true");
              emitLocalStorageChange("disableBlogPosts");
            } else {
              removeLocalStorageItem("disableBlogPosts");
              emitLocalStorageChange("disableBlogPosts");
            }
          }}
          aria-label="切换隐藏博客文章"
        />
      </Space>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text type="secondary">隐藏跳动图标</Text>
        <Switch
          size="small"
          checked={disableBouncingIcon}
          onChange={(checked) => {
            if (checked) {
              setLocalStorageItem("disableBouncingIcon", "true");
              emitLocalStorageChange("disableBouncingIcon");
            } else {
              removeLocalStorageItem("disableBouncingIcon");
              emitLocalStorageChange("disableBouncingIcon");
            }
          }}
          aria-label="切换隐藏跳动图标"
        />
      </Space>
    </Space>
  );

  return (
    <Dropdown
      menu={{ items: userItems }}
      popupRender={(menu) => (
        <div
          className="bg-white rounded-lg shadow-lg"
        >
          {renderUserInfoSection()}
          <Divider style={{ margin: 0 }} />
          {React.cloneElement(menu as React.ReactElement, {
            style: { boxShadow: "none" },
          })}
        </div>
      )}
    >
      <Button type="text" >
        <Space>
          <UserOutlined />
          <Text>用户</Text>
          <DownOutlined />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default UserDropdown;
