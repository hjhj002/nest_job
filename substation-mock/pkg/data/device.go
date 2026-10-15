// Package data 提供变电站设备数据结构和模拟生成逻辑
// 用于多智能体风控系统测试的数据模拟
package data

import (
	"encoding/csv"
	"fmt"
	"log"
	"math/rand"
	"os"
	"sync"
	"time"
)

// DeviceType 定义设备类型
type DeviceType string

const (
	// 变压器
	DeviceTypeTransformer DeviceType = "TX"
	// 断路器
	DeviceTypeCircuitBreaker DeviceType = "CB"
	// 母线
	DeviceTypeBus DeviceType = "Bus"
	// 电容器
	DeviceTypeCapacitor DeviceType = "Cap"
	// 避雷器
	DeviceTypeLightningArrester DeviceType = "LA"
)

// DeviceStatus 定义设备状态
type DeviceStatus string

const (
	// 正常状态
	StatusNormal DeviceStatus = "normal"
	// 警告状态
	StatusWarning DeviceStatus = "warning"
	// 异常状态
	StatusAbnormal DeviceStatus = "abnormal"
)

// Device 定义变电站设备数据结构
type Device struct {
	// 设备唯一标识
	DeviceID string `json:"device_id"`
	// 设备类型: TX/CB/Bus/Cap/LA
	DeviceType DeviceType `json:"device_type"`
	// 设备位置
	Location string `json:"location"`
	// 电压(kV)，带±5%波动
	Voltage float64 `json:"voltage"`
	// 电流(A)，带±10%波动
	Current float64 `json:"current"`
	// 频率(Hz)
	Frequency float64 `json:"frequency"`
	// 温度(℃)，带±20℃波动
	Temperature float64 `json:"temperature"`
	// 油位百分比(%)，变压器特有
	OilLevel *float64 `json:"oil_level,omitempty"`
	// 负载率(%)，0-100%
	LoadRate float64 `json:"load_rate"`
	// 分接头位置，变压器特有
	TapPosition *int `json:"tap_position,omitempty"`
	// 设备状态: normal/warning/abnormal
	Status DeviceStatus `json:"status"`
	// 告警列表（只包含告警标识，不含原因，由智能体推断）
	Alarms []string `json:"alarms"`
	// 是否存在故障（只标记存在性，不输出具体原因）
	HasFault *bool `json:"has_fault,omitempty"`
	// 故障时间
	FaultTime *time.Time `json:"fault_time,omitempty"`
	// 下次维护日期
	MaintenanceDue time.Time `json:"maintenance_due"`
	// 数据时间戳(ISO8601格式)
	Timestamp time.Time `json:"timestamp"`
}

// 设备类型基础参数配置
var deviceTypeConfigs = map[DeviceType]struct {
	baseVoltage    float64 // 基准电压(kV)
	baseCurrent    float64 // 基准电流(A)
	baseTemp       float64 // 基准温度(℃)
	locationPrefix string  // 位置前缀
}{
	DeviceTypeTransformer:       {220.0, 500.0, 55.0, "主变"},
	DeviceTypeCircuitBreaker:    {220.0, 2000.0, 45.0, "断路器"},
	DeviceTypeBus:               {220.0, 3000.0, 40.0, "母线"},
	DeviceTypeCapacitor:         {35.0, 100.0, 35.0, "电容器组"},
	DeviceTypeLightningArrester: {220.0, 0.001, 30.0, "避雷器"},
}

// DeviceConfig 设备配置（从CSV读取）
type DeviceConfig struct {
	// 设备ID
	DeviceID string `json:"device_id"`
	// 设备名称
	DeviceName string `json:"device_name"`
	// 设备类型
	DeviceType DeviceType `json:"device_type"`
	// 状态类型: normal/warning/abnormal
	StatusType DeviceStatus `json:"status_type"`
	// 开关机状态: on/off
	PowerStatus string `json:"power_status"`
}

// DeviceGenerator 设备数据生成器
type DeviceGenerator struct {
	rand          *rand.Rand
	mu            sync.Mutex
	deviceConfigs map[string]*DeviceConfig // 从CSV加载的设备配置
	csvPath       string                   // CSV配置文件路径，用于热重载
}

