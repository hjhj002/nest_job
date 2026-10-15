import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Tabs,
  Modal,
  Form,
  InputNumber,
  Switch,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ruleApi, strategyApi } from '../../../services/risk';
import type { RuleItem, StrategyItem } from '../../../services/risk';
import dayjs from 'dayjs';
import './style.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const riskTypeLabels: Record<string, string> = {
  overspeed: '超速',
  deviation: '偏离',
  collision: '碰撞',
  restricted_area: '禁入区域',
  unknown: '未知',
};

const riskTypeColors: Record<string, string> = {
  overspeed: 'orange',
  deviation: 'blue',
  collision: 'red',
  restricted_area: 'purple',
  unknown: 'default',
};

const levelColors: Record<number, string> = {
  1: 'blue',
  2: 'orange',
  3: 'red',
  4: 'red',
};

const levelLabels: Record<number, string> = {
  1: '低风险',
  2: '中风险',
  3: '高风险',
  4: '紧急',
};

const actionTypeLabels: Record<string, string> = {
  log: '日志记录',
  notify: '通知',
  alert: '告警',
  blockchain: '区块链存证',
  escalate: '升级',
};

// ==================== 规则管理 Tab ====================

function RuleManagement() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRiskType, setFilterRiskType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const [editVisible, setEditVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRule, setDetailRule] = useState<RuleItem | null>(null);
  const [evaluateVisible, setEvaluateVisible] = useState(false);
  const [evaluateJson, setEvaluateJson] = useState('');
  const [evaluateResult, setEvaluateResult] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

  const fetchList = useCallback(async (p?: number, ps?: number) => {
    setLoading(true);
    try {
      const res = await ruleApi.getList({
        page: p ?? page,
        pageSize: ps ?? pageSize,
        riskType: filterRiskType,
        status: filterStatus !== undefined ? Number(filterStatus) : undefined,
        keyword: searchKeyword || undefined,
      });
      setRules(res.list);
      setTotal(res.total);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, pageSize, filterRiskType, filterStatus, searchKeyword]);

  useEffect(() => { fetchList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); fetchList(1); };

  const handleAdd = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ weight: 1, priority: 0, status: 1, riskType: 'overspeed' });
    setEditVisible(true);
  };

  const handleEdit = async (rule: RuleItem) => {
    setEditingRule(rule);
    form.setFieldsValue({
      code: rule.code,
      name: rule.name,
      riskType: rule.riskType,
      description: rule.description || '',
      conditions: JSON.stringify(rule.conditions, null, 2),
      weight: rule.weight,
      priority: rule.priority,
      status: rule.status,
    });
    setEditVisible(true);
  };

  const handleViewDetail = async (id: string) => {
    try {
      const rule = await ruleApi.getById(id);
      setDetailRule(rule);
      setDetailVisible(true);
    } catch { message.error('获取规则详情失败'); }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setEditLoading(true);
      let conditions;
      try {
        conditions = JSON.parse(values.conditions);
      } catch {
        message.error('条件格式错误，请输入有效的 JSON 数组');
        setEditLoading(false);
        return;
      }
      const payload = { ...values, conditions };
      if (editingRule) {
        await ruleApi.update(editingRule.id, payload);
        message.success('规则已更新');
      } else {
        await ruleApi.create(payload);
        message.success('规则已创建');
      }
      setEditVisible(false);
      fetchList(page);
    } catch { /* validation handled by form */ }
    finally { setEditLoading(false); }
  };

  const handleToggleStatus = async (rule: RuleItem) => {
    try {
      await ruleApi.update(rule.id, { status: rule.status === 1 ? 0 : 1 });
      message.success(rule.status === 1 ? '规则已禁用' : '规则已启用');
      fetchList(page);
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await ruleApi.remove(id);
      message.success('规则已删除');
      fetchList(page);
    } catch { message.error('删除失败'); }
  };

  const handleEvaluate = async () => {
    if (!evaluateJson.trim()) {
      message.warning('请输入测试数据');
      return;
    }
    let data;
    try {
      data = JSON.parse(evaluateJson);
    } catch {
      message.error('JSON 格式错误');
      return;
    }
    setEvaluating(true);
    try {
      const res = await ruleApi.evaluate(data);
      setEvaluateResult(res);
    } catch { message.error('评估失败'); }
    finally { setEvaluating(false); }
  };

  const columns: ColumnsType<RuleItem> = [
    { title: '规则编码', dataIndex: 'code', key: 'code', width: 130 },
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    {
      title: '风险类型', dataIndex: 'riskType', key: 'riskType', width: 100,
      render: (t) => <Tag color={riskTypeColors[t] || 'default'}>{riskTypeLabels[t] || t}</Tag>,
    },
    {
      title: '条件', dataIndex: 'conditions', key: 'conditions', width: 180, ellipsis: true,
      render: (c: any[]) => {
        if (!c || c.length === 0) return '-';
        const summary = c.map((cond) => `${cond.field} ${cond.operator} ${cond.value}`).join(', ');
        return <Tooltip title={summary}><Text ellipsis style={{ maxWidth: 160 }}>{summary}</Text></Tooltip>;
      },
    },
    {
      title: '权重', dataIndex: 'weight', key: 'weight', width: 70,
      render: (w: number) => Number(w).toFixed(1),
    },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 70 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: number) => (
        <Switch checked={s === 1} size="small"
          onChange={() => { /* handled in action column */ }} />
      ),
    },
    {
      title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160,
      render: (v) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title={record.status === 1 ? '确定禁用该规则？' : '确定启用该规则？'}
            onConfirm={() => handleToggleStatus(record)}>
            <Button type="link" size="small">
              {record.status === 1 ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
          <Popconfirm title="确定删除该规则？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card className="filter-card" size="small">
        <Space wrap>
          <Input placeholder="搜索规则名称/编码" prefix={<SearchOutlined />}
            value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch} style={{ width: 200 }} allowClear />
          <Select placeholder="风险类型" value={filterRiskType} onChange={setFilterRiskType}
            style={{ width: 120 }} allowClear>
            {Object.entries(riskTypeLabels).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
          <Select placeholder="状态" value={filterStatus} onChange={setFilterStatus}
            style={{ width: 100 }} allowClear>
            <Select.Option value="1">启用</Select.Option>
            <Select.Option value="0">禁用</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleSearch}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增规则</Button>
          <Button icon={<ExperimentOutlined />}
            onClick={() => { setEvaluateJson(''); setEvaluateResult(null); setEvaluateVisible(true); }}>
            规则测试
          </Button>
        </Space>
      </Card>

      <Card className="table-card" size="small">
        <Table columns={columns} dataSource={rules} rowKey="id" loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchList(p, ps); },
          }} />
      </Card>

      {/* 新增/编辑规则 */}
      <Modal title={editingRule ? '编辑规则' : '新增规则'} open={editVisible}
        onCancel={() => setEditVisible(false)} onOk={handleSubmit}
        confirmLoading={editLoading} width={640} destroyOnClose>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="规则编码" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如: over_current" disabled={!!editingRule} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如: 过流检测" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="riskType" label="风险类型" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(riskTypeLabels).map(([k, v]) => (
                    <Select.Option key={k} value={k}>{v}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="weight" label="权重">
                <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="priority" label="优先级">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="规则说明" />
          </Form.Item>
          <Form.Item name="conditions" label="触发条件 (JSON)"
            rules={[{ required: true, message: '请输入条件' },
              { validator: (_, v) => { try { JSON.parse(v); return Promise.resolve(); } catch { return Promise.reject('JSON 格式错误'); } } }]}>
            <TextArea rows={4} placeholder='[{"field": "currentA", "operator": ">", "value": 100}]' />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则详情 */}
      <Modal title="规则详情" open={detailVisible} onCancel={() => setDetailVisible(false)}
        footer={null} width={640}>
        {detailRule && (
          <div>
            <p><Text strong>编码：</Text>{detailRule.code}</p>
            <p><Text strong>名称：</Text>{detailRule.name}</p>
            <p><Text strong>类型：</Text>
              <Tag color={riskTypeColors[detailRule.riskType] || 'default'}>
                {riskTypeLabels[detailRule.riskType] || detailRule.riskType}
              </Tag>
            </p>
            <p><Text strong>描述：</Text>{detailRule.description || '-'}</p>
            <p><Text strong>权重：</Text>{Number(detailRule.weight).toFixed(1)}</p>
            <p><Text strong>优先级：</Text>{detailRule.priority}</p>
            <p><Text strong>状态：</Text>{detailRule.status === 1 ? '启用' : '禁用'}</p>
            <p><Text strong>条件：</Text></p>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13 }}>
              {JSON.stringify(detailRule.conditions, null, 2)}
            </pre>
            {detailRule.ruleStrategies && detailRule.ruleStrategies.length > 0 && (
              <>
                <p><Text strong>关联策略：</Text></p>
                {detailRule.ruleStrategies.map((rs) => (
                  <Tag key={rs.strategy.id} color="blue">{rs.strategy.name} ({rs.strategy.code})</Tag>
                ))}
              </>
            )}
            <p style={{ marginTop: 12 }}>
              <Text strong>更新时间：</Text>{dayjs(detailRule.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </p>
          </div>
        )}
      </Modal>

      {/* 规则测试 */}
      <Modal title="规则测试" open={evaluateVisible}
        onCancel={() => setEvaluateVisible(false)} width={700}
        footer={[
          <Button key="close" onClick={() => setEvaluateVisible(false)}>关闭</Button>,
          <Button key="eval" type="primary" icon={<ExperimentOutlined />}
            loading={evaluating} onClick={handleEvaluate}>运行测试</Button>,
        ]}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>输入测试数据 (JSON)：</Text>
          <TextArea rows={6} value={evaluateJson} onChange={(e) => setEvaluateJson(e.target.value)}
            placeholder='{"currentA": 150, "temperature": 85, "voltageA": 10.5}' />
        </div>
        {evaluateResult && (
          <div>
            <Text strong>测试结果：</Text>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(evaluateResult, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== 策略管理 Tab ====================

function StrategyManagement() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRiskLevel, setFilterRiskLevel] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const [editVisible, setEditVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailStrategy, setDetailStrategy] = useState<StrategyItem | null>(null);
  const [executeVisible, setExecuteVisible] = useState(false);
  const [executeContext, setExecuteContext] = useState('');
  const [executeResult, setExecuteResult] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  const fetchList = useCallback(async (p?: number, ps?: number) => {
    setLoading(true);
    try {
      const res = await strategyApi.getList({
        page: p ?? page,
        pageSize: ps ?? pageSize,
        riskLevel: filterRiskLevel ? Number(filterRiskLevel) : undefined,
        status: filterStatus !== undefined ? Number(filterStatus) : undefined,
        keyword: searchKeyword || undefined,
      });
      setStrategies(res.list);
      setTotal(res.total);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, pageSize, filterRiskLevel, filterStatus, searchKeyword]);

  useEffect(() => { fetchList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); fetchList(1); };

  const handleAdd = () => {
    setEditingStrategy(null);
    form.resetFields();
    form.setFieldsValue({ riskLevel: 1, status: 1 });
    setEditVisible(true);
  };

  const handleEdit = async (strategy: StrategyItem) => {
    setEditingStrategy(strategy);
    form.setFieldsValue({
      code: strategy.code,
      name: strategy.name,
      description: strategy.description || '',
      riskLevel: strategy.riskLevel,
      actions: JSON.stringify(strategy.actions, null, 2),
      notifyConfig: strategy.notifyConfig ? JSON.stringify(strategy.notifyConfig, null, 2) : '',
      status: strategy.status,
    });
    setEditVisible(true);
  };

  const handleViewDetail = async (id: string) => {
    try {
      const strategy = await strategyApi.getById(id);
      setDetailStrategy(strategy);
      setDetailVisible(true);
    } catch { message.error('获取策略详情失败'); }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setEditLoading(true);
      let actions;
      try {
        actions = JSON.parse(values.actions);
      } catch {
        message.error('动作配置格式错误，请输入有效的 JSON 数组');
        setEditLoading(false);
        return;
      }
      let notifyConfig = undefined;
      if (values.notifyConfig) {
        try {
          notifyConfig = JSON.parse(values.notifyConfig);
        } catch {
          message.error('通知配置格式错误');
          setEditLoading(false);
          return;
        }
      }
      const payload = { ...values, actions, notifyConfig };
      if (editingStrategy) {
        await strategyApi.update(editingStrategy.id, payload);
        message.success('策略已更新');
      } else {
        await strategyApi.create(payload);
        message.success('策略已创建');
      }
      setEditVisible(false);
      fetchList(page);
    } catch { /* validation handled by form */ }
    finally { setEditLoading(false); }
  };

  const handleToggleStatus = async (strategy: StrategyItem) => {
    try {
      await strategyApi.update(strategy.id, { status: strategy.status === 1 ? 0 : 1 });
      message.success(strategy.status === 1 ? '策略已禁用' : '策略已启用');
      fetchList(page);
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await strategyApi.remove(id);
      message.success('策略已删除');
      fetchList(page);
    } catch { message.error('删除失败'); }
  };

  const handleExecute = async () => {
    if (!detailStrategy) return;
    if (!executeContext.trim()) {
      message.warning('请输入执行上下文');
      return;
    }
    let context;
    try {
      context = JSON.parse(executeContext);
    } catch {
      message.error('JSON 格式错误');
      return;
    }
    setExecuting(true);
    try {
      const res = await strategyApi.execute(detailStrategy.id, context);
      setExecuteResult(res);
    } catch { message.error('执行失败'); }
    finally { setExecuting(false); }
  };

  const columns: ColumnsType<StrategyItem> = [
    { title: '策略编码', dataIndex: 'code', key: 'code', width: 130 },
    { title: '策略名称', dataIndex: 'name', key: 'name' },
    {
      title: '风险等级', dataIndex: 'riskLevel', key: 'riskLevel', width: 100,
      render: (l: number) => <Tag color={levelColors[l] || 'default'}>{levelLabels[l] || l}</Tag>,
    },
    {
      title: '动作', dataIndex: 'actions', key: 'actions', width: 180, ellipsis: true,
      render: (a: any[]) => {
        if (!a || a.length === 0) return '-';
        const summary = a.map((act) => actionTypeLabels[act.type] || act.type).join(', ');
        return <Tooltip title={summary}><Text ellipsis style={{ maxWidth: 160 }}>{summary}</Text></Tooltip>;
      },
    },
    {
      title: '描述', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: number) => (
        <Switch checked={s === 1} size="small" />
      ),
    },
    {
      title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160,
      render: (v) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title={record.status === 1 ? '确定禁用该策略？' : '确定启用该策略？'}
            onConfirm={() => handleToggleStatus(record)}>
            <Button type="link" size="small">
              {record.status === 1 ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
          <Popconfirm title="确定删除该策略？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card className="filter-card" size="small">
        <Space wrap>
          <Input placeholder="搜索策略名称/编码" prefix={<SearchOutlined />}
            value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch} style={{ width: 200 }} allowClear />
          <Select placeholder="风险等级" value={filterRiskLevel} onChange={setFilterRiskLevel}
            style={{ width: 110 }} allowClear>
            {Object.entries(levelLabels).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
          <Select placeholder="状态" value={filterStatus} onChange={setFilterStatus}
            style={{ width: 100 }} allowClear>
            <Select.Option value="1">启用</Select.Option>
            <Select.Option value="0">禁用</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleSearch}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增策略</Button>
        </Space>
      </Card>

      <Card className="table-card" size="small">
        <Table columns={columns} dataSource={strategies} rowKey="id" loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchList(p, ps); },
          }} />
      </Card>

      {/* 新增/编辑策略 */}
      <Modal title={editingStrategy ? '编辑策略' : '新增策略'} open={editVisible}
        onCancel={() => setEditVisible(false)} onOk={handleSubmit}
        confirmLoading={editLoading} width={640} destroyOnClose>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="策略编码" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如: urgent_block" disabled={!!editingStrategy} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="策略名称" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如: 紧急阻断策略" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="riskLevel" label="风险等级" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(levelLabels).map(([k, v]) => (
                    <Select.Option key={k} value={Number(k)}>{v}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="策略说明" />
          </Form.Item>
          <Form.Item name="actions" label="动作配置 (JSON)"
            rules={[{ required: true, message: '请输入动作配置' },
              { validator: (_, v) => { try { JSON.parse(v); return Promise.resolve(); } catch { return Promise.reject('JSON 格式错误'); } } }]}
            extra='[{ "type": "alert" }, { "type": "blockchain", "config": { "dataType": "risk_event" } }]'>
            <TextArea rows={4} placeholder='[{"type": "alert"}, {"type": "notify", "config": {"channels": ["email","sms"]}}]' />
          </Form.Item>
          <Form.Item name="notifyConfig" label="通知配置 (JSON，可选)">
            <TextArea rows={3} placeholder='{"channels": ["email"], "template": "risk_alert"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 策略详情 */}
      <Modal title="策略详情" open={detailVisible} onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="exec" icon={<ThunderboltOutlined />}
            onClick={() => { setExecuteContext(''); setExecuteResult(null); setExecuteVisible(true); }}>
            执行测试
          </Button>,
          <Button key="close" type="primary" onClick={() => setDetailVisible(false)}>关闭</Button>,
        ]} width={640}>
        {detailStrategy && (
          <div>
            <p><Text strong>编码：</Text>{detailStrategy.code}</p>
            <p><Text strong>名称：</Text>{detailStrategy.name}</p>
            <p><Text strong>风险等级：</Text>
              <Tag color={levelColors[detailStrategy.riskLevel] || 'default'}>
                {levelLabels[detailStrategy.riskLevel] || detailStrategy.riskLevel}
              </Tag>
            </p>
            <p><Text strong>描述：</Text>{detailStrategy.description || '-'}</p>
            <p><Text strong>状态：</Text>{detailStrategy.status === 1 ? '启用' : '禁用'}</p>
            <p><Text strong>动作配置：</Text></p>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13 }}>
              {JSON.stringify(detailStrategy.actions, null, 2)}
            </pre>
            {detailStrategy.notifyConfig && (
              <>
                <p><Text strong>通知配置：</Text></p>
                <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13 }}>
                  {JSON.stringify(detailStrategy.notifyConfig, null, 2)}
                </pre>
              </>
            )}
            {detailStrategy.ruleStrategies && detailStrategy.ruleStrategies.length > 0 && (
              <>
                <p><Text strong>关联规则：</Text></p>
                {detailStrategy.ruleStrategies.map((rs) => (
                  <Tag key={rs.rule.id} color="blue">{rs.rule.name} ({rs.rule.code})</Tag>
                ))}
              </>
            )}
            <p style={{ marginTop: 12 }}>
              <Text strong>更新时间：</Text>{dayjs(detailStrategy.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </p>
          </div>
        )}
      </Modal>

      {/* 策略执行测试 */}
      <Modal title="策略执行测试" open={executeVisible}
        onCancel={() => setExecuteVisible(false)} width={700}
        footer={[
          <Button key="close" onClick={() => setExecuteVisible(false)}>关闭</Button>,
          <Button key="exec" type="primary" icon={<ThunderboltOutlined />}
            loading={executing} onClick={handleExecute}>执行</Button>,
        ]}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>执行上下文 (JSON)：</Text>
          <TextArea rows={6} value={executeContext} onChange={(e) => setExecuteContext(e.target.value)}
            placeholder='{"riskId": "xxx", "riskLevel": 3}' />
        </div>
        {executeResult && (
          <div>
            <Text strong>执行结果：</Text>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(executeResult, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== 主页面 ====================

export default function RiskConfigPage() {
  const [ruleCount, setRuleCount] = useState(0);
  const [strategyCount, setStrategyCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [rules, strategies] = await Promise.all([
          ruleApi.getList({ page: 1, pageSize: 1 }),
          strategyApi.getList({ page: 1, pageSize: 1 }),
        ]);
        setRuleCount(rules.total);
        setStrategyCount(strategies.total);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div className="risk-config-page">
      <Title level={2}>规则配置</Title>

      <Row gutter={16} className="stats-row">
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="规则总数" value={ruleCount} prefix={<SettingOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="策略总数" value={strategyCount}
              prefix={<ThunderboltOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="rules"
        items={[
          {
            key: 'rules',
            label: <span><SettingOutlined /> 规则管理</span>,
            children: <RuleManagement />,
          },
          {
            key: 'strategies',
            label: <span><ThunderboltOutlined /> 策略管理</span>,
            children: <StrategyManagement />,
          },
        ]}
      />
    </div>
  );
}
