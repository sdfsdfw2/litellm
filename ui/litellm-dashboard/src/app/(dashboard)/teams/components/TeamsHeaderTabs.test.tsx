import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import TeamsHeaderTabs from "./TeamsHeaderTabs";

vi.mock("@tremor/react", () => ({
  TabGroup: ({ children, ...props }: any) => <div data-testid="tab-group" {...props}>{children}</div>,
  TabList: ({ children, ...props }: any) => <div data-testid="tab-list" {...props}>{children}</div>,
  Tab: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  TabPanels: ({ children, ...props }: any) => <div data-testid="tab-panels" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Icon: ({ onClick, ...props }: any) => <button data-testid="refresh-icon" onClick={onClick} />,
}));

vi.mock("@heroicons/react/outline", () => ({
  RefreshIcon: () => <svg data-testid="refresh-svg" />,
}));

const renderTabs = (props: Partial<Parameters<typeof TeamsHeaderTabs>[0]> = {}) => {
  const defaults = {
    lastRefreshed: "",
    onRefresh: vi.fn(),
    userRole: "Internal User",
    children: <div data-testid="panel-content">Panel</div>,
  };
  return render(<TeamsHeaderTabs {...defaults} {...props} />);
};

describe("TeamsHeaderTabs", () => {
  it("should render '我的团队' and '可加入的团队' tabs", () => {
    renderTabs();

    expect(screen.getByText("我的团队")).toBeInTheDocument();
    expect(screen.getByText("可加入的团队")).toBeInTheDocument();
  });

  it("should render '默认团队设置' tab when user is Admin", () => {
    renderTabs({ userRole: "Admin" });

    expect(screen.getByText("默认团队设置")).toBeInTheDocument();
  });

  it("should not render '默认团队设置' tab for non-admin users", () => {
    renderTabs({ userRole: "Internal User" });

    expect(screen.queryByText("默认团队设置")).not.toBeInTheDocument();
  });

  it("should display last refreshed time when provided", () => {
    renderTabs({ lastRefreshed: "2024-06-01 12:00:00" });

    expect(screen.getByText("上次刷新: 2024-06-01 12:00:00")).toBeInTheDocument();
  });
});
