# MY SIMPLE GACHA

課堂抽籤工具：抽組或抽個人，分配任務。純靜態網站（HTML/CSS/JS），資料只存在瀏覽器 localStorage。

原作：學生作品（原始部署 https://my-simple-gacha.vercel.app/）。

## 雲端分組登記

- `/admin`：教師登入（密碼在 Vercel 環境變數 `TEACHER_PASSWORD`），開課程、取得班級代碼 / QR code、修改或刪除登記、截止登記、匯出 CSV、「▶ 用這份名單抽籤」。
- `/join?code=XXXXXX`：學生輸入班級代碼、學號、姓名、組別；同一學號再送一次會更新。
- 資料庫：Supabase Postgres（Vercel Marketplace），連線字串 `POSTGRES_URL`。資料表在 API 第一次被呼叫時自動建立（`db/schema.mjs`），並開啟 RLS，Supabase 公開 API 讀不到學生資料。
- 其他環境變數：`SESSION_SECRET`（教師登入 cookie 簽章用）。
