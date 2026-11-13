// ui/reset.js — 选项（重置/存档/主题）面板组件
(function () {
    const ResetPanel = {
        template: `
<div>
    <div class="reset-area">
        <button class="btn-rect" title="重新开始游戏,只保留成就、永恒等" @click="softResetClick">软重置</button>
        <button class="btn-rect" title="彻底清除存档" @click="hardResetClick">硬重置</button>
        <button class="btn-rect" @click="manualSave()">手动保存</button>
        <button class="btn-rect" @click="toggleTheme">{{ themeBtnText }}</button>
    </div>
    <div class="reset-area" style="margin-top: 1rem;">
        <button class="btn-rect" @click="exportSave()">导出存档文件</button>
        <button class="btn-rect" @click="copyExportText()">导出存档文本</button>
        <button class="btn-rect" @click="ui.importModalOpen = true">导入存档文本</button>
        <button class="btn-rect" @click="importFile">导入存档文件</button>
    </div>
    <p>每10秒自动保存</p>
    <p>按住shift键可以每次购买/加减10个建筑,按住ctrl以100为单位操作，shift+ctrl以1000为单位操作</p>
    <p>Bug、建议反馈：tlxgsgame@163.com</p>
    <p>也欢迎在 GitHub 上提 Issue，或直接贡献代码！</p>
    <br>
    <hr>
    <br>
    <div class="lore-box">
        <p class="lore-title">背景故事：末世火种</p>
        <p>大灾变纪年元年，旧文明毁于「长冬战争」——核火与纳米瘟疫席卷全球，城市化为废墟，天空蒙尘十余载。</p>
        <p>你是「火种计划」最后一位唤醒者。走出地下避难所时，你的行囊里只有几件旧时代的工具，和一箱沉睡的<b>时间晶体</b>——那是上个文明倾尽最后的科技造出的造物，能局部回溯时间流，让世界运转得更快。</p>
        <p>从收集木材、搭建帐篷开始，重建农业、工业、能源与科学。但每一轮纪元终有尽头：或毁于战火，或毁于贪婪。纪元落幕时，废墟中会留下上一轮文明的<b>遗物</b>、残存的<b>暗能量</b>与经验——它们是你唯一的遗产，也是下一个纪元的起点。</p>
        <p>凭借这些遗产，每一次重启都比上一次走得更远。而火种计划的终极目标只有一个：<b>带领文明突破长冬，抵达真正的永恒</b>。</p>
        <p class="lore-note">※ 术语对照：软重置 = 纪元落幕与重启 ｜ 遗物 / 暗能量 / 奇点 = 前纪元遗产 ｜ 时间晶体 = 火种计划的时间回溯装置</p>
    </div>
    <p>Q&A</p>
    <p>问：有些建筑产出/消耗的人口/资源似乎与显示不符？</p>
    <p>答：请检查是否有其他建筑因为资源缺乏处于非满效率工作状态，这些建筑消耗的人口和资源会被乘以其效率</p>
    <p>问：为什么手动购买/出售资源时，总花费/收入 ≠ 单价 × 交易数量？</p>
    <p>答：简单来说：因为一次购买实际上是逐步购买的，后面的购买价格比一开始更高，所以总价会更高，反之出售时获利更少，这样设计是为了防止无限刷金。具体来说：设当前对数价格偏移为 <i>H</i>，基准价为 <i>V</i>，价格敏感系数为 <i>c</i>，单次贸易量上限为 <i>M</i>。则第 <i>q</i> 单位资源的价格为：<br>
    &emsp;<i>P</i>(<i>q</i>) = <i>V</i> · e<sup><i>H</i> + (<i>c</i>/<i>M</i>)·<i>q</i></sup><br>
    购买总量 <i>Q</i> 的总成本为：<br>
    &emsp;<i>Cost</i> = ∫<sub>0</sub><sup><i>Q</i></sup> <i>P</i>(<i>q</i>) d<i>q</i> = <i>V</i>·e<sup><i>H</i></sup> · (e<sup>(<i>c</i>/<i>M</i>)<i>Q</i></sup> − 1) / (<i>c</i>/<i>M</i>)<br>
    出售收益需再乘以 (1 − 税率)，因此总价与 <i>Q</i> 呈非线性关系。</p>
</div>
`,
        computed: {
            themeBtnText() {
                return this.ui.theme === 'dark' ? '浅色模式' : '深色模式';
            },
        },
        methods: {
            softResetClick() {
                if (confirm("执行软重置？\n所有建筑、科技、资源将被清空，但永恒升级和已获得的成就会保留。")) {
                    softReset(0, 0);
                    addEventLog("执行了软重置。");
                }
            },
            hardResetClick() {
                if (confirm("确定硬重置？所有数据将丢失！")) hardReset();
            },
            toggleTheme() {
                const isDark = document.body.classList.toggle('dark-theme');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                this.ui.theme = isDark ? 'dark' : 'light';
            },
            // 以下三个全局函数（saveGame/exportGame/copyGameExportText）不能直接在 Vue 3 模板中调用
            // （模板标识符只解析组件实例，不会回退到 window 全局，直接调用会抛 TypeError 导致点击无反应），
            // 因此包一层组件方法，与其它面板"模板只调方法、方法内调全局"的约定保持一致。
            manualSave() {
                saveGame();
            },
            exportSave() {
                exportGame();
            },
            copyExportText() {
                copyGameExportText();
            },
            importFile() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.civ,text/plain';
                input.onchange = (e) => {
                    if (e.target.files.length > 0) {
                        importGameFromFile(e.target.files[0]);
                    }
                };
                input.click();
            },
        },
    };
    UI.registerComponent('ResetPanel', ResetPanel);
})();
