# 安全响应头（Nginx 版）—— 供 deploy/nginx.conf 用 include 引入
#
# ⚠️ 这份是 vite.config.ts 里 SECURITY_HEADERS 的**镜像**，两者必须保持一致。
#
#   为什么会有两份：自动化验收（npm run verify:browser）跑的是 vite preview，
#   也就是 vite.config.ts 那份；而线上真正下发头的是 Nginx / CDN，用的是这份。
#   改安全策略时**两处都要改**，改完跑 `npm run verify:browser` 确认没拦坏页面。
#
#   为什么用 .inc 后缀而不是 .conf：
#   nginx 默认会 `include /etc/nginx/conf.d/*.conf`，如果这个文件叫 .conf，
#   它会被当成独立配置再加载一遍 —— 于是 add_header 被注册两次，
#   响应里会出现**重复的 Content-Security-Policy 头**。换个后缀就不会被 glob 命中。
#
# 关于策略本身，两条承载性指令（删了会直接坏掉或失去保护）：
#   * script-src 里的 'wasm-unsafe-eval'
#       sql.js 靠它才能实例化 WebAssembly。删掉 → 整站白屏。
#       （不要顺手"精简"成只剩 'self'，那不是更安全，那是打不开。）
#   * connect-src 'self' + default-src 'none'
#       这才是真正守住「文件零上传」的部分：即使页面被注入脚本，
#       它也没有可用的网络出口把数据发出去。
#       default-src 取 'none' 而不是 'self'，是为了让策略 **fail-closed** ——
#       万一将来有人把某个取数据的指令名拼错（比如 connect-srcs），
#       浏览器会回落到全禁而不是静默放行。这条性质已由 .verify/probe-csp.mjs
#       做过 A/B/C 三组对照验证。
#
# 'unsafe-inline' 说明：script-src 里那条是为 index.html 中防首屏闪白的内联脚本留的。
# 想收紧的话，把那段脚本挪成外部文件、或改用 sha256 hash 再删掉 'unsafe-inline'；
# 但它不影响"零上传"承诺 —— 外发数据靠的是 connect-src / img-src / form-action。

add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=(), usb=()" always;
