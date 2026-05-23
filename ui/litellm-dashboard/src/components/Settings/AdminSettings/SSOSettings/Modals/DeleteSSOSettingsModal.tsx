import { useEditSSOSettings } from "@/app/(dashboard)/hooks/sso/useEditSSOSettings";
import { useSSOSettings } from "@/app/(dashboard)/hooks/sso/useSSOSettings";
import React from "react";
import DeleteResourceModal from "../../../../common_components/DeleteResourceModal";
import NotificationsManager from "../../../../molecules/notifications_manager";
import { parseErrorMessage } from "../../../../shared/errorUtils";
import { detectSSOProvider } from "../utils";

interface DeleteSSOSettingsModalProps {
  isVisible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const DeleteSSOSettingsModal: React.FC<DeleteSSOSettingsModalProps> = ({ isVisible, onCancel, onSuccess }) => {
  const { data: ssoSettings } = useSSOSettings();
  const { mutateAsync: editSSOSettings, isPending: isEditingSSOSettings } = useEditSSOSettings();

  // Handle clearing SSO settings
  const handleClearSSO = async () => {
    const clearSettings = {
      google_client_id: null,
      google_client_secret: null,
      microsoft_client_id: null,
      microsoft_client_secret: null,
      microsoft_tenant: null,
      generic_client_id: null,
      generic_client_secret: null,
      generic_authorization_endpoint: null,
      generic_token_endpoint: null,
      generic_userinfo_endpoint: null,
      proxy_base_url: null,
      user_email: null,
      sso_provider: null,
      role_mappings: null,
      team_mappings: null,
    };

    await editSSOSettings(clearSettings, {
      onSuccess: () => {
        NotificationsManager.success("SSO 设置已清除");
        onCancel();
        onSuccess();
      },
      onError: (error) => {
        NotificationsManager.fromBackend("清除 SSO 设置失败: " + parseErrorMessage(error));
      },
    });
  };

  return (
    <DeleteResourceModal
      isOpen={isVisible}
      title="确认清除 SSO 设置"
      alertMessage="此操作无法撤消。"
      message="确定要清除所有 SSO 设置吗？更改后用户将无法再使用 SSO 登录。"
      resourceInformationTitle="SSO 设置"
      resourceInformation={[
        { label: "提供商", value: (ssoSettings?.values && detectSSOProvider(ssoSettings?.values)) || "通用" },
      ]}
      onCancel={onCancel}
      onOk={handleClearSSO}
      confirmLoading={isEditingSSOSettings}
    />
  );
};

export default DeleteSSOSettingsModal;
