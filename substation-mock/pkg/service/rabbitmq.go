// Package service 提供消息队列服务
// 支持RabbitMQ消息推送，用于将设备数据发送到消息队列
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"substation-mock/pkg/data"
	"time"

	"github.com/rabbitmq/amqp091-go"
)

// RabbitMQConfig RabbitMQ配置
type RabbitMQConfig struct {
	// RabbitMQ服务器地址
	Host string
	// RabbitMQ端口
	Port int
	// 用户名
	Username string
	// 密码
	Password string
	// 虚拟主机
	VHost string
	// 交换机名称
	Exchange string
	// 队列名称
	Queue string
	// 路由键
	RoutingKey string
}

// DefaultRabbitMQConfig 返回默认RabbitMQ配置
func DefaultRabbitMQConfig() *RabbitMQConfig {
	return &RabbitMQConfig{
		Host:       "localhost",
		Port:       5672,
		Username:   "guest",
		Password:   "guest",
		VHost:      "/",
		Exchange:   "substation.device",
		Queue:      "device_data",
		RoutingKey: "device.data",
	}
}

// RabbitMQService RabbitMQ服务
type RabbitMQService struct {
	config     *RabbitMQConfig
	connection *amqp091.Connection
	channel    *amqp091.Channel
	isConnected bool
}

// NewRabbitMQService 创建RabbitMQ服务实例
// config: RabbitMQ配置，如果为nil则使用默认配置
func NewRabbitMQService(config *RabbitMQConfig) (*RabbitMQService, error) {
	if config == nil {
		config = DefaultRabbitMQConfig()
	}

	service := &RabbitMQService{
		config:      config,
		isConnected: false,
	}

	// 尝试连接RabbitMQ
	if err := service.Connect(); err != nil {
		// 连接失败不返回错误，允许服务在RabbitMQ不可用时继续运行
		// 实际项目中应记录日志
		return service, nil
	}

	return service, nil
}

// Connect 建立RabbitMQ连接
func (s *RabbitMQService) Connect() error {
	// 构建连接URL
	url := fmt.Sprintf("amqp://%s:%s@%s:%d%s",
		s.config.Username,
		s.config.Password,
		s.config.Host,
		s.config.Port,
		s.config.VHost,
	)

	// 建立连接
	conn, err := amqp091.Dial(url)
	if err != nil {
		return fmt.Errorf("连接RabbitMQ失败: %w", err)
	}

	// 创建通道
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("创建RabbitMQ通道失败: %w", err)
	}

	// 声明交换机
	err = ch.ExchangeDeclare(
		s.config.Exchange, // 交换机名称
		"topic",           // 交换机类型
		true,              // 持久化
		false,             // 自动删除
		false,             // 内部交换机
		false,             // 等待服务器确认
		nil,               // 参数
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("声明交换机失败: %w", err)
	}

	// 声明队列
	_, err = ch.QueueDeclare(
		s.config.Queue, // 队列名称
		true,           // 持久化
		false,          // 自动删除
		false,          // 排他性
		false,          // 等待服务器确认
		nil,            // 参数
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("声明队列失败: %w", err)
	}

	// 绑定队列到交换机
	err = ch.QueueBind(
		s.config.Queue,     // 队列名称
		s.config.RoutingKey, // 路由键
		s.config.Exchange,   // 交换机名称
		false,               // 等待服务器确认
		nil,                 // 参数
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("绑定队列失败: %w", err)
	}

	s.connection = conn
	s.channel = ch
	s.isConnected = true

	return nil
}

// Close 关闭RabbitMQ连接
func (s *RabbitMQService) Close() error {
	if s.channel != nil {
		s.channel.Close()
	}
	if s.connection != nil {
		return s.connection.Close()
	}
	s.isConnected = false
	return nil
}

// IsConnected 检查是否已连接
func (s *RabbitMQService) IsConnected() bool {
	return s.isConnected && s.connection != nil && !s.connection.IsClosed()
}

// PublishDeviceData 发布设备数据到RabbitMQ
// device: 设备数据
func (s *RabbitMQService) PublishDeviceData(device *data.Device) error {
	if !s.IsConnected() {
		// 未连接时尝试重连
		if err := s.Connect(); err != nil {
			return fmt.Errorf("RabbitMQ未连接，重连失败: %w", err)
		}
	}

	// 将设备数据序列化为JSON
	body, err := json.Marshal(device)
	if err != nil {
		return fmt.Errorf("序列化设备数据失败: %w", err)
	}

	// 设置发布超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 发布消息
	err = s.channel.PublishWithContext(
		ctx,
		s.config.Exchange,   // 交换机
		s.config.RoutingKey, // 路由键
		false,               // 强制
		false,               // 立即
		amqp091.Publishing{
			ContentType:  "application/json",
			Body:         body,
			Timestamp:    time.Now(),
			DeliveryMode: amqp091.Persistent, // 持久化消息
			Headers: amqp091.Table{
				"device_type": string(device.DeviceType),
				"status":      string(device.Status),
			},
		},
	)
	if err != nil {
		s.isConnected = false
		return fmt.Errorf("发布消息失败: %w", err)
	}

	return nil
}

// PublishBatch 批量发布设备数据
// devices: 设备数据切片
func (s *RabbitMQService) PublishBatch(devices []*data.Device) error {
	for _, device := range devices {
		if err := s.PublishDeviceData(device); err != nil {
			return err
		}
	}
	return nil
}

// GetQueueInfo 获取队列信息
// 返回队列中的消息数量和消费者数量
func (s *RabbitMQService) GetQueueInfo() (messages, consumers int, err error) {
	if !s.IsConnected() {
		return 0, 0, fmt.Errorf("RabbitMQ未连接")
	}

	queue, err := s.channel.QueueInspect(s.config.Queue)
	if err != nil {
		return 0, 0, fmt.Errorf("获取队列信息失败: %w", err)
	}

	return queue.Messages, queue.Consumers, nil
}

// MockRabbitMQService 模拟RabbitMQ服务
// 用于RabbitMQ不可用时进行本地测试
type MockRabbitMQService struct {
	messages []*data.Device
}

// NewMockRabbitMQService 创建模拟RabbitMQ服务
func NewMockRabbitMQService() *MockRabbitMQService {
	return &MockRabbitMQService{
		messages: make([]*data.Device, 0),
	}
}

// PublishDeviceData 模拟发布设备数据(仅存储在内存中)
func (m *MockRabbitMQService) PublishDeviceData(device *data.Device) error {
	m.messages = append(m.messages, device)
	// 限制内存中存储的消息数量
	if len(m.messages) > 1000 {
		m.messages = m.messages[len(m.messages)-1000:]
	}
	return nil
}

// GetMessages 获取内存中存储的消息(仅用于测试)
func (m *MockRabbitMQService) GetMessages() []*data.Device {
	return m.messages
}

// ClearMessages 清空内存中的消息
func (m *MockRabbitMQService) ClearMessages() {
	m.messages = make([]*data.Device, 0)
}
