'use strict';
/**
 * routes/events.js — 漏斗埋点
 * POST /api/ev              — 前端事件（sendBeacon，公开，白名单）
 * GET  /api/kpi/funnel      — 漏斗汇总（ADMIN_TOKEN）
 *
 * 为什么单独落 NDJSON 而不进 data.json：data.json 每次 _persist 整份重写，
 * 事件量一上来会拖慢所有写入；按月分文件、只追加，汇总时流式读。
 */

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EV_DIR = process.env.EVENTS_DIR || path.join(path.dirname(process.env.DATA_FILE || path.join(__dirname, '../data.json')), 'events');
try { fs.mkdirSync(EV_DIR, { recursive: true }); } catch (e) {}

// 漏斗顺序即展示顺序
const FUNNEL = ['landing_view', 'collect_view', 'collect_submit', 'pick_view', 'method_pick', 'report_view',
  'free_done', 'paywall_view', 'checkout_click', 'checkout_created', 'paid', 'claim_ok'];
const EXTRA = ['daily_optin', 'invite_create', 'invite_open', 'invite_done', 'share_click', 'magic_sent', 'magic_ok'];
// 相生单校区试点漏斗。成功标准是双方接受与再次联系，不是访问/测算次数。
// 前端只能发 landing/cta/share；注册及之后的步骤只能由服务端（friends-campus.js）写入。
const XS_FUNNEL = ['xs_landing_view', 'xs_cta_click', 'xs_register', 'xs_profile_done', 'xs_request_sent', 'xs_mutual_accept', 'xs_second_contact'];
const XS_EXTRA = ['xs_share_create', 'xs_met_reported'];
const XS_SERVER_ONLY = new Set(['xs_register', 'xs_profile_done', 'xs_request_sent', 'xs_mutual_accept', 'xs_second_contact', 'xs_met_reported']);
const XS_BY = ['src', 'camp', 'club', 'cp', 'ref'];
const VALID = new Set(FUNNEL.concat(EXTRA, XS_FUNNEL, XS_EXTRA));

const clip = (v, n) => (v === undefined || v === null) ? '' : String(v).slice(0, n);
const ipHash = (req) => crypto.createHash('sha256').update(String(req.ip || '') + (process.env.ADMIN_TOKEN || 'sy')).digest('hex').slice(0, 8);

function _file(d) { return path.join(EV_DIR, 'events-' + d.toISOString().slice(0, 7) + '.ndjson'); }

// 服务端也用（checkout_created / paid / claim_ok）
function logEvent(ev) {
  try {
    const row = {
      ts: new Date().toISOString(),
      e: clip(ev.e, 32), m: clip(ev.m, 32), lang: clip(ev.lang, 8), sid: clip(ev.sid, 48),
      src: clip(ev.src, 48), camp: clip(ev.camp, 64), ref: clip(ev.ref, 48), p: clip(ev.p, 80),
      v: clip(ev.v, 48), ih: clip(ev.ih, 8),
      club: clip(ev.club, 24), cp: clip(ev.cp, 24), x: ev.x === 'test' ? 'test' : '',
    };
    if (!VALID.has(row.e)) return false;
    fs.appendFile(_file(new Date()), JSON.stringify(row) + '\n', () => {});
    return true;
  } catch (e) { return false; }
}

// sendBeacon 发的是 text/plain；express.json 不解析，自己兜一下
function _body(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) {} }
  return {};
}

router.post('/ev', require('express').text({ type: 'text/plain', limit: '4kb' }), (req, res) => {
  const b = _body(req);
  // 服务端专属步骤（注册、资料完成、申请、双方接受、再次联系）不接受浏览器上报，也不让前端自标测试数据
  if (XS_SERVER_ONLY.has(b && b.e)) return res.status(400).end();
  const ok = logEvent({ ...b, x: '', ih: ipHash(req) });
  res.status(ok ? 204 : 400).end();
});

function _readRange(sinceMs) {
  const rows = [];
  let files = [];
  try { files = fs.readdirSync(EV_DIR).filter(f => /^events-\d{4}-\d{2}\.ndjson$/.test(f)).sort(); } catch (e) {}
  const sinceMonth = new Date(sinceMs).toISOString().slice(0, 7);
  files.filter(f => f.slice(7, 14) >= sinceMonth).forEach(f => {
    const txt = fs.readFileSync(path.join(EV_DIR, f), 'utf8');
    txt.split('\n').forEach(line => {
      if (!line) return;
      try { const r = JSON.parse(line); if (Date.parse(r.ts) >= sinceMs) rows.push(r); } catch (e) {}
    });
  });
  return rows;
}

// 每步去重人数（sid 优先，缺 sid 用 ip 哈希兜底）
function funnel(rows, groupBy) {
  const groups = {};
  rows.forEach(r => {
    const g = groupBy ? (r[groupBy] || '(none)') : 'all';
    const who = r.sid || ('ip:' + r.ih);
    groups[g] = groups[g] || {};
    (groups[g][r.e] = groups[g][r.e] || new Set()).add(who);
  });
  const out = {};
  Object.keys(groups).forEach(g => {
    const steps = FUNNEL.concat(EXTRA).map(e => ({ e, n: groups[g][e] ? groups[g][e].size : 0 }));
    out[g] = steps;
  });
  return out;
}

// 相生校园漏斗：每步按人去重（服务端事件的 sid 是 HMAC 匿名键）；双方接受/再次联系另给去重“对数”。
// 默认剔除测试账号（FRIENDS_KPI_TEST_IDS 标记的 x=test 行）。
function campusFunnel(rows, groupBy, { includeTest = false } = {}) {
  const by = XS_BY.includes(groupBy) ? groupBy : 'src';
  const steps = XS_FUNNEL.concat(XS_EXTRA);
  const groups = {};
  let excludedTest = 0;
  rows.forEach(r => {
    if (steps.indexOf(r.e) < 0) return;
    if (r.x === 'test' && !includeTest) { excludedTest++; return; }
    const g = r[by] || '(unknown)';
    const who = r.sid || ('ip:' + r.ih);
    const grp = groups[g] = groups[g] || { people: {}, pairs: {} };
    (grp.people[r.e] = grp.people[r.e] || new Set()).add(who);
    if (r.v && /^p[0-9a-f]{15}$/.test(r.v)) (grp.pairs[r.e] = grp.pairs[r.e] || new Set()).add(r.v);
  });
  const out = {};
  Object.keys(groups).forEach(g => {
    out[g] = steps.map(e => ({ e, n: groups[g].people[e] ? groups[g].people[e].size : 0, pairs: groups[g].pairs[e] ? groups[g].pairs[e].size : 0 }));
  });
  return { by, excludedTest, order: XS_FUNNEL, extra: XS_EXTRA, groups: out };
}

router.get('/kpi/funnel', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const provided = req.headers['x-admin-token'] || '';
  if (!adminToken || provided !== adminToken) return res.status(401).json({ error: 'unauthorized' });
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
  const by = ['lang', 'src', 'm', 'ref'].includes(req.query.by) ? req.query.by : '';
  const rows = _readRange(Date.now() - days * 864e5);
  const campus = campusFunnel(rows, req.query.campusBy, { includeTest: req.query.includeTest === '1' });
  res.json({ days, by: by || null, funnelOrder: FUNNEL, total: rows.length, groups: funnel(rows, by), campus });
});

module.exports = { router, logEvent, funnel, campusFunnel, FUNNEL, XS_FUNNEL, XS_SERVER_ONLY };
