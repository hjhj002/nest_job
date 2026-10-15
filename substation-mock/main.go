// Substation Device Data Mock Service
// 变电站设备数据模拟服务
// 用于多智能体风控系统测试
//
// 功能特性:
//   - 模拟5种变电站设备类型(变压器、断路器、母线、电容器、避雷器)
//   - 支持设备参数波动和异常状态模拟
//   - 提供REST API获取模拟数据
//   - 可选RabbitMQ消息推送
//   - 支持高并发数据生成
//
// API端点:
//   GET /health              - 健康检查
//   GET /api/v1/device-data  - 获取设备数据(?count=N)
//   GET /api/v1/device-stats - 获取设备统计
//   GET /api/v1/device-types - 获取设备类型列表
//
// 使用方法:
//   1. 直接运行: go run main.go
//   2. 编译运行: go build -o substation-mock && ./substation-mock
//   3. 配置RabbitMQ: 设置环境变量 RABBITMQ_HOST, RABBITMQ_PORT 等

package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"substation-mock/pkg/api"
	"substation-mock/pkg/data"
	"substation-mock/pkg/service"
	"substation-mock/pkg/watcher"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

// 版本信息
const (
	Version   = "1.0.0"
	AppName   = "substation-mock"
	BuildTime = "2024-01-01"
)

// Config 应用配置
type Config struct {
	// HTTP服务器端口
	Port int
	// 是否启用RabbitMQ
	EnableRabbitMQ bool
	// RabbitMQ配置
	RabbitMQ *service.RabbitMQConfig
}

// loadConfig 从环境变量加载配置
func loadConfig() *Config {
	config := &Config{
		Port:           8080,
		EnableRabbitMQ: false,
		RabbitMQ:       service.DefaultRabbitMQConfig(),
	}

	// 从环境变量读取端口
	if port := os.Getenv("PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.Port = p
		}
	}

	// 从环境变量读取RabbitMQ配置
	if host := os.Getenv("RABBITMQ_HOST"); host != "" {
		config.RabbitMQ.Host = host
		config.EnableRabbitMQ = true
	}
	if port := os.Getenv("RABBITMQ_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.RabbitMQ.Port = p
		}
	}
	if user := os.Getenv("RABBITMQ_USER"); user != "" {
		config.RabbitMQ.Username = user
	}
	if pass := os.Getenv("RABBITMQ_PASS"); pass != "" {
		config.RabbitMQ.Password = pass
	}
	if vhost := os.Getenv("RABBITMQ_VHOST"); vhost != "" {
		config.RabbitMQ.VHost = vhost
	}

	return config
}

func main() {
	// 解析命令行参数
	var (
		port        = flag.Int("port", 0, "HTTP服务器端口(默认8080)")
		enableMQ    = flag.Bool("mq", false, "启用RabbitMQ推送")
		mqHost      = flag.String("mq-host", "", "RabbitMQ主机地址")
		showVersion = flag.Bool("version", false, "显示版本信息")
	)
	flag.Parse()

	// 显示版本信息
	if *showVersion {
		fmt.Printf("%s version %s (built %s)\n", AppName, Version, BuildTime)
		os.Exit(0)
	}

	// 加载配置
	config := loadConfig()

	// 命令行参数覆盖环境变量
	if *port != 0 {
		config.Port = *port
	}
	if *enableMQ {
		config.EnableRabbitMQ = true
	}
	if *mqHost != "" {
		config.RabbitMQ.Host = *mqHost
		config.EnableRabbitMQ = true
	}

	// 打印启动信息
	printBanner()
	log.Printf("[INFO] 启动 %s v%s", AppName, Version)
	log.Printf("[INFO] HTTP服务器端口: %d", config.Port)
	log.Printf("[INFO] RabbitMQ启用: %v", config.EnableRabbitMQ)

	// 创建设备数据生成器
	csvPath := os.Getenv("DEVICE_CSV_PATH")
	if csvPath == "" {
		csvPath = "config/devices.csv"
	}
	generator, err := data.NewDeviceGenerator(csvPath)
	if err != nil {
		log.Printf("[WARN] 设备数据生成器初始化警告: %v", err)
	}
	log.Printf("[INFO] 设备数据生成器已初始化")

	// 启动CSV配置文件监控，实现热重载
	configWatcher, err := watcher.NewConfigWatcher(generator.GetCSVPath(), func() {
		if reloadErr := generator.ReloadDeviceConfigs(); reloadErr != nil {
			log.Printf("[警告] 配置热重载失败: %v", reloadErr)
		}
	})
	if err != nil {
		log.Printf("[警告] 无法启动配置文件监控: %v", err)
	} else {
		if err := configWatcher.Start(); err != nil {
			log.Printf("[警告] 配置文件监控启动失败: %v", err)
		} else {
			defer configWatcher.Stop()
		}
	}

	// 初始化RabbitMQ服务(如果启用)
	var mqService *service.RabbitMQService
	if config.EnableRabbitMQ {
		var err error
		mqService, err = service.NewRabbitMQService(config.RabbitMQ)
		if err != nil {
			log.Printf("[WARN] RabbitMQ连接失败: %v", err)
			log.Printf("[WARN] 将继续运行，但不推送消息到RabbitMQ")
		} else if mqService.IsConnected() {
			log.Printf("[INFO] RabbitMQ已连接: %s:%d", config.RabbitMQ.Host, config.RabbitMQ.Port)
			defer mqService.Close()
		}
	}

	// 设置Gin路由
	router := api.SetupRouter(generator, mqService)

	// 配置HTTP服务器
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", config.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 启动服务器(在goroutine中)
	go func() {
		log.Printf("[INFO] HTTP服务器启动成功，监听端口 %d", config.Port)
		log.Printf("[INFO] API文档: http://localhost:%d/api/v1/device-data?count=5", config.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP服务器启动失败: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[INFO] 正在关闭服务器...")

	// 关闭RabbitMQ连接
	if mqService != nil {
		if err := mqService.Close(); err != nil {
			log.Printf("[WARN] 关闭RabbitMQ连接失败: %v", err)
		} else {
			log.Printf("[INFO] RabbitMQ连接已关闭")
		}
	}

	log.Printf("[INFO] 服务器已关闭")
}

// printBanner 打印启动横幅
func printBanner() {
	banner := `
   _____       _     _             _   _               
  / ____|     | |   | |           | | (_)              
 | (___  _   _| |__ | |_ _ __ ___ | |_ _ _ __   __ _   
  \___ \| | | | '_ \| __| '_ \ _ \| __| | '_ \ / _\ |  
  ____) | |_| | |_) | |_| | | | | | |_| | | | | (_| |  
 |_____/ \__,_|_.__/ \__|_| |_| |_|\__|_|_| |_|\__, |  
                                                __/ |  
  Substation Device Data Mock Service          |___/   
                                                        
`
	fmt.Println(banner)
}

// init 初始化函数
func init() {
	// 设置日志格式
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)
}
