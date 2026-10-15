// Package api 提供REST API路由定义和处理器
// 基于Gin框架实现变电站设备数据接口
package api

import (
	"net/http"
	"strconv"
	"substation-mock/pkg/data"
	"substation-mock/pkg/service"
	"time"

	"github.com/gin-gonic/gin"
)

// Response 统一API响应结构
type Response struct {
	// 请求是否成功
	Success bool `json:"success"`
	// 响应数据
	Data interface{} `json:"data,omitempty"`
	// 错误信息
	Error string `json:"error,omitempty"`
	// 响应时间戳
	Timestamp string `json:"timestamp"`
	// 数据总数（可选）
	Total int `json:"total,omitempty"`
}

// DeviceHandler 设备数据处理器
type DeviceHandler struct {
	generator *data.DeviceGenerator
	mqService *service.RabbitMQService
}

// NewDeviceHandler 创建设备数据处理器
// generator: 设备数据生成器
// mqService: RabbitMQ服务(可为nil)
func NewDeviceHandler(generator *data.DeviceGenerator, mqService *service.RabbitMQService) *DeviceHandler {
	return &DeviceHandler{
		generator: generator,
		mqService: mqService,
	}
}

// SetupRouter 配置API路由
// 返回配置好的Gin引擎
func SetupRouter(generator *data.DeviceGenerator, mqService *service.RabbitMQService) *gin.Engine {
	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	router.Use(requestLogger())

	// 健康检查端点
	router.GET("/health", healthCheck)

	// API v1 路由组
	v1 := router.Group("/api/v1")
	{
		handler := NewDeviceHandler(generator, mqService)

		// 获取设备数据（批量随机生成）
		v1.GET("/device-data", handler.GetDeviceData)

		// 根据设备ID获取数据（从CSV配置）
		v1.GET("/device/:id", handler.GetDeviceByID)

		// 获取所有设备配置列表
		v1.GET("/devices", handler.GetAllDevices)

		// 批量获取设备数据（POST方式）
		v1.POST("/devices/batch", handler.GetDevicesBatch)

		// 批量获取设备数据（GET方式，通过查询参数）
		v1.GET("/devices/batch", handler.GetDevicesBatch)

		// 获取所有设备实时数据
		v1.GET("/devices/data", handler.GetAllDeviceData)

		// 获取设备统计信息
		v1.GET("/device-stats", handler.GetDeviceStats)

		// 获取支持的设备类型
		v1.GET("/device-types", handler.GetDeviceTypes)
	}

	// 手动触发设备配置热重载的管理端点
	// POST /api/v1/admin/reload-config
	router.POST("/api/v1/admin/reload-config", func(c *gin.Context) {
		if err := generator.ReloadDeviceConfigs(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "设备配置重新加载失败",
				"error":   err.Error(),
			})
			return
		}
		configs := generator.GetAllDeviceConfigs()
		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"message":     "设备配置已重新加载",
			"deviceCount": len(configs),
		})
	})

	return router
}

// GetDeviceData 获取模拟设备数据
// GET /api/v1/device-data?count=N
// count: 返回的设备数量，默认5，最大100
func (h *DeviceHandler) GetDeviceData(c *gin.Context) {
	// 解析count参数
	countStr := c.DefaultQuery("count", "5")
	count, err := strconv.Atoi(countStr)
	if err != nil || count < 1 {
		c.JSON(http.StatusBadRequest, Response{
			Success:   false,
			Error:     "无效的count参数，必须是正整数",
			Timestamp: getTimestamp(),
		})
		return
	}

	// 限制最大数量
	if count > 100 {
		count = 100
	}

	// 生成设备数据
	devices := h.generator.GenerateDevices(count)

	// 如果配置了RabbitMQ，异步推送数据
	if h.mqService != nil {
		go func(devices []*data.Device) {
			for _, device := range devices {
				if err := h.mqService.PublishDeviceData(device); err != nil {
					// 记录错误但不影响API响应
					// 实际项目中应使用日志框架
					_ = err
				}
			}
		}(devices)
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      devices,
		Timestamp: getTimestamp(),
	})
}

// GetDeviceStats 获取设备统计信息
// GET /api/v1/device-stats
// 返回各类设备数量和状态分布
func (h *DeviceHandler) GetDeviceStats(c *gin.Context) {
	// 生成一批数据用于统计
	sampleSize := 100
	devices := h.generator.GenerateDevices(sampleSize)

	// 统计设备类型分布
	typeStats := make(map[string]int)
	// 统计状态分布
	statusStats := make(map[string]int)
	// 统计告警数量
	alarmCount := 0

	for _, device := range devices {
		typeStats[string(device.DeviceType)]++
		statusStats[string(device.Status)]++
		alarmCount += len(device.Alarms)
	}

	stats := map[string]interface{}{
		"sample_size":         sampleSize,
		"device_types":        typeStats,
		"status_distribution": statusStats,
		"total_alarms":        alarmCount,
		"alarm_rate":          float64(alarmCount) / float64(sampleSize) * 100,
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      stats,
		Timestamp: getTimestamp(),
	})
}

// GetDeviceTypes 获取支持的设备类型列表
// GET /api/v1/device-types
func (h *DeviceHandler) GetDeviceTypes(c *gin.Context) {
	types := []map[string]string{
		{"code": "TX", "name": "变压器", "description": "电力变压器，用于电压变换"},
		{"code": "CB", "name": "断路器", "description": "高压断路器，用于电路保护"},
		{"code": "Bus", "name": "母线", "description": "汇流母线，用于电能汇集和分配"},
		{"code": "Cap", "name": "电容器", "description": "并联电容器组，用于无功补偿"},
		{"code": "LA", "name": "避雷器", "description": "金属氧化物避雷器，用于过电压保护"},
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      types,
		Timestamp: getTimestamp(),
	})
}