// NewDeviceGenerator 创建新的设备数据生成器
// csvPath: CSV配置文件路径，为空则使用默认路径"config/devices.csv"
func NewDeviceGenerator(csvPath string) (*DeviceGenerator, error) {
	if csvPath == "" {
		csvPath = "config/devices.csv"
	}

	generator := &DeviceGenerator{
		rand:          rand.New(rand.NewSource(time.Now().UnixNano())),
		deviceConfigs: make(map[string]*DeviceConfig),
		csvPath:       csvPath,
	}

	// 加载CSV配置
	configs, err := generator.loadDeviceConfigs(csvPath)
	if err != nil {
		// 如果加载失败，使用空配置继续运行
		fmt.Printf("[WARN] 加载CSV配置失败: %v，将使用默认配置\n", err)
	} else {
		generator.deviceConfigs = configs
		fmt.Printf("[INFO] 成功加载 %d 个设备配置\n", len(configs))
	}

	return generator, nil
}

// GetCSVPath 返回当前生成器使用的CSV配置文件路径
// 文件监控器使用该路径来确定需要监听的目标文件
func (g *DeviceGenerator) GetCSVPath() string {
	return g.csvPath
}

// ReloadDeviceConfigs 重新读取CSV并以原子方式替换内部设备配置映射
// 用于在外部检测到CSV文件变更后触发的热重载操作
func (g *DeviceGenerator) ReloadDeviceConfigs() error {
	configs, err := g.loadDeviceConfigs(g.csvPath)
	if err != nil {
		log.Printf("[ConfigReload] 重新加载设备配置失败: %v", err)
		return err
	}

	// 在持有互斥锁的情况下原子替换内部映射，保证读写线程安全
	g.mu.Lock()
	g.deviceConfigs = configs
	count := len(g.deviceConfigs)
	g.mu.Unlock()

	log.Printf("[ConfigReload] 设备配置重新加载成功，共加载 %d 个设备", count)
	return nil
}

// loadDeviceConfigs 从CSV文件解析设备配置并返回新的映射
// 该方法不会修改生成器内部状态，可被首次加载和热重载共同复用
func (g *DeviceGenerator) loadDeviceConfigs(csvPath string) (map[string]*DeviceConfig, error) {
	file, err := os.Open(csvPath)
	if err != nil {
		return nil, fmt.Errorf("打开CSV文件失败: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("读取CSV文件失败: %w", err)
	}

	// 跳过表头
	if len(records) < 2 {
		return nil, fmt.Errorf("CSV文件数据不足")
	}

	configs := make(map[string]*DeviceConfig)
	for i, record := range records[1:] {
		if len(record) < 5 {
			fmt.Printf("[WARN] 第%d行数据格式错误，跳过\n", i+2)
			continue
		}

		config := &DeviceConfig{
			DeviceID:    record[0],
			DeviceName:  record[1],
			DeviceType:  DeviceType(record[2]),
			StatusType:  DeviceStatus(record[3]),
			PowerStatus: record[4],
		}

		configs[config.DeviceID] = config
	}

	return configs, nil
}

// GetDeviceConfig 获取指定ID的设备配置
func (g *DeviceGenerator) GetDeviceConfig(deviceID string) (*DeviceConfig, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	config, exists := g.deviceConfigs[deviceID]
	return config, exists
}

// GetAllDeviceConfigs 获取所有设备配置
func (g *DeviceGenerator) GetAllDeviceConfigs() []*DeviceConfig {
	g.mu.Lock()
	defer g.mu.Unlock()

	configs := make([]*DeviceConfig, 0, len(g.deviceConfigs))
	for _, config := range g.deviceConfigs {
		configs = append(configs, config)
	}
	return configs
}

// GenerateDeviceByID 根据设备ID生成对应的数据
// 如果设备ID存在于CSV配置中，则根据配置的状态类型生成对应数据
func (g *DeviceGenerator) GenerateDeviceByID(deviceID string) (*Device, error) {
	config, exists := g.GetDeviceConfig(deviceID)
	if !exists {
		return nil, fmt.Errorf("设备ID不存在: %s", deviceID)
	}

	return g.generateDeviceFromConfig(config), nil
}

// GenerateDevicesByIDs 根据多个设备ID批量生成数据
// deviceIDs: 设备ID列表
// 返回设备数据列表和错误列表（如果有设备ID不存在）
func (g *DeviceGenerator) GenerateDevicesByIDs(deviceIDs []string) ([]*Device, []string) {
	devices := make([]*Device, 0, len(deviceIDs))
	var errors []string

	var wg sync.WaitGroup
	deviceChan := make(chan *Device, len(deviceIDs))
	errorChan := make(chan string, len(deviceIDs))

	for _, deviceID := range deviceIDs {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			device, err := g.GenerateDeviceByID(id)
			if err != nil {
				errorChan <- err.Error()
			} else {
				deviceChan <- device
			}
		}(deviceID)
	}

	// 等待所有goroutine完成
	go func() {
		wg.Wait()
		close(deviceChan)
		close(errorChan)
	}()

	// 收集结果
	for device := range deviceChan {
		devices = append(devices, device)
	}
	for err := range errorChan {
		errors = append(errors, err)
	}

	return devices, errors
}

