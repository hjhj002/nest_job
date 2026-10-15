import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { authApi } from '../../../services/auth';
import { useNavigate } from 'react-router-dom';
import './style.css';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await authApi.login(values);
      localStorage.setItem('token', result.accessToken);
      localStorage.setItem('user', JSON.stringify(result.user));
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error?.message || '登录失败，请检查用户名和密码';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background" />

      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <SafetyOutlined />
          </div>
          <Title level={3} className="login-title">
            电力设备监控系统
          </Title>
          <Text type="secondary">智能风控 · 多Agent协同 · 区块链存证</Text>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              登录
            </Button>
          </Form.Item>

          <div className="login-tips">
            <Text type="secondary" style={{ fontSize: 12 }}>
              演示账号：cladmin001 / 123456
            </Text>
          </div>
        </Form>
      </Card>

      <div className="login-footer">
        <Text type="secondary">
          © 2024 电力设备监控系统 · 基于多智能体协同的风险决策研究
        </Text>
      </div>
    </div>
  );
}
