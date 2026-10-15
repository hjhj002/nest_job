import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  List,
  Tag,
  Badge,
  Typography,
  Button,
  Space,
  Spin,
  Result,
} from "antd";
import {
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  AlertOutlined,
  ClusterOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  HomeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import * as echarts from "echarts";
import {
  bigscreenApi,
  type DeviceRealtimeData,
  type AgentStatus,
} from "../../../services/bigscreen";
import "./style.css";

const { Title, Text } = Typography;

export default function BigScreenPage() {
  const navigate = useNavigate();
  const riskDistRef = useRef<HTMLDivElement>(null);
  const deviceTypeRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    abnormalDevices: 0,
    todayRisks: 0,
  });
  const [devices, setDevices] = useState<DeviceRealtimeData[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<Record<string, number>>({});
  const [deviceTypeDist, setDeviceTypeDist] = useState<{ type: string; label: string; count: number }[]>([]);
  const [trendData, setTrendData] = useState<{ hours: string[]; risks: number[]; alerts: number[] }>({
    hours: [], risks: [], alerts: [],
  });

  const chartsRef = useRef<{ [key: string]: echarts.ECharts | null }>({});

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 初始化图表
  const initCharts = useCallback(() => {
    if (riskDistRef.current && !chartsRef.current.riskDist) {
      chartsRef.current.riskDist = echarts.init(riskDistRef.current);
    }
    if (deviceTypeRef.current && !chartsRef.current.deviceType) {
      chartsRef.current.deviceType = echarts.init(deviceTypeRef.current);
    }
    if (trendRef.current && !chartsRef.current.trend) {
      chartsRef.current.trend = echarts.init(trendRef.current);
    }
  }, []);

  const deviceTypeLabelMap: Record<string, string> = {
    transformer: "变压器",
    breaker: "断路器",
    busbar: "母线",
    capacitor: "电容器组",
    arrester: "避雷器",
  };

  const deviceTypeColors: Record<string, string> = {
    transformer: "#00d4ff",
    breaker: "#52c41a",
    busbar: "#faad14",
    capacitor: "#1890ff",
    arrester: "#ff4d4f",
  };

  // 更新图表
  const updateCharts = useCallback(() => {
    // 风险分布饼图
    if (chartsRef.current.riskDist) {
      const riskItems = Object.entries(riskDistribution)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({
          value: v,
          name: { critical: "紧急", high: "高风险", medium: "中风险", low: "低风险" }[k] || k,
          itemStyle: {
            color: { critical: "#ff4d4f", high: "#faad14", medium: "#1890ff", low: "#52c41a" }[k] || "#999",
          },
        }));

      chartsRef.current.riskDist.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "item", backgroundColor: "rgba(0,0,0,0.8)", borderColor: "#00d4ff", textStyle: { color: "#fff" } },
        legend: { orient: "vertical", right: "5%", top: "center", textStyle: { color: "#fff", fontSize: 12 }, itemWidth: 10, itemHeight: 10 },
        series: [{
          type: "pie", radius: ["40%", "65%"], center: ["35%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 5, borderColor: "#0a0a1a", borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold", color: "#fff" } },
          data: riskItems.length > 0 ? riskItems : [{ value: 1, name: "暂无数据", itemStyle: { color: "#444" } }],
        }],
      });
    }

    // 设备类型分布柱状图
    if (chartsRef.current.deviceType) {
      const items = deviceTypeDist.length > 0
        ? deviceTypeDist
        : Object.entries(deviceTypeLabelMap).map(([type, label]) => ({ type, label, count: 0 }));

      const data = items.map((item) => ({
        value: item.count,
        itemStyle: { color: deviceTypeColors[item.type] || "#999" },
      }));

      chartsRef.current.deviceType.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "axis", backgroundColor: "rgba(0,0,0,0.8)", borderColor: "#00d4ff", textStyle: { color: "#fff" } },
        grid: { left: "3%", right: "4%", bottom: "15%", top: "10%", containLabel: true },
        xAxis: {
          type: "category",
          data: items.map((item) => item.label),
          axisLabel: { color: "#fff", fontSize: 10, rotate: 30 },
          axisLine: { lineStyle: { color: "#444" } },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          axisLabel: { color: "#fff", fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        },
        series: [{ type: "bar", barWidth: "50%", data, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
      });
    }

    // 趋势图
    if (chartsRef.current.trend) {
      const { hours, risks: riskVals, alerts: alertVals } = trendData;
      const hasData = hours.length > 0;
      const displayHours = hasData ? hours.filter((_, i) => i % 4 === 0) : [];
      const displayRisks = hasData ? riskVals.filter((_, i) => i % 4 === 0) : [];
      const displayAlerts = hasData ? alertVals.filter((_, i) => i % 4 === 0) : [];

      chartsRef.current.trend.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "axis", backgroundColor: "rgba(0,0,0,0.8)", borderColor: "#00d4ff", textStyle: { color: "#fff" } },
        grid: { left: "3%", right: "4%", bottom: "5%", top: "10%", containLabel: true },
        legend: { data: ["风险", "告警"], textStyle: { color: "#fff", fontSize: 11 }, top: 0 },
        xAxis: {
          type: "category",
          data: displayHours,
          axisLabel: { color: "#fff", fontSize: 10 },
          axisLine: { lineStyle: { color: "#444" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#fff", fontSize: 11 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        },
        series: [
          {
            name: "风险", type: "line", data: displayRisks, smooth: true,
            symbol: "circle", symbolSize: 6,
            lineStyle: { color: "#ff4d4f", width: 2 },
            itemStyle: { color: "#ff4d4f" },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(255, 77, 79, 0.3)" },
              { offset: 1, color: "rgba(255, 77, 79, 0)" },
            ]) },
          },
          {
            name: "告警", type: "line", data: displayAlerts, smooth: true,
            symbol: "circle", symbolSize: 6,
            lineStyle: { color: "#faad14", width: 2 },
            itemStyle: { color: "#faad14" },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(250, 173, 20, 0.3)" },
              { offset: 1, color: "rgba(250, 173, 20, 0)" },
            ]) },
          },
        ],
      });
    }
  }, [riskDistribution, deviceTypeDist, trendData]);

  const fetchData = useCallback(async () => {
    try {
      const data = await bigscreenApi.getFullData();
      setStats(data.stats || { totalDevices: 0, onlineDevices: 0, abnormalDevices: 0, todayRisks: 0 });
      setDevices((data.devices || []).map((d: any) => ({
        ...d,
        type: d.type || d.deviceType || "transformer",
        voltage: d.voltage ?? 0,
        current: d.current ?? 0,
        temperature: d.temperature ?? 0,
        loadRate: d.loadRate ?? 0,
        status: d.status || "normal",
      })));
      setRisks(data.latestRisks || []);
      setRiskDistribution(data.riskDistribution || {});
      setDeviceTypeDist(data.deviceTypeDistribution || []);
      setTrendData(data.trendData || { hours: [], risks: [], alerts: [] });
      setAgentStatus(data.agentStatus || []);
      setError(false);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  // 初始加载
  useEffect(() => {
    setTimeout(() => {
      initCharts();
      fetchData();
    }, 100);

    const timer = setInterval(fetchData, 10000);
    return () => {
      clearInterval(timer);
      Object.values(chartsRef.current).forEach((chart) => chart?.dispose());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 数据更新时刷新图表
  useEffect(() => {
    setTimeout(() => {
      updateCharts();
      Object.values(chartsRef.current).forEach((chart) => chart?.resize());
    }, 100);
  }, [updateCharts]);

  // HTTP轮询
  useEffect(() => {
    const pollTimer = setInterval(() => fetchData(), 5000);
    return () => clearInterval(pollTimer);
  }, [fetchData]);

  // 响应式
  useEffect(() => {
    const handleResize = () => {
      Object.values(chartsRef.current).forEach((chart) => chart?.resize());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal": case "online": return "#52c41a";
      case "warning": return "#faad14";
      case "error": return "#ff4d4f";
      case "offline": return "#d9d9d9";
      default: return "#d9d9d9";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "normal": return "正常";
      case "warning": return "警告";
      case "error": case "offline": return "异常";
      default: return "未知";
    }
  };

  const levelConfig: Record<string, { color: string; text: string }> = {
    critical: { color: "#ff4d4f", text: "紧急" },
    high: { color: "#ff4d4f", text: "高" },
    medium: { color: "#faad14", text: "中" },
    low: { color: "#1890ff", text: "低" },
    info: { color: "#999", text: "信息" },
    unknown: { color: "#999", text: "未知" },
  };

  const getLevelTag = (level: string) => {
    const cfg = levelConfig[level] || { color: "#999", text: "未知" };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const agentsByType = {
    collector: agentStatus.filter((a) => a.type === "collector"),
    assessor: agentStatus.filter((a) => a.type === "assessor"),
    decision: agentStatus.filter((a) => a.type === "decision"),
  };

  return (
    <div className="bigscreen-page">
      <header className="screen-header">
        <div className="header-left">
          <Title level={2} className="screen-title">电力设备监控大屏</Title>
        </div>
        <div className="header-center">
          <div className="time-display">
            {currentTime.toLocaleString("zh-CN", {
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            })}
          </div>
        </div>
        <div className="header-right">
          <Space>
            <Button type="text" icon={<ReloadOutlined />} onClick={fetchData} style={{ color: "#fff" }} loading={loading}>刷新</Button>
            <Button type="text" icon={<HomeOutlined />} onClick={() => navigate("/dashboard")} style={{ color: "#fff" }}>返回后台</Button>
            <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={toggleFullscreen} style={{ color: "#fff" }}>
              {isFullscreen ? "退出全屏" : "全屏"}
            </Button>
            <Badge status={error ? "error" : "success"} text={error ? "数据异常" : "系统正常运行"} />
          </Space>
        </div>
      </header>

      <main className="screen-content">
        <Spin spinning={loading} size="large" tip="加载中...">
          {/* 顶部统计 */}
          <div className="top-stats">
            <div className="stat-box">
              <ToolOutlined className="stat-icon" />
              <div className="stat-info">
                <Text className="stat-label">设备总数</Text>
                <div className="stat-value">{stats.totalDevices}</div>
              </div>
            </div>
            <div className="stat-box">
              <CheckCircleOutlined className="stat-icon online" />
              <div className="stat-info">
                <Text className="stat-label">在线设备</Text>
                <div className="stat-value">{stats.onlineDevices}</div>
              </div>
            </div>
            <div className="stat-box">
              <WarningOutlined className="stat-icon warning" />
              <div className="stat-info">
                <Text className="stat-label">异常设备</Text>
                <div className="stat-value">{stats.abnormalDevices}</div>
              </div>
            </div>
            <div className="stat-box">
              <AlertOutlined className="stat-icon danger" />
              <div className="stat-info">
                <Text className="stat-label">今日风险</Text>
                <div className="stat-value">{stats.todayRisks}</div>
              </div>
            </div>
          </div>

          {/* 主体内容区 */}
          <div className="main-content">
            {/* 左1：设备实时监控 */}
            <div className="cell-left-1">
              <Card title="设备实时监控" className="screen-card device-list-card">
                {devices.length === 0 && !loading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>暂无设备数据</div>
                ) : (
                  <List
                    className="device-virtual-list"
                    dataSource={devices}
                    renderItem={(device: DeviceRealtimeData) => (
                      <List.Item className="device-virtual-item" style={{ padding: 0, border: "none" }}>
                        <div className="device-scroll-item" style={{ borderLeftColor: getStatusColor(device.status) }}>
                          <div className="device-scroll-header">
                            <span className="device-scroll-name">{device.name}</span>
                            <span className="device-scroll-status" style={{ background: getStatusColor(device.status) }}>
                              {getStatusText(device.status)}
                            </span>
                          </div>
                          <div className="device-scroll-data">
                            <span>温度: {(device.temperature ?? 0).toFixed(1)}°C</span>
                            <span>负载: {(device.loadRate ?? 0).toFixed(1)}%</span>
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </div>

            {/* 左2：风险分布 */}
            <div className="cell-left-2">
              <Card title="风险分布" className="screen-card chart-card">
                <div ref={riskDistRef} className="chart-container" />
              </Card>
            </div>

            {/* 中1：多智能体协同监控 */}
            <div className="cell-mid-1">
              <Card title="多智能体协同监控" className="screen-card agent-flow-card">
                <div className="agent-flow-horizontal">
                  <div className="agent-flow-node">
                    <div className="agent-flow-icon-h"><DatabaseOutlined /></div>
                    <div className="agent-flow-name-h">采集Agent</div>
                    <div className="agent-flow-status-h running">
                      <span className="status-dot" />运行中
                    </div>
                    <div className="agent-flow-agents">
                      {agentsByType.collector.length > 0
                        ? agentsByType.collector.map((a) => <span key={a.id} className={`agent-tag ${a.status}`}>{a.name}</span>)
                        : <span className="agent-tag online">CollectionAgent</span>}
                    </div>
                  </div>
                  <div className="agent-flow-connector">
                    <div className="connector-line" />
                    <div className="connector-arrow">▶</div>
                  </div>
                  <div className="agent-flow-node">
                    <div className="agent-flow-icon-h"><SafetyOutlined /></div>
                    <div className="agent-flow-name-h">评估Agent</div>
                    <div className="agent-flow-status-h analyzing">
                      <span className="status-dot" />AI分析
                    </div>
                    <div className="agent-flow-agents">
                      {agentsByType.assessor.length > 0
                        ? agentsByType.assessor.map((a) => <span key={a.id} className={`agent-tag ${a.status}`}>{a.name}</span>)
                        : <span className="agent-tag online">AssessmentAgent</span>}
                    </div>
                  </div>
                  <div className="agent-flow-connector">
                    <div className="connector-line" />
                    <div className="connector-arrow">▶</div>
                  </div>
                  <div className="agent-flow-node">
                    <div className="agent-flow-icon-h"><ClusterOutlined /></div>
                    <div className="agent-flow-name-h">决策Agent</div>
                    <div className="agent-flow-status-h standby">
                      <span className="status-dot" />待命
                    </div>
                    <div className="agent-flow-agents">
                      {agentsByType.decision.length > 0
                        ? agentsByType.decision.map((a) => <span key={a.id} className={`agent-tag ${a.status}`}>{a.name}</span>)
                        : <span className="agent-tag online">DecisionAgent</span>}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 中2：系统状态 */}
            <div className="cell-mid-2">
              <Card title="系统状态监控" className="screen-card system-status-card">
                <div className="system-status-grid">
                  {["数据库", "消息队列", "区块链", "AI模型", "WebSocket", "告警推送", "缓存服务", "日志服务", "监控中心"].map((name) => (
                    <div key={name} className="system-status-item-g">
                      <Badge status="success" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* 右1：实时风险事件 */}
            <div className="cell-right-1">
              <Card title="实时风险事件" className="screen-card risk-card">
                {risks.length === 0 && !loading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#999" }}>暂无风险事件</div>
                ) : (
                  <List
                    className="risk-list"
                    dataSource={risks.slice(0, 5)}
                    renderItem={(item) => (
                      <List.Item className="risk-list-item">
                        <div className="risk-info">
                          <div className="risk-header">
                            <Text strong className="risk-device">{item.deviceName}</Text>
                            {getLevelTag(item.level)}
                          </div>
                          <div className="risk-desc">{item.description || item.type}</div>
                          <div className="risk-time">{item.createdAt?.split(" ")[1] || item.createdAt}</div>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </div>

            {/* 右2：设备类型分布 */}
            <div className="cell-right-2">
              <Card title="设备类型分布" className="screen-card chart-card">
                <div ref={deviceTypeRef} className="chart-container" />
              </Card>
            </div>
          </div>

          {/* 趋势图 - 第3行全宽 */}
          <div style={{ gridColumn: "1 / -1", gridRow: 3, minHeight: 0 }}>
            <Card title="24小时趋势" className="screen-card chart-card">
              <div ref={trendRef} style={{ height: "100%" }} />
            </Card>
          </div>
        </Spin>
      </main>
    </div>
  );
}
