// TO-DO: Standardize tables eventually

"use client";
import { useKeys } from "@/app/(dashboard)/hooks/keys/useKeys";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, SwitchVerticalIcon } from "@heroicons/react/outline";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Badge,
  Button,
  Icon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
} from "@tremor/react";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Popover, Skeleton, Tooltip, Typography } from "antd";
import DefaultProxyAdminTag from "../common_components/DefaultProxyAdminTag";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getModelDisplayName } from "../key_team_helpers/fetch_available_models_team_key";
import { KeyResponse, Team } from "../key_team_helpers/key_list";
import FilterComponent, { FilterOption } from "../molecules/filter";
import { Organization } from "../networking";
import KeyInfoView from "../templates/key_info_view";
import { useQuery } from "@tanstack/react-query";
import { fetchTeamFilterOptions } from "../key_team_helpers/filter_helpers";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";

interface TeamVirtualKeysTableProps {
  teamId: string;
  teamAlias?: string;
  organization: Organization | null;
}

/**
 * TeamVirtualKeysTable – variant of VirtualKeysTable scoped to a single team.
 * Displays all virtual keys belonging to the team with same format and styling.
 */
export function TeamVirtualKeysTable({ teamId, teamAlias, organization }: TeamVirtualKeysTableProps) {
  const { accessToken } = useAuthorized();
  const [selectedKey, setSelectedKey] = useState<KeyResponse | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [tablePagination, setTablePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [filters, setFilters] = useState<Record<string, string>>({
    "组织 ID": "",
    "密钥别名": "",
    "用户 ID": "",
    "排序依据": "created_at",
    "排序方式": "desc",
  });

  const sortBy = sorting.length > 0 ? sorting[0].id : "created_at";
  const sortOrder = sorting.length > 0 ? (sorting[0].desc ? "desc" : "asc") : "desc";

  const pageIndex = tablePagination.pageIndex;
  const pageSize = tablePagination.pageSize;

  const {
    data: keys,
    isPending: isLoading,
    isFetching,
    refetch,
  } = useKeys(pageIndex + 1, pageSize, {
    teamID: teamId,
    organizationID: filters["组织 ID"]?.trim() || undefined,
    selectedKeyAlias: filters["密钥别名"]?.trim() || undefined,
    userID: filters["用户 ID"]?.trim() || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
    expand: "user",
  });

  const displayKeys = useMemo(() => {
    const kList = keys?.keys || [];
    const orgId = organization?.organization_id;
    if (!orgId) return kList;
    return kList.map((k: KeyResponse) => ({
      ...k,
      organization_id: (k.organization_id ?? k.org_id) || orgId,
    }));
  }, [keys?.keys, organization?.organization_id]);

  const pageCount = keys?.total_pages ?? 0;
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});

  const currentTeam: Team = useMemo(
    () => ({
      team_id: teamId,
      team_alias: teamAlias || teamId,
      models: [],
      max_budget: null,
      budget_duration: null,
      tpm_limit: null,
      rpm_limit: null,
      organization_id: organization?.organization_id || "",
      created_at: "",
      keys: [],
      members_with_roles: [],
      spend: 0,
    }),
    [teamId, teamAlias, organization],
  );

  const teamFilterOptionsQuery = useQuery({
    queryKey: ["teamFilterOptions", teamId, accessToken],
    queryFn: async () => fetchTeamFilterOptions(accessToken, teamId),
    enabled: !!accessToken && !!teamId,
    staleTime: 30000, // 30 seconds - align with useKeys
  });
  const teamFilterOptions = teamFilterOptionsQuery.data || {
    keyAliases: [],
    organizationIds: [],
    userIds: [],
  };

  const handleStorageChange = useCallback(() => {
    refetch?.();
  }, [refetch]);

  useEffect(() => {
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [handleStorageChange]);

  const handleFilterChange = useCallback((newFilters: Record<string, string>, skipDebounce = false) => {
    setFilters((prev) => ({
      ...prev,
      "组织 ID": newFilters["组织 ID"] ?? prev["组织 ID"],
      "密钥别名": newFilters["密钥别名"] ?? prev["密钥别名"],
      "用户 ID": newFilters["用户 ID"] ?? prev["用户 ID"],
      "排序依据": newFilters["排序依据"] ?? prev["排序依据"] ?? "created_at",
      "排序方式": newFilters["排序方式"] ?? prev["排序方式"] ?? "desc",
    }));
    if (!skipDebounce) {
      setTablePagination((prev) => ({ ...prev, pageIndex: 0 }));
    }
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({
      "组织 ID": "",
      "密钥别名": "",
      "用户 ID": "",
      "排序依据": "created_at",
      "排序方式": "desc",
    });
    setTablePagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const filterOptions: FilterOption[] = useMemo(
    () => [
      {
        name: "组织 ID",
        label: "组织 ID",
        isSearchable: true,
        searchFn: async (searchText: string) => {
          const { organizationIds } = teamFilterOptions;
          if (!organizationIds.length) return [];
          const lower = searchText.toLowerCase();
          const filtered = lower
            ? organizationIds.filter((id) => id.toLowerCase().includes(lower))
            : organizationIds;
          return filtered.map((id) => ({ label: id, value: id }));
        },
      },
      {
        name: "密钥别名",
        label: "密钥别名",
        isSearchable: true,
        searchFn: async (searchText: string) => {
          const { keyAliases } = teamFilterOptions;
          const lower = searchText.toLowerCase();
          const filtered = lower
            ? keyAliases.filter((alias) => alias.toLowerCase().includes(lower))
            : keyAliases;
          return filtered.map((alias) => ({ label: alias, value: alias }));
        },
      },
      {
        name: "用户 ID",
        label: "用户 ID",
        isSearchable: true,
        searchFn: async (searchText: string) => {
          const { userIds } = teamFilterOptions;
          const lower = searchText.toLowerCase();
          const filtered = lower
            ? userIds.filter(
                (u) =>
                  u.id.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower),
              )
            : userIds;
          return filtered.map((u) => ({
            label: u.email ? `${u.id} (${u.email})` : u.id,
            value: u.id,
          }));
        },
      },
    ],
    [teamFilterOptions],
  );

  const columns: ColumnDef<KeyResponse>[] = useMemo(
    () => [
      {
        id: "token",
        accessorKey: "token",
        header: "密钥 ID",
        size: 100,
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue() as string;
          const width = info.cell.column.getSize();
          return (
            <Tooltip title={value}>
              <Button
                size="xs"
                variant="light"
                className="font-mono text-blue-500 bg-blue-50 hover:bg-blue-100 text-xs font-normal px-2 py-0.5 text-left overflow-hidden truncate block"
                style={{ maxWidth: width, overflow: "hidden" }}
                onClick={() => setSelectedKey(info.row.original)}
              >
                {value ?? "-"}
              </Button>
            </Tooltip>
          );
        },
      },
      {
        id: "key_alias",
        accessorKey: "key_alias",
        header: "密钥别名",
        size: 150,
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue() as string;
          const width = info.cell.column.getSize();
          return (
            <Tooltip title={value}>
              <span
                className="font-mono text-xs truncate block"
                style={{ maxWidth: width, overflow: "hidden" }}
              >
                {value ?? "-"}
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: "key_name",
        accessorKey: "key_name",
        header: "密钥",
        size: 120,
        enableSorting: false,
        cell: (info) => <span className="font-mono text-xs">{info.getValue() as string}</span>,
      },
      {
        id: "organization_id",
        accessorKey: "organization_id",
        header: "组织 ID",
        size: 140,
        enableSorting: false,
        cell: (info) => (info.getValue() ? info.renderValue() : "-"),
      },
      {
        id: "user_email",
        accessorKey: "user",
        header: "用户邮箱",
        size: 160,
        enableSorting: false,
        cell: (info) => {
          const user = info.getValue() as { user_email?: string } | undefined;
          const value = user?.user_email;
          const width = info.cell.column.getSize();
          return (
            <Tooltip title={value}>
              <span
                className="font-mono text-xs truncate block"
                style={{ maxWidth: width, overflow: "hidden" }}
              >
                {value ?? "-"}
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: "user_id",
        accessorKey: "user_id",
        header: "用户 ID",
        size: 70,
        enableSorting: false,
        cell: (info) => {
          const userId = info.getValue() as string | null;
          const displayValue = userId === "default_user_id" ? "Default Proxy Admin" : userId;
          const width = info.cell.column.getSize();
          return (
            <Tooltip title={displayValue}>
              <span
                className="font-mono text-xs truncate block"
                style={{ maxWidth: width, overflow: "hidden" }}
              >
                {displayValue ?? "-"}
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: "created_at",
        accessorKey: "created_at",
        header: "创建时间",
        size: 120,
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue();
          return value ? new Date(value as string).toLocaleDateString() : "-";
        },
      },
      {
        id: "created_by",
        accessorKey: "created_by",
        header: "创建者",
        size: 70,
        enableSorting: false,
        cell: (info) => {
          const userId = info.getValue() as string | null;
          if (!userId) return "-";
          const { created_by_user } = info.row.original;
          const userAlias = created_by_user?.user_alias ?? null;
          const userEmail = created_by_user?.user_email ?? null;
          const isDefaultAdmin = userId === "default_user_id";
          const displayValue = userAlias || userEmail || userId;
          const width = info.cell.column.getSize();

          const popoverContent = (
            <div className="flex flex-col gap-2 text-xs min-w-[200px] max-w-[300px]">
              {[
                { label: "用户别名", value: userAlias },
                { label: "用户邮箱", value: userEmail },
                { label: "用户 ID", value: userId },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col min-w-0">
                  <span className="text-gray-400">{label}</span>
                  {value ? (
                    <Typography.Text
                      className="font-mono text-xs"
                      ellipsis={{ tooltip: value }}
                      copyable
                    >
                      {value}
                    </Typography.Text>
                  ) : (
                    <span className="font-mono">-</span>
                  )}
                </div>
              ))}
            </div>
          );

          if (isDefaultAdmin && !userAlias && !userEmail) {
            return (
              <Popover content={popoverContent} trigger="hover" placement="bottomLeft">
                <span className="cursor-default">
                  <DefaultProxyAdminTag userId={userId} />
                </span>
              </Popover>
            );
          }

          return (
            <Popover content={popoverContent} trigger="hover" placement="bottomLeft">
              <span
                className="font-mono text-xs truncate block cursor-default"
                style={{ maxWidth: width, overflow: "hidden" }}
              >
                {displayValue}
              </span>
            </Popover>
          );
        },
      },
      {
        id: "updated_at",
        accessorKey: "updated_at",
        header: "Updated At",
        size: 120,
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue();
          return value ? new Date(value as string).toLocaleDateString() : "从未";
        },
      },
      {
        id: "last_active",
        accessorKey: "last_active",
        header: () => (
          <span className="flex items-center gap-1">
            上次活跃
            <Popover
              content="这是一个新字段，不会回填。只有新的密钥使用才会更新此值。"
              trigger="hover"
            >
              <InfoCircleOutlined className="text-gray-400 text-xs cursor-help" />
            </Popover>
          </span>
        ),
        size: 130,
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue();
          if (!value) return "未知";
          const date = new Date(value as string);
          return (
            <Tooltip title={date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" })}>
              <span>{date.toLocaleDateString()}</span>
            </Tooltip>
          );
        },
      },
      {
        id: "expires",
        accessorKey: "expires",
        header: "过期时间",
        size: 120,
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue();
          return value ? new Date(value as string).toLocaleDateString() : "永不过期";
        },
      },
      {
        id: "spend",
        accessorKey: "spend",
        header: "消费 (USD)",
        size: 100,
        enableSorting: true,
        cell: (info) => formatNumberWithCommas(info.getValue() as number, 4),
      },
      {
        id: "max_budget",
        accessorKey: "max_budget",
        header: "预算 (USD)",
        size: 110,
        enableSorting: true,
        cell: (info) => {
          const maxBudget = info.getValue() as number | null;
          if (maxBudget === null) return "无限制";
          return `$${formatNumberWithCommas(maxBudget)}`;
        },
      },
      {
        id: "budget_reset_at",
        accessorKey: "budget_reset_at",
        header: "预算重置",
        size: 130,
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue();
          return value ? new Date(value as string).toLocaleString() : "从不";
        },
      },
      {
        id: "models",
        accessorKey: "models",
        header: "模型",
        size: 200,
        enableSorting: false,
        cell: (info) => {
          const models = info.getValue() as string[];
          return (
            <div className="flex flex-col py-2">
              {Array.isArray(models) ? (
                <div className="flex flex-col">
                  {models.length === 0 ? (
                      <Badge size="xs" className="mb-1" color="red">
                        <Text>所有代理模型</Text>
                      </Badge>
                  ) : (
                    <>
                      <div className="flex items-start">
                        {models.length > 3 && (
                          <div>
                            <Icon
                              icon={expandedAccordions[info.row.id] ? ChevronDownIcon : ChevronRightIcon}
                              className="cursor-pointer"
                              size="xs"
                              onClick={() =>
                                setExpandedAccordions((prev) => ({
                                  ...prev,
                                  [info.row.id]: !prev[info.row.id],
                                }))
                              }
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {models.slice(0, 3).map((model, index) =>
                            model === "all-proxy-models" ? (
                              <Badge key={index} size="xs" color="red">
                                <Text>所有代理模型</Text>
                              </Badge>
                            ) : (
                              <Badge key={index} size="xs" color="blue">
                                <Text>
                                  {model.length > 30
                                    ? `${getModelDisplayName(model).slice(0, 30)}...`
                                    : getModelDisplayName(model)}
                                </Text>
                              </Badge>
                            ),
                          )}
                          {models.length > 3 && !expandedAccordions[info.row.id] && (
                            <Badge size="xs" color="gray" className="cursor-pointer">
                              <Text>
                                +{models.length - 3} {models.length - 3 === 1 ? "more model" : "more models"}
                              </Text>
                            </Badge>
                          )}
                          {expandedAccordions[info.row.id] && (
                            <div className="flex flex-wrap gap-1">
                              {models.slice(3).map((model, index) =>
                                model === "all-proxy-models" ? (
                                  <Badge key={index + 3} size="xs" color="red">
                                    <Text>所有代理模型</Text>
                                  </Badge>
                                ) : (
                                  <Badge key={index + 3} size="xs" color="blue">
                                    <Text>
                                      {model.length > 30
                                        ? `${getModelDisplayName(model).slice(0, 30)}...`
                                        : getModelDisplayName(model)}
                                    </Text>
                                  </Badge>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "rate_limits",
        header: "速率限制",
        size: 140,
        enableSorting: false,
        cell: ({ row }) => {
          const key = row.original;
          return (
            <div>
              <div>TPM: {key.tpm_limit !== null ? key.tpm_limit : "无限制"}</div>
              <div>RPM: {key.rpm_limit !== null ? key.rpm_limit : "无限制"}</div>
            </div>
          );
        },
      },
    ],
    [expandedAccordions],
  );

  const handleSortingChange = useCallback(
    (updaterOrValue: React.SetStateAction<SortingState>) => {
      const newSorting =
        typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
      setSorting(newSorting);
      if (newSorting?.length > 0) {
        const sortState = newSorting[0];
        handleFilterChange(
          {
            "排序依据": sortState.id,
            "排序方式": sortState.desc ? "desc" : "asc",
          },
          true,
        );
      }
    },
    [sorting, handleFilterChange],
  );

  const table = useReactTable({
    data: displayKeys,
    columns,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    state: { sorting, pagination: tablePagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setTablePagination,
    getCoreRowModel: getCoreRowModel(),
    // getSortedRowModel not needed — manualSorting: true delegates sorting to the server
    enableSorting: true,
    manualSorting: true, // Server sorts via useKeys. Avoid redundant client-side sort
    manualPagination: true,
    pageCount: pageCount,
  });

  return (
    <div className="w-full h-full overflow-hidden">
      {selectedKey ? (
        <KeyInfoView
          keyId={selectedKey.token}
          onClose={() => setSelectedKey(null)}
          keyData={selectedKey}
          teams={[currentTeam]}
          onDelete={refetch}
        />
      ) : (
        <div className="border-b py-4 flex-1 overflow-hidden">
          <div className="w-full mb-6">
            <FilterComponent
              options={filterOptions}
              onApplyFilters={handleFilterChange}
              initialValues={filters}
              onResetFilters={handleFilterReset}
            />
          </div>

          <div className="flex items-center justify-end w-full mb-4">
            <div className="inline-flex items-center gap-2">
              {isLoading || isFetching ? (
                <Skeleton.Node active style={{ width: 74, height: 20 }} />
              ) : (
                <span className="text-sm text-gray-700">
                  第 {pageIndex + 1} 页，共 {table.getPageCount()} 页
                </span>
              )}

              {isLoading || isFetching ? (
                <Skeleton.Button active size="small" style={{ width: 84, height: 30 }} />
              ) : (
                <button
                  onClick={() => table.previousPage()}
                  disabled={isLoading || isFetching || !table.getCanPreviousPage()}
                  className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
              )}

              {isLoading || isFetching ? (
                <Skeleton.Button active size="small" style={{ width: 58, height: 30 }} />
              ) : (
                <button
                  onClick={() => table.nextPage()}
                  disabled={isLoading || isFetching || !table.getCanNextPage()}
                  className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              )}
            </div>
          </div>
          <div className="h-[75vh] overflow-auto">
            <div className="rounded-lg custom-border relative">
              <div className="overflow-x-auto">
                <Table className="[&_td]:py-0.5 [&_th]:py-1" style={{ width: table.getCenterTotalSize() }}>
                  <TableHead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHeaderCell
                            key={header.id}
                            data-header-id={header.id}
                            className={`py-1 h-8 relative hover:bg-gray-50 ${
                              header.id === "actions"
                                ? "sticky right-0 bg-white shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.1)]"
                                : ""
                            }`}
                            style={{
                              width: header.getSize(),
                              position: "relative",
                              cursor: header.column.getCanSort() ? "pointer" : "default",
                            }}
                            onMouseEnter={() => {
                              const resizer = document.querySelector(
                                `[data-header-id="${header.id}"] .resizer`,
                              );
                              if (resizer) (resizer as HTMLElement).style.opacity = "0.5";
                            }}
                            onMouseLeave={() => {
                              const resizer = document.querySelector(
                                `[data-header-id="${header.id}"] .resizer`,
                              );
                              if (resizer && !header.column.getIsResizing())
                                (resizer as HTMLElement).style.opacity = "0";
                            }}
                            onClick={
                              header.column.getCanSort()
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center">
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                              {header.id !== "actions" && header.column.getCanSort() && (
                                <div className="w-4">
                                  {header.column.getIsSorted() ? (
                                    {
                                      asc: <ChevronUpIcon className="h-4 w-4 text-blue-500" />,
                                      desc: <ChevronDownIcon className="h-4 w-4 text-blue-500" />,
                                    }[header.column.getIsSorted() as string]
                                  ) : (
                                    <SwitchVerticalIcon className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              )}
                              <div
                                onDoubleClick={() => header.column.resetSize()}
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className={`resizer ${table.options.columnResizeDirection} ${
                                  header.column.getIsResizing() ? "isResizing" : ""
                                }`}
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: 0,
                                  height: "100%",
                                  width: "5px",
                                  background: header.column.getIsResizing() ? "#3b82f6" : "transparent",
                                  cursor: "col-resize",
                                  userSelect: "none",
                                  touchAction: "none",
                                  opacity: header.column.getIsResizing() ? 1 : 0,
                                }}
                              />
                            </div>
                          </TableHeaderCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableHead>
                  <TableBody>
                    {isLoading || isFetching ? (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-8 text-center">
                          <div className="text-center text-gray-500">
                            <p>正在加载密钥...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : displayKeys.length > 0 ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="h-8">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              style={{
                                width: cell.column.getSize(),
                                maxWidth: "8-x",
                                whiteSpace: "pre-wrap",
                                overflow: "hidden",
                              }}
                              className={`py-0.5 max-h-8 overflow-hidden text-ellipsis whitespace-nowrap ${
                                cell.column.id === "models" &&
                                Array.isArray(cell.getValue()) &&
                                (cell.getValue() as string[]).length > 3
                                  ? "px-0"
                                  : ""
                              }`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-8 text-center">
                          <div className="text-center text-gray-500">
                            <p>未找到密钥</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
