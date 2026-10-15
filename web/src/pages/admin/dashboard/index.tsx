import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Badge, List, Typography, Tag, Divider, Space } from 'antd';
import {
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  AlertOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Alert, RiskEvent } from '../../../types';
import './style.css';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    abnormalDevices: 0,
    todayRisks: 0,
    pendingAlerts: 0,
  });
  const [latestAlerts, setLatestAlerts] = useState<Alert[]>([]);
  const [latestRisks, setLatestRisks] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { statisticsApi } = await import('../../../services/statistics');
      const { riskApi } = await import('../../../services/risk');
      const { alertApi } = await import('../../../services/alert');

      const [dashStats, riskList, alertLatest] = await Promise.all([
        statisticsApi.getDashboard(),
        riskApi.getList({ page: 1, pageSize: 5 }),
        alertApi.getLatest(5),
      ]);

      setStats({
        totalDevices: dashStats.totalDevices,
        onlineDevices: dashStats.onlineDevices,
        abnormalDevices: dashStats.offlineDevices,
        todayRisks: dashStats.todayRisks,
        pendingAlerts: dashStats.unreadAlerts,
      });

      setLatestAlerts((alertLatest as any[]).map((a: any) => ({
        id: a.id,
        deviceId: a.riskEvent?.deviceId,
        deviceName: a.riskEvent?.device?.name || '未知',
        level: a.alertLevel >= 3 ? 'critical' : a.alertLevel >= 2 ? 'warning' : 'info',
        message: a.title || a.content || '',
        status: a.status === 0 ? 'unread' : a.status === 1 ? 'read' : 'handled',
        createdAt: a.sentAt,
      })));

      setLatestRisks((riskList.list || []).map((r: any) => ({
        id: r.id,
        deviceId: r.deviceId,
        deviceName: r.device?.name || '未知',
        level: r.riskLevel === 4 ? 'high' : r.riskLevel === 3 ? 'high' : r.riskLevel === 2 ? 'medium' : 'low',
        type: r.riskType,
        description: r.title,
        source: 'AI Agent',
        status: r.status === 0 ? 'pending' : r.status === 1 ? 'processing' : 'resolved',
        createdAt: r.occurredAt || r.createdAt,
      })));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'resolved':
        return 'success';
      case 'warning':
      case 'processing':
        return 'warning';
      case 'error':
      case 'pending':
        return 'error';
      default:
        return 'default';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
      case 'high':
        return 'red';
      case 'warning':
      case 'medium':
        return 'orange';
      case 'info':
      case 'low':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getLevelText = (level: string) => {
    const map: Record<string, string> = {
      critical: '紧急',
      warning: '警告',
      info: '提示',
      high: '高',
      medium: '中',
      low: '低',
    };
    return map[level] || level;
  };

  return (
    <div className="dashboard-page">
      <Title level={2}>首页概览</Title>
      <Text type="secondary">实时监控电力设备运行状态与风险态势</Text>

      <Divider />

      {/* 统计卡片 */}
      <Row gutter={16} className="stats-row">
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="stat-card">
            <Statistic
              title="设备总数"
              value={stats.totalDevices}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div className="stat-trend">
              <Text type="secondary">
                <ArrowUpOutlined style={{ color: '#52c41a' }} /> 较昨日 +3
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="stat-card">
            <Statistic
              title="在线设备"
              value={stats.onlineDevices}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={`/ ${stats.totalDevices}`}
            />
            <div className="stat-trend">
              <Text type="success">
                在线率 {((stats.onlineDevices / stats.totalDevices) * 100).toFixed(1)}%
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="stat-card">
            <Statistic
              title="异常设备"
              value={stats.abnormalDevices}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div className="stat-trend">
              <Text type="danger">
                <ArrowUpOutlined /> 需立即关注
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="stat-card">
            <Statistic
              title="今日风险"
              value={stats.todayRisks}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div className="stat-trend">
              <Text type="warning">
                <ArrowDownOutlined style={{ color: '#52c41a' }} /> 较昨日 -5
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 列表区域 */}
      <Row gutter={16} className="list-row">
        <Col xs={24} lg={12}>
          <Card
            title="最新告警"
            extra={<a onClick={() => navigate('/alarm')}>查看更多</a>}
            loading={loading}
            className="list-card"
          >
            <List
              dataSource={latestAlerts}
              renderItem={(item) => (
                <List.Item
                  className="alert-item"
                  onClick={() => navigate('/alarm')}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={item.status === 'unread'}>
                        <div className={`alert-icon ${item.level}`}>
                          <AlertOutlined />
                        </div>
                      </Badge>
                    }
                    title={
                      <Space>
                        <Text strong>{item.deviceName}</Text>
                        <Tag color={getLevelColor(item.level)}>
                          {getLevelText(item.level)}
                        </Tag>
                      </Space>
                    }
                    description={item.message}
                  />
                  <Text type="secondary" className="alert-time">
                    {item.createdAt.split(' ')[1]}
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="最新风险事件"
            extra={<a onClick={() => navigate('/risk')}>查看更多</a>}
            loading={loading}
            className="list-card"
          >
            <List
              dataSource={latestRisks}
              renderItem={(item) => (
                <List.Item
                  className="risk-item"
                  onClick={() => navigate('/risk')}
                >
                  <List.Item.Meta
                    avatar={
                      <div className={`risk-icon ${item.level}`}>
                        <WarningOutlined />
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong>{item.deviceName}</Text>
                        <Tag color={getLevelColor(item.level)}>
                          {getLevelText(item.level)}
                        </Tag>
                        <Tag color={getStatusColor(item.status)}>
                          {item.status === 'pending' ? '待处理' :
                           item.status === 'processing' ? '处理中' :
                           item.status === 'resolved' ? '已解决' : '已忽略'}
                        </Tag>
                      </Space>
                    }
                    description={item.description}
                  />
                  <Text type="secondary" className="risk-time">
                    {item.createdAt.split(' ')[1]}
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}


