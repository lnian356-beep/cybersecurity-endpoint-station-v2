# 資安終點站

一台電腦多人輪流玩的資訊網路大富翁。Node.js 原生 HTTP 負責遊戲 API。本機遊玩使用 SQLite；部署網站時使用 Neon PostgreSQL，讓成績可以跨手機與電腦保存。

## 開始遊戲

Windows 免安裝包包含 Node.js 24.21.0。解壓後執行 `start-game.bat`，遊戲會在瀏覽器開啟 `http://127.0.0.1:3000/`。若使用原始碼，請安裝 Node.js 22.5 以上，在專案資料夾執行 `npm start`。

## 遊戲內容

- 答題時間依難度調整：入門 30 秒、普通 25 秒、困難 20 秒、GAY炮 15 秒。
- 一般棋盤可供 2–4 人遊玩，共十回合。每局會重新安排棋盤，題目與選項也會洗牌；每位玩家最近看過的 50 題會優先避開。機會與命運格可能觸發臨時事件，題目仍限於簡報範圍。
- 每題作答後會顯示正確答案與解析；結算頁整理本局錯題、主題答題情況和已解鎖稱號。
- 100 個稱號分布於十個資訊網路主題，依玩家累積答對紀錄逐步解鎖。
- 無盡對決需兩位玩家都完成一場 GAY炮難度，且各答對至少三題後解鎖。解鎖前會隱藏入口；達成條件時會播放魔王關卡解鎖動畫與音效。進入後換成墨綠、酒紅與銅金色的暗色介面，並使用專屬音效。每人 30 HP、每題 30 秒，直到一方倒下。無盡題目為延伸內容，只會在此模式出現。
## 成績資料

本機遊玩時，成績存在執行資料夾的 `scores.sqlite`。部署網站時，成績寫入 Neon PostgreSQL，所有玩家共用同一份雲端排行榜。兩種資料庫都會在第一次啟動時自動建立資料表。本機 `scores.sqlite` 和雲端連線字串都不應上傳到公開 repository。

## GitHub 下載包

如果從 GitHub 下載，請下載 `game-part1.bin`、`game-part2.bin` 和 `merge-game.bat`，放在同一個資料夾後執行 `merge-game.bat`，再到產生的 `game` 資料夾執行 `start-game.bat`。

Node.js Windows 執行檔取自官方發行版，授權資訊及 SHA256 清單隨包附上。

## 手機公開網站（一次設定）

GitHub 手機 App 負責管理程式碼，不會直接執行遊戲伺服器。部署完成後，請用手機瀏覽器開啟 Render 提供的 HTTPS 網址。此專案已附 `render.yaml`：

1. 在 Neon 建立 PostgreSQL 專案，複製含 `sslmode=require` 的連線字串。不要把連線字串貼到 GitHub 或公開訊息。
2. 在 Render 建立 Blueprint，連結此 GitHub repository，讓 Render 讀取 `render.yaml`。
3. 在 Render 服務環境變數設定 `DATABASE_URL` 為 Neon 連線字串，再部署。
4. 等部署完成後，用手機打開 Render 網址。雲端資料庫會在第一次啟動時自動建立必要資料表。

Render 免費網站閒置一段時間後會休眠，重新開啟可能需要等待；雲端成績存放於 Neon，不會寫入 repository。原有電腦的 `scores.sqlite` 不會自動上傳或合併至雲端。