// GenerateAllDevices 生成所有配置设备的数据
// 返回所有设备的数据
func (g *DeviceGenerator) GenerateAllDevices() []*Device {
	configs := g.GetAllDeviceConfigs()
	deviceIDs := make([]string, len(configs))
	for i, config := range configs {
		deviceIDs[i] = config.DeviceID
	}
	devices, _ := g.GenerateDevicesByIDs(deviceIDs)
	return devices
}

// generateDeviceFromConfig 根据设备配置生成数据
func (g *DeviceGenerator) generateDeviceFromConfig(config *DeviceConfig) *Device {
	g.mu.Lock()
	defer g.mu.Unlock()

	// 获取设备类型配置
	typeConfig := deviceTypeConfigs[config.DeviceType]

	// 生成波动参数
	voltage := applyPercentageFluctuation(g.rand, typeConfig.baseVoltage, 0.05)
	current := applyPercentageFluctuation(g.rand, typeConfig.baseCurrent, 0.10)
	temperature := applyAbsoluteFluctuation(g.rand, typeConfig.baseTemp, 20.0)
	frequency := applyPercentageFluctuation(g.rand, 50.0, 0.2)
	loadRate := g.rand.Float64() * 100

	// 根据CSV中的状态类型设置状态
	status := config.StatusType

	// 根据状态调整参数（异常设备生成异常数据）
	switch status {
	case StatusAbnormal:
		temperature = 85.0 + g.rand.Float64()*20.0 // 异常时温度升高
		loadRate = 90.0 + g.rand.Float64()*10.0    // 负载率接近满载
		// 异常时可能电流为0（跳闸）
		if g.rand.Float64() < 0.3 {
			current = 0
		}
	case StatusWarning:
		temperature = 75.0 + g.rand.Float64()*10.0 // 警告时温度偏高
		loadRate = 70.0 + g.rand.Float64()*20.0    // 负载率较高
	default: // StatusNormal
		// 正常状态保持基础参数
	}

	// 如果设备关机，电流为0，负载率为0
	if config.PowerStatus == "off" {
		current = 0
		loadRate = 0
		frequency = 0
	}

	// 生成告警列表
	alarms := g.generateAlarmsForConfig(config, temperature, current, status)

	// 生成变压器特有字段
	var oilLevel *float64
	var tapPosition *int
	if config.DeviceType == DeviceTypeTransformer {
		oil := 60.0 + g.rand.Float64()*35.0
		// 异常状态下油位可能偏低
		if status == StatusAbnormal && g.rand.Float64() < 0.5 {
			oil = 50.0 + g.rand.Float64()*20.0
		}
		oilLevel = &oil
		tap := g.rand.Intn(17) - 8 // -8 到 +8
		tapPosition = &tap
	}

	// 生成故障标记（异常设备有高概率有故障记录）
	// 只标记存在故障，不输出具体故障原因，由智能体推断
	var hasFault *bool
	var faultTime *time.Time
	if status == StatusAbnormal && g.rand.Float64() < 0.8 {
		faultFlag := true
		hasFault = &faultFlag
		t := time.Now().Add(-time.Duration(g.rand.Intn(3600)) * time.Second)
		faultTime = &t
	}

	// 生成维护日期
	maintenanceDue := time.Now().AddDate(0, g.rand.Intn(6)+1, g.rand.Intn(30))

	return &Device{
		DeviceID:       config.DeviceID,
		DeviceType:     config.DeviceType,
		Location:       config.DeviceName,
		Voltage:        round(voltage, 2),
		Current:        round(current, 2),
		Frequency:      round(frequency, 2),
		Temperature:    round(temperature, 1),
		OilLevel:       oilLevel,
		LoadRate:       round(loadRate, 1),
		TapPosition:    tapPosition,
		Status:         status,
		Alarms:         alarms,
		HasFault:       hasFault,
		FaultTime:      faultTime,
		MaintenanceDue: maintenanceDue,
		Timestamp:      time.Now(),
	}
}

