import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Input, Select, Space, Modal, Badge, Row, Col, Statistic, Typography, message,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, BellOutlined, WarningOutlined, InfoCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { alertApi } from '../../../services/alert';
import dayjs from 'dayjs';
import './style.css';

const { Title, Text, Paragraph } = Typography;

const levelMap: Record<number, { text: string; color: string }> = {
  1: { text: '提示', color: 'blue' },
  2: { text: '警告', color: 'orange' },
  3: { text: '紧急', color: 'red' },
  4: { text: '危急', color: 'red' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '未读', color: 'red' },
  1: { text: '已读', color: 'blue' },
  2: { text: '已处理', color: 'green' },
};

interface AlertItem {
  id: string;
  riskEventId: string;
  alertLevel: number;
  title: string;
  content: string;
  status: number;
  sentAt: string;
  riskEvent?: any;
}

export default function AlarmPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterLevel, setFilterLevel] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [stats, setStats] = useState({ total: 0, unread: 0, critical: 0 });

  const fetchList = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const res = await alertApi.getList({
        page: p ?? page, pageSize: 10,
        level: filterLevel, status: filterStatus,
        keyword: searchKeyword || undefined,
      });
      setAlerts(res.list);
      setTotal(res.total);

      // Calculate stats from list or separate calls
      const unread = await alertApi.getUnreadCount();
      const critical = res.list.filter((a: AlertItem) => a.alertLevel >= 3 && a.status !== 2).length;
      setStats({ total: res.total, unread: unread as unknown as number, critical });
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, filterLevel, filterStatus, searchKeyword]);

  useEffect(() => { fetchList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); fetchList(1); };

  const handleMarkAsRead = async (id: string) => {
    try {
      await alertApi.markAsRead(id);
      message.success('已标记为已读');
      fetchList(page);
    } catch { message.error('操作失败'); }
  };

  const handleHandle = async (id: string) => {
    try {
      await alertApi.handle(id, { handler: 'admin' });
      message.success('告警已处理');
      fetchList(page);
    } catch { message.error('操作失败'); }
  };

  const columns: ColumnsType<AlertItem> = [
    {
      title: '', key: 'indicator', width: 40,
      render: (_, record) => record.status === 0 ? <Badge dot /> : null,
    },
    {
      title: '级别', dataIndex: 'alertLevel', width: 90,
      render: (l: number) => {
        const m = levelMap[l] || { text: '未知', color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '设备', key: 'device', width: 120,
      render: (_, r) => r.riskEvent?.device?.name || '-',
    },
    {
      title: '内容', dataIndex: 'title', ellipsis: true,
      render: (v: string, r: AlertItem) => v || r.content || '-',
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: number) => {
        const m = statusMap[s] || { text: '未知', color: 'default' };
        return <Badge status={s === 0 ? 'error' : s === 1 ? 'processing' : 'success'} text={m.text} />;
      },
    },
    {
      title: '时间', dataIndex: 'sentAt', width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space>
          {record.status === 0 && (
            <Button type="link" onClick={() => handleMarkAsRead(record.id)}>标记已读</Button>
          )}
          {record.status !== 2 && (
            <Button type="link" onClick={() => handleHandle(record.id)}>处理</Button>
          )}
          <Button type="link" onClick={() => { setSelectedAlert(record); setDetailVisible(true); }}>详情</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="alarm-page">
      <Title level={2}>告警中心</Title>

      <Row gutter={16} className="stats-row">
        <Col xs={12} sm={8}>
          <Card><Statistic title="告警总数" value={stats.total} prefix={<BellOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="未读告警" value={stats.unread} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="紧急告警" value={stats.critical} valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="filter-card">
        <Space wrap>
          <Input placeholder="搜索告警信息..." prefix={<SearchOutlined />} value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)} onPressEnter={handleSearch}
            style={{ width: 200 }} allowClear />
          <Select placeholder="级别" value={filterLevel} onChange={setFilterLevel} style={{ width: 100 }} allowClear>
            <Select.Option value="1">提示</Select.Option>
            <Select.Option value="2">警告</Select.Option>
            <Select.Option value="3">紧急</Select.Option>
          </Select>
          <Select placeholder="状态" value={filterStatus} onChange={setFilterStatus} style={{ width: 100 }} allowClear>
            <Select.Option value="0">未读</Select.Option>
            <Select.Option value="1">已读</Select.Option>
            <Select.Option value="2">已处理</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleSearch}>刷新</Button>
        </Space>
      </Card>

      <Card className="table-card">
        <Table
          columns={columns} dataSource={alerts} rowKey="id" loading={loading}
          rowClassName={(r) => r.status === 0 ? 'unread-row' : ''}
          pagination={{
            current: page, pageSize: 10, total,
            showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => { setPage(p); fetchList(p); },
          }}
        />
      </Card>

      <Modal title="告警详情" open={detailVisible} onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          ...(selectedAlert && selectedAlert.status !== 2 ? [
            <Button key="handle" type="primary" onClick={() => { if (selectedAlert) handleHandle(selectedAlert.id); setDetailVisible(false); }}>
              处理告警
            </Button>,
          ] : []),
        ]}
      >
        {selectedAlert && (
          <div>
            <Paragraph>
              <Tag color={levelMap[selectedAlert.alertLevel]?.color}>{levelMap[selectedAlert.alertLevel]?.text}</Tag>
              <Text type="secondary"> {dayjs(selectedAlert.sentAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </Paragraph>
            <Title level={5}>{selectedAlert.riskEvent?.device?.name || '未知设备'}</Title>
            <Paragraph>{selectedAlert.title}</Paragraph>
            <Paragraph>{selectedAlert.content || '无详细内容'}</Paragraph>
          </div>
        )}
      </Modal>
    </div>
  );
}
