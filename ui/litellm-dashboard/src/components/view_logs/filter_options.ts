import FilterTeamDropdown from "../common_components/FilterTeamDropdown";
import { PaginatedKeyAliasSelect } from "../KeyAliasSelect/PaginatedKeyAliasSelect/PaginatedKeyAliasSelect";
import { PaginatedModelSelect } from "../ModelSelect/PaginatedModelSelect/PaginatedModelSelect";
import { FilterOption } from "../molecules/filter";
import { allEndUsersCall } from "../networking";
import { ERROR_CODE_OPTIONS } from "./constants";
import { FILTER_KEYS } from "./log_filter_logic";

export function getLogFilterOptions(accessToken: string): FilterOption[] {
  return [
    {
      name: "Team ID",
      label: "团队ID",
      customComponent: FilterTeamDropdown,
    },
    {
      name: "Status",
      label: "状态",
      isSearchable: false,
      options: [
        { label: "成功", value: "success" },
        { label: "失败", value: "failure" },
      ],
    },
    {
      name: "Model",
      label: "模型",
      customComponent: PaginatedModelSelect,
    },
    {
      name: FILTER_KEYS.PUBLIC_MODEL_OR_SEARCH_TOOL,
      label: "公开模型/搜索工具",
      isSearchable: false,
    },
    {
      name: "Key Alias",
      label: "密钥别名",
      customComponent: PaginatedKeyAliasSelect,
    },
    {
      name: "End User",
      label: "最终用户",
      isSearchable: true,
      searchFn: async (searchText: string) => {
        const data = await allEndUsersCall(accessToken);
        const users = data?.map((u: any) => u.user_id) || [];
        const filtered = users.filter((u: string) => u.toLowerCase().includes(searchText.toLowerCase()));
        return filtered.map((u: string) => ({ label: u, value: u }));
      },
    },
    {
      name: "Error Code",
      label: "错误码",
      isSearchable: true,
      searchFn: async (searchText: string) => {
        if (!searchText) return ERROR_CODE_OPTIONS;
        const lower = searchText.toLowerCase();
        const filtered = ERROR_CODE_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(lower));
        const isExactValue = ERROR_CODE_OPTIONS.some((opt) => opt.value === searchText.trim());
        if (!isExactValue && searchText.trim()) {
          filtered.push({ label: `使用自定义码: ${searchText.trim()}`, value: searchText.trim() });
        }
        return filtered;
      },
    },
    {
      name: "Key Hash",
      label: "密钥哈希",
      isSearchable: false,
    },
    {
      name: "Error Message",
      label: "错误信息",
      isSearchable: false,
    },
  ];
}
