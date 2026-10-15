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
  Descriptions,
  Typography,
  Badge,
  Row,
  Col,
  Statistic,
  Form,
  message,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { deviceApi } from '../../../services/device';
import type { Device, HistoryData } from '../../../types';
import dayjs from 'dayjs';
import './style.css';

const { Title, Text } = Typography;

const typeLabel: Record<string, string> = {
  transformer: '变压器',
  breaker: '断路器',
  busbar: '母线',
  capacitor: '电容器组',
  arrester: '避雷器',
};

const typeColor: Record<string, string> = {
  transformer: 'blue',
  breaker: 'green',
  busbar: 'orange',
  capacitor: 'purple',
  arrester: 'cyan',
};

export default function DevicePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);

  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [editVisible, setEditVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchList = useCallback(async (p?: number, ps?: number) => {
    setLoading(true);
    try {
      const res = await deviceApi.getList({
        page: p ?? page,
        pageSize: ps ?? pageSize,
        keyword: searchKeyword || undefined,
        type: filterType,
        status: filterStatus,
      });
      setDevices(res.list);
      setTotal(res.total);
    } catch {
      // errors handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchKeyword, filterType, filterStatus]);

  // Fetch stats from getAll
  const fetchStats = useCallback(async () => {
    try {
      const all = await deviceApi.getAll();
      setStats({
        total: all.length,
        online: all.filter((d) => d.status === 1).length,
        offline: all.filter((d) => d.status === 0).length,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setPage(1);
    fetchList(1);
  };

  const handleViewDetail = async (device: Device) => {
    setSelectedDevice(device);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const [detail, history] = await Promise.all([
        deviceApi.getDetail(device.id),
        deviceApi.getHistoryData(device.id),
      ]);
      setSelectedDevice(detail);
      setHistoryData(history);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    form.setFieldsValue({
      name: device.name,
      location: device.location || '',
      description: device.description || '',
      status: device.status,
    });
    setEditVisible(true);
  };

  const handleEditSubmit = async () => {
    if (!editingDevice) return;
    try {
      const values = await form.validateFields();
      setEditLoading(true);
      await deviceApi.update(editingDevice.id, values);
      message.success('设备更新成功');
      setEditVisible(false);
      fetchList();
    } catch {
      // validation error handled by form
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deviceApi.remove(id);
      message.success('设备已删除');
      fetchList();
      fetchStats();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const res = await deviceApi.sync();
      message.success(`同步成功，共同步 ${res.count} 台设备`);
      await Promise.all([fetchList(), fetchStats()]);
    } catch {
      message.error('同步失败，请确认 substation-mock 服务是否已启动');
    } finally {
      setSyncLoading(false);
    }
  };

  const getStatusBadge = (status: number) => {
    if (status === 1) {
      return <Badge status="success" text="在线" />;
    }
    return <Badge status="default" text="离线" />;
  };

  const columns: ColumnsType<Device> = [
    {
      title: '设备编号',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '设备类型',
      dataIndex: 'deviceType',
      key: 'deviceType',
      width: 100,
      render: (t) => <Tag color={typeColor[t] || 'default'}>{typeLabel[t] || t}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => getStatusBadge(s),
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      render: (v) => v || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该设备？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="device-page">
      <Title level={2}>设备管理</Title>

      <Row gutter={16} className="stats-row">
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="设备总数"
              value={stats.total}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="在线设备"
              value={stats.online}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="离线设备"
              value={stats.offline}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="异常设备"
              value={0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="filter-card">
        <Space wrap>
          <Input
            placeholder="搜索设备名称/编号"
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="设备类型"
            value={filterType}
            onChange={setFilterType}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="transformer">变压器</Select.Option>
            <Select.Option value="breaker">断路器</Select.Option>
            <Select.Option value="busbar">母线</Select.Option>
            <Select.Option value="capacitor">电容器组</Select.Option>
            <Select.Option value="arrester">避雷器</Select.Option>
          </Select>
          <Select
            placeholder="设备状态"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="1">在线</Select.Option>
            <Select.Option value="0">离线</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleSearch}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={syncLoading}
            onClick={handleSync}
          >
            同步设备
          </Button>
        </Space>
      </Card>

      <Card className="table-card">
        <Table
          columns={columns}
          dataSource={devices}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              fetchList(p, ps);
            },
          }}
        />
      </Card>

      <Modal
        title="编辑设备"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditSubmit}
        confirmLoading={editLoading}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
            <Input placeholder="请输入设备名称" />
          </Form.Item>
          <Form.Item name="location" label="位置">
            <Input placeholder="请输入设备位置" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入设备描述" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              <Select.Option value={1}>在线</Select.Option>
              <Select.Option value={0}>离线</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设备详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={800}
        footer={null}
        loading={detailLoading}
      >
        {selectedDevice && (
          <div className="device-detail">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="设备编号">{selectedDevice.code}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{selectedDevice.name}</Descriptions.Item>
              <Descriptions.Item label="设备类型">
                <Tag color={typeColor[selectedDevice.deviceType] || 'default'}>
                  {typeLabel[selectedDevice.deviceType] || selectedDevice.deviceType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusBadge(selectedDevice.status)}</Descriptions.Item>
              <Descriptions.Item label="位置">{selectedDevice.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedDevice.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(selectedDevice.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{dayjs(selectedDevice.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            </Descriptions>

            {selectedDevice.deviceData && selectedDevice.deviceData.length > 0 && (
              <Descriptions bordered column={4} size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label="A相电压">{String(selectedDevice.deviceData[0].voltageA)} kV</Descriptions.Item>
                <Descriptions.Item label="B相电压">{String(selectedDevice.deviceData[0].voltageB)} kV</Descriptions.Item>
                <Descriptions.Item label="C相电压">{String(selectedDevice.deviceData[0].voltageC)} kV</Descriptions.Item>
                <Descriptions.Item label="有功功率">{String(selectedDevice.deviceData[0].activePower)} kW</Descriptions.Item>
                <Descriptions.Item label="A相电流">{String(selectedDevice.deviceData[0].currentA)} A</Descriptions.Item>
                <Descriptions.Item label="B相电流">{String(selectedDevice.deviceData[0].currentB)} A</Descriptions.Item>
                <Descriptions.Item label="C相电流">{String(selectedDevice.deviceData[0].currentC)} A</Descriptions.Item>
                <Descriptions.Item label="温度">{String(selectedDevice.deviceData[0].temperature)} °C</Descriptions.Item>
                <Descriptions.Item label="湿度">{String(selectedDevice.deviceData[0].humidity)} %</Descriptions.Item>
                <Descriptions.Item label="SF6压力">{String(selectedDevice.deviceData[0].sf6Pressure)} MPa</Descriptions.Item>
                <Descriptions.Item label="局部放电">{String(selectedDevice.deviceData[0].partialDischarge)} pC</Descriptions.Item>
                <Descriptions.Item label="记录时间" span={4}>
                  {dayjs(selectedDevice.deviceData[0].recordedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            )}

            <div className="history-section" style={{ marginTop: 16 }}>
              <Title level={5}>历史数据（最近记录）</Title>
              {historyData.length > 0 ? (
                <Table
                  dataSource={historyData}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: '时间', dataIndex: 'recordedAt', width: 160, render: (v: string) => dayjs(v).format('MM-DD HH:mm:ss') },
                    { title: 'A相电压', dataIndex: 'voltageA', width: 80 },
                    { title: 'B相电压', dataIndex: 'voltageB', width: 80 },
                    { title: 'C相电压', dataIndex: 'voltageC', width: 80 },
                    { title: 'A相电流', dataIndex: 'currentA', width: 80 },
                    { title: '温度', dataIndex: 'temperature', width: 80 },
                    { title: '湿度', dataIndex: 'humidity', width: 80 },
                    { title: 'SF6压力', dataIndex: 'sf6Pressure', width: 80 },
                    { title: '局放', dataIndex: 'partialDischarge', width: 60 },
                  ]}
                />
              ) : (
                <Text type="secondary">暂无历史数据</Text>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