// generateAlarmsForConfig 根据设备配置生成告警列表
// 注意：只返回简单的告警标识，不包含具体原因，由智能体自行推断
func (g *DeviceGenerator) generateAlarmsForConfig(
	config *DeviceConfig,
	temperature, current float64,
	status DeviceStatus,
) []string {
	var alarms []string

	// 关机状态 - 只返回状态标识
	if config.PowerStatus == "off" {
		alarms = append(alarms, "POWER_OFF")
		return alarms
	}

	// 过温告警 - 只返回告警标识，不说明原因
	if temperature > 80.0 {
		alarms = append(alarms, "OVER_TEMP")
	}

	// 油位低告警 - 只返回告警标识
	if config.DeviceType == DeviceTypeTransformer {
		oilLevel := 60.0 + g.rand.Float64()*35.0
		if oilLevel < 70.0 {
			alarms = append(alarms, "LOW_OIL_LEVEL")
		}
	}

	// 跳闸故障 - 只返回告警标识
	if current < 0.1 && status == StatusAbnormal {
		alarms = append(alarms, "TRIP_FAULT")
	}

	// 过载告警 - 只返回告警标识
	if current > 1500.0 {
		alarms = append(alarms, "OVERLOAD")
	}

	// 异常状态 - 只返回状态标识
	if status == StatusAbnormal {
		alarms = append(alarms, "ABNORMAL")
	}

	return alarms
}

// GenerateDevices 批量生成模拟设备数据
// count: 需要生成的设备数量
// 返回设备数据切片
func (g *DeviceGenerator) GenerateDevices(count int) []*Device {
	devices := make([]*Device, count)
	var wg sync.WaitGroup

	// 使用goroutine并发生成数据
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			devices[index] = g.generateSingleDevice(index)
		}(i)
	}

	wg.Wait()
	return devices
}

// generateSingleDevice 生成单个设备数据
func (g *DeviceGenerator) generateSingleDevice(index int) *Device {
	g.mu.Lock()
	defer g.mu.Unlock()

	// 随机选择设备类型
	deviceTypes := []DeviceType{
		DeviceTypeTransformer,
		DeviceTypeCircuitBreaker,
		DeviceTypeBus,
		DeviceTypeCapacitor,
		DeviceTypeLightningArrester,
	}
	deviceType := deviceTypes[g.rand.Intn(len(deviceTypes))]

	// 获取设备类型配置
	config := deviceTypeConfigs[deviceType]

	// 生成设备ID
	deviceID := fmt.Sprintf("%s_%03d_%s",
		deviceType,
		index+1,
		randomString(g.rand, 4),
	)

	// 生成位置信息
	location := fmt.Sprintf("%s%d号站-%s%d",
		config.locationPrefix,
		g.rand.Intn(10)+1,
		getBayName(g.rand),
		g.rand.Intn(20)+1,
	)

	// 生成波动参数
	voltage := applyPercentageFluctuation(g.rand, config.baseVoltage, 0.05)
	current := applyPercentageFluctuation(g.rand, config.baseCurrent, 0.10)
	temperature := applyAbsoluteFluctuation(g.rand, config.baseTemp, 20.0)
	frequency := applyPercentageFluctuation(g.rand, 50.0, 0.2)
	loadRate := g.rand.Float64() * 100

	// 确定设备状态 (正常85%, 警告10%, 异常5%)
	status := g.determineStatus()

	// 根据状态调整参数
	if status == StatusAbnormal {
		temperature = 85.0 + g.rand.Float64()*20.0 // 异常时温度升高
		loadRate = 90.0 + g.rand.Float64()*10.0    // 负载率接近满载
	} else if status == StatusWarning {
		temperature = 75.0 + g.rand.Float64()*10.0 // 警告时温度偏高
		loadRate = 70.0 + g.rand.Float64()*20.0    // 负载率较高
	}

	// 生成告警列表
	alarms := g.generateAlarms(deviceType, temperature, current, status)

	// 生成变压器特有字段
	var oilLevel *float64
	var tapPosition *int
	if deviceType == DeviceTypeTransformer {
		oil := 60.0 + g.rand.Float64()*35.0
		oilLevel = &oil
		tap := g.rand.Intn(17) - 8 // -8 到 +8
		tapPosition = &tap
	}

	// 生成故障标记（只标记存在性，不输出具体原因）
	var hasFault *bool
	var faultTime *time.Time
	if status == StatusAbnormal && g.rand.Float64() < 0.7 {
		faultFlag := true
		hasFault = &faultFlag
		t := time.Now().Add(-time.Duration(g.rand.Intn(3600)) * time.Second)
		faultTime = &t
	}

	// 生成维护日期
	maintenanceDue := time.Now().AddDate(0, g.rand.Intn(6)+1, g.rand.Intn(30))

	return &Device{
		DeviceID:       deviceID,
		DeviceType:     deviceType,
		Location:       location,
		Voltage:        round(voltage, 2),
		Current:        round(current, 2),
		Frequency:      round(frequency, 2),
		Temperature:    round(temperature, 1),
		OilLevel:       oilLevel,
		LoadRate:       round(loadRate, 1),
		TapPosition:    tapPosition,
		Status:         status,
		Alarms:         alarms,
		HasFault:       hasFault,
		FaultTime:      faultTime,
		MaintenanceDue: maintenanceDue,
		Timestamp:      time.Now(),
	}
}

