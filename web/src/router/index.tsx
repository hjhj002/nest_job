import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Layout from '../components/Layout';
import LoginPage from '../pages/admin/login';
import DashboardPage from '../pages/admin/dashboard';
import DevicePage from '../pages/admin/device';
import RiskPage from '../pages/admin/risk';
import DecisionPage from '../pages/admin/decision';
import AlarmPage from '../pages/admin/alarm';
import BlockchainPage from '../pages/admin/blockchain';
import DataPage from '../pages/admin/data';
import ChatPage from '../pages/admin/chat';
import LogsPage from '../pages/admin/logs';
import UserPage from '../pages/admin/user';
import ReviewPage from '../pages/admin/review';
import RiskConfigPage from '../pages/admin/risk-config';
import AgentConfigPage from '../pages/admin/agent-config';
import BigScreenPage from '../pages/screen/bigscreen';

// 路由守卫组件
const PrivateRoute = () => {
  const token = localStorage.getItem('token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

// 公开路由
const PublicRoute = () => {
  const token = localStorage.getItem('token');
  return !token ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          {
            path: '/',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/device',
            element: <DevicePage />,
          },
          {
            path: '/risk',
            element: <RiskPage />,
          },
          {
            path: '/decision',
            element: <DecisionPage />,
          },
          {
            path: '/alarm',
            element: <AlarmPage />,
          },
          {
            path: '/blockchain',
            element: <BlockchainPage />,
          },
          {
            path: '/data',
            element: <DataPage />,
          },
          {
            path: '/chat',
            element: <ChatPage />,
          },
          {
            path: '/logs',
            element: <LogsPage />,
          },
          {
            path: '/users',
            element: <UserPage />,
          },
          {
            path: '/review',
            element: <ReviewPage />,
          },
          {
            path: '/risk-config',
            element: <RiskConfigPage />,
          },
          {
            path: '/agent-config',
            element: <AgentConfigPage />,
          },
        ],
      },
    ],
  },
  // 数字大屏 - 独立全屏页面（不需要Layout）
  {
    path: '/bigscreen',
    element: <BigScreenPage />,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
