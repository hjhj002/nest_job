import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  Select,
  Typography,
  Descriptions,
  message,
  Tabs,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  EyeOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { reviewApi, type ReviewItem } from '../../../services/review';
import './style.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const riskLevelMap: Record<number, { label: string; color: string }> = {
  1: { label: '低风险', color: 'green' },
  2: { label: '中风险', color: 'blue' },
  3: { label: '高风险', color: 'orange' },
  4: { label: '紧急', color: 'red' },
};

const reviewStatusMap: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: '待审核', color: 'orange' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
};

export default function ReviewPage() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');

  const [detailOpen, setDetailOpen] = useState(false);
  const [current, setCurrent] = useState<ReviewItem | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reviewApi.getList({ page, pageSize, status: statusFilter });
      setList(data.list);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleApprove = async (riskId: string) => {
    try {
      await reviewApi.approve(riskId);
      message.success('审核通过，决策已执行');
      fetchList();
    } catch { /* ignore */ }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) {
      message.warning('请填写驳回理由');
      return;
    }
    if (!current) return;
    try {
      await reviewApi.reject(current.id, rejectComment);
      message.success('已驳回，AI将重新分析');
      setRejectOpen(false);
      setRejectComment('');
      fetchList();
    } catch { /* ignore */ }
  };

  const columns: ColumnsType<ReviewItem> = [
    { title: '风险编号', dataIndex: 'riskNo', key: 'riskNo', width: 160 },
    { title: '标题', dataIndex: 'title', key: 'title', width: 200, ellipsis: true },
    {
      title: '等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      render: (v: number) => <Tag color={riskLevelMap[v]?.color}>{riskLevelMap[v]?.label || '未知'}</Tag>,
    },
    { title: '风险类型', dataIndex: 'riskType', key: 'riskType', width: 100 },
    {
      title: '关联设备',
      key: 'device',
      width: 140,
      render: (_, r) => r.device?.name || r.device?.code || '-',
    },
    {
      title: '审核状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 100,
      render: (v: string) => <Tag color={reviewStatusMap[v]?.color}>{reviewStatusMap[v]?.label || v}</Tag>,
    },
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setCurrent(record); setDetailOpen(true); }}
          >
            详情
          </Button>
          {record.reviewStatus === 'PENDING_REVIEW' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => { setCurrent(record); setRejectOpen(true); }}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="review-page">
      <Title level={2}>决策审核</Title>

      <Card>
        <Tabs
          activeKey={statusFilter}
          onChange={(key) => { setStatusFilter(key); setPage(1); }}
          items={[
            { key: 'PENDING_REVIEW', label: '待审核' },
            { key: 'APPROVED', label: '已通过' },
            { key: 'REJECTED', label: '已驳回' },
          ]}
          tabBarExtraContent={
            <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
              刷新
            </Button>
          }
        />

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

      {/* Detail Modal */}
      <Modal
        title="风险详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
      >
        {current && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="风险编号">{current.riskNo}</Descriptions.Item>
            <Descriptions.Item label="风险等级">
              <Tag color={riskLevelMap[current.riskLevel]?.color}>
                {riskLevelMap[current.riskLevel]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="风险类型">{current.riskType}</Descriptions.Item>
            <Descriptions.Item label="风险评分">{current.riskScore ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>{current.title}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{current.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联设备">
              {current.device?.name || current.device?.code || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核状态">
              <Tag color={reviewStatusMap[current.reviewStatus]?.color}>
                {reviewStatusMap[current.reviewStatus]?.label || current.reviewStatus}
              </Tag>
            </Descriptions.Item>
            {current.reviewComment && (
              <Descriptions.Item label="审核意见" span={2}>{current.reviewComment}</Descriptions.Item>
            )}
            <Descriptions.Item label="发生时间" span={2}>
              {current.occurredAt ? new Date(current.occurredAt).toLocaleString() : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="驳回决策"
        open={rejectOpen}
        onOk={handleReject}
        onCancel={() => { setRejectOpen(false); setRejectComment(''); }}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <div className="reject-warning">
          <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />
          <Text style={{ marginLeft: 8 }}>
            驳回后，AI 将根据您的反馈重新分析该风险事件。
          </Text>
        </div>
        <TextArea
          rows={4}
          placeholder="请填写驳回理由，AI将据此重新分析..."
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  );
}
