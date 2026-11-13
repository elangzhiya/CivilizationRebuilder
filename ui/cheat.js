// ui/cheat.js — 作弊面板组件（随意调速度/资源/上限 + 无需求购买）
// 状态挂 GameState.cheat（响应式），设置持久化到 localStorage 'civCheatState'
(function () {
    const CHEAT_KEY = 'civCheatState';
    const SPEEDS = [1, 2, 5, 10, 50, 100];

    const CheatPanel = {
        template: `
<div class="cheat-root">
    <button class="cheat-toggle" @click="open = !open">🛠️ 作弊</button>
    <div class="cheat-panel" v-if="open">
        <div class="cheat-title">作弊面板</div>
        <div class="cheat-row">
            <span>游戏速度：</span>
            <button v-for="s in speeds" :key="s" class="cheat-btn" :class="{on: GS.speed === s}" @click="setSpeed(s)">{{ s }}x</button>
        </div>
        <div class="cheat-row">
            <label><input type="checkbox" v-model="GS.cheat.freeBuy"> 无需求购买（建筑/科技/升级免费）</label>
        </div>
        <div class="cheat-row">
            <label><input type="checkbox" v-model="GS.cheat.infiniteRes"> 无限资源（资源拉满上限，不因消耗减少）</label>
        </div>
        <div class="cheat-row">
            <select v-model="resName" class="cheat-select">
                <option v-for="r in resList" :key="r" :value="r">{{ r }}</option>
            </select>
            <input v-model.number="resAmount" type="number" class="cheat-input" placeholder="数量">
            <button class="cheat-btn" @click="setRes" title="把该资源直接设为输入的数量">设资源</button>
            <button class="cheat-btn" @click="setCap" title="把该资源上限锁定为输入的数量">锁上限</button>
            <button class="cheat-btn" @click="clearCap" title="取消上限锁定">解上限</button>
        </div>
        <div class="cheat-note" v-if="GS.cheat.capSet && GS.cheat.capSet[resName] !== undefined">
            🔒 {{ resName }} 上限已锁定为 {{ GS.cheat.capSet[resName] }}
        </div>
        <div class="cheat-note">提示：设置大量资源时先「锁上限」再「设资源」，否则会被当前上限截断；2x 以上速度不消耗时间晶体。</div>
    </div>
</div>
`,
        data() {
            return { open: false, speeds: SPEEDS, resName: '', resAmount: 1000 };
        },
        watch: {
            'GS.cheat.freeBuy'() { this.persist(); },
            'GS.cheat.infiniteRes'() { this.persist(); },
        },
        created() {
            if (!this.GS.cheat) {
                this.GS.cheat = { freeBuy: false, infiniteRes: false, capSet: {} };
            }
            // 恢复上次的作弊设置（存档不含 cheat 字段，单独持久化）
            try {
                const saved = JSON.parse(localStorage.getItem(CHEAT_KEY) || 'null');
                if (saved) {
                    this.GS.cheat.freeBuy = !!saved.freeBuy;
                    this.GS.cheat.infiniteRes = !!saved.infiniteRes;
                    this.GS.cheat.capSet = saved.capSet || {};
                    if (saved.speed > 1) this.GS.speed = saved.speed;
                }
            } catch (e) { /* 忽略损坏的历史数据 */ }
            if (!this.resName && this.resList.length) this.resName = this.resList[0];
        },
        computed: {
            resList() { return Object.keys(this.GS.resources); },
        },
        methods: {
            persist() {
                localStorage.setItem(CHEAT_KEY, JSON.stringify({
                    freeBuy: this.GS.cheat.freeBuy,
                    infiniteRes: this.GS.cheat.infiniteRes,
                    capSet: this.GS.cheat.capSet,
                    speed: this.GS.speed,
                }));
            },
            setSpeed(s) {
                this.GS.speed = s;
                this.persist();
            },
            setRes() {
                const r = this.GS.resources[this.resName];
                if (!r || isNaN(this.resAmount)) return;
                r.amount = this.resAmount;
                if (r.amount > 0) r.visible = true;
            },
            setCap() {
                if (isNaN(this.resAmount)) return;
                this.GS.cheat.capSet[this.resName] = this.resAmount;
                ProductionEngine.computeProductionAndCaps();
                this.persist();
            },
            clearCap() {
                delete this.GS.cheat.capSet[this.resName];
                ProductionEngine.computeProductionAndCaps();
                this.persist();
            },
        },
    };
    UI.registerComponent('CheatPanel', CheatPanel);
})();