// GetDeviceByID 根据设备ID获取数据
// GET /api/v1/device/:id
// 从CSV配置中查找设备并生成对应状态的数据
func (h *DeviceHandler) GetDeviceByID(c *gin.Context) {
	deviceID := c.Param("id")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, Response{
			Success:   false,
			Error:     "设备ID不能为空",
			Timestamp: getTimestamp(),
		})
		return
	}

	// 根据ID生成设备数据
	device, err := h.generator.GenerateDeviceByID(deviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success:   false,
			Error:     err.Error(),
			Timestamp: getTimestamp(),
		})
		return
	}

	// 如果配置了RabbitMQ，异步推送数据
	if h.mqService != nil {
		go func(device *data.Device) {
			if err := h.mqService.PublishDeviceData(device); err != nil {
				_ = err
			}
		}(device)
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      device,
		Timestamp: getTimestamp(),
	})
}

// GetAllDevices 获取所有设备配置列表
// GET /api/v1/devices
// 返回CSV中配置的所有设备基本信息
func (h *DeviceHandler) GetAllDevices(c *gin.Context) {
	configs := h.generator.GetAllDeviceConfigs()

	if len(configs) == 0 {
		c.JSON(http.StatusOK, Response{
			Success:   true,
			Data:      []interface{}{},
			Timestamp: getTimestamp(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      configs,
		Timestamp: getTimestamp(),
	})
}

// GetDevicesBatch 批量获取设备数据
// POST /api/v1/devices/batch
// 请求体: {"device_ids": ["TX_001", "TX_002", "CB_001"]}
// 或查询参数: ?ids=TX_001,TX_002,CB_001
func (h *DeviceHandler) GetDevicesBatch(c *gin.Context) {
	var deviceIDs []string

	// 优先从查询参数获取
	idsParam := c.Query("ids")
	if idsParam != "" {
		// 解析逗号分隔的ID列表
		deviceIDs = parseIDs(idsParam)
	} else {
		// 从JSON请求体获取
		var req struct {
			DeviceIDs []string `json:"device_ids"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, Response{
				Success:   false,
				Error:     "无效的请求格式: " + err.Error(),
				Timestamp: getTimestamp(),
			})
			return
		}
		deviceIDs = req.DeviceIDs
	}

	if len(deviceIDs) == 0 {
		c.JSON(http.StatusBadRequest, Response{
			Success:   false,
			Error:     "设备ID列表不能为空",
			Timestamp: getTimestamp(),
		})
		return
	}

	// 限制批量数量
	if len(deviceIDs) > 100 {
		deviceIDs = deviceIDs[:100]
	}

	// 批量生成设备数据
	devices, errors := h.generator.GenerateDevicesByIDs(deviceIDs)

	// 如果配置了RabbitMQ，异步推送数据
	if h.mqService != nil {
		go func(devices []*data.Device) {
			for _, device := range devices {
				if err := h.mqService.PublishDeviceData(device); err != nil {
					_ = err
				}
			}
		}(devices)
	}

	result := map[string]interface{}{
		"devices":     devices,
		"total":       len(devices),
		"requested":   len(deviceIDs),
		"errors":      errors,
		"error_count": len(errors),
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      result,
		Timestamp: getTimestamp(),
	})
}

// GetAllDeviceData 获取所有设备实时数据
// GET /api/v1/devices/data
// 返回CSV中配置的所有设备的实时数据
func (h *DeviceHandler) GetAllDeviceData(c *gin.Context) {
	devices := h.generator.GenerateAllDevices()

	// 如果配置了RabbitMQ，异步推送数据
	if h.mqService != nil {
		go func(devices []*data.Device) {
			for _, device := range devices {
				if err := h.mqService.PublishDeviceData(device); err != nil {
					_ = err
				}
			}
		}(devices)
	}

	c.JSON(http.StatusOK, Response{
		Success:   true,
		Data:      devices,
		Total:     len(devices),
		Timestamp: getTimestamp(),
	})
}

// parseIDs 解析逗号分隔的设备ID列表
func parseIDs(idsParam string) []string {
	var ids []string
	current := ""
	for _, char := range idsParam {
		if char == ',' {
			if current != "" {
				ids = append(ids, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		ids = append(ids, current)
	}
	return ids
}

// healthCheck 健康检查处理器
// GET /health
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"service":   "substation-mock",
		"version":   "1.0.0",
		"timestamp": getTimestamp(),
	})
}

// corsMiddleware CORS跨域中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// requestLogger 请求日志中间件
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录请求开始时间
		start := time.Now()

		// 处理请求
		c.Next()

		// 记录请求信息
		// 实际项目中应使用结构化日志
		_ = gin.LogFormatterParams{
			TimeStamp:    time.Now(),
			Latency:      time.Since(start),
			ClientIP:     c.ClientIP(),
			Method:       c.Request.Method,
			StatusCode:   c.Writer.Status(),
			ErrorMessage: c.Errors.ByType(gin.ErrorTypePrivate).String(),
		}
	}
}

// getTimestamp 获取当前时间戳字符串(ISO8601格式)
func getTimestamp() string {
	return time.Now().Format("2006-01-02T15:04:05.000Z")
}
