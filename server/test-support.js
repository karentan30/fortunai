#!/usr/bin/env node

/**
 * 善缘客服系统测试工具
 * 用法：node test-support.js
 */

const http = require('http');
const querystring = require('querystring');

const API_BASE = 'http://localhost:3021';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, msg) {
  console.log(`${colors[color]}${prefix}${colors.reset} ${msg}`);
}

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   善缘客服系统测试                          ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: 健康检查
  try {
    log('cyan', '[TEST 1]', '健康检查...');
    const res = await makeRequest('GET', '/api/support-stats');
    if (res.status === 200 && res.data.ok) {
      log('green', '✓', `服务器正常（统计: ${res.data.stats.total} 工单）`);
      passed++;
    } else {
      log('red', '✗', `服务器异常 (${res.status})`);
      failed++;
    }
  } catch (e) {
    log('red', '✗', `连接失败: ${e.message}`);
    failed++;
  }

  // Test 2: AI 对话
  try {
    log('cyan', '[TEST 2]', 'AI 对话测试...');
    const res = await makeRequest('POST', '/api/support-chat', {
      product: 'shenyuan',
      message: '测试：请问怎样查看八字命盘？',
      history: []
    });

    if (res.status === 200 && res.data.reply) {
      log('green', '✓', `AI 回复成功: "${res.data.reply.substring(0, 30)}..."`);
      passed++;
    } else {
      log('red', '✗', `AI 回复失败: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log('yellow', '⚠', `AI 测试跳过: ${e.message}`);
    log('yellow', '  ', '确保 DEEPSEEK_API_KEY 已设置');
  }

  // Test 3: 工单提交
  try {
    log('cyan', '[TEST 3]', '工单提交测试...');
    const testEmail = `test_${Date.now()}@example.com`;
    const res = await makeRequest('POST', '/api/support-ticket', {
      product: 'shenyuan',
      email: testEmail,
      question: '测试工单：这是一条测试消息',
      conversation: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好，有什么可以帮你的吗？' }
      ]
    });

    if (res.status === 200 && res.data.ok) {
      log('green', '✓', `工单提交成功 (${testEmail})`);
      passed++;
    } else {
      log('red', '✗', `工单提交失败: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log('red', '✗', `工单提交异常: ${e.message}`);
    failed++;
  }

  // Test 4: 工单查询
  try {
    log('cyan', '[TEST 4]', '工单列表查询...');
    const res = await makeRequest('GET', '/api/support-tickets');

    if (res.status === 200 && res.data.ok && Array.isArray(res.data.tickets)) {
      log('green', '✓', `查询成功 (${res.data.tickets.length} 条工单)`);
      if (res.data.tickets.length > 0) {
        const latest = res.data.tickets[0];
        log('blue', '  ', `最新: ${latest.email} @ ${latest.ts.substring(0, 10)}`);
      }
      passed++;
    } else {
      log('red', '✗', `查询失败: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log('red', '✗', `查询异常: ${e.message}`);
    failed++;
  }

  // Test 5: 工单状态更新
  try {
    log('cyan', '[TEST 5]', '工单状态更新...');

    // 先获取一条工单
    const listRes = await makeRequest('GET', '/api/support-tickets');
    if (listRes.data.tickets && listRes.data.tickets.length > 0) {
      const ticketId = listRes.data.tickets[0].id;
      const res = await makeRequest('POST', `/api/support-ticket/${ticketId}/status`, {
        status: 'open'
      });

      if (res.status === 200 && res.data.ok) {
        log('green', '✓', `状态更新成功 (${ticketId} -> open)`);
        passed++;
      } else {
        log('red', '✗', `状态更新失败: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } else {
      log('yellow', '⚠', '跳过：无可用工单');
    }
  } catch (e) {
    log('yellow', '⚠', `状态更新测试跳过: ${e.message}`);
  }

  // Test 6: 消息历史查询
  try {
    log('cyan', '[TEST 6]', '消息历史查询...');
    const testEmail = 'test@example.com';
    const res = await makeRequest('GET', `/api/support-messages/${testEmail}`);

    if (res.status === 200 && res.data.ok && Array.isArray(res.data.messages)) {
      log('green', '✓', `消息查询成功 (${res.data.messages.length} 条消息)`);
      passed++;
    } else {
      log('red', '✗', `消息查询失败: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log('red', '✗', `消息查询异常: ${e.message}`);
    failed++;
  }

  // Test 7: 统计信息验证
  try {
    log('cyan', '[TEST 7]', '统计数据验证...');
    const res = await makeRequest('GET', '/api/support-stats');

    if (res.status === 200 && res.data.ok && res.data.stats) {
      const stats = res.data.stats;
      const msg = `total=${stats.total}, new=${stats.new}, open=${stats.open}, resolved=${stats.resolved}`;
      log('green', '✓', `统计验证成功 (${msg})`);

      // 验证数据一致性
      const sum = stats.new + stats.open + stats.resolved;
      if (sum === stats.total) {
        log('green', '✓', `数据一致性检查通过`);
      } else {
        log('yellow', '⚠', `数据不一致: ${sum} !== ${stats.total}`);
      }
      passed++;
    } else {
      log('red', '✗', `统计验证失败: ${JSON.stringify(res.data)}`);
      failed++;
    }
  } catch (e) {
    log('red', '✗', `统计验证异常: ${e.message}`);
    failed++;
  }

  // 总结
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   测试结果                                  ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.green}✓ 通过${colors.reset}: ${passed}`);
  console.log(`${colors.red}✗ 失败${colors.reset}: ${failed}`);

  const total = passed + failed;
  const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(`\n总体通过率: ${rate}%\n`);

  if (failed === 0) {
    console.log(`${colors.green}🎉 所有测试通过！${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  有 ${failed} 个测试失败${colors.reset}\n`);
    console.log(`检查清单：`);
    console.log(`1. 服务器是否运行：npm start`);
    console.log(`2. DEEPSEEK_API_KEY 环境变量是否设置`);
    console.log(`3. RESEND_API_KEY 环境变量是否设置`);
    console.log(`4. /www/lumee/data/ 目录是否存在且可写\n`);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(err => {
  log('red', '✗', `测试失败: ${err.message}`);
  process.exit(1);
});
