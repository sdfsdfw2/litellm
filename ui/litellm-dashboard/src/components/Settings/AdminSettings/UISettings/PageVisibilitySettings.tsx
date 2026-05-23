"use client";

import { getAvailablePages } from "@/components/page_utils";
import { Button, Checkbox, Collapse, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";

interface PageVisibilitySettingsProps {
  enabledPagesInternalUsers: string[] | null | undefined;
  enabledPagesPropertyDescription?: string;
  isUpdating: boolean;
  onUpdate: (settings: { enabled_ui_pages_internal_users: string[] | null }) => void;
}

export default function PageVisibilitySettings({
  enabledPagesInternalUsers,
  enabledPagesPropertyDescription,
  isUpdating,
  onUpdate,
}: PageVisibilitySettingsProps) {
  // Check if page visibility is set (null/undefined means "not set" = all pages visible)
  const isPageVisibilitySet = enabledPagesInternalUsers !== null && enabledPagesInternalUsers !== undefined;

  // Get available pages from leftnav configuration
  const availablePages = useMemo(() => getAvailablePages(), []);

  // Group pages by their group for better UI
  const pagesByGroup = useMemo(() => {
    const grouped: Record<string, typeof availablePages> = {};
    availablePages.forEach((page) => {
      if (!grouped[page.group]) {
        grouped[page.group] = [];
      }
      grouped[page.group].push(page);
    });
    return grouped;
  }, [availablePages]);

  // Local state for page selection
  const [selectedPages, setSelectedPages] = useState<string[]>(enabledPagesInternalUsers || []);

  // Update local state when data changes
  useMemo(() => {
    if (enabledPagesInternalUsers) {
      setSelectedPages(enabledPagesInternalUsers);
    } else {
      setSelectedPages([]);
    }
  }, [enabledPagesInternalUsers]);

  const handleSavePageVisibility = () => {
    onUpdate({ enabled_ui_pages_internal_users: selectedPages.length > 0 ? selectedPages : null });
  };

  const handleResetToDefault = () => {
    setSelectedPages([]);
    onUpdate({ enabled_ui_pages_internal_users: null });
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space direction="vertical" size={4}>
        <Space align="center">
          <Typography.Text strong>内部用户页面可见性</Typography.Text>
          {!isPageVisibilitySet && (
            <Tag color="default" style={{ marginLeft: "8px" }}>
              未设置（所有页面可见）
            </Tag>
          )}
          {isPageVisibilitySet && (
            <Tag color="blue" style={{ marginLeft: "8px" }}>
              已选择 {selectedPages.length} 个页面
            </Tag>
          )}
        </Space>
        {enabledPagesPropertyDescription && (
          <Typography.Text type="secondary">{enabledPagesPropertyDescription}</Typography.Text>
        )}
        <Typography.Text type="secondary" style={{ fontSize: "12px", fontStyle: "italic" }}>
          默认情况下，所有页面都对内部用户可见。选择特定页面以限制可见性。
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: "12px", color: "#8b5cf6" }}>
          注意：此处仅显示内部用户角色可访问的页面。仅管理员页面已被排除，因为无论此设置如何，它们都无法对内部用户可见。
        </Typography.Text>
      </Space>

      <Collapse
        items={[
          {
            key: "page-visibility",
            label: "配置页面可见性",
            children: (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Checkbox.Group value={selectedPages} onChange={setSelectedPages} style={{ width: "100%" }}>
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    {Object.entries(pagesByGroup).map(([groupName, pages]) => (
                      <div key={groupName}>
                        <Typography.Text
                          strong
                          style={{
                            fontSize: "11px",
                            color: "#6b7280",
                            letterSpacing: "0.05em",
                            display: "block",
                            marginBottom: "8px",
                          }}
                        >
                          {groupName}
                        </Typography.Text>
                        <Space direction="vertical" size="small" style={{ marginLeft: "16px", width: "100%" }}>
                          {pages.map((page) => (
                            <div key={page.page} style={{ marginBottom: "4px" }}>
                              <Checkbox value={page.page}>
                                <Space direction="vertical" size={0}>
                                  <Typography.Text>{page.label}</Typography.Text>
                                  <Typography.Text type="secondary" style={{ fontSize: "12px" }}>
                                    {page.description}
                                  </Typography.Text>
                                </Space>
                              </Checkbox>
                            </div>
                          ))}
                        </Space>
                      </div>
                    ))}
                  </Space>
                </Checkbox.Group>

                <Space>
                  <Button type="primary" onClick={handleSavePageVisibility} loading={isUpdating} disabled={isUpdating}>
                    保存页面可见性设置
                  </Button>
                  {isPageVisibilitySet && (
                    <Button onClick={handleResetToDefault} loading={isUpdating} disabled={isUpdating}>
                      重置为默认（所有页面）
                    </Button>
                  )}
                </Space>
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
}
