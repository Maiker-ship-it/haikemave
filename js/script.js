// 方块贴图路径：0红珊瑚 1蓝小鱼 2绿海草 3黄海星 4灰鲸鱼
        const BLOCK_IMGS = [
            'img/blocks/block0.png',
            'img/blocks/block1.png',
            'img/blocks/block2.png',
            'img/blocks/block3.png',
            'img/blocks/block4.png',
            'img/blocks/block5.png'
        ];
        const GLOW_IMGS = [
            'img/发光珊瑚.png',
            'img/发光小鱼.png',
            'img/发光水草.png',
            'img/发光星星.png',
            'img/发光鲸鱼.png',
            'img/发光水母.png'
        ];
        const ULTIMATE_IMG = 'img/终极方块.png';
        const LOCK_IMG = 'img/lock.png';
        const TOTAL_LEVEL = 5;

        // 关卡配置：5关全方形，目标分递增、第5关难度最高
        const levelConfig = [
            { level: 1, target: 150, rows: 6, cols: 6, shape: "square" },
            { level: 2, target: 220, rows: 7, cols: 7, shape: "square" },
            { level: 3, target: 320, rows: 8, cols: 8, shape: "square" },
            { level: 4, target: 430, rows: 8, cols: 8, shape: "square" },
            { level: 5, target: 560, rows: 9, cols: 9, shape: "square" }
        ];

        // 游戏状态变量
        let grid = [];
        let score = 0;
        let targetScore = 0;
        let unlockMaxLevel = Number(localStorage.getItem("unlockMaxLevel")) || 1;
        let isPause = false;
        let gameOver = false;
        let animating = false;
        let remainStep = 30;
        let usedStep = 0;
        let selectR = -1, selectC = -1;
        let animationDelay = 420;
        let glowPotentialPair = null; // 开局藏的发光潜力交换对
        let noMatchDismissed = false; // 玩家点过“取消”后不再自动弹无解提示

        // === 音效 & 背景音乐系统 ===
        let soundEnabled = true;
        let bgmAudio = null;
        const sfxCache = {};
        function playSfx(name) {
            if (!soundEnabled) return;
            try {
                if (!sfxCache[name]) {
                    sfxCache[name] = new Audio('audio/' + name + '.mp3');
                    sfxCache[name].volume = sfxVolume;
                }
                sfxCache[name].currentTime = 0;
                sfxCache[name].play().catch(() => {});
            } catch(e) {}
        }
        let currentBgm = '';
        function playBgm(name) {
            if (!musicOn) return;
            if (currentBgm === name && bgmAudio && bgmAudio.src.includes(name)) {
                bgmAudio.play().catch(() => {});
                return;
            }
            if (bgmAudio) { bgmAudio.pause(); }
            try {
                bgmAudio = new Audio('audio/' + name + '.mp3');
                bgmAudio.loop = true;
                bgmAudio.volume = 0.3;
                currentBgm = name;
                bgmAudio.play().catch(() => {});
            } catch(e) {}
        }
        function stopBgm() {
            if (bgmAudio) { bgmAudio.pause(); }
        }
        function resumeBgm() {
            if (bgmAudio) { bgmAudio.play().catch(() => {}); }
        }
        function restartBgm() {
            if (bgmAudio) { bgmAudio.currentTime = 0; bgmAudio.play().catch(() => {}); }
        }
        const sfx = {
            swap:    () => playSfx('方块交换成功音效'),
            invalid: () => playSfx('sfx-click'),
            match:   (count) => {
                const n = Math.min(count, 5);
                for (let i = 0; i < n; i++) {
                    setTimeout(() => playSfx('sfx-match'), i * 60);
                }
            },
            click:   () => playSfx('sfx-click'),
            win:     () => playSfx('sfx-win'),
            lose:    () => playSfx('sfx-click')
        };
        let hintTimer = null;

        let gameMode = "story";
        let currentLevel = 1;
        let boardRows = 6;
        let boardCols = 6;
        let boardShape = "square";
        let cellPixel = 60;

        // dom元素
        const mainMenu = document.getElementById('mainMenu');
        const levelSelectPage = document.getElementById("levelSelectPage");
        const levelGrid = document.getElementById("levelGrid");
        const gamePage = document.getElementById('gamePage');
        const scoreDom = document.getElementById('score');
        const targetScoreDom = document.getElementById("targetScore");
        const curLevelTextDom = document.getElementById("curLevelText");
        const gameModeTextDom = document.getElementById("gameModeText");
        const stepLeftDom = document.getElementById('stepLeft');
        const usedStepDom = document.getElementById('usedStep');
        const boardDom = document.getElementById('board');
        const pauseModal = document.getElementById('pauseModal');
        const gameOverModal = document.getElementById('gameOverModal');
        const gameOverTitleDom = document.getElementById("gameOverTitle");
        const gameOverDescDom = document.getElementById("gameOverDesc");
        const gameEnterTipModal = document.getElementById("gameEnterTipModal");
        const gameEnterTipContentDom = document.getElementById("gameEnterTipContent");
        const winAllModal = document.getElementById("winAllModal");
        const ruleModal = document.getElementById('ruleModal');
        const feedbackModal = document.getElementById('feedbackModal');
        const feedbackTextarea = document.getElementById('feedbackTextarea');
        const successModal = document.getElementById('successModal');
        const noMatchModal = document.getElementById('noMatchModal');

        function saveUnlock() {
            localStorage.setItem("unlockMaxLevel", unlockMaxLevel.toString());
        }

        function renderLevelSelect() {
            levelGrid.innerHTML = "";
            for (let i = 1; i <= TOTAL_LEVEL; i++) {
                const item = document.createElement("div");
                item.className = "level-item";
                if (i <= unlockMaxLevel) {
                    item.classList.add("unlock");
                    item.innerText = i;
                    item.onclick = () => { sfx.click(); enterLevel(i); };
                } else {
                    item.classList.add("lock");
                    item.style.backgroundImage = `url('${LOCK_IMG}')`;
                    item.style.backgroundSize = 'cover';
                    item.style.backgroundPosition = 'center';
                    item.innerHTML = '';
                }
                levelGrid.appendChild(item);
            }
            const endlessBtn = document.createElement("div");
            endlessBtn.className = "level-item unlock endless-special";
            endlessBtn.innerText = "无尽";
            endlessBtn.onclick = function() { sfx.click(); startEndlessGame(); };
            levelGrid.appendChild(endlessBtn);
            const timeBtn = document.createElement("div");
            timeBtn.className = "level-item unlock endless-special";
            timeBtn.innerText = "限时";
            timeBtn.onclick = function() { sfx.click(); showTimeBest(); document.getElementById("timeSelectModal").style.display = "flex"; };
            levelGrid.appendChild(timeBtn);
        }

        function enterLevel(lv) {
            currentLevel = lv;
            const cfg = levelConfig[lv - 1];
            targetScore = cfg.target;
            gameMode = "story";
            boardRows = cfg.rows;
            boardCols = cfg.cols;
            boardShape = cfg.shape;
            showVideo('bgm-level');
            mainMenu.style.display = "none";
            levelSelectPage.style.display = "none";
            playSfx('sfx-transition');
            gamePage.style.display = "flex";
            playBgm('bgm-level');
            initGameBoard();
            gameEnterTipContentDom.innerText = `第${lv}关\n目标分数：${cfg.target}\n棋盘规格：${cfg.rows}行 × ${cfg.cols}列\n在剩余步数内达到目标分数即可通关！`;
            gameEnterTipModal.style.display = "flex";
        }

        document.getElementById("closeGameEnterTip").onclick = function () {
            sfx.click();
            gameEnterTipModal.style.display = "none";
        }

        function startEndlessGame() {
            gameMode = "endless";
            boardRows = 9;
            boardCols = 9;
            boardShape = "square";
            targetScore = 0;
            showVideo('bgm-game');
            mainMenu.style.display = "none";
            levelSelectPage.style.display = "none";
            gamePage.style.display = "flex";
            playBgm('bgm-endless');
            initGameBoard();
        }

        let timeLeft = 0;
        let timeTimer = null;
        let timeLimit = 30;
        function getBestScore(sec) { return Number(localStorage.getItem("timeBest_" + sec)) || 0; }
        function showTimeBest() {
            document.getElementById("best30").innerText = "最高: " + getBestScore(30);
            document.getElementById("best45").innerText = "最高: " + getBestScore(45);
            document.getElementById("best60").innerText = "最高: " + getBestScore(60);
        }

        function startTimedGame(seconds) {
            gameMode = "timed";
            boardRows = 9;
            boardCols = 9;
            boardShape = "square";
            targetScore = 0;
            timeLeft = seconds;
            timeLimit = seconds;
            showVideo("bgm-game");
            mainMenu.style.display = "none";
            levelSelectPage.style.display = "none";
            gamePage.style.display = "flex";
            playBgm("bgm-endless");
            document.getElementById("timeSelectModal").style.display = "none";
            initGameBoard();
            document.querySelectorAll(".speed-btn").forEach(b => b.style.display = "none");
            document.getElementById("speedArea").style.display = "none";
            clearInterval(timeTimer);
            timeTimer = setInterval(() => {
                timeLeft--;
                updateTimeDisplay();
                if (timeLeft <= 0) { clearInterval(timeTimer); endTimedGame(); }
            }, 1000);
        }

        function updateTimeDisplay() { stepLeftDom.innerText = timeLeft + "秒"; }

        function endTimedGame() {
            gameOver = true;
            clearTimeout(hintTimer);
            clearInterval(timeTimer);
            const best = getBestScore(timeLimit);
            const isNew = score > best;
            if (isNew) localStorage.setItem("timeBest_" + timeLimit, score.toString());
            gameOverTitleDom.innerText = "⏰时间到！";
            const iconDom = document.getElementById("gameOverIcon");
            iconDom.innerText = "🕒";
            iconDom.className = "gameover-icon win";
            document.getElementById("starRating").innerText = "";
            gameOverDescDom.innerText = "得分：" + score + (isNew ? " 新纪录！" : " 历史最高：" + best);
            document.getElementById("gameOverStats").innerHTML =
                `<div class="stat-item"><span class="stat-label">本次得分</span><span class="stat-value">${score}</span></div>` +
                `<div class="stat-item${isNew ? ' stat-warn' : ''}"><span class="stat-label">${isNew ? '新纪录' : '历史最高'}</span><span class="stat-value">${isNew ? score : best}</span></div>`;
            document.getElementById("btnModalNextLevel").style.display = "none";
            gameOverModal.style.display = "flex";
            sfx.lose();
        }

        function buildShapeMask(rows, cols, shape) {
            const mask = Array.from({ length: rows }, () => Array(cols).fill(true));
            const midR = Math.floor(rows / 2);
            const midC = Math.floor(cols / 2);

            switch (shape) {
                case "square":
                default:
                    break;
                case "wide": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                                if ((r + c) % 3 !== 0) mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "arc": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const dr = r - midR;
                            const dc = c - midC;
                            if (dr * dr + dc * dc > midR * midR + midC * midC) {
                                mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "wave": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            if (r === 0 || r === rows - 1) {
                                if (c % 4 === 0) mask[r][c] = false;
                            }
                            if (c === 0 || c === cols - 1) {
                                if (r % 4 === 0) mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "block": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            if ((r < 3 && c < 3) || (r < 3 && c >= cols - 3) || (r >= rows - 3 && c < 3) || (r >= rows - 3 && c >= cols - 3)) {
                                mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "pyramid": {
                    for (let r = 0; r < rows; r++) {
                        const left = Math.floor(midC - r * 0.6);
                        const right = Math.ceil(midC + r * 0.6);
                        for (let c = 0; c < cols; c++) {
                            if (c < left || c > right) mask[r][c] = false;
                        }
                    }
                    break;
                }
                case "valley": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const edge = Math.abs(c - midC);
                            if (edge > midC - 1 && r > midR + 2) {
                                mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "stair_new": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            if (c > r + 2 && c < cols - r - 2) {
                                mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "cloud": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const dr = r - midR;
                            const dc = c - midC;
                            const dist = dr * dr + dc * dc;
                            const threshold = (midR * midR + midC * midC) * 0.65;
                            if (dist > threshold && (r + c) % 5 === 0) {
                                mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
                case "maze": {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const nearEdge = r < 2 || r >= rows - 2 || c < 2 || c >= cols - 2;
                            if (nearEdge && (r + c) % 3 === 0) {
                                mask[r][c] = false;
                            }
                        }
                    }
                    break;
                }
            }
            for (let r = midR - 1; r <= midR + 1; r++) {
                for (let c = midC - 1; c <= midC + 1; c++) {
                    if (r >= 0 && r < rows && c >= 0 && c < cols) {
                        mask[r][c] = true;
                    }
                }
            }
            return mask;
        }

        function randBlock() {
            const idx = Math.floor(Math.random() * BLOCK_IMGS.length);
            return { colorIdx: idx, type: "normal" };
        }

        function calcCellPixel() {
            var base = (boardRows <= 7) ? 66 : (boardRows <= 8 ? 56 : 48);
            var avail = window.innerWidth - 40 - 24;
            var byScreen = Math.floor(avail / boardCols);
            return Math.max(32, Math.min(base, byScreen));
        }

        function initGameBoard() {
            clearTimeout(hintTimer);
            cellPixel = calcCellPixel();
            const mask = buildShapeMask(boardRows, boardCols, boardShape);
            grid = [];
            for (let i = 0; i < boardRows; i++) {
                const arr = [];
                for (let j = 0; j < boardCols; j++) {
                    if (mask[i][j]) arr.push(randBlock());
                    else arr.push(null);
                }
                grid.push(arr);
            }
            // 清除开局自带匹配，保证棋盘干净：只有玩家主动交换产生4连/5连时才合成发光/终极方块
            let attempts = 0;
            while (attempts < 50) {
                const { cells } = scanAllMatches();
                if (cells.length === 0) break;
                for (let i = 0; i < boardRows; i++) {
                    for (let j = 0; j < boardCols; j++) {
                        if (mask[i][j]) grid[i][j] = randBlock();
                    }
                }
                attempts++;
            }
            // 保证每一局开局都藏一对手交换后能合成4连/5连（发光/终极方块）的方块
            glowPotentialPair = findGlowSwapPair();
            let gpGuard = 0;
            while (glowPotentialPair === null && gpGuard < 200) {
                for (let i = 0; i < boardRows; i++) {
                    for (let j = 0; j < boardCols; j++) {
                        if (mask[i][j]) grid[i][j] = randBlock();
                    }
                }
                attempts = 0;
                while (attempts < 50) {
                    const { cells } = scanAllMatches();
                    if (cells.length === 0) break;
                    for (let i = 0; i < boardRows; i++) {
                        for (let j = 0; j < boardCols; j++) {
                            if (mask[i][j]) grid[i][j] = randBlock();
                        }
                    }
                    attempts++;
                }
                glowPotentialPair = findGlowSwapPair();
                gpGuard++;
            }
            score = 0;
            usedStep = 0;
            if (gameMode === "story") {
                remainStep = 18 + currentLevel * 2;
            } else {
                remainStep = 99999;
            }
            gameOver = false;
            isPause = false;
            selectR = -1; selectC = -1;
            gameOverModal.style.display = 'none';
            document.getElementById('failOverlay').style.display = 'none';
            pauseModal.style.display = 'none';
            renderBoard();
            // 开局提示藏的发光潜力交换对，闪烁3秒
            if (glowPotentialPair) {
                clearAllHint();
                const b1 = getBlockDom(glowPotentialPair[0], glowPotentialPair[1]);
                const b2 = getBlockDom(glowPotentialPair[2], glowPotentialPair[3]);
                if (b1) b1.classList.add('hint-blink');
                if (b2) b2.classList.add('hint-blink');
                setTimeout(() => { clearAllHint(); }, 3000);
            }
            var showSpeed = (gameMode !== "timed");
            document.getElementById("speedArea").style.display = showSpeed ? "" : "none";
            resetHintTimer();
            animating = false;
        }

        function clearAllHint() {
            document.querySelectorAll('.block.hint-blink').forEach(el => el.classList.remove('hint-blink'));
        }
        function resetHintTimer() {
            clearTimeout(hintTimer);
            clearAllHint();
            hintTimer = setTimeout(() => {
                if (isPause || gameOver) return;
                const pair = findHintSwapPair();
                if (!pair) {
                    // 无解：弹提示（玩家点过取消则不再打扰）
                    if (!animating && !noMatchDismissed) noMatchModal.style.display = "flex";
                    return;
                }
                const [r1, c1, r2, c2] = pair;
                getBlockDom(r1, c1).classList.add("hint-blink");
                getBlockDom(r2, c2).classList.add("hint-blink");
            }, 5000);
        }

        function findHintSwapPair() {
            const dirs = [[0, 1], [1, 0]];
            for (let r = 0; r < boardRows; r++) {
                for (let c = 0; c < boardCols; c++) {
                    if (!grid[r][c]) continue;
                    for (const [dr, dc] of dirs) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= boardRows || nc >= boardCols || !grid[nr][nc]) continue;
                        [grid[r][c], grid[nr][nc]] = [grid[nr][nc], grid[r][c]];
                        const m = scanAllMatches().cells;
                        [grid[r][c], grid[nr][nc]] = [grid[nr][nc], grid[r][c]];
                        if (m.length > 0) return [r, c, nr, nc];
                    }
                }
            }
            return null;
        }

        // 查找交换后能合成4连/5连（发光/终极方块）的交换对，用于开局藏潜力
        function findGlowSwapPair() {
            const dirs = [[0, 1], [1, 0]];
            for (let r = 0; r < boardRows; r++) {
                for (let c = 0; c < boardCols; c++) {
                    if (!grid[r][c]) continue;
                    for (const [dr, dc] of dirs) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= boardRows || nc >= boardCols || !grid[nr][nc]) continue;
                        [grid[r][c], grid[nr][nc]] = [grid[nr][nc], grid[r][c]];
                        const { groups } = scanAllMatches();
                        [grid[r][c], grid[nr][nc]] = [grid[nr][nc], grid[r][c]];
                        for (const g of groups) {
                            if (g.len >= 4) return [r, c, nr, nc];
                        }
                    }
                }
            }
            return null;
        }


        function renderBoard() {
            scoreDom.innerText = score;
            document.getElementById("targetLabel").firstChild.textContent = gameMode === "timed" ? "最高分：" : "目标分：";
            targetScoreDom.innerText = gameMode === "story" ? targetScore : (gameMode === "timed" ? getBestScore(timeLimit) : "-");
            curLevelTextDom.innerText = gameMode === "story" ? currentLevel : (gameMode === "timed" ? "限时" : "无尽");
            gameModeTextDom.innerText = gameMode === "story" ? "闯关" : (gameMode === "timed" ? "限时" : "无尽");
            document.getElementById("stepLabel").firstChild.textContent = gameMode === "timed" ? "时间：" : "剩余步数：";
            stepLeftDom.innerText = gameMode === "story" ? remainStep : (gameMode === "timed" ? timeLeft + "秒" : "∞");
            usedStepDom.innerText = usedStep;
            boardDom.innerHTML = '';
            const mask = buildShapeMask(boardRows, boardCols, boardShape);
            for (let r = 0; r < boardRows; r++) {
                const rowDiv = document.createElement('div');
                rowDiv.className = 'row';
                for (let c = 0; c < boardCols; c++) {
                    const cellDiv = document.createElement('div');
                    cellDiv.className = 'cell';
                    cellDiv.style.width = cellPixel + "px";
                    cellDiv.style.height = cellPixel + "px";
                    if (!mask[r][c]) cellDiv.classList.add("invalid");
                    cellDiv.dataset.r = r;
                    cellDiv.dataset.c = c;
                    if (grid[r][c]) {
                        const block = document.createElement('div');
                        var t = grid[r][c].type || 'normal';
                        block.className = 'block' + (t === 'glow' ? ' glow' : (t === 'ultimate' ? ' ultimate' : ''));
                        var imgPath = t === 'ultimate' ? ULTIMATE_IMG : (t === 'glow' ? GLOW_IMGS[grid[r][c].colorIdx] : BLOCK_IMGS[grid[r][c].colorIdx]);
                        block.style.backgroundImage = 'url("' + imgPath + '")';
                        cellDiv.appendChild(block);
                    }
                    cellDiv.onclick = () => onCellClick(r, c);
                    rowDiv.appendChild(cellDiv);
                }
                boardDom.appendChild(rowDiv);
            }
        }

        function getBlockDom(r, c) {
            let idx = 0;
            for (let i = 0; i < r; i++) for (let j = 0; j < boardCols; j++) if (grid[i][j]) idx++;
            for (let j = 0; j < c; j++) if (grid[r][j]) idx++;
            return boardDom.querySelectorAll('.block')[idx];
        }

        async function onCellClick(r, c) {
            if (isPause || gameOver || animating) return;
            if (!grid[r][c]) return;
            clearAllHint();
            resetHintTimer();
            if (selectR === -1) {
                selectR = r; selectC = c;
                getBlockDom(r, c).classList.add('selected');
            } else {
                const dr = Math.abs(selectR - r);
                const dc = Math.abs(selectC - c);
                getBlockDom(selectR, selectC).classList.remove('selected');
                if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
                    await doSwap(selectR, selectC, r, c);
                }
                selectR = -1; selectC = -1;
            }
        }

        // 统一交换处理：点击与拖拽共用（支持所有特殊方块组合）
        async function doSwap(r1, c1, r2, c2) {
            animating = true;
            const b1 = grid[r1][c1];
            const b2 = grid[r2][c2];
            // 终极方块和普通方块交换：消除所有同色，交换的终极方块本身也消失
            if ((b1.type === 'ultimate' && (!b2.type || b2.type === 'normal')) || (b2.type === 'ultimate' && (!b1.type || b1.type === 'normal'))) {
                usedStep++;
                if (gameMode === "story") remainStep--;
                noMatchDismissed = false;
                const color = b1.type === 'ultimate' ? b2.colorIdx : b1.colorIdx;
                [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
                renderBoard();
                await sleep(animationDelay);
                // 交换后终极方块所在位置：b1是ultimate则在(r2,c2)，b2是ultimate则在(r1,c1)
                const uR = b1.type === 'ultimate' ? r2 : r1;
                const uC = b1.type === 'ultimate' ? c2 : c1;
                // 收集要消除的方块：所有同色方块 + 交换的那个终极方块本身（不误伤其他颜色的终极方块）
                const toErase = [];
                for (let rr = 0; rr < boardRows; rr++) for (let cc = 0; cc < boardCols; cc++) {
                    if (grid[rr][cc] && (grid[rr][cc].colorIdx === color || (rr === uR && cc === uC))) toErase.push([rr, cc]);
                }
                // 加popping动画
                for (const [er, ec] of toErase) {
                    const blk = getBlockDom(er, ec);
                    if (blk) { blk.classList.remove('popping'); void blk.offsetWidth; blk.classList.add('popping'); }
                }
                await sleep(Math.round(250 * animationDelay / 420));
                for (const [rr, cc] of toErase) { score += 4; grid[rr][cc] = null; }
                playSfx('sfx-match');
                await dropAndFill();
                await resolveMatchLoop();
                checkGameOverJudge();
            } else if ((b1.type === 'glow' || b1.type === 'ultimate') && (b2.type === 'glow' || b2.type === 'ultimate')) {
                usedStep++;
                if (gameMode === "story") remainStep--;
                noMatchDismissed = false;
                [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
                renderBoard();
                await sleep(animationDelay);
                if (b1.type === 'ultimate' && b2.type === 'ultimate') {
                    // 终极+终极：清全盘（带动画）
                    const allBlocks = [];
                    for (let rr = 0; rr < boardRows; rr++) for (let cc = 0; cc < boardCols; cc++) {
                        if (grid[rr][cc]) allBlocks.push([rr, cc]);
                    }
                    for (const [er, ec] of allBlocks) {
                        const blk = getBlockDom(er, ec);
                        if (blk) { blk.classList.remove('popping'); void blk.offsetWidth; blk.classList.add('popping'); }
                    }
                    await sleep(Math.round(300 * animationDelay / 420));
                    for (const [rr, cc] of allBlocks) { score += 4; grid[rr][cc] = null; }
                    playSfx('sfx-win');
                } else if (b1.type === 'ultimate' || b2.type === 'ultimate') {
                    // ultimate + glow: 终极方块消失，所有同色方块被赋予发光后立即随机清除整行/整列
                    const color = b1.type === 'ultimate' ? b2.colorIdx : b1.colorIdx;
                    const uR = b1.type === 'ultimate' ? r2 : r1;
                    const uC = b1.type === 'ultimate' ? c2 : c1;
                    grid[uR][uC] = null;
                    const toErase = new Set();
                    for (let rr = 0; rr < boardRows; rr++) for (let cc = 0; cc < boardCols; cc++) {
                        if (grid[rr][cc] && grid[rr][cc].colorIdx === color) {
                            const d = Math.random() < 0.5 ? 'h' : 'v';
                            if (d === 'h') { for (let x = 0; x < boardCols; x++) toErase.add(rr + ',' + x); }
                            else { for (let y = 0; y < boardRows; y++) toErase.add(y + ',' + cc); }
                        }
                    }
                    renderBoard();
                    await sleep(animationDelay);
                    for (const key of toErase) {
                        const [er, ec] = key.split(',').map(Number);
                        const blk = getBlockDom(er, ec);
                        if (blk) { blk.classList.remove('popping'); void blk.offsetWidth; blk.classList.add('popping'); }
                    }
                    await sleep(Math.round(250 * animationDelay / 420));
                    for (const key of toErase) {
                        const [er, ec] = key.split(',').map(Number);
                        score += 4;
                        grid[er][ec] = null;
                    }
                    playSfx('sfx-match');
                } else {
                    // glow + glow: 两行两列（带动画）
                    const toErase = new Set();
                    for (let cc = 0; cc < boardCols; cc++) if (grid[r1][cc]) toErase.add(r1 + ',' + cc);
                    for (let rr = 0; rr < boardRows; rr++) if (grid[rr][c1]) toErase.add(rr + ',' + c1);
                    for (let cc = 0; cc < boardCols; cc++) if (grid[r2][cc]) toErase.add(r2 + ',' + cc);
                    for (let rr = 0; rr < boardRows; rr++) if (grid[rr][c2]) toErase.add(rr + ',' + c2);
                    for (const key of toErase) {
                        const [er, ec] = key.split(',').map(Number);
                        const blk = getBlockDom(er, ec);
                        if (blk) { blk.classList.remove('popping'); void blk.offsetWidth; blk.classList.add('popping'); }
                    }
                    await sleep(Math.round(250 * animationDelay / 420));
                    for (const key of toErase) {
                        const [er, ec] = key.split(',').map(Number);
                        score += 4;
                        grid[er][ec] = null;
                    }
                    playSfx('sfx-match');
                }
                await dropAndFill();
                await resolveMatchLoop();
                checkGameOverJudge();
            } else {
                // 普通交换：交换后立即检测，消除动画与音效并行开始（不再双倍等待）
                [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
                renderBoard();
                const matches = scanAllMatches().cells;
                if (matches.length > 0) {
                    usedStep++;
                    if (gameMode === "story") remainStep--;
                    noMatchDismissed = false;
                    sfx.swap();
                    await resolveMatchLoop();
                    checkGameOverJudge();
                } else {
                    // 无匹配：先短暂展示交换结果，再回退并抖动
                    await sleep(animationDelay);
                    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
                    renderBoard();
                    getBlockDom(r1, c1).classList.add('shake');
                    getBlockDom(r2, c2).classList.add('shake');
                    sfx.invalid();
                    setTimeout(() => {
                        getBlockDom(r1, c1).classList.remove('shake');
                        getBlockDom(r2, c2).classList.remove('shake');
                    }, 250);
                }
            }
            animating = false;
        }

        // === 拖拽滑动交换 ===
        let dragStart = null;
        let dragSwapped = false;

        function cellFromEvent(e) {
            const rect = boardDom.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const c = Math.floor(x / cellPixel);
            const r = Math.floor(y / cellPixel);
            if (r < 0 || r >= boardRows || c < 0 || c >= boardCols) return null;
            if (!grid[r][c]) return null;
            return { r, c };
        }

        function initDragEvents() {
            boardDom.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (isPause || gameOver || animating) return;
                const pos = cellFromEvent(e);
                if (!pos) return;
                dragStart = { r: pos.r, c: pos.c, x: e.clientX, y: e.clientY };
                dragSwapped = false;
                getBlockDom(pos.r, pos.c).classList.add('selected');
            });

            document.addEventListener('mousemove', (e) => {
                if (!dragStart || dragSwapped) return;
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                const threshold = cellPixel * 0.45;
                if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
                let nr = dragStart.r, nc = dragStart.c;
                if (Math.abs(dx) > Math.abs(dy)) {
                    nc += dx > 0 ? 1 : -1;
                } else {
                    nr += dy > 0 ? 1 : -1;
                }
                if (nr >= 0 && nr < boardRows && nc >= 0 && nc < boardCols && grid[nr][nc]) {
                    dragSwapped = true;
                    getBlockDom(dragStart.r, dragStart.c).classList.remove('selected');
                    const r1 = dragStart.r, c1 = dragStart.c;
                    dragStart = null;
                    swapAndCheck(r1, c1, nr, nc);
                }
            });

            document.addEventListener('mouseup', () => {
                if (dragStart && !dragSwapped) {
                    getBlockDom(dragStart.r, dragStart.c).classList.remove('selected');
                }
                dragStart = null;
            });

            // 触屏支持
            boardDom.addEventListener('touchstart', (e) => {
                if (isPause || gameOver || animating) return;
                const t = e.touches[0];
                const pos = cellFromEvent(t);
                if (!pos) return;
                dragStart = { r: pos.r, c: pos.c, x: t.clientX, y: t.clientY };
                dragSwapped = false;
                getBlockDom(pos.r, pos.c).classList.add('selected');
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (!dragStart || dragSwapped) return;
                e.preventDefault();
                const t = e.touches[0];
                const dx = t.clientX - dragStart.x;
                const dy = t.clientY - dragStart.y;
                const threshold = cellPixel * 0.45;
                if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
                let nr = dragStart.r, nc = dragStart.c;
                if (Math.abs(dx) > Math.abs(dy)) {
                    nc += dx > 0 ? 1 : -1;
                } else {
                    nr += dy > 0 ? 1 : -1;
                }
                if (nr >= 0 && nr < boardRows && nc >= 0 && nc < boardCols && grid[nr][nc]) {
                    dragSwapped = true;
                    getBlockDom(dragStart.r, dragStart.c).classList.remove('selected');
                    const r1 = dragStart.r, c1 = dragStart.c;
                    dragStart = null;
                    swapAndCheck(r1, c1, nr, nc);
                }
            }, { passive: false });

            document.addEventListener('touchend', () => {
                if (dragStart && !dragSwapped) {
                    getBlockDom(dragStart.r, dragStart.c).classList.remove('selected');
                }
                dragStart = null;
            });
        }

        async function swapAndCheck(r1, c1, r2, c2) {
            clearAllHint();
            resetHintTimer();
            await doSwap(r1, c1, r2, c2);
        }

        function checkGameOverJudge() {
            if (gameMode === "endless" || gameMode === "timed") return;
            if (score >= targetScore) {
                gameOver = true;
                clearTimeout(hintTimer);
                if (currentLevel >= unlockMaxLevel && currentLevel < TOTAL_LEVEL) {
                    unlockMaxLevel = currentLevel + 1;
                    saveUnlock();

                }
                gameOverTitleDom.innerText = "🎉闯关成功";
                const iconDom = document.getElementById("gameOverIcon");
                iconDom.innerText = "🎉";
                iconDom.className = "gameover-icon win";
                const totalStep = 18 + currentLevel * 2;
                const remainRatio = remainStep / totalStep;
                let stars = 1;
                if (remainRatio > 0.5) stars = 3;
                else if (remainRatio > 0.25) stars = 2;
                document.getElementById("starRating").innerText = "★".repeat(stars) + "☆".repeat(3 - stars);
                gameOverDescDom.innerText = `得分：${score}，目标分数${targetScore}，剩余步数${remainStep}，成功通关！`;
                document.getElementById("gameOverStats").innerHTML =
                    `<div class="stat-item"><span class="stat-label">得分</span><span class="stat-value">${score}</span></div>` +
                    `<div class="stat-item"><span class="stat-label">目标分</span><span class="stat-value">${targetScore}</span></div>` +
                    `<div class="stat-item"><span class="stat-label">剩余步数</span><span class="stat-value">${remainStep}</span></div>`;
                if (currentLevel >= TOTAL_LEVEL) {
                    document.getElementById("btnModalNextLevel").style.display = "none";
                } else {
                    document.getElementById("btnModalNextLevel").style.display = "inline-block";
                }
                gameOverModal.style.display = "flex";
                sfx.win();
                if (currentLevel === TOTAL_LEVEL) {
                    setTimeout(() => { winAllModal.style.display = "flex"; }, 600);
                }
            } else if (remainStep <= 0) {
                gameOver = true;
                clearTimeout(hintTimer);
                gameOverTitleDom.innerText = "💔闯关失败";
                const iconDom = document.getElementById("gameOverIcon");
                iconDom.innerText = "💔";
                iconDom.className = "gameover-icon lose";
                document.getElementById("starRating").innerText = "";
                const gap = targetScore - score;
                gameOverDescDom.innerText = `得分：${score}，目标分数${targetScore}，步数耗尽，未达成目标。`;
                document.getElementById("gameOverStats").innerHTML =
                    `<div class="stat-item"><span class="stat-label">得分</span><span class="stat-value">${score}</span></div>` +
                    `<div class="stat-item"><span class="stat-label">目标分</span><span class="stat-value">${targetScore}</span></div>` +
                    `<div class="stat-item stat-warn"><span class="stat-label">还差</span><span class="stat-value">${gap}分</span></div>`;
                document.getElementById("btnModalNextLevel").style.display = "none";
                document.getElementById("failOverlay").style.display = "block";
                gameOverModal.style.display = "flex";
                sfx.lose();
            }
        }

        function sleep(ms) {
            return new Promise(res => setTimeout(res, ms));
        }

        function scanAllMatches() {
            const matched = new Set();
            const groups = [];
            for (let i = 0; i < boardRows; i++) {
                let j = 0;
                while (j < boardCols) {
                    const base = grid[i][j];
                    if (!base) { j++; continue; }
                    let k = j;
                    while (k < boardCols && grid[i][k] && grid[i][k].colorIdx === base.colorIdx) k++;
                    const len = k - j;
                    if (len >= 3) {
                        const cells = [];
                        for (let x = j; x < k; x++) { matched.add(`${i},${x}`); cells.push([i, x]); }
                        groups.push({ dir: 'h', cells, len });
                    }
                    j = k;
                }
            }
            for (let j = 0; j < boardCols; j++) {
                let i = 0;
                while (i < boardRows) {
                    const base = grid[i][j];
                    if (!base) { i++; continue; }
                    let k = i;
                    while (k < boardRows && grid[k][j] && grid[k][j].colorIdx === base.colorIdx) k++;
                    const len = k - i;
                    if (len >= 3) {
                        const cells = [];
                        for (let x = i; x < k; x++) { matched.add(`${x},${j}`); cells.push([x, j]); }
                        groups.push({ dir: 'v', cells, len });
                    }
                    i = k;
                }
            }
            return { cells: Array.from(matched).map(s => { const [a, b] = s.split(','); return [Number(a), Number(b)]; }), groups };
        }

        async function resolveMatchLoop() {
            animating = true;
            while (true) {
                const { cells: matches, groups } = scanAllMatches();
                if (matches.length === 0) break;
                renderBoard();
                await sleep(animationDelay);
                // 检测4连/5连生成特殊方块
                const toRemove = new Set(matches.map(([r,c]) => `${r},${c}`));
                const specialSpawns = [];
                for (const g of groups) {
                    if (g.len >= 5) {
                        const mid = g.cells[Math.floor(g.cells.length / 2)];
                        specialSpawns.push({ r: mid[0], c: mid[1], type: 'ultimate' });
                        toRemove.delete(`${mid[0]},${mid[1]}`);
                    } else if (g.len === 4) {
                        const mid = g.cells[Math.floor(g.cells.length / 2)];
                        specialSpawns.push({ r: mid[0], c: mid[1], type: 'glow', dir: g.dir });
                        toRemove.delete(`${mid[0]},${mid[1]}`);
                    }
                }
                // 检测L型/T型：一个方块同时在横排和竖排匹配中
                const posCount = {};
                for (const g of groups) {
                    if (g.len < 3) continue;
                    for (const [r, c] of g.cells) {
                        const key = `${r},${c}`;
                        if (!posCount[key]) posCount[key] = { r, c, h: 0, v: 0 };
                        if (g.dir === 'h') posCount[key].h++;
                        else posCount[key].v++;
                    }
                }
                // 记录已由4连/5连生成特殊方块的位置，L/T检测不再覆盖它们（防止ultimate被降级为glow）
                const specialPos = new Set(specialSpawns.map(s => s.r + ',' + s.c));
                for (const key in posCount) {
                    const p = posCount[key];
                    if (p.h > 0 && p.v > 0 && !specialPos.has(key)) {
                        // L型/T型，生成glow随机方向
                        specialSpawns.push({ r: p.r, c: p.c, type: 'glow', dir: Math.random() < 0.5 ? 'h' : 'v' });
                        toRemove.delete(key);
                    }
                }
                // 消除特殊方块效果：遍历棋盘找被消除的glow/ultimate
                const specialToRemove = [];
                for (let rr = 0; rr < boardRows; rr++) for (let cc = 0; cc < boardCols; cc++) {
                    if (toRemove.has(`${rr},${cc}`) && grid[rr][cc]) {
                        const blk = grid[rr][cc];
                        if (blk.type === 'glow') specialToRemove.push({ r: rr, c: cc, dir: blk.dir });
                        else if (blk.type === 'ultimate') specialToRemove.push({ r: rr, c: cc, type: 'ultimate', color: blk.colorIdx });
                    }
                }
                for (const s of specialToRemove) {
                    if (s.type === 'ultimate') {
                        for (let rr = 0; rr < boardRows; rr++) for (let cc = 0; cc < boardCols; cc++) {
                            if (grid[rr][cc] && grid[rr][cc].colorIdx === s.color) toRemove.add(`${rr},${cc}`);
                        }
                    } else if (s.dir === 'h') {
                        for (let cc = 0; cc < boardCols; cc++) { if (grid[s.r][cc]) toRemove.add(`${s.r},${cc}`); }
                    } else {
                        for (let rr = 0; rr < boardRows; rr++) { if (grid[rr][s.c]) toRemove.add(`${rr},${s.c}`); }
                    }
                }
                // 给所有要消除的方块加popping动画
                for (const key of toRemove) {
                    const [er, ec] = key.split(',').map(Number);
                    const blk = getBlockDom(er, ec);
                    if (blk) { blk.classList.remove('popping'); void blk.offsetWidth; blk.classList.add('popping'); }
                }
                await sleep(Math.round(250 * animationDelay / 420));
                // 执行消除
                for (const key of toRemove) {
                    const [r, c] = key.split(',').map(Number);
                    score += 4;
                    grid[r][c] = null;
                }
                // 生成特殊方块
                for (const s of specialSpawns) {
                    if (grid[s.r] && grid[s.r][s.c]) {
                        const oldColor = grid[s.r][s.c].colorIdx;
                        grid[s.r][s.c] = { colorIdx: oldColor, type: s.type, dir: s.dir || null };
                    }
                }
                playSfx('sfx-match');
                await dropAndFill();
            }
            resetHintTimer();
            animating = false;
            noMatchDismissed = false;
            // 检查是否没有可消除的方块了：弹出提示，让玩家重新洗牌或重开本局
            if (!isPause && !gameOver && findHintSwapPair() === null) {
                noMatchModal.style.display = "flex";
            }
        }

        function reshuffleBoard() {
            // 保留分数和步数，只重新生成棋盘方块，并确保新棋盘有可消除的交换
            const mask = buildShapeMask(boardRows, boardCols, boardShape);
            grid = [];
            for (let i = 0; i < boardRows; i++) {
                const arr = [];
                for (let j = 0; j < boardCols; j++) {
                    if (mask[i][j]) arr.push(randBlock());
                    else arr.push(null);
                }
                grid.push(arr);
            }
            let guard = 0;
            while (findHintSwapPair() === null && guard < 100) {
                for (let i = 0; i < boardRows; i++) for (let j = 0; j < boardCols; j++) {
                    if (mask[i][j]) grid[i][j] = randBlock();
                }
                guard++;
            }
            selectR = -1; selectC = -1;
            renderBoard();
            resetHintTimer();
            noMatchModal.style.display = 'none';
            playSfx('sfx-click');
        }

        async function dropAndFill() {
            const dropDist = Array.from({length: boardRows}, () => Array(boardCols).fill(0));
            for (let c = 0; c < boardCols; c++) {
                // 检查这列有没有null，没有就跳过
                let hasNull = false;
                for (let r = 0; r < boardRows; r++) { if (!grid[r][c]) { hasNull = true; break; } }
                if (!hasNull) continue;
                const col = [];
                for (let r = boardRows - 1; r >= 0; r--) {
                    if (grid[r][c]) col.push(grid[r][c]);
                }
                let destR = boardRows - 1;
                for (let i = 0; i < col.length; i++) {
                    const oldR = boardRows - 1 - i;
                    dropDist[destR][c] = oldR - destR;
                    grid[destR][c] = col[i];
                    destR--;
                }
                for (let r = destR; r >= 0; r--) {
                    grid[r][c] = randBlock();
                    dropDist[r][c] = boardRows;
                }
            }
            renderBoard();
            // 给所有下落了的方块加动画
            for (let r = 0; r < boardRows; r++) {
                for (let c = 0; c < boardCols; c++) {
                    if (dropDist[r][c] > 0) {
                        const blk = getBlockDom(r, c);
                        if (blk) {
                            blk.style.transform = 'translateY(-' + (dropDist[r][c] * cellPixel) + 'px)';
                            blk.style.transition = 'transform ' + Math.round(300 * animationDelay / 420) + 'ms ease-in';
                            requestAnimationFrame(() => {
                                blk.style.transform = 'translateY(0)';
                            });
                        }
                    }
                }
            }
            await sleep(Math.round(450 * animationDelay / 420));
            // 清理内联样式
            for (let r = 0; r < boardRows; r++) {
                for (let c = 0; c < boardCols; c++) {
                    const blk = getBlockDom(r, c);
                    if (blk) { blk.style.transition = ''; blk.style.transform = ''; }
                }
            }
        }


        // 页面事件绑定
        // video切换辅助函数
        // 视频循环
        ['bgVideoMenu','bgVideoLevel','bgVideoGame'].forEach(function(id) {
            const v = document.getElementById(id);
            v.addEventListener('ended', function() { this.currentTime = 0; this.play(); });
        });
        function showVideo(name) {
            document.getElementById('bgVideoMenu').style.display = name === 'bgm-menu' ? 'block' : 'none';
            document.getElementById('bgVideoLevel').style.display = name === 'bgm-level' ? 'block' : 'none';
            document.getElementById('bgVideoGame').style.display = name === 'bgm-game' ? 'block' : 'none';
        }

        document.getElementById('btnStartGame').onclick = function () {
            sfx.click();
            playSfx('sfx-transition');
            showVideo('bgm-level');
            initDragEvents();
        renderLevelSelect();
            mainMenu.style.display = 'none';
            levelSelectPage.style.display = 'flex';
        }

        document.getElementById('levelBackMain').onclick = function () {
            sfx.click();
            levelSelectPage.style.display = 'none';
            mainMenu.style.display = 'flex';
            showVideo('bgm-menu');
            playBgm(menuBgm);
        }

        document.getElementById('closeWinAll').onclick = () => { sfx.click(); winAllModal.style.display = 'none'; };

        document.getElementById('btnShowRule').onclick = function () { sfx.click(); ruleModal.style.display = 'flex'; }
        document.getElementById('btnCloseRule').onclick = function () { sfx.click(); ruleModal.style.display = 'none'; }
        document.getElementById('btnShowFeedback').onclick = function () { sfx.click(); feedbackModal.style.display = 'flex'; }
        document.getElementById('btnCloseFeedback').onclick = function () { sfx.click(); feedbackModal.style.display = 'none'; }
        document.getElementById('btnSubmitFeedback').onclick = function () {
            sfx.click(); feedbackTextarea.value = ''; feedbackModal.style.display = 'none'; successModal.style.display = 'flex';
        }
        document.getElementById('btnCloseSuccess').onclick = function () { sfx.click(); successModal.style.display = 'none'; }

        document.getElementById('noMatchShuffle').onclick = function () { sfx.click(); reshuffleBoard(); };
        document.getElementById('noMatchRestart').onclick = function () { sfx.click(); noMatchModal.style.display = 'none'; initGameBoard(); };
        document.getElementById('noMatchCancel').onclick = function () { sfx.click(); noMatchModal.style.display = 'none'; noMatchDismissed = true; };

        document.getElementById('btnPause').onclick = function () { sfx.click(); isPause = true; clearInterval(timeTimer); pauseModal.style.display = 'flex'; }
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.onclick = function () {
                sfx.click();
                const sp = Number(this.dataset.sp);
                animationDelay = Math.round(420 / sp);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            }
        })
        document.querySelector('.speed-btn[data-sp="1.0"]').classList.add('active');

        document.getElementById('btnResume').onclick = function () { sfx.click(); isPause = false; pauseModal.style.display = 'none'; resetHintTimer(); if (gameMode === 'timed' && !gameOver) { clearInterval(timeTimer); timeTimer = setInterval(() => { timeLeft--; updateTimeDisplay(); if (timeLeft <= 0) { clearInterval(timeTimer); endTimedGame(); } }, 1000); } }
        document.getElementById('btnRestartInPause').onclick = function () {
            sfx.click();
            if (!gameOver && gameMode !== "endless") {
                if (!confirm("重新开始将丢失当前进度，确定吗？")) return;
            }
            pauseModal.style.display = 'none'; initGameBoard();
        }
        document.getElementById('btnExitGame').onclick = function () {
            sfx.click();
            if (!gameOver && gameMode !== "endless") {
                if (!confirm("退出将丢失当前进度，确定吗？")) return;
            }
            pauseModal.style.display = 'none'; gamePage.style.display = 'none';
            levelSelectPage.style.display = 'flex'; clearTimeout(hintTimer);
            clearInterval(timeTimer);
            document.querySelectorAll('.speed-btn').forEach(b => b.style.display = '');
            document.getElementById('speedArea').style.display = '';
            showVideo('bgm-level');
            if (musicOn) playBgm(menuBgm); else currentBgm = menuBgm;
        }
        document.getElementById('btnModalRestart').onclick = function () {
            sfx.click(); gameOverModal.style.display = 'none';
            document.getElementById('failOverlay').style.display = 'none';
            initGameBoard();
        }
        document.getElementById('btnModalBackLevel').onclick = function () {
            sfx.click(); gameOverModal.style.display = 'none';
            document.getElementById('failOverlay').style.display = 'none';
            gamePage.style.display = 'none';
            levelSelectPage.style.display = 'flex'; clearTimeout(hintTimer);
            document.querySelectorAll('.speed-btn').forEach(b => b.style.display = '');
            document.getElementById('speedArea').style.display = '';
            showVideo('bgm-level');
            if (musicOn) playBgm(menuBgm); else currentBgm = menuBgm;
        }
        document.getElementById('btnModalNextLevel').onclick = function () {
            sfx.click(); gameOverModal.style.display = 'none';
            document.getElementById('failOverlay').style.display = 'none';
            if (currentLevel < TOTAL_LEVEL) enterLevel(currentLevel + 1);
        }

        // 全局音乐按钮
        let musicOn = false;
        let musicClickTimer = null;
        let menuBgm = 'bgm-menu'; // 主页当前曲目（退出游戏时恢复）
        const menuBgmList = ['bgm-menu', 'bgm-menu2', 'bgm-menu3'];

        document.getElementById('musicBtn').onclick = function() {
            clearTimeout(musicClickTimer);
            musicClickTimer = setTimeout(() => {
                musicOn = !musicOn;
                if (musicOn) {
                    this.classList.remove('paused');
                    this.classList.add('playing');
                    sfx.click();
                    let name;
                    if (gamePage.style.display === 'flex') name = gameMode === 'endless' ? 'bgm-endless' : 'bgm-level';
                    else if (currentBgm.startsWith('bgm-menu')) name = currentBgm;
                    else name = 'bgm-menu';
                    if (name.startsWith('bgm-menu')) menuBgm = name;
                    if (currentBgm === name && bgmAudio && bgmAudio.src.includes(name)) bgmAudio.play().catch(() => {});
                    else playBgm(name);
                } else {
                    this.classList.add('paused');
                    stopBgm();
                }
            }, 250);
        };
        document.getElementById('musicBtn').ondblclick = function() {
            clearTimeout(musicClickTimer);
            sfx.click();
            if (!musicOn) { musicOn = true; this.classList.remove('paused'); this.classList.add('playing'); }
            restartBgm();
        };

        // 右键音乐按钮弹BGM列表
        const bgmNames = ['曲目1', '曲目2', '曲目3'];
        document.getElementById('musicBtn').oncontextmenu = function(e) {
            e.preventDefault();
            if (gamePage.style.display === 'flex') return;
            playSfx('sfx-click');
            const old = document.getElementById('bgmMenu');
            if (old) old.remove();
            const menu = document.createElement('div');
            menu.id = 'bgmMenu';
            menu.style.cssText = 'position:fixed;top:90px;right:20px;background:rgba(30,60,80,0.95);border:2px solid #fff;border-radius:10px;padding:10px;z-index:300;min-width:160px;';
            menuBgmList.forEach(function(bgm, i) {
                const item = document.createElement('div');
                const playing = currentBgm === bgm;
                item.innerText = bgmNames[i] + (playing ? '  (正在播放)' : '');
                item.style.cssText = 'padding:8px 12px;color:#fff;cursor:pointer;font-size:15px;border-radius:6px;' + (playing ? 'background:rgba(100,200,255,0.3);' : '');
                item.onclick = function() {
                    playSfx('sfx-transition'); musicOn = true;
                    menuBgm = bgm;
                    document.getElementById('musicBtn').classList.remove('paused');
                    document.getElementById('musicBtn').classList.add('playing');
                    playBgm(bgm); menu.remove();
                };
                menu.appendChild(item);
            });
            document.body.appendChild(menu);
            setTimeout(function() {
                const closeHandler = function(ev) {
                    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeHandler); }
                };
                document.addEventListener('click', closeHandler);
            }, 0);
        };

        // 设置模块
        let musicVolume = 0.3;
        let sfxVolume = 0.6;
        document.getElementById('settingsBtn').onclick = function() { sfx.click(); document.getElementById('settingsModal').style.display = 'flex'; };
        document.getElementById('closeSettings').onclick = function() { sfx.click(); document.getElementById('settingsModal').style.display = 'none'; };
        document.getElementById('brightnessSlider').oninput = function() { document.body.style.filter = 'brightness(' + (this.value / 100) + ')'; };
        document.getElementById('musicVolumeSlider').oninput = function() { musicVolume = this.value / 100; if (bgmAudio) bgmAudio.volume = musicVolume; };
        document.getElementById('sfxVolumeSlider').oninput = function() { sfxVolume = this.value / 100; };
        document.getElementById('resetSettings').onclick = function() {
            sfx.click();
            document.getElementById('brightnessSlider').value = 80;
            document.getElementById('musicVolumeSlider').value = 30;
            document.getElementById('sfxVolumeSlider').value = 60;
            document.body.style.filter = 'brightness(0.8)';
            musicVolume = 0.3; sfxVolume = 0.6;
            if (bgmAudio) bgmAudio.volume = 0.3;
        };
        let warnShown = { music: false, sfx: false };
        document.getElementById('musicVolumeSlider').addEventListener('change', function() {
            if (this.value > 80 && !warnShown.music) { warnShown.music = true; setTimeout(() => alert('友情提示：音乐音量过大可能损伤听力，建议保持在80%以下！'), 100); }
            if (this.value <= 80) warnShown.music = false;
        });
        document.getElementById('sfxVolumeSlider').addEventListener('change', function() {
            if (this.value > 80 && !warnShown.sfx) { warnShown.sfx = true; setTimeout(() => alert('友情提示：音效音量过大可能损伤听力，建议保持在80%以下！'), 100); }
            if (this.value <= 80) warnShown.sfx = false;
        });

        // 首次弹窗
        document.getElementById('closeFirstVisit').onclick = function() {
            sfx.click(); this.parentElement.parentElement.style.display = 'none';
            musicOn = true; menuBgm = 'bgm-menu'; document.getElementById('musicBtn').classList.add('playing');
            showVideo('bgm-menu'); playBgm('bgm-menu');
        };

        // 限时模式按钮
        document.querySelectorAll('.time-option').forEach(btn => {
            btn.onclick = function() {
                sfx.click();
                startTimedGame(Number(this.dataset.time));
            };
        });
        document.getElementById('closeTimeSelect').onclick = function() {
            sfx.click();
            document.getElementById('timeSelectModal').style.display = 'none';
        };

        renderLevelSelect();

        let resizeTimer = null;
        window.addEventListener('resize', function() {
            if (!boardRows || !boardDom) return;
            if (gamePage.style.display === 'none') return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                var newSize = calcCellPixel();
                if (newSize === cellPixel) return;
                cellPixel = newSize;
                var cells = boardDom.querySelectorAll('.cell');
                for (var i = 0; i < cells.length; i++) {
                    cells[i].style.width = cellPixel + 'px';
                    cells[i].style.height = cellPixel + 'px';
                }
            }, 150);
        });

        // 加载完成后隐藏 loading
        window.addEventListener('load', function() {
            setTimeout(function() {
                var l = document.getElementById('loading');
                if (l) l.classList.add('hide');
            }, 300);
        });
