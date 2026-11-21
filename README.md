# 知食 ZhiShi · 农大AI食堂伴侣

> AI 懂吃，你吃得明白。拍照识菜 · AI个性化点餐 · 食堂红黑榜 · 健康周报

中国农业大学 2026 AgriHackathon（农客松）参赛作品 · 方向二「生命系统」· 食品赛道

## 功能总览（健康饮食闭环）

查菜识菜 → AI个性化点餐 → 一键记录 → AI健康周报 → 反馈到明天的选择

| 模块 | 说明 |
|---|---|
| 查菜识菜 | 菜单关键词模糊搜索（支持多词、带食堂位置）；拍照识别为食材清单模式（只报看到的食物+克数，不猜菜名，支持文字补充说明增强） |
| AI 个性化点餐 | 目标(减脂/增肌/控糖/不设) + 过敏忌口 + 「想吃/不想吃」一句话口味 + 指定食堂或不指定(AI自动选) → 单食堂配餐约束、点名菜强制入选、本地算法兜底永不空转 |
| 食堂红黑榜 | 评价 100% 来自真实用户（无预置数据）；红/黑/重油重盐三榜；贝叶斯加权排名（规则公开可查）；评价绑定食堂位置、昵称全站唯一、楼层回复互评；AI 口碑提炼 |
| 健康周报 | 自然周热力图、热量走势、营养达标度、均衡雷达、AI 专属报告、成就徽章；每日目标热量可自定义，周报与首页目标同步 |
| 游客身份体系 | 一台设备=一个身份，昵称全站唯一（服务端注册表查重），改名全站同步历史评价 |
| 菜品众包 | 手册没收录的菜（如新窗口）用户自助添加，AI 现场估算营养入库，加入后可直接评价 |
| 每日食安贴士 | 20 条食科知识每日轮换（本地知识库，零 token） |

## 数据规模

- 11 个食堂 / 1588 道去重菜品 / 1915 个菜品实体（菜名×食堂×窗口独立口碑）
- 数据来源：CAU 官方《最全食堂菜品自查手册》（近期菜单快照，以食堂实际供应为准）
- 营养数据：AI 按食堂常规份量估算（热量/蛋白质/脂肪/碳水/钠/膳食纤维/价格/过敏原），仅供参考

## 运行方式

### 方式A：一体化服务器（推荐：本地路演 / 公网部署）

1. 把蚂蚁百灵 API Key 放到 `app/ant_key.txt`（本副本中该文件为占位提示，运行前自行填入；不要把真实密钥提交到公开仓库）
2. 启动：

```bash
cd app
python server.py
```



- 纯 Python 标准库，Python 3.8+，零第三方依赖
- 前端自动探测 `/api/ping`，进入代理模式：AI 调用经服务器转发（密钥不出服务端），评价写入服务端 JSON 存储，多端实时共享
- `app/_data` 为运行数据（评价/昵称），首次运行自动生成空库
- 云端部署（ZCode Sites 等 PaaS）：`start.sh` 中 `python server.py` 监听 `$PORT` 即可

### 方式B：纯静态 + 浏览器直连（GitHub Pages / 任意静态托管）

任意支持 CORS 的 OpenAI 兼容服务均可。部署后打开网页 → 右上角齿轮 → 直连模式 → 填 Base URL / API Key / 模型名（按所用服务填写）。密钥只存本机浏览器 localStorage；公开仓库不要提交任何密钥。

## 目录结构

```
├─ app/                 # 产品本体（部署这个目录）
│  ├─ index.html        # 单页应用
│  ├─ css/style.css     # 全部样式（无外部依赖）
│  ├─ js/
│  │  ├─ appcfg.js      # 全局配置与通用工具
│  │  ├─ data.js        # 菜品数据库(菜单+营养,构建产物)
│  │  ├─ store.js       # 本地存储(档案/日记/评价/自定义菜品)
│  │  ├─ api.js         # AI客户端(重试/流式SSE/视觉路由/JSON容错)
│  │  ├─ charts.js      # 手写Canvas图表(雷达/折线/柱状,零依赖)
│  │  ├─ main.js        # 启动/路由/首页/识菜
│  │  ├─ dine.js        # 点餐推荐引擎
│  │  ├─ rank.js        # 红黑榜+共享评价+评论区
│  │  └─ report.js      # 周报
│  ├─ server.py         # 一体化服务器(静态+AI代理+共享评价)
│  └─ ant_key.txt       # 密钥占位(本地运行前填入,勿提交真实密钥)
├─ tools/               # 数据管线与内部检查脚本(部分硬编码内部路径,仅供参考)
└─ README.md            # 本文件
```

## 安全与数据说明

- 本副本已剥离全部密钥与本地运行数据；`app/_data` 不在仓库中，首次运行自动生成空库
- `app/ant_key.txt` 为占位文件，切勿提交真实密钥；云端部署时该文件随包上传但不通过网页暴露（服务器只开放 API 接口）
- `tools/` 多为内部数据管线与检查脚本，部分硬编码了内部路径，不影响 app 运行

## 重新构建菜品数据库

```bash
python tools/extract_docx.py <手册.docx> tools/menu_raw.txt
python tools/parse_menu.py tools/menu_raw.txt tools/menu_parsed.json
python tools/gen_nutrition.py <蚂蚁APIKey> tools/menu_parsed.json tools/nutri_progress --base=https://maas-api.antdigital.com/v1 --model=deepseek-v4.1-flash-1017
python tools/build_data.py tools/menu_parsed.json tools/nutri_progress app/js/data.js
python tools/verify_nutrition.py tools/nutri_progress   # 锚点校验
```

## 免责与合规

- 菜单为官方手册近期快照，可能与当日实际供应有出入；营养数据为 AI 估算，不构成医疗建议
- 请勿在公开仓库/演示视频中暴露 API Key 与个人身份信息（比赛匿名要求）
- 过敏原数据供参考，实际饮食请以食堂窗口确认为准
