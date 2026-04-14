# Deploy `ba_game_build` with Git Submodule (CI/CD)

## 目標
你有兩個 repo：
1. **主站**：`checkinSystem`（Node/Express + pm2）
2. **遊戲前端**：`ba_game_build`（靜態內容，路徑例如 `games/game/xxx/index.html`）

你希望：
- 在主站伺服器目錄中放一個 `./games/` 資料夾，內容來自 `ba_game_build`
- `ba_game_build` 有人 `push` 後，可以自動更新主站 server 上的 `/games/...`，並讓 pm2 重新載入（或至少讓靜態檔生效）

本文提供兩段流程：
- A. **部署前：如何設定 submodule**
- B. **CI/CD：如何做到 push 後自動更新到 server（B 方案）**

---

## 前置確認（先看你是否符合）
### 1) 主站已掛載靜態路由 `/games`
在 `checkinSystem/app.js` 需要有類似下面程式：
```js
app.use('/games', express.static(path.join(__dirname, 'games')));
```

此外，如果你希望 `.../games/game/xxx` 少尾 `/` 也能正確導到 `.../games/game/xxx/`，可以加：
```js
app.get('/games/game/:slug', (req, res) => {
  return res.redirect(301, `/games/game/${req.params.slug}/`);
});
```

---

## A. 如何設定 submodule（由頭開始）
以下以「你在主站 repo 根目錄放 `games/` submodule」為例。

### 0) 確定主站 repo 目錄
在你 local 或伺服器上進入主站目錄，例如：
```bash
cd /path/to/checkinSystem
```

### 1) 加入 submodule（第一次）
若你要追蹤 `ba_game_build` 的 `main` 分支（請按實際分支調整）：
```bash
git submodule add -b main git@github.com:ice-solution/ba_game_build.git games
git submodule update --init --recursive
```

### 2) 確保 submodule 有追蹤 branch（建議加上）
檢查 `.gitmodules` 是否有：
```ini
[submodule "games"]
  path = games
  url = git@github.com:ice-solution/ba_game_build.git
  branch = main
```

如沒有 `branch`，可以加到 `.gitmodules`：
```bash
git config -f .gitmodules submodule.games.branch main
git submodule sync --recursive
```

### 3) 提交主站 repo 的 submodule 指標
```bash
git add .gitmodules games
git commit -m "Add games submodule"
```

> 注意：這份 commit 的目的只是「記錄 submodule 指向的 commit」，不是把內容更新到最新（CI/CD 會做 update）。

---

## 本地/手動更新（你現在用 pm2 + 手動 git pull 的方式）
每次你想更新最新 games 內容，可以在 **server 上**執行：
```bash
cd /path/to/checkinSystem

# 更新主站 repo（可選：若只更新 games 可以不用）
git pull

# 初始化/確保 submodule 存在
git submodule update --init --recursive

# B 方案核心：更新 submodule 到 remote 最新（會跟分支）
git submodule update --remote --merge games

# 讓 pm2 重新載入（若你的 app 沒有依賴 build，只是 serve 靜態檔，通常 reload/restart 即可）
pm2 reload all
# 或 pm2 restart all
```

---

## B. CI/CD：當 `ba_game_build` push 時自動更新到 server（B 方案）
你在前面說你用 pm2 並手動更新；B 方案就是：**CI 在收到 push 後，在 server 上自動跑 submodule update + pm2 reload**。

### 核心概念
- GitHub Actions 不會因為「submodule 裡的 repo push」而自動觸發主站 repo workflow（除非你做通知/觸發）。
- 做法：在 `ba_game_build` push 時，用 `repository_dispatch` 通知主站（主站 workflow 收到後部署）。

---

### Step 1：主站 repo（checkinSystem）建立 workflow（接收 dispatch + 部署到 server）
在主站 repo 建檔：
`.github/workflows/deploy-games-dispatch.yml`

建議用 SSH 連到 server，直接執行：
- `git submodule update --remote --merge games`
- `pm2 reload ...`

範例（你只需改 `SERVER_PATH`、pm2 指令與 secret 名稱）：

```yaml
name: Deploy games (submodule) on dispatch

on:
  repository_dispatch:
    types: [games_updated]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script_stop: true
          script: |
            set -e
            cd "${{ secrets.SERVER_PATH }}"

            # （可選）更新主站代碼
            git pull

            # 初始化 submodule
            git submodule update --init --recursive

            # 追 remote games 最新
            git submodule update --remote --merge games

            # reload pm2（可替換成指定 ecosystem 或 process 名稱）
            pm2 reload all
```

#### 你需要設定的 secrets（主站 repo）
- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`（private key）
- `SERVER_PATH`（server 上 checkinSystem 的路徑）

可選：
- 如果你不想 `pm2 reload all`，改成 `pm2 reload <process>` 或 `pm2 restart <process>`。

---

### Step 2：遊戲 repo（ba_game_build）建立 workflow（push 後通知主站）
在 `ba_game_build` repo 建檔：
`.github/workflows/notify-main-deploy.yml`

範例：
```yaml
name: Notify main repo deploy on games push

on:
  push:
    branches: [ "main" ]

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger main repo workflow
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          OWNER: your-main-repo-owner
          REPO: your-main-repo-name
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $GH_TOKEN" \
            "https://api.github.com/repos/$OWNER/$REPO/dispatches" \
            -d '{"event_type":"games_updated","client_payload":{"source":"ba_game_build"}}'
```

#### 你需要設定的 secrets（遊戲 repo）
- `GH_TOKEN`
  - 建議用 PAT / fine-grained token，至少要有對主站 repo 的權限（讓 API 能呼叫 dispatch）。

同時把 `OWNER` / `REPO` 改成你主站 repo 真實資訊。

---

## 多個 server：是否每台都要設定 submodule？
如果多台 server 都要 serve `/games`：
- 代表每台 server 都需要有 `games/` 內容
- 最穩就是：**每台 server 都做 submodule init**

而 CI 部署腳本要改成對多台 server 都執行一樣的 `git pull + submodule update --remote --merge games + pm2 reload`。

例如你可以在主站 workflow 裡把 `ssh-action` 用在 multiple hosts（或做一個 server list loop）。

---

## Troubleshooting（常見問題）
1) **`/games/game/xxx` 404**
- 確認目標檔是否存在於 `./games/game/xxx/index.html`（或你的實際入口檔）
- 如果入口是資料夾名，建議使用有尾 `/` 的 URL（你可以用 `/games/game/:slug` redirect 解決）

2) **submodule 更新沒生效**
- 確認 server 上有執行：
  - `git submodule update --remote --merge games`
- 確認 `.gitmodules` 內有 `branch = main`（或你實際 branch）

3) **pm2 reload 後仍舊看不到最新**
- 通常靜態檔會立即生效，但若你加了 cache/CDN，需要清快取
- 也可以用 `pm2 restart all` 再試一次

