#!/usr/bin/env node

/**
 * 邀请码生成工具
 * 用途: 为投放渠道批量生成唯一的邀请码
 * 使用: node generate-refcodes.js [数量] [前缀]
 * 例子: node generate-refcodes.js 100 wechat
 */

const fs = require('fs');
const crypto = require('crypto');

function generateRefCode(prefix = '') {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  const buf = crypto.randomBytes(4);

  for (let i = 0; i < 4; i++) {
    code += chars[buf[i] % 36];
  }

  return prefix ? `${prefix}_${code}` : code;
}

function main() {
  const count = parseInt(process.argv[2]) || 100;
  const prefix = process.argv[3] || '';
  const timestamp = new Date().toISOString().split('T')[0];

  const refcodes = [];
  const seen = new Set();

  console.log(`📌 生成 ${count} 个邀请码...`);

  while (refcodes.length < count) {
    const code = generateRefCode(prefix);
    if (!seen.has(code)) {
      seen.add(code);
      refcodes.push({
        code: code,
        channel: prefix || 'default',
        created_at: new Date().toISOString(),
        status: 'unused',
        used_by: null,
        converted_at: null
      });
    }
  }

  // 输出CSV格式
  const csv = [
    ['邀请码', '渠道', '创建时间', '状态', '使用人', '转化时间'],
    ...refcodes.map(r => [
      r.code,
      r.channel,
      r.created_at,
      r.status,
      r.used_by || '',
      r.converted_at || ''
    ])
  ]
    .map(row => row.map(col => `"${col}"`).join(','))
    .join('\n');

  // 输出JSON格式
  const json = JSON.stringify({
    generated_at: new Date().toISOString(),
    total: count,
    prefix: prefix,
    refcodes: refcodes
  }, null, 2);

  // 保存文件
  const csvFile = `refcodes_${prefix}_${timestamp}.csv`;
  const jsonFile = `refcodes_${prefix}_${timestamp}.json`;

  fs.writeFileSync(csvFile, csv);
  fs.writeFileSync(jsonFile, json);

  console.log(`✅ 生成完成`);
  console.log(`📄 CSV: ${csvFile}`);
  console.log(`📄 JSON: ${jsonFile}`);
  console.log(`\n🎯 前5个邀请码示例:`);
  refcodes.slice(0, 5).forEach(r => {
    console.log(`   ${r.code}`);
  });

  // 复制到剪贴板友好的格式
  const shareable = refcodes.map(r => r.code).join('\n');
  fs.writeFileSync(`refcodes_${prefix}_${timestamp}.txt`, shareable);
  console.log(`\n💾 可分享格式: refcodes_${prefix}_${timestamp}.txt`);
}

main();
