import { Empty, Typography, Button } from "antd";

const { Title, Paragraph } = Typography;

interface SSOSettingsEmptyPlaceholderProps {
  onAdd: () => void;
}

export default function SSOSettingsEmptyPlaceholder({ onAdd }: SSOSettingsEmptyPlaceholderProps) {
  return (
    <div className="bg-white p-12 rounded-lg border border-dashed border-gray-300 text-center w-full">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div className="space-y-2">
            <Title level={4}>未找到 SSO 配置</Title>
            <Paragraph type="secondary" className="max-w-md mx-auto">
              配置单点登录 (SSO)，使用您的身份提供商为团队成员实现无缝认证。
            </Paragraph>
          </div>
        }
      >
        <Button type="primary" size="large" onClick={onAdd} className="flex items-center gap-2 mx-auto mt-4">
          配置 SSO
        </Button>
      </Empty>
    </div>
  );
}
