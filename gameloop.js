// gameloop.js - 基于真实时间戳的循环，页面隐藏/恢复自动追赶
const GameLoop = (function() {
    const DAY_GAME_TIME = 1.0; // 一天需要的游戏时间（秒）
    const EVENT_TRIGGER_BASE_CHANCE = 0.002;
    const MAX_DELTA_SEC = 3600; // 单次最大游戏时间增量

    let intervalId = null;
    let crystalIntervalId = null;
    let lastTimestamp = null; // 上一次 tick 的真实时间戳（毫秒）
    let gameDayAccum = 0; // 不足一天的累计秒数

    function getSpeed() {
        // 作弊面板支持任意倍速：speed 为数值且 >1 时直接生效
        return GameState.speed > 1 ? GameState.speed : 1;
    }

    let frameCount = 0;
    function tickResources(deltaGameSec) {
        // 性能节流：全量重算（含效果聚合/效率迭代）从每 tick(200ms) 降为每秒一次。
        // 所有改变产量的操作（买建筑/研究/政策/事件变化等）都会显式调用
        // computeProductionAndCaps，即时性不受影响；此处仅省掉常规帧的重复计算。
        frameCount++;
        if (frameCount >= 5) {
            frameCount = 0;
            ProductionEngine.computeProductionAndCaps();
        }
        // 作弊「无限资源」每帧回满（节流后仍保持无消耗体验）
        if (GameState.cheat && GameState.cheat.infiniteRes) {
            for (let r in GameState.resources) {
                const res = GameState.resources[r];
                if (res.cap === Infinity || res.cap <= 0) continue;
                if (r === '遗物' || r === '暗能量' || r === '孢子' || r === '时间晶体' || r === '奇点') continue;
                res.amount = res.cap;
                res.visible = true;
            }
        }

        // 更新资源量（生产/消耗）
        const deltaMap = {};
        for (let r in GameState.resources) {
            const productionDelta = GameState.resources[r].production * deltaGameSec;
            if (productionDelta !== 0) {
                deltaMap[r] = productionDelta;
            }
        }
        ResourcesManager.add(deltaMap);
        // 更新贸易热度（持续贸易影响 + 衰减）
        TradeEngine.updateHeat(deltaGameSec, GameState);
    }

    function advanceDay() {
        GameState.gameDays++;
        GameState.totalGameDays = (GameState.totalGameDays || 0) + 1;
        // 日期与季节由 UI 层根据 gameDays 响应式派生，此处不再直接操作 DOM

        // 事件过期检查
        if (GameState.activeRandomEvents && GameState.activeRandomEvents.length > 0) {
            const before = GameState.activeRandomEvents.length;
            GameState.activeRandomEvents = GameState.activeRandomEvents.filter(e => {
                if (GameState.gameDays >= e.endDay) {
                    addEventLog(`[事件结束] ${e.name} 效果已消失`);
                    return false;
                }
                return true;
            });
            if (before !== GameState.activeRandomEvents.length) {
                ProductionEngine.computeProductionAndCaps();
            }
        }
        if (GameState.autoWarEnabled) {
            const arms = GameState.resources["军备"];
            if (arms && arms.amount >= arms.cap - 0.0001 && arms.cap > 100.001 && GameState.crystals.inventory.length < 6) {
                let success = Core.performAction('war');
                if (!success) {
                    GameState.autoWarEnabled = false;
                }
            }
        }

        tryTriggerRandomEvent();
        renderLogPanel(); // 只更新日志区域
        processQueue();
    }

    function tryTriggerRandomEvent() {
        if (Math.random() > EVENT_TRIGGER_BASE_CHANCE) return false;
        const eventDef = selectRandomEvent(GameState);
        if (!eventDef) return false;

        const event = EventEffectHandler.createEventSnapshot(eventDef, GameState);
        if (!GameState.activeRandomEvents) GameState.activeRandomEvents = [];
        GameState.activeRandomEvents.push(event);

        const immediateLogs = EventEffectHandler.applyImmediateEffects(event, GameState);
        let effectDesc = '';
        for (let eff of event.effects) {
            if (eff.type === 'resourceMultiplier') {
                const p = ((eff.multiplier - 1) * 100).toFixed(0);
                effectDesc += `${eff.resource} ${eff.multiplier > 1 ? '+' : ''}${p}% `;
            } else if (eff.type === 'buildingMultiplier') {
                const p = ((eff.multiplier - 1) * 100).toFixed(0);
                effectDesc += `${eff.building} ${eff.field === 'prod' ? '产量' : eff.field} ${eff.multiplier > 1 ? '+' : ''}${p}% `;
            } else if (eff.type === 'happinessMod') {
                effectDesc += `幸福度 ${eff.value > 0 ? '+' : ''}${eff.value}% `;
            }
        }
        const duration = event.endDay - GameState.gameDays;
        addEventLog(`随机事件触发：${event.name}！${event.desc}${effectDesc ? ' ('.concat(effectDesc.trim(), ')') : ''}，持续${duration}天`);

        for (let log of immediateLogs) addEventLog(log);
        ProductionEngine.computeProductionAndCaps();
        return true;
    }

    // 晶体消耗（真实时间每秒，仅二倍速时扣除）
    function startCrystalConsume() {
        if (crystalIntervalId) clearInterval(crystalIntervalId);
        crystalIntervalId = setInterval(() => {
            if (GameState.speed !== 2) return;
            // 作弊模式（开启无需求购买）不消耗时间晶体
            if (GameState.cheat && GameState.cheat.freeBuy) return;
            const crystal = GameState.resources["时间晶体"];
            if (!crystal) return;
            if (crystal.amount >= 1) {
                crystal.amount -= 1;
            } else {
                GameState.speed = 1;
                addEventLog("时间晶体耗尽，自动恢复为1倍速。");
                ProductionEngine.computeProductionAndCaps();
            }
            if (crystal.amount < 0) crystal.amount = 0;
            crystal.visible = crystal.amount > 0;
        }, 1000);
    }

    // 核心 tick：基于真实时间差推进游戏
    function tick() {
        const now = Date.now();
        if (lastTimestamp === null) {
            lastTimestamp = now;
            return;
        }

        let realDeltaSec = (now - lastTimestamp) / 1000;
        if (realDeltaSec <= 0) return;
        if (realDeltaSec > MAX_DELTA_SEC) realDeltaSec = MAX_DELTA_SEC; // 防止跳跃过大

        const speed = getSpeed();
        const gameDelta = realDeltaSec * speed; // 游戏时间增量（秒）

        tickResources(gameDelta);
        gameDayAccum += gameDelta;
        while (gameDayAccum >= DAY_GAME_TIME) {
            gameDayAccum -= DAY_GAME_TIME;
            advanceDay();
        }

        // 刷新动态颜色
        if (typeof refreshUI === 'function') {
            refreshUI();
        }


        lastTimestamp = now;
    }

    function start() {
        stop();
        lastTimestamp = Date.now();
        gameDayAccum = 0;
        intervalId = setInterval(() => {
            tick();
        }, 200); // 固定 200ms 触发一次，实际步长由时间差决定
        startCrystalConsume();
    }

    function stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (crystalIntervalId) {
            clearInterval(crystalIntervalId);
            crystalIntervalId = null;
        }
        lastTimestamp = null;
    }

    function resetTimer() {
        lastTimestamp = Date.now();
        gameDayAccum = 0;
    }

    return { start, stop, resetTimer };
})();

window.GameLoop = GameLoop;