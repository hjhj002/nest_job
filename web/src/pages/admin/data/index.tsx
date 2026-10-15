import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Statistic,
  Typography,
  Tabs,
} from 'antd';
import {
  ReloadOutlined,
  WarningOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { statisticsApi } from '../../../services/statistics';
import { bigscreenApi } from '../../../services/bigscreen';
import './style.css';

const { Title } = Typography;

export default function DataPage() {
  const riskTrendRef = useRef<HTMLDivElement>(null);
  const riskDistRef = useRef<HTMLDivElement>(null);
  const deviceTypeRef = useRef<HTMLDivElement>(null);
  const deviceStatusRef = useRef<HTMLDivElement>(null);

  const chartInstances = useRef<Map<string, echarts.ECharts>>(new Map());

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [dataReady, setDataReady] = useState(false);

  const [stats, setStats] = useState({ totalDevices: 0, onlineDevices: 0, offlineDevices: 0, todayRisks: 0, pendingRisks: 0, unreadAlerts: 0, totalBlockchainRecords: 0 });
  const [riskDist, setRiskDist] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [deviceTypes, setDeviceTypes] = useState<{ type: string; label: string; count: number }[]>([]);
  const [trendData, setTrendData] = useState<{ hours: string[]; risks: number[]; alerts: number[] } | null>(null);

  // Get or create chart instance
  const getChart = useCallback((ref: React.RefObject<HTMLDivElement>, key: string): echarts.ECharts | null => {
    if (!ref.current) return null;
    const existing = echarts.getInstanceByDom(ref.current);
    if (existing) return existing;
    const instance = echarts.init(ref.current);
    chartInstances.current.set(key, instance);
    return instance;
  }, []);

  // Render a specific chart group
  const renderRiskCharts = useCallback(() => {
    if (!trendData) return;

    const trendChart = getChart(riskTrendRef, 'riskTrend');
    if (trendChart) {
      trendChart.setOption({
        title: { text: '24小时风险趋势', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: trendData.hours },
        yAxis: { type: 'value' },
        series: [
          { name: '风险事件', type: 'line', data: trendData.risks, smooth: true, itemStyle: { color: '#ff4d4f' } },
          { name: '告警', type: 'line', data: trendData.alerts, smooth: true, itemStyle: { color: '#faad14' } },
        ],
      });
    }

    const distChart = getChart(riskDistRef, 'riskDist');
    if (distChart) {
      distChart.setOption({
        title: { text: '风险等级分布', left: 'center' },
        tooltip: { trigger: 'item' },
        legend: { bottom: '5%' },
        series: [{
          name: '风险等级',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
          data: [
            { value: riskDist.critical, name: '紧急', itemStyle: { color: '#ff4d4f' } },
            { value: riskDist.high, name: '高风险', itemStyle: { color: '#faad14' } },
            { value: riskDist.medium, name: '中风险', itemStyle: { color: '#1890ff' } },
            { value: riskDist.low, name: '低风险', itemStyle: { color: '#52c41a' } },
          ],
        }],
      });
    }
  }, [trendData, riskDist, getChart]);

  const renderDeviceCharts = useCallback(() => {
    const typeChart = getChart(deviceTypeRef, 'deviceType');
    if (typeChart && deviceTypes.length > 0) {
      typeChart.setOption({
        title: { text: '设备类型分布', left: 'center' },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { type: 'category', data: deviceTypes.map((d) => d.label) },
        yAxis: { type: 'value' },
        series: [{
          name: '设备数量',
          type: 'bar',
          data: deviceTypes.map((d) => d.count),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#83bff6' },
              { offset: 0.5, color: '#188df0' },
              { offset: 1, color: '#188df0' },
            ]),
          },
        }],
      });
    }

    const statusChart = getChart(deviceStatusRef, 'deviceStatus');
    if (statusChart) {
      statusChart.setOption({
        title: { text: '设备状态分布', left: 'center' },
        tooltip: { trigger: 'item' },
        series: [{
          name: '设备状态',
          type: 'pie',
          radius: '60%',
          data: [
            { value: stats.onlineDevices, name: '在线', itemStyle: { color: '#52c41a' } },
            { value: stats.offlineDevices, name: '离线', itemStyle: { color: '#d9d9d9' } },
          ],
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
        }],
      });
    }
  }, [deviceTypes, stats, getChart]);

  // Initialize charts when tab becomes visible
  useEffect(() => {
    if (!dataReady) return;
    // Small delay to let the DOM paint the newly visible tab content
    const timer = setTimeout(() => {
      if (activeTab === '1') {
        // Destroy device tab charts since they're hidden (will re-init on tab switch)
        renderRiskCharts();
      } else {
        renderDeviceCharts();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab, dataReady, renderRiskCharts, renderDeviceCharts]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      chartInstances.current.forEach((chart) => chart.resize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch each independently so one failure doesn't kill others
      const results = await Promise.allSettled([
        statisticsApi.getDashboard(),
        statisticsApi.getRiskDistribution(),
        bigscreenApi.getTrendData(),
        bigscreenApi.getFullData(),
      ]);

      if (results[0].status === 'fulfilled') setStats(results[0].value);
      if (results[1].status === 'fulfilled') setRiskDist(results[1].value);
      if (results[2].status === 'fulfilled') setTrendData(results[2].value);
      if (results[3].status === 'fulfilled') {
        setDeviceTypes(results[3].value.deviceTypeDistribution || []);
      }

      setDataReady(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const items = [
    {
      key: '1',
      label: '风险分析',
      children: (
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card loading={loading}>
              <div ref={riskTrendRef} style={{ height: 400 }} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card loading={loading}>
              <div ref={riskDistRef} style={{ height: 400 }} />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: '2',
      label: '设备分析',
      children: (
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card loading={loading}>
              <div ref={deviceTypeRef} style={{ height: 400 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card loading={loading}>
              <div ref={deviceStatusRef} style={{ height: 400 }} />
            </Card>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <div className="data-page">
      <Title level={2}>数据分析</Title>

      <Row gutter={16} className="stats-row">
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="风险事件总数" value={riskDist.critical + riskDist.high + riskDist.medium + riskDist.low} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="监控设备数" value={stats.totalDevices} prefix={<ToolOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="在线设备" value={stats.onlineDevices} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="待处理风险" value={stats.pendingRisks} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={items}
        activeKey={activeTab}
        onChange={setActiveTab}
        className="chart-tabs"
        extra={<Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>}
      />
    </div>
  );
}
