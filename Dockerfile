# 数据库放大镜 —— 镜像定义
#
# 两阶段：
#   1) build   用 Node 把站点构建出来
#   2) runtime 只保留 Nginx + 静态产物（约 50MB，不含 Node）
#
# 构建：docker build -t db-parser .
# 运行：docker run --rm -p 8080:80 db-parser   然后打开 http://localhost:8080
# 一步到位：docker compose up -d

# ------------------------------- 构建阶段 -------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# 先只拷依赖清单再安装。
# 这一层的缓存因此与源码无关：只要 package-lock.json 没变，
# 改一行组件代码不会触发重新 npm ci（那是整个构建里最慢的一步）。
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 只写 `npm run build` —— package.json 里的 prebuild 钩子会在它之前自动做两件事：
#   1) make-testdata —— 生成 public/sample.sqlite / sample.json。
#      用的是**种子固定的伪随机**（见 scripts/make-testdata.mjs），
#      每次生成的内容完全一致，所以放进镜像构建是安全、可复现的，
#      也让"从零 clone 也能构建出带示例数据的站点"这件事成立。
#   2) sync:wasm —— 把 sql.js 的 wasm 同步到 public/。
RUN npm run build

# ------------------------------- 运行阶段 -------------------------------
FROM nginx:1.27-alpine AS runtime

# 站点配置 + 安全响应头。
# 两个文件都要拷：nginx.conf 里的 include 指向 security-headers.inc。
# 注意用的是 .inc 后缀 —— nginx 会 include conf.d/*.conf，
# 若这个文件叫 .conf 会被当成独立配置再加载一遍，导致响应里出现重复的 CSP 头。
COPY deploy/nginx.conf              /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.inc    /etc/nginx/conf.d/security-headers.inc

COPY --from=build /app/dist /usr/share/nginx/html

# 说明一下这个容器**没有**什么，避免有人照着模板往里加：
#   没有卷     —— 全站无状态，删了容器不丢任何东西（用户数据从来只在浏览器里）
#   没有环境变量 —— 纯静态站点，不存在"环境变量配错导致 500"
#   没有后端    —— 也就没有 SSRF、没有数据库凭据要管
EXPOSE 80

# 健康检查：能取到首页就算健康。
# alpine 自带 BusyBox wget，不用额外装 curl。
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
