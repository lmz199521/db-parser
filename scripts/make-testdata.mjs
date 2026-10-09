/**
 * 生成示例数据库（public/sample.sqlite）
 *
 * 为什么要专门造数据：
 * 示例库必须覆盖工具的所有卖点，否则演示不出效果。这里刻意设计成：
 *   - 有主外键关系（users ← orders ← order_items → products）
 *   - 有 4 个 JSON 字段，且嵌套层级不同（对象套对象、对象套数组、数组套对象）
 *   - 有一张日志表行数较多，用来验证大表下的渲染与抽样统计
 *   - 有一个视图，用来验证视图分支
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** 可复现的伪随机（线性同余），保证每次生成的示例数据一致 */
let seed = 20261008;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const CITIES = ['深圳市', '广州市', '杭州市', '成都市', '南京市', '武汉市', '西安市', '长沙市'];
const DISTRICTS = ['南山区', '福田区', '西湖区', '武侯区', '江宁区', '洪山区', '雁塔区', '岳麓区'];
const CATEGORIES = ['数码', '家电', '服饰', '食品', '图书', '运动', '美妆', '家居'];
const PRODUCT_WORDS = [
  '无线降噪耳机', '便携充电宝', '机械键盘', '人体工学椅', '空气炸锅', '扫地机器人',
  '纯棉短袖', '轻量跑鞋', '冷萃咖啡液', '坚果礼盒', '技术管理手册', '瑜伽垫',
  '氨基酸洁面', '护眼台灯', '收纳箱', '保温杯', '蓝牙音箱', '显示器支架',
  '桌面收纳架', '露营天幕', '智能手环', '电动牙刷', '棉麻抱枕', '厨房刀具套装',
];
const ORDER_STATUS = ['待付款', '已付款', '已发货', '已签收', '已取消', '退款中'];
const LOG_LEVELS = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
const LOG_PATHS = ['/api/order/create', '/api/product/list', '/api/user/profile', '/api/pay/callback', '/api/cart/update'];
const UA_LIST = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Linux; Android 15; PJD110) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0',
];

