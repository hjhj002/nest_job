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
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { riskApi } from '../../../services/risk';
import dayjs from 'dayjs';
import './style.css';

const { Title, Paragraph } = Typography;

const levelMap: Record<number, { text: string; color: string }> = {
  1: { text: '低', color: 'blue' },
  2: { text: '中', color: 'orange' },
  3: { text: '高', color: 'red' },
  4: { text: '紧急', color: 'red' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '待处理', color: 'red' },
  1: { text: '处理中', color: 'orange' },
  2: { text: '已解决', color: 'green' },
};

const levelFilterMap: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const statusFilterMap: Record<string, number> = {
  pending: 0,
  processing: 1,
  resolved: 2,
};

interface RiskItem {
  id: string;
  riskNo: string;
  deviceId: string;
  deviceName: string;
  riskLevel: number;
  riskType: string;
  riskScore: number;
  title: string;
  description: string;
  status: number;
  occurredAt: string;
  handledAt?: string;
  handleResult?: string;
}

export default function RiskPage() {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterLevel, setFilterLevel] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [stats, setStats] = useState({ total: 0, high: 0, pending: 0, today: 0 });

  const fetchList = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const res = await riskApi.getList({
        page: p ?? page,
        pageSize: 10,
        riskLevel: filterLevel ? levelFilterMap[filterLevel] : undefined,
        status: filterStatus ? statusFilterMap[filterStatus] : undefined,
        keyword: searchKeyword || undefined,
      });
      const list = (res.list || []).map((r: any) => ({
        id: r.id,
        riskNo: r.riskNo,
        deviceId: r.deviceId,
        deviceName: r.device?.name || '未知',
        riskLevel: r.riskLevel,
        riskType: r.riskType,
        riskScore: r.riskScore,
        title: r.title,
        description: r.description,
        status: r.status,
        occurredAt: r.occurredAt,
        handledAt: r.handledAt,
        handleResult: r.handleResult,
      }));
      setRisks(list);
      setTotal(res.total);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, filterLevel, filterStatus, searchKeyword]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await riskApi.getStatistics();
      const high = (data.byLevel || [])
        .filter((l: any) => l.level >= 3)
        .reduce((s: number, l: any) => s + l.count, 0);
      const pending = (data.byStatus || [])
        .filter((s: any) => s.status === 0)
        .reduce((s: number, l: any) => s + l.count, 0);
      const today = (data.trend || []).slice(-1)[0]?.count || 0;
      setStats({ total: data.total, high, pending, today });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchList(); fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); fetchList(1); };

  const handleResolve = async (id: string) => {
    try {
      await riskApi.handle(id, { status: 2 });
      message.success('风险已标记为已解决');
      fetchList(page);
      fetchStats();
    } catch { message.error('操作失败'); }
  };

  const handleIgnore = async (id: string) => {
    try {
      await riskApi.handle(id, { status: 2, handleResult: '已忽略' });
      message.success('风险已忽略');
      fetchList(page);
      fetchStats();
    } catch { message.error('操作失败'); }
  };

  const columns: ColumnsType<RiskItem> = [
    {
      title: '风险编号', dataIndex: 'riskNo', key: 'riskNo', width: 180,
    },
    {
      title: '设备名称',
      key: 'deviceName',
      render: (_, r) => r.deviceName || r.deviceId || '-',
    },
    {
      title: '风险等级', dataIndex: 'riskLevel', key: 'riskLevel', width: 100,
      render: (l: number) => {
        const m = levelMap[l] || { text: '未知', color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '风险类型', dataIndex: 'riskType', key: 'riskType',
    },
    {
      title: '风险描述', dataIndex: 'title', key: 'title', ellipsis: true,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: number) => {
        const m = statusMap[s] || { text: '未知', color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '发生时间', dataIndex: 'occurredAt', key: 'occurredAt', width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />}
            onClick={() => { setSelectedRisk(record); setDetailVisible(true); }}>
            详情
          </Button>
          {record.status === 0 && (
            <>
              <Button type="link" onClick={() => handleResolve(record.id)}>处理</Button>
              <Popconfirm title="确认忽略" description="确定要忽略此风险事件吗？"
                onConfirm={() => handleIgnore(record.id)}>
                <Button type="link" danger>忽略</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="risk-page">
      <Title level={2}>风险管理</Title>

      <Row gutter={16} className="stats-row">
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="风险总数" value={stats.total} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="高风险" value={stats.high} valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="今日新增" value={stats.today} valueStyle={{ color: '#1890ff' }}
              prefix={<EyeOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="filter-card">
        <Space wrap>
          <Input placeholder="搜索风险编号/设备/类型" prefix={<SearchOutlined />}
            value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch} style={{ width: 220 }} allowClear />
          <Select placeholder="风险等级" value={filterLevel} onChange={setFilterLevel}
            style={{ width: 120 }} allowClear>
            <Select.Option value="high">高</Select.Option>
            <Select.Option value="medium">中</Select.Option>
            <Select.Option value="low">低</Select.Option>
          </Select>
          <Select placeholder="处理状态" value={filterStatus} onChange={setFilterStatus}
            style={{ width: 120 }} allowClear>
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="processing">处理中</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleSearch}>刷新</Button>
        </Space>
      </Card>

      <Card className="table-card">
        <Table
          columns={columns} dataSource={risks} rowKey="id" loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page, pageSize: 10, total,
            showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => { setPage(p); fetchList(p); },
          }}
        />
      </Card>

      <Modal title="风险事件详情" open={detailVisible}
        onCancel={() => setDetailVisible(false)} width={700}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          ...(selectedRisk?.status === 0 ? [
            <Button key="ignore" danger onClick={() => { handleIgnore(selectedRisk!.id); setDetailVisible(false); }}>忽略</Button>,
            <Button key="resolve" type="primary" onClick={() => { handleResolve(selectedRisk!.id); setDetailVisible(false); }}>标记已解决</Button>,
          ] : []),
        ]}>
        {selectedRisk && (
          <div className="risk-detail">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="风险编号" span={2}>{selectedRisk.riskNo}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{selectedRisk.deviceName}</Descriptions.Item>
              <Descriptions.Item label="设备编号">{selectedRisk.deviceId || '-'}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={levelMap[selectedRisk.riskLevel]?.color}>
                  {levelMap[selectedRisk.riskLevel]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险类型">{selectedRisk.riskType}</Descriptions.Item>
              <Descriptions.Item label="风险评分">{selectedRisk.riskScore ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="处理状态">
                <Tag color={statusMap[selectedRisk.status]?.color}>
                  {statusMap[selectedRisk.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发生时间">
                {dayjs(selectedRisk.occurredAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedRisk.handledAt && (
                <>
                  <Descriptions.Item label="处理时间">
                    {dayjs(selectedRisk.handledAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="处理结果">{selectedRisk.handleResult || '-'}</Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="风险描述" span={2}>
                <Paragraph>{selectedRisk.description || selectedRisk.title}</Paragraph>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
