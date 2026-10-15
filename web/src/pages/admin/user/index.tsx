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
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userApi, type UserItem, type UserRole } from '../../../services/user';
import './style.css';

const { Title } = Typography;

const statusMap: Record<number, { label: string; color: string }> = {
  1: { label: '启用', color: 'green' },
  0: { label: '禁用', color: 'red' },
};

export default function UserPage() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [roleForm] = Form.useForm();

  const fetchRoles = useCallback(async () => {
    try {
      const data = await userApi.getRoles();
      setRoles(data);
    } catch { /* ignore */ }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userApi.getList({ page, pageSize, keyword });
      setList(data.list);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await userApi.create(values);
      message.success('用户创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      fetchList();
    } catch { /* validation error */ }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!currentUser) return;
      await userApi.update(currentUser.id, values);
      message.success('用户信息已更新');
      setEditOpen(false);
      fetchList();
    } catch { /* validation error */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await userApi.remove(id);
      message.success('用户已删除');
      fetchList();
    } catch { /* ignore */ }
  };

  const handleRoleSave = async () => {
    try {
      const values = await roleForm.validateFields();
      if (!currentUser) return;
      await userApi.updateRoles(currentUser.id, values.roleIds);
      message.success('角色分配成功');
      setRoleOpen(false);
      fetchList();
    } catch { /* validation error */ }
  };

  const columns: ColumnsType<UserItem> = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    { title: '姓名', dataIndex: 'realName', key: 'realName', width: 100, render: (v) => v || '-' },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180, render: (v) => v || '-' },
    { title: '手机', dataIndex: 'phone', key: 'phone', width: 140, render: (v) => v || '-' },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 160,
      render: (rs: UserRole[]) => rs?.length > 0
        ? rs.map((r) => <Tag key={r.id} color="blue">{r.name}</Tag>)
        : <Tag>未分配</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: number) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label || '未知'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentUser(record);
              editForm.setFieldsValue(record);
              setEditOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<TeamOutlined />}
            onClick={() => {
              setCurrentUser(record);
              roleForm.setFieldsValue({ roleIds: record.roles?.map((r) => r.id) || [] });
              setRoleOpen(true);
            }}
          >
            角色
          </Button>
          <Popconfirm
            title="确定删除该用户？"
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
    <div className="user-page">
      <Title level={2}>用户管理</Title>

      <Card>
        <div className="user-toolbar">
          <Space>
            <Input
              placeholder="搜索用户名 / 姓名"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 240 }}
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
              刷新
            </Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
            新增用户
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新增用户"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="realName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" placeholder="选择角色" options={roles.map((r) => ({ label: r.name, value: r.id }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑用户"
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => setEditOpen(false)}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="realName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Role Assignment Modal */}
      <Modal
        title={`分配角色 - ${currentUser?.username || ''}`}
        open={roleOpen}
        onOk={handleRoleSave}
        onCancel={() => setRoleOpen(false)}
        destroyOnClose
      >
        <Form form={roleForm} layout="vertical" preserve={false}>
          <Form.Item name="roleIds" label="角色" rules={[{ required: true, message: '请至少选择一个角色' }]}>
            <Select mode="multiple" placeholder="选择角色" options={roles.map((r) => ({ label: r.name, value: r.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
