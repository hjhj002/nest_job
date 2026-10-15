import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Steps,
  Typography,
  Badge,
  Row,
  Col,
  Divider,
  List,
  Descriptions,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  ClusterOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  ArrowRightOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { decisionApi } from '../../../services/decision';
import dayjs from 'dayjs';
import './style.css';

const { Title, Text } = Typography;

interface AgentStep {
  id: string;
  agentName: string;
  agentType: string;
  status: string;
  input: any;
  output: any;
  startTime: string;
  duration: number;
}

interface DecisionItem {
  id: string;
  traceId: string;
  riskId: string | null;
  riskEvent?: { id: string; riskNo: string; riskType: string; riskLevel: number; title: string } | null;
  agentCount: number;
  agents: string[];
  status: string;
  duration: number;
  steps: AgentStep[];
  createdAt: string;
}

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  lastHeartbeat: string | null;
}

export default function DecisionPage() {
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedDecision, setSelectedDecision] = useState<DecisionItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus[]>([]);

  const fetchList = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const res = await decisionApi.getList({ page: p ?? page, pageSize: 10 });
      setDecisions(res.list || []);
      setTotal(res.total);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page]);

  const fetchAgentStatus = useCallback(async () => {
    try {
      const data = await decisionApi.getAgentStatus();
      setAgentStatus(data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchList(); fetchAgentStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groupedAgents = {
    collectors: agentStatus.filter((a) => a.type === 'collection' || a.name.includes('Collection')),
    assessors: agentStatus.filter((a) => a.type === 'assessment' || a.name.includes('Assessment')),
    decisionMakers: agentStatus.filter((a) => a.type === 'decision' || a.name.includes('Decision')),
  };

  const handleViewDetail = (decision: DecisionItem) => {
    setSelectedDecision(decision);
    setActiveStep(0);
    setIsPlaying(false);
    setDetailVisible(true);
  };

  // Flow animation
  useEffect(() => {
    if (isPlaying && selectedDecision) {
      const timer = setInterval(() => {
        setActiveStep((prev) => {
          if (prev >= selectedDecision.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [isPlaying, selectedDecision]);

  const getAgentIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'collection' || t === 'collector')
      return <DatabaseOutlined style={{ color: '#1890ff' }} />;
    if (t === 'assessment' || t === 'assessor')
      return <SafetyOutlined style={{ color: '#faad14' }} />;
    if (t === 'decision')
      return <ClusterOutlined style={{ color: '#52c41a' }} />;
    return <ClusterOutlined />;
  };

  const getAgentTypeLabel = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'collection' || t === 'collector') return '数据采集Agent';
    if (t === 'assessment' || t === 'assessor') return '风险评估Agent';
    if (t === 'decision') return '决策Agent';
    if (t === 'orchestrator') return '协调Agent';
    return type;
  };

  const getDecisionResult = (decision: DecisionItem) => {
    // Find the DecisionAgent step (not the last orchestrator step)
    const decisionStep = decision.steps.find(
      (s) => s.agentType === 'decision' || s.agentName === 'DecisionAgent',
    );
    if (!decisionStep) {
      return { action: '未知', description: '未找到决策步骤' };
    }
    const output = decisionStep.output || {};
    // DecisionAgent outputs: strategyCode, strategyName, measures (运维建议)
    const action = output.strategyName || output.strategyCode || '未知';
    const description = output.measures?.length
      ? output.measures.join('；')
      : (output.strategyName || output.strategyCode || '无建议');
    return { action, description };
  };

  const columns: ColumnsType<DecisionItem> = [
    {
      title: '决策编号', dataIndex: 'id', key: 'id', width: 220,
    },
    {
      title: '关联风险', dataIndex: 'riskId', key: 'riskId', width: 200,
      render: (_, record) => {
        if (!record.riskEvent) return record.riskId || '-';
        const levelLabels: Record<number, string> = { 1: '低', 2: '中', 3: '高', 4: '紧急' };
        const levelColors: Record<number, string> = { 1: 'green', 2: 'orange', 3: 'red', 4: '#ff4d4f' };
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{record.riskEvent.riskNo}</Text>
            <Space size={4}>
              <Tag color={levelColors[record.riskEvent.riskLevel]}>{levelLabels[record.riskEvent.riskLevel] || record.riskEvent.riskLevel}</Tag>
              <Text style={{ fontSize: 12 }}>{record.riskEvent.riskType}</Text>
            </Space>
          </Space>
        );
      },
    },
    {
      title: '决策结果', key: 'result',
      render: (_, record) => {
        const result = getDecisionResult(record);
        return <Tag color={record.status === 'failed' ? 'red' : 'blue'}>{result.action}</Tag>;
      },
    },
    {
      title: '执行步骤', key: 'steps',
      render: (_, record) => (
        <Space>
          {record.steps.map((step, index) => (
            <Badge key={step.id}
              status={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : 'processing'}
              text={index === 0 ? '采集' : index === 1 ? '评估' : index === 2 ? '决策' : step.agentName}
            />
          ))}
        </Space>
      ),
    },
    {
      title: '耗时', dataIndex: 'duration', key: 'duration', width: 100,
      render: (d: number) => d ? `${d}ms` : '-',
    },
    {
      title: '执行时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => (
        <Button type="primary" icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}>
          查看流程
        </Button>
      ),
    },
  ];

  return (
    <div className="decision-page">
      <Title level={2}>决策协同</Title>
      <Text type="secondary">可视化多智能体协同决策流程</Text>

      <Divider />

      <Row gutter={16} className="agent-status-row">
        <Col xs={24} md={8}>
          <Card title={<><DatabaseOutlined /> 数据采集Agent</>} className="agent-card">
            <List
              dataSource={groupedAgents.collectors}
              locale={{ emptyText: '暂无Agent' }}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Badge status={item.status === 'online' ? 'success' : item.status === 'warning' ? 'warning' : 'error'} />
                    <Text>{item.name}</Text>
                    {item.lastHeartbeat && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.lastHeartbeat).format('HH:mm:ss')}
                      </Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title={<><SafetyOutlined /> 风险评估Agent</>} className="agent-card">
            <List
              dataSource={groupedAgents.assessors}
              locale={{ emptyText: '暂无Agent' }}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Badge status={item.status === 'online' ? 'success' : item.status === 'warning' ? 'warning' : 'error'} />
                    <Text>{item.name}</Text>
                    {item.lastHeartbeat && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.lastHeartbeat).format('HH:mm:ss')}
                      </Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title={<><ClusterOutlined /> 决策Agent</>} className="agent-card">
            <List
              dataSource={groupedAgents.decisionMakers}
              locale={{ emptyText: '暂无Agent' }}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Badge status={item.status === 'online' ? 'success' : item.status === 'warning' ? 'warning' : 'error'} />
                    <Text>{item.name}</Text>
                    {item.lastHeartbeat && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.lastHeartbeat).format('HH:mm:ss')}
                      </Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card className="table-card" title="决策流程记录"
        extra={<Button icon={<ReloadOutlined />} onClick={() => { fetchList(page); fetchAgentStatus(); }}>刷新</Button>}>
        <Table
          columns={columns} dataSource={decisions} rowKey="id" loading={loading}
          pagination={{
            current: page, pageSize: 10, total,
            showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => { setPage(p); fetchList(p); },
          }}
        />
      </Card>

      <Modal title="多智能体协同决策流程" open={detailVisible}
        onCancel={() => { setDetailVisible(false); setIsPlaying(false); }}
        width={900}
        footer={[<Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>]}>
        {selectedDecision && (
          <div className="decision-detail">
            <div className="flow-visualization">
              <div className="flow-header">
                <Title level={5}>决策流程动画演示</Title>
                <Button type="primary"
                  icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? '暂停' : '播放'}
                </Button>
              </div>

              <div className="flow-diagram">
                {selectedDecision.steps.map((step, index) => (
                  <div key={step.id}
                    className={`flow-node ${index <= activeStep ? 'active' : ''} ${step.status}`}>
                    <div className="node-icon">{getAgentIcon(step.agentType)}</div>
                    <div className="node-content">
                      <Text strong>{getAgentTypeLabel(step.agentType)}</Text>
                      <Text type="secondary" className="node-name">{step.agentName}</Text>
                      <Tag color={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : 'processing'}>
                        {step.status === 'completed' ? '已完成' : step.status === 'failed' ? '失败' : '运行中'}
                      </Tag>
                    </div>
                    {index < selectedDecision.steps.length - 1 && (
                      <div className={`flow-arrow ${index < activeStep ? 'active' : ''}`}>
                        <ArrowRightOutlined />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Steps current={activeStep} direction="vertical" className="detail-steps"
                items={selectedDecision.steps.map((step) => ({
                  key: step.id,
                  title: getAgentTypeLabel(step.agentType),
                  description: (
                    <div className="step-detail">
                      <Text type="secondary">{step.agentName}</Text>
                      <div className="io-section">
                        <div className="io-block">
                          <Text type="secondary" strong>输入:</Text>
                          <pre>{JSON.stringify(step.input, null, 2)}</pre>
                        </div>
                        <div className="io-block">
                          <Text type="secondary" strong>输出:</Text>
                          <pre>{JSON.stringify(step.output, null, 2)}</pre>
                        </div>
                      </div>
                      <Text type="secondary" className="time-info">
                        耗时: {step.duration || 0}ms
                      </Text>
                    </div>
                  ),
                }))}
              />
            </div>

            <Divider />

            <div className="decision-result">
              <Title level={5}>决策结果</Title>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="执行策略">
                  <Tag color="blue">{getDecisionResult(selectedDecision).action}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="关联风险">
                  {selectedDecision.riskEvent ? (
                    <Space>
                      <Tag>{selectedDecision.riskEvent.riskNo}</Tag>
                      <Text>{selectedDecision.riskEvent.title}</Text>
                    </Space>
                  ) : selectedDecision.riskId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selectedDecision.status === 'failed' ? 'red' : 'green'}>
                    {selectedDecision.status === 'completed' ? '已完成' : '失败'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="总耗时">
                  {selectedDecision.duration}ms（{selectedDecision.steps.length} 个Agent）
                </Descriptions.Item>
                <Descriptions.Item label="处置措施">
                  {getDecisionResult(selectedDecision).description}
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
