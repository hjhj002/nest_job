// Package watcher 提供基于fsnotify的配置文件热重载监控能力
// 用于在不重启服务的前提下感知CSV等配置文件的变更并触发回调
package watcher

import (
	"log"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
)

// ConfigWatcher 监听单个文件的变更并触发回调
// 实现上监听文件所在目录以兼容不同编辑器的写入方式（重命名/原子保存等）
type ConfigWatcher struct {
	filePath string
	onChange func()
	watcher  *fsnotify.Watcher
}

// NewConfigWatcher 创建一个新的文件监控器
// filePath: 待监听的目标文件绝对或相对路径
// onChange: 文件发生写入或创建事件后的回调函数
func NewConfigWatcher(filePath string, onChange func()) (*ConfigWatcher, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	cw := &ConfigWatcher{
		filePath: filePath,
		onChange: onChange,
		watcher:  w,
	}

	return cw, nil
}

// Start 开始监听文件变更
// fsnotify对目录监听更稳定，因此监听目标文件所在目录并在事件循环中过滤目标文件
func (cw *ConfigWatcher) Start() error {
	// 监听目标文件所在目录
	dir := filepath.Dir(cw.filePath)
	if err := cw.watcher.Add(dir); err != nil {
		return err
	}

	go cw.eventLoop()
	log.Printf("[ConfigWatcher] 开始监控文件变更: %s", cw.filePath)
	return nil
}

// Stop 停止文件监控并释放底层资源
func (cw *ConfigWatcher) Stop() error {
	return cw.watcher.Close()
}

// eventLoop 内部事件循环，对短时间内的多次写入事件进行去抖动处理
// 在最后一次事件后等待500ms再执行回调，避免编辑器多次保存触发重复重载
func (cw *ConfigWatcher) eventLoop() {
	// 去抖动: 最后一次事件后等待500ms再触发重载
	var debounceTimer *time.Timer
	targetFile := filepath.Base(cw.filePath)

	for {
		select {
		case event, ok := <-cw.watcher.Events:
			if !ok {
				return
			}
			// 仅响应目标文件的写入或创建事件
			if filepath.Base(event.Name) == targetFile {
				if event.Op&(fsnotify.Write|fsnotify.Create) != 0 {
					if debounceTimer != nil {
						debounceTimer.Stop()
					}
					eventName := event.Name
					debounceTimer = time.AfterFunc(500*time.Millisecond, func() {
						log.Printf("[ConfigWatcher] 检测到文件变更: %s, 正在重新加载...", eventName)
						cw.onChange()
					})
				}
			}
		case err, ok := <-cw.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[ConfigWatcher] 监控错误: %v", err)
		}
	}
}
