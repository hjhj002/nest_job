import { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Avatar, Dropdown, Space, Typography, theme, Tooltip } from 'antd';
import {
  DashboardOutlined,
  ToolOutlined,
  WarningOutlined,
  SafetyOutlined,
  BellOutlined,
  BlockOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  AuditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FullscreenOutlined,
  SunOutlined,
  MoonOutlined,
  MessageOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import './style.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// Menu items with their required permissions
const allMenuItems: { key: string; icon: React.ReactNode; label: React.ReactNode; permission?: string; onClick?: () => void }[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '首页概览', permission: 'dashboard:view' },
  { key: '/device', icon: <ToolOutlined />, label: '设备管理', permission: 'device:read' },
  { key: '/risk', icon: <WarningOutlined />, label: '风险管理', permission: 'risk:read' },
  { key: '/decision', icon: <SafetyOutlined />, label: '决策协同', permission: 'decision:read' },
  { key: '/alarm', icon: <BellOutlined />, label: '告警中心', permission: 'alarm:read' },
  { key: '/review', icon: <AuditOutlined />, label: '决策审核', permission: 'risk:handle' },
  { key: '/blockchain', icon: <BlockOutlined />, label: '区块链存证', permission: 'blockchain:read' },
  { key: '/chat', icon: <MessageOutlined />, label: 'Agent 对话', permission: 'chat:use' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Agent 日志', permission: 'logs:read' },
  { key: '/data', icon: <BarChartOutlined />, label: '数据分析', permission: 'dashboard:view' },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理', permission: 'user:read' },
  { key: '/risk-config', icon: <SettingOutlined />, label: '规则配置', permission: 'risk:rule:read' },
  { key: 'bigscreen', icon: <FullscreenOutlined />, label: '数字大屏', permission: 'bigscreen:view', onClick: () => window.open('/bigscreen', '_blank') },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const { mode, toggle } = useTheme();

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { alertApi } = await import('../../services/alert');
      const count = await alertApi.getUnreadCount();
      setUnreadCount(count as unknown as number);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const userPermissions: string[] = user?.permissions || [];

  const menuItems = allMenuItems
    .filter((item) => !item.permission || userPermissions.includes(item.permission))
    .map((item) => {
      if (item.key === '/alarm' && unreadCount > 0) {
        return {
          ...item,
          label: (
            <Space>
              告警中心
              <Badge count={unreadCount} size="small" />
            </Space>
          ),
        };
      }
      return item;
    });

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  const isDark = mode === 'dark';

  return (
    <Layout className="app-layout">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme={isDark ? 'dark' : 'light'}
        className="app-sider"
      >
        <div className="logo" style={{ background: colorBgContainer, borderBottom: `1px solid ${isDark ? 'rgba(124,58,237,0.2)' : '#f0ebff'}` }}>
          <SafetyOutlined className="logo-icon" />
          {!collapsed && <span className="logo-text" style={{ color: isDark ? '#a78bfa' : '#1f0a3c' }}>电力监控</span>}
        </div>
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header style={{ background: colorBgContainer }} className="app-header">
          <div className="header-left">
            <div className="trigger" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          </div>

          <div className="header-right">
            <Space size={16}>
              <Tooltip title={isDark ? '切换浅色' : '切换深色'}>
                <div className="header-icon" onClick={toggle}>
                  {isDark ? <SunOutlined /> : <MoonOutlined />}
                </div>
              </Tooltip>

              <Badge count={unreadCount} size="small">
                <BellOutlined
                  className="header-icon"
                  onClick={() => navigate('/alarm')}
                />
              </Badge>

              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space className="user-info">
                  <Avatar icon={<UserOutlined />} />
                  {!collapsed && (
                    <Text strong>{user?.realName || user?.username || '管理员'}</Text>
                  )}
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
          }}
          className="app-content"
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

