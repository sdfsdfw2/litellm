import React from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";

type OnboardingFormBodyProps = {
  variant: "signup" | "reset_password";
  userEmail: string;
  isPending: boolean;
  claimError: string | null;
  onSubmit: (values: { password: string }) => void;
};

export function OnboardingFormBody({
  variant,
  userEmail,
  isPending,
  claimError,
  onSubmit,
}: OnboardingFormBodyProps) {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (userEmail) form.setFieldValue("user_email", userEmail);
  }, [userEmail, form]);

  return (
    <div className="mx-auto w-full max-w-md mt-10">
      <Card>
        <Typography.Title level={5} className="text-center mb-5">
          🚅 LiteLLM
        </Typography.Title>
        <Typography.Title level={3}>
          {variant === "reset_password" ? "Reset Password" : "Sign Up"}
        </Typography.Title>
        <Typography.Text>
          {variant === "reset_password"
            ? "重置密码以访问管理界面。"
            : "认领用户账户以登录管理界面。"}
        </Typography.Text>

        {variant === "signup" && (
          <Alert
            className="mt-4"
            type="info"
            message="SSO"
            description={
              <div className="flex justify-between items-center">
                <span>SSO 属于企业版功能。</span>
                <Button
                  type="primary"
                  size="small"
                  href="https://forms.gle/W3U4PZpJGFHWtHyA9"
                  target="_blank"
                >
                  免费试用
                </Button>
              </div>
            }
            showIcon
          />
        )}

        <Form className="mt-10 mb-5" layout="vertical" form={form} onFinish={(values) => onSubmit({ password: values.password })}>
          <Form.Item label="邮箱地址" name="user_email">
            <Input type="email" disabled />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "需要输入密码才能注册" }]}
            help={
              variant === "reset_password"
                ? "输入您的新密码"
                : "为您的账户创建密码"
            }
          >
            <Input.Password />
          </Form.Item>

          {claimError && (
            <Alert type="error" message={claimError} showIcon className="mb-4" />
          )}

          <div className="mt-10">
            <Button htmlType="submit" loading={isPending}>
          {variant === "reset_password" ? "重置密码" : "注册"}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
