import React from "react";
import { TextInput, Accordion, AccordionHeader, AccordionBody } from "@tremor/react";
import { Button as Button2, Modal, Form, InputNumber, Select } from "antd";
import { useCreateBudget } from "@/app/(dashboard)/hooks/budgets/useBudgets";
import NotificationsManager from "../molecules/notifications_manager";

interface BudgetModalProps {
  isModalVisible: boolean;
  setIsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
const BudgetModal: React.FC<BudgetModalProps> = ({ isModalVisible, setIsModalVisible }) => {
  const [form] = Form.useForm();
  const createBudget = useCreateBudget();

  const handleOk = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleCreate = async (formValues: Record<string, any>) => {
    try {
      NotificationsManager.info("Making API Call");
      await createBudget.mutateAsync(formValues);
      NotificationsManager.success("Budget Created");
      form.resetFields();
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error creating the budget:", error);
      NotificationsManager.fromBackend(`Error creating the budget: ${error}`);
    }
  };

  return (
    <Modal
      title="创建预算"
      open={isModalVisible}
      width={800}
      footer={null}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <Form form={form} onFinish={handleCreate} labelCol={{ span: 8 }} wrapperCol={{ span: 16 }} labelAlign="left">
        <>
          <Form.Item
            label="预算ID"
            name="budget_id"
            rules={[
              {
                required: true,
                message: "请输入一个易于识别的预算名称",
              },
            ]}
            help="一个易于识别的预算名称"
          >
            <TextInput placeholder="" />
          </Form.Item>
          <Form.Item label="每分钟最大Token数" name="tpm_limit" help="Default is model limit.">
            <InputNumber step={1} precision={2} width={200} />
          </Form.Item>
          <Form.Item label="每分钟最大请求数" name="rpm_limit" help="Default is model limit.">
            <InputNumber step={1} precision={2} width={200} />
          </Form.Item>

          <Accordion className="mt-20 mb-8">
            <AccordionHeader>
              <b>可选设置</b>
            </AccordionHeader>
            <AccordionBody>
              <Form.Item label="最大预算（USD）" name="max_budget">
                <InputNumber step={0.01} precision={2} width={200} />
              </Form.Item>
              <Form.Item className="mt-8" label="预算重置周期" name="budget_duration">
                <Select defaultValue={null} placeholder="n/a">
                  <Select.Option value="24h">每天</Select.Option>
                  <Select.Option value="7d">每周</Select.Option>
                  <Select.Option value="30d">每月</Select.Option>
                </Select>
              </Form.Item>
            </AccordionBody>
          </Accordion>
        </>

        <div style={{ textAlign: "right", marginTop: "10px" }}>
          <Button2 htmlType="submit">创建预算</Button2>
        </div>
      </Form>
    </Modal>
  );
};

export default BudgetModal;
