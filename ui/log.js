// ui/log.js — 事件日志组件
(function () {
    const LogPanel = {
        template: `
<div id="event-log-list" class="event-log-list">
    <div v-if="logs.length === 0" class="log-entry" style="color:#8a9aac;">暂无事件日志</div>
    <div v-for="(log, i) in logs" :key="i" class="log-entry" :style="logColor(log.text)">
        <span class="log-date">[{{ log.dateStr }}]</span>
        <span>{{ log.text }}</span>
    </div>
</div>
`,
        computed: {
            logs() {
                return this.GS.eventLogs || [];
            },
        },
        methods: {
            // 日志分色：随机事件紫、解锁/成就金、事件结束灰、其他默认
            logColor(text) {
                if (typeof text !== 'string') return {};
                if (text.includes('随机事件') || text.includes('触发')) return { color: '#a469d6' };
                if (text.includes('解锁') || text.includes('成就') || text.includes('✨') || text.includes('🔥')) return { color: '#d69e27' };
                if (text.includes('[事件结束]')) return { color: '#8a9aac' };
                return {};
            },
        },
    };
    UI.registerComponent('LogPanel', LogPanel);
})();