// determineStatus 根据概率分布确定设备状态
// 正常85%, 警告10%, 异常5%
func (g *DeviceGenerator) determineStatus() DeviceStatus {
	r := g.rand.Float64()
	switch {
	case r < 0.85:
		return StatusNormal
	case r < 0.95:
		return StatusWarning
	default:
		return StatusAbnormal
	}
}

// generateAlarms 根据设备参数生成告警列表
// 注意：只返回简单的告警标识，不包含具体原因，由智能体自行推断
func (g *DeviceGenerator) generateAlarms(
	deviceType DeviceType,
	temperature, current float64,
	status DeviceStatus,
) []string {
	var alarms []string

	// 过温告警 - 只返回告警标识
	if temperature > 80.0 {
		alarms = append(alarms, "OVER_TEMP")
	}

	// 油位低告警 - 只返回告警标识
	if deviceType == DeviceTypeTransformer {
		oilLevel := 60.0 + g.rand.Float64()*35.0
		if oilLevel < 70.0 {
			alarms = append(alarms, "LOW_OIL_LEVEL")
		}
	}

	// 跳闸故障 - 只返回告警标识
	if current < 0.1 && status == StatusAbnormal {
		alarms = append(alarms, "TRIP_FAULT")
	}

	// 过载告警 - 只返回告警标识
	if current > 1500.0 {
		alarms = append(alarms, "OVERLOAD")
	}

	// 异常状态 - 只返回状态标识
	if status == StatusAbnormal {
		alarms = append(alarms, "ABNORMAL")
	}

	return alarms
}

// applyPercentageFluctuation 应用百分比波动率到基准值
// 用于电压、电流等参数 (±5%, ±10%)
func applyPercentageFluctuation(r *rand.Rand, baseValue, fluctuationRate float64) float64 {
	return baseValue + (r.Float64()*2-1)*fluctuationRate*baseValue
}

// applyAbsoluteFluctuation 应用绝对值波动到基准值
// 用于温度等参数 (±20℃)
func applyAbsoluteFluctuation(r *rand.Rand, baseValue, fluctuation float64) float64 {
	return baseValue + (r.Float64()*2-1)*fluctuation
}

// round 四舍五入到指定小数位
func round(value float64, decimals int) float64 {
	factor := 1.0
	for i := 0; i < decimals; i++ {
		factor *= 10
	}
	return float64(int(value*factor+0.5)) / factor
}

// randomString 生成随机字符串
func randomString(r *rand.Rand, length int) string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = chars[r.Intn(len(chars))]
	}
	return string(result)
}

// getBayName 获取随机间隔名称
func getBayName(r *rand.Rand) string {
	bays := []string{"出线", "进线", "主变", "母联", "旁路", "母线", "电容"}
	return bays[r.Intn(len(bays))]
}

// getRandomFaultType 获取随机故障类型
func getRandomFaultType(r *rand.Rand, deviceType DeviceType) string {
	faults := map[DeviceType][]string{
		DeviceTypeTransformer: {
			"绕组过热故障",
			"绝缘油老化",
			"分接开关故障",
			"铁芯多点接地",
		},
		DeviceTypeCircuitBreaker: {
			"触头烧蚀",
			"操作机构卡涩",
			"SF6压力低",
			"控制回路断线",
		},
		DeviceTypeBus: {
			"母线接地",
			"绝缘子闪络",
			"连接点过热",
		},
		DeviceTypeCapacitor: {
			"电容器鼓包",
			"熔丝熔断",
			"内部放电",
		},
		DeviceTypeLightningArrester: {
			"避雷器击穿",
			"泄漏电流异常",
			"计数器故障",
		},
	}

	deviceFaults := faults[deviceType]
	return deviceFaults[r.Intn(len(deviceFaults))]
}

// GetDeviceTypeName 获取设备类型中文名称
func GetDeviceTypeName(dt DeviceType) string {
	names := map[DeviceType]string{
		DeviceTypeTransformer:       "变压器",
		DeviceTypeCircuitBreaker:    "断路器",
		DeviceTypeBus:               "母线",
		DeviceTypeCapacitor:         "电容器",
		DeviceTypeLightningArrester: "避雷器",
	}
	if name, ok := names[dt]; ok {
		return name
	}
	return string(dt)
}