function pad(n) {
  return String(n).padStart(2, '0');
}
/** 生成一个形如 2026-03-14 09:23:41 的时间戳字符串 */
function ts(daysBack) {
  const base = Date.UTC(2026, 8, 20, 12, 0, 0) - daysBack * 86400000;
  const d = new Date(base + int(0, 86399) * 1000);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(root, 'node_modules/sql.js/dist', file),
  });
  const db = new SQL.Database();

  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    VARCHAR(32)  NOT NULL UNIQUE,
      nickname    VARCHAR(32),
      email       VARCHAR(120),
      phone       VARCHAR(20),
      level       INTEGER      NOT NULL DEFAULT 1,
      is_active   BOOLEAN      NOT NULL DEFAULT 1,
      created_at  DATETIME     NOT NULL,
      profile     JSON
    );

    CREATE TABLE products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sku         VARCHAR(32)   NOT NULL UNIQUE,
      title       VARCHAR(120)  NOT NULL,
      category    VARCHAR(20)   NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      stock       INTEGER       NOT NULL DEFAULT 0,
      rating      REAL          DEFAULT 5.0,
      tags        JSON,
      created_at  DATETIME      NOT NULL
    );

    CREATE TABLE orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no     VARCHAR(32)   NOT NULL UNIQUE,
      user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       VARCHAR(20)   NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      paid         BOOLEAN       NOT NULL DEFAULT 0,
      items        JSON,
      created_at   DATETIME      NOT NULL
    );

    CREATE TABLE order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity   INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL
    );

    CREATE TABLE app_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      level      VARCHAR(10) NOT NULL,
      message    TEXT        NOT NULL,
      context    JSON,
      created_at DATETIME    NOT NULL
    );

    CREATE INDEX idx_orders_user      ON orders (user_id);
    CREATE INDEX idx_orders_status    ON orders (status, created_at);
    CREATE INDEX idx_items_order      ON order_items (order_id);
    CREATE INDEX idx_items_product    ON order_items (product_id);
    CREATE INDEX idx_logs_level       ON app_logs (level, created_at);
  `);

  /* --------------------------- users --------------------------- */
  const users = [];
  for (let i = 1; i <= 14; i += 1) {
    const username = `user${pad(i)}`;
    const city = pick(CITIES);
    const profile = {
      nickname: `用户${i}号`,
      avatar: `https://cdn.example.com/avatar/${i}.png`,
      tags: [pick(['新客', '老客', '高价值']), pick(['活跃', '沉睡', '流失预警'])],
      prefs: {
        language: pick(['zh-CN', 'en-US']),
        theme: pick(['light', 'dark']),
        notify: { email: rnd() > 0.4, sms: rnd() > 0.6, push: true },
      },
      address: {
        city,
        district: pick(DISTRICTS),
        detail: `${int(1, 200)}号${int(1, 30)}栋${int(1, 25)}0${int(1, 9)}室`,
        geo: [Number((114 + rnd() * 8).toFixed(4)), Number((22 + rnd() * 10).toFixed(4))],
      },
      registerSource: pick(['app-android', 'app-ios', 'web', 'mini-program']),
    };
    users.push({ username, profile, createdAt: ts(int(30, 700)) });
  }
  const insertUser = db.prepare(
    `INSERT INTO users (username, nickname, email, phone, level, is_active, created_at, profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  users.forEach((u, i) => {
    insertUser.run([
      u.username,
      u.profile.nickname,
      `${u.username}@example.com`,
      `1${pick(['3', '5', '7', '8', '9'])}${String(int(100000000, 999999999))}`.slice(0, 11),
      int(1, 6),
      rnd() > 0.15 ? 1 : 0,
      u.createdAt,
      JSON.stringify(u.profile),
    ]);
    void i;
  });
  insertUser.free();

  /* -------------------------- products ------------------------- */
  const products = [];
  PRODUCT_WORDS.forEach((title, i) => {
    const tags = {
      category: pick(CATEGORIES),
      labels: [pick(['热销', '新品', '清仓', '限时']), pick(['包邮', '次日达', '7天无理由'])],
      attributes: {
        color: pick(['曜石黑', '月光白', '雾霾蓝', '奶油杏']),
        weight_g: int(80, 3200),
      },
      salesHistory: Array.from({ length: int(2, 4) }, () => ({
        month: `${int(1, 12)}月`,
        sold: int(20, 900),
      })),
    };
    products.push({ title, tags, sku: `SKU-${1000 + i}` });
  });
  const insertProduct = db.prepare(
    `INSERT INTO products (sku, title, category, price, stock, rating, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  products.forEach((p, i) => {
    insertProduct.run([
      p.sku,
      `${p.title} ${i % 3 === 0 ? 'Pro' : ''}`.trim(),
      p.tags.category,
      Number((rnd() * 1900 + 19).toFixed(2)),
      int(0, 800),
      Number((3.5 + rnd() * 1.5).toFixed(1)),
      JSON.stringify(p.tags),
      ts(int(10, 500)),
    ]);
  });
  insertProduct.free();

  /* --------------------------- orders -------------------------- */
  const insertOrder = db.prepare(
    `INSERT INTO orders (order_no, user_id, status, total_amount, paid, items, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
  );

  const ORDER_COUNT = 80;
  for (let i = 1; i <= ORDER_COUNT; i += 1) {
    const userId = int(1, users.length);
    const status = pick(ORDER_STATUS);
    const lineCount = int(1, 4);
    const items = [];
    let total = 0;

    for (let k = 0; k < lineCount; k += 1) {
      const productId = int(1, products.length);
      const quantity = int(1, 5);
      const basePrice = Number((rnd() * 900 + 29).toFixed(2));
      total += basePrice * quantity;
      items.push({
        productId,
        title: products[productId - 1].title,
        quantity,
        unitPrice: basePrice,
        discount: {
          type: pick(['无', '满减', '优惠券']),
          amount: Number((rnd() * 30).toFixed(2)),
        },
      });
    }

    const orderNo = `SO${202600000 + i}`;
    const createdAt = ts(int(0, 120));
    insertOrder.run([
      orderNo,
      userId,
      status,
      Number(total.toFixed(2)),
      status === '待付款' || status === '已取消' ? 0 : 1,
      JSON.stringify({
        orderNo,
        channel: pick(['app', 'web', 'mini-program']),
        address: { city: pick(CITIES), district: pick(DISTRICTS) },
        lines: items,
      }),
      createdAt,
    ]);

    const orderId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
    for (const it of items) {
      insertItem.run([orderId, it.productId, it.quantity, it.unitPrice]);
    }
  }
  insertOrder.free();
  insertItem.free();

  /* -------------------------- app_logs ------------------------- */
  const insertLog = db.prepare(
    `INSERT INTO app_logs (level, message, context, created_at) VALUES (?, ?, ?, ?)`,
  );
  const LOG_MESSAGES = [
    '订单创建成功',
    '库存不足，下单被拒绝',
    '支付回调验签失败',
    '用户登录成功',
    '商品缓存已刷新',
    '第三方接口超时重试',
    '优惠券核销成功',
    '数据库慢查询告警',
  ];
  for (let i = 0; i < 600; i += 1) {
    const level = pick(LOG_LEVELS);
    const path = pick(LOG_PATHS);
    insertLog.run([
      level,
      pick(LOG_MESSAGES),
      JSON.stringify({
        requestId: `req-${int(100000, 999999)}`,
        ip: `${int(10, 220)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
        userAgent: pick(UA_LIST),
        path,
        durationMs: int(3, 2400),
        params: { page: int(1, 30), size: pick([10, 20, 50]), sort: pick(['created_at', 'price']) },
        trace: [{ step: 'auth', ok: true }, { step: 'db', ok: level !== 'ERROR', retries: int(0, 3) }],
      }),
      ts(int(0, 30)),
    ]);
  }
  insertLog.free();

  /* --------------------------- 视图 --------------------------- */
  db.run(`
    CREATE VIEW v_order_summary AS
    SELECT o.order_no,
           u.username,
           u.level AS user_level,
           o.status,
           o.total_amount,
           o.paid,
           COUNT(oi.id) AS line_count,
           o.created_at
      FROM orders o
      JOIN users u        ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY o.id
     ORDER BY o.created_at DESC;
  `);

  const bytes = db.export();
  db.close();

  await mkdir(resolve(root, 'public'), { recursive: true });
  await writeFile(resolve(root, 'public/sample.sqlite'), Buffer.from(bytes));
  console.log(`[make-testdata] sample.sqlite 已生成，${(bytes.byteLength / 1024).toFixed(1)} KB`);

  /* ------- 顺便生成一份 JSON 样例，供后续「上传文件解析」功能使用 ------- */
  const sampleJson = {
    meta: { generator: 'db-parser', version: '0.1.0', generatedAt: new Date().toISOString() },
    dataset: {
      name: '电商订单快照',
      recordCount: ORDER_COUNT,
      fields: [
        { name: 'order_no', type: 'string', required: true },
        { name: 'total_amount', type: 'number', required: true },
        { name: 'status', type: 'enum', values: ORDER_STATUS },
      ],
    },
    samples: Array.from({ length: 6 }, (_, i) => ({
      orderNo: `SO${202600000 + i + 1}`,
      user: { id: int(1, 14), username: `user${pad(int(1, 14))}` },
      amount: Number((rnd() * 1500 + 29).toFixed(2)),
      status: pick(ORDER_STATUS),
      lines: Array.from({ length: int(1, 3) }, () => ({
        sku: `SKU-${int(1000, 1023)}`,
        qty: int(1, 4),
        price: Number((rnd() * 800 + 29).toFixed(2)),
      })),
      flags: { refundable: rnd() > 0.7, invoiceNeeded: rnd() > 0.5 },
    })),
  };
  await writeFile(
    resolve(root, 'public/sample.json'),
    JSON.stringify(sampleJson, null, 2),
    'utf8',
  );
  console.log('[make-testdata] sample.json 已生成');
}

main().catch((err) => {
  console.error('[make-testdata] 失败：', err);
  process.exit(1);
});
