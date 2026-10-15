import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Space,
  Modal,
  Descriptions,
  Row,
  Col,
  Statistic,
  Typography,
  message,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { blockchainApi } from '../../../services/blockchain';
import dayjs from 'dayjs';
import './style.css';

const { Title, Text } = Typography;

const levelMap: Record<number, { text: string; color: string }> = {
  1: { text: '低', color: 'blue' },
  2: { text: '中', color: 'orange' },
  3: { text: '高', color: 'red' },
  4: { text: '紧急', color: 'red' },
};

interface BcItem {
  id: string;
  riskEventId: string;
  txHash: string | null;
  blockNumber: number | null;
  dataHash: string | null;
  status: number;
  errorMsg: string | null;
  createdAt: string;
  riskEvent?: {
    id: string;
    riskNo: string;
    deviceId: string;
    riskLevel: number;
    riskType: string;
    title: string;
  };
}

export default function BlockchainPage() {
  const [records, setRecords] = useState<BcItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<BcItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, today: 0 });
  const [certifyVisible, setCertifyVisible] = useState(false);
  const [certifyData, setCertifyData] = useState('{\n  "deviceName": "变压器A1",\n  "certType": "设备合规认证",\n  "inspector": "张工程师",\n  "result": "合格"\n}');
  const [certifyLoading, setCertifyLoading] = useState(false);
  const [certifyResult, setCertifyResult] = useState<any>(null);

  const fetchList = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const res = await blockchainApi.getList({
        page: p ?? page,
        pageSize: 10,
        keyword: searchKeyword || undefined,
      });
      setRecords(res.list || []);
      setTotal(res.total);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, searchKeyword]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await blockchainApi.getStats();
      setStats({
        total: data.totalRecords,
        confirmed: data.confirmedRecords,
        pending: data.pendingRecords,
        today: data.todayRecords,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchList(); fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); fetchList(1); };

  const truncateHash = (hash: string, length: number = 12) => {
    if (!hash) return '-';
    if (hash.length <= length * 2 + 4) return hash;
    return `${hash.slice(0, length)}...${hash.slice(-length)}`;
  };

  const getStatusTag = (status: number) => {
    if (status === 1) return <Tag color="success" icon={<CheckCircleOutlined />}>已确认</Tag>;
    if (status === 2) return <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>;
    return <Tag color="processing" icon={<ClockCircleOutlined />}>确认中</Tag>;
  };

  const handleViewDetail = (record: BcItem) => {
    setSelectedRecord(record);
    setVerifyResult(null);
    setDetailVisible(true);
  };

  const handleVerify = async (record: BcItem) => {
    setVerifying(true);
    try {
      const res = await blockchainApi.verify(record.id);
      setVerifyResult(res);
      if (res.valid) {
        message.success(res.message || '验证通过');
      } else {
        message.warning(res.message || '验证未通过');
      }
    } catch {
      message.error('验证请求失败');
    } finally {
      setVerifying(false);
    }
  };

  const handleCertify = async () => {
    setCertifyLoading(true);
    try {
      const data = JSON.parse(certifyData);
      const res = await blockchainApi.certify(data);
      setCertifyResult(res);
      message.success('数据已上链认证成功');
      fetchList(page);
      fetchStats();
    } catch (err: any) {
      message.error(err?.message || '认证失败，请检查数据格式或网络');
    } finally {
      setCertifyLoading(false);
    }
  };

  const columns: ColumnsType<BcItem> = [
    {
      title: '存证ID', dataIndex: 'id', key: 'id', width: 200,
    },
    {
      title: '关联事件', dataIndex: 'riskEventId', key: 'riskEventId', width: 200,
      render: (v: string, r) => r.riskEvent?.riskNo || v,
    },
    {
      title: '设备ID', key: 'deviceId', width: 120,
      render: (_, r) => r.riskEvent?.deviceId || '-',
    },
    {
      title: '风险等级', key: 'riskLevel', width: 100,
      render: (_, r) => {
        const l = r.riskEvent?.riskLevel;
        if (l == null) return '-';
        const m = levelMap[l] || { text: '未知', color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '数据哈希', dataIndex: 'dataHash', key: 'dataHash',
      render: (hash: string) => hash ? (
        <Tooltip title={hash}>
          <Text copyable={{ text: hash }}>{truncateHash(hash)}</Text>
        </Tooltip>
      ) : '-',
    },
    {
      title: '交易哈希', dataIndex: 'txHash', key: 'txHash',
      render: (hash: string) => hash ? (
        <Tooltip title={hash}>
          <Text copyable={{ text: hash }}>{truncateHash(hash)}</Text>
        </Tooltip>
      ) : '-',
    },
    {
      title: '上链时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: number) => getStatusTag(s),
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}>详情</Button>
          <Button type="link" icon={<LinkOutlined />}
            onClick={() => handleVerify(record)} loading={verifying}>验证</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="blockchain-page">
      <Title level={2}>区块链存证</Title>
      <Text type="secondary">风险事件上链存证，确保数据不可篡改</Text>

      <Row gutter={16} className="stats-row">
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="存证总数" value={stats.total} prefix={<BlockOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="已确认" value={stats.confirmed}
              valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="确认中" value={stats.pending}
              valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="今日上链" value={stats.today}
              valueStyle={{ color: '#1890ff' }} prefix={<BlockOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="filter-card">
        <Space>
          <Input placeholder="搜索存证记录（事件号/设备ID/交易哈希/数据哈希等）" prefix={<SearchOutlined />}
            value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch} style={{ width: 300 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={handleSearch}>刷新</Button>
          <Button type="primary" icon={<SafetyCertificateOutlined />}
            onClick={() => { setCertifyResult(null); setCertifyVisible(true); }}>
            手动认证
          </Button>
        </Space>
      </Card>

      <Card className="table-card">
        <Table
          columns={columns} dataSource={records} rowKey="id" loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page, pageSize: 10, total,
            showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => { setPage(p); fetchList(p); },
          }}
        />
      </Card>

      <Modal title="手动上链认证" open={certifyVisible}
        onCancel={() => setCertifyVisible(false)} width={700}
        footer={[
          <Button key="close" onClick={() => setCertifyVisible(false)}>关闭</Button>,
          <Button key="certify" type="primary" icon={<SafetyCertificateOutlined />}
            onClick={handleCertify} loading={certifyLoading}>
            提交认证
          </Button>,
        ]}>
        <div>
          <Text type="secondary">输入待认证的 JSON 数据，系统将计算哈希并上链存证</Text>
          <Input.TextArea
            rows={8}
            value={certifyData}
            onChange={(e) => setCertifyData(e.target.value)}
            style={{ fontFamily: 'monospace', marginTop: 12, marginBottom: 12 }}
          />
          {certifyResult && (
            <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="认证编号">{certifyResult.riskEventNo}</Descriptions.Item>
              <Descriptions.Item label="证书ID">{certifyResult.certificateId}</Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <Text code copyable>{certifyResult.txHash}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="数据哈希">
                <Text code copyable>{certifyResult.dataHash}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块号">{certifyResult.blockNumber}</Descriptions.Item>
              <Descriptions.Item label="认证时间">{certifyResult.timestamp}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color="success" icon={<CheckCircleOutlined />}>已上链</Tag>
              </Descriptions.Item>
            </Descriptions>
          )}
        </div>
      </Modal>

      <Modal title="区块链存证详情" open={detailVisible}
        onCancel={() => setDetailVisible(false)} width={700}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          <Button key="verify" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => selectedRecord && handleVerify(selectedRecord)}
            loading={verifying}>验证存证</Button>,
        ]}>
        {selectedRecord && (
          <div className="record-detail">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="存证ID">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="关联事件">
                {selectedRecord.riskEvent?.riskNo || selectedRecord.riskEventId}
              </Descriptions.Item>
              <Descriptions.Item label="设备ID">
                {selectedRecord.riskEvent?.deviceId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                {selectedRecord.riskEvent?.riskLevel != null ? (
                  <Tag color={levelMap[selectedRecord.riskEvent.riskLevel]?.color}>
                    {levelMap[selectedRecord.riskEvent.riskLevel]?.text}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="数据哈希">
                <Text code copyable>{selectedRecord.dataHash || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <Text code copyable>{selectedRecord.txHash || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块号">
                {selectedRecord.blockNumber?.toString() || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="上链时间">
                {dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedRecord.status)}</Descriptions.Item>
              {selectedRecord.errorMsg && (
                <Descriptions.Item label="错误信息">
                  <Text type="danger">{selectedRecord.errorMsg}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {verifyResult && (
              <div className="verify-info" style={{ marginTop: 16 }}>
                <Title level={5}>验证结果</Title>
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="验证状态">
                    <Tag color={verifyResult.valid ? 'success' : 'error'}>
                      {verifyResult.valid ? '通过' : '未通过'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="验证信息">{verifyResult.message}</Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
