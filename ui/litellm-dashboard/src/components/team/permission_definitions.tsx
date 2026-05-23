export interface PermissionInfo {
  method: string;
  endpoint: string;
  description: string;
  route: string;
}

/**
 * Map of permission endpoint patterns to their descriptions
 */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "/key/generate": "成员可以为此团队生成虚拟密钥",
  "/key/service-account/generate":
    "成员可以为此团队生成服务账户密钥（不属于任何用户）",
  "/key/update": "成员可以更新属于此团队的虚拟密钥",
  "/key/delete": "成员可以删除属于此团队的虚拟密钥",
  "/key/info": "成员可以获取属于此团队的虚拟密钥信息",
  "/key/regenerate": "成员可以重新生成属于此团队的虚拟密钥",
  "/key/{key_id}/regenerate": "成员可以重新生成属于此团队的虚拟密钥",
  "/key/list": "成员可以列出属于此团队的虚拟密钥",
  "/key/block": "成员可以封禁属于此团队的虚拟密钥",
  "/key/unblock": "成员可以解封属于此团队的虚拟密钥",
  "/team/daily/activity":
    "成员可以查看所有团队使用数据（不仅是自己的）",
  "/spend/logs":
    "成员可以查看整个团队的消费日志（不仅是自己的）",
};

/**
 * Determines the HTTP method for a given permission endpoint
 */
export const getMethodForEndpoint = (endpoint: string): string => {
  if (endpoint.includes("/info") || endpoint.includes("/list") || endpoint.includes("/activity") || endpoint === "/spend/logs") {
    return "GET";
  }
  return "POST";
};

/**
 * Parses a permission string into a structured PermissionInfo object
 */
export const getPermissionInfo = (permission: string): PermissionInfo => {
  const method = getMethodForEndpoint(permission);
  const endpoint = permission;

  // Find exact match or fallback to default description
  let description = PERMISSION_DESCRIPTIONS[permission];

  // If no exact match, try to find a partial match based on patterns
  if (!description) {
    for (const [pattern, desc] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      if (permission.includes(pattern)) {
        description = desc;
        break;
      }
    }
  }

  // Fallback if no match found
  if (!description) {
    description = `访问 ${permission}`;
  }

  return {
    method,
    endpoint,
    description,
    route: permission,
  };
};
