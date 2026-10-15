import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { agentConfigApi, type AgentConfigItem } from '../../../services/agent-config';
import './style.css';

const { Title } = Typography;

const statusMap: Record<number, { label: string; color: string }> = {
  1: { label: '启用', color: 'green' },
  0: { label: '禁用', color: 'red' },
};

const agentTypeColorMap: Record<string, string> = {
  collection: 'blue',
  assessment: 'orange',
  decision: 'green',
};

const agentTypeOptions = [
  { label: 'collection', value: 'collection' },
  { label: 'assessment', value: 'assessment' },
  { label: 'decision', value: 'decision' },
];

export default function AgentConfigPage() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<AgentConfigItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<AgentConfigItem | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchList = useCallback(async (keyword?: string) => {
    setLoading(true);
    try {
      const data = await agentConfigApi.getList({ keyword });
      setList(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const handleSearch = () => {
    fetchList(searchKeyword);
  };

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      let parsedConfig: any = values.config;
      if (typeof values.config === 'string' && values.config.trim()) {
        try {
          parsedConfig = JSON.parse(values.config);
        } catch {
          message.error('配置必须是合法的 JSON');
          return;
        }
      }
      await agentConfigApi.create({ ...values, config: parsedConfig, status: 1 });
      message.success('Agent配置创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      fetchList();
    } catch { /* validation error */ }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!currentItem) return;
      let parsedConfig: any = values.config;
      if (typeof values.config === 'string' && values.config.trim()) {
        try {
          parsedConfig = JSON.parse(values.config);
        } catch {
          message.error('配置必须是合法的 JSON');
          return;
        }
      }
      const { agentType, ...rest } = values;
      await agentConfigApi.update(currentItem.id, { ...rest, config: parsedConfig });
      message.success('Agent配置已更新');
      setEditOpen(false);
      fetchList();
    } catch { /* validation error */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await agentConfigApi.remove(id);
      message.success('Agent配置已删除');
      fetchList();
    } catch { /* ignore */ }
  };

  const columns: ColumnsType<AgentConfigItem> = [
    { title: 'Agent名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: 'Agent类型',
      dataIndex: 'agentType',
      key: 'agentType',
      width: 140,
      render: (t: string) => <Tag color={agentTypeColorMap[t] || 'default'}>{t}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: number) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label || '未知'}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentItem(record);
              editForm.setFieldsValue({
                ...record,
                config:
                  typeof record.config === 'string'
                    ? record.config
                    : JSON.stringify(record.config ?? {}, null, 2),
              });
              setEditOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该Agent配置？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="agent-config-page">
      <Title level={2}>Agent配置管理</Title>

      <Card>
        <div className="agent-config-toolbar">
          <Space>
            <Input
              placeholder="搜索Agent配置..."
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 240 }}
              allowClear
            />
            <Button icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchList(searchKeyword)} loading={loading}>
              刷新
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { createForm.resetFields(); setCreateOpen(true); }}
          >
            新增配置
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新增Agent配置"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
        width={640}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item name="agentType" label="Agent类型" rules={[{ required: true, message: '请选择Agent类型' }]}>
            <Select placeholder="请选择Agent类型" options={agentTypeOptions} />
          </Form.Item>
          <Form.Item name="name" label="Agent名称" rules={[{ required: true, message: '请输入Agent名称' }]}>
            <Input placeholder="请输入Agent名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="config" label="配置">
            <Input.TextArea rows={10} placeholder="请输入JSON格式配置" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑Agent配置"
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => setEditOpen(false)}
        destroyOnClose
        width={640}
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="agentType" label="Agent类型">
            <Select disabled options={agentTypeOptions} />
          </Form.Item>
          <Form.Item name="name" label="Agent名称" rules={[{ required: true, message: '请输入Agent名称' }]}>
            <Input placeholder="请输入Agent名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="config" label="配置">
            <Input.TextArea rows={10} placeholder="请输入JSON格式配置" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
