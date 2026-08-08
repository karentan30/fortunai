#!/usr/bin/env node

/**
 * 投放渠道邀请码生成工具 v2
 * 用途: 为投放渠道批量生成唯一的邀请码
 * 使用:
 *   node generate-refcodes.js              (生成100个跨渠道)
 *   node generate-refcodes.js all          (生成5渠道完整配置)
 *   node generate-refcodes.js wechat 50    (生成50个微信专用码)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 渠道配置
const CHANNELS = {
  wechat: {
    name: '微信',
    count: 30,
    prefix: 'WX',
    description: '微信群/朋友圈/私域'
  },
  xiaohongshu: {
    name: '小红书',
    count: 25,
    prefix: 'XHS',
    description: '笔记评论/个人资料'
  },
  tiktok: {
    name: 'TikTok',
    count: 20,
    prefix: 'TK',
    description: '视频评论/直播间'
  },
  youtube: {
    name: 'YouTube',
    count: 10,
    prefix: 'YT',
    description: '视频描述/社区'
  },
  organic: {
    name: '自然流量',
    count: 15,
    prefix: 'ORG',
    description: '搜索/直接访问'
  }
};

function generateRefCode(prefix = '') {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  const buf = crypto.randomBytes(4);

  for (let i = 0; i < 4; i++) {
    code += chars[buf[i] % 36];
  }

  return prefix ? `${prefix}${code}` : code;
}

function generateMultiChannelCodes() {
  const allRefcodes = [];
  const mapping = {};
  let index = 1;

  for (const [channelKey, channelConfig] of Object.entries(CHANNELS)) {
    const channelCodes = [];
    for (let i = 0; i < channelConfig.count; i++) {
      const code = generateRefCode(channelConfig.prefix);
      const refcodeObj = {
        index: index,
        ref_code: code,
        channel: channelKey,
        channel_name: channelConfig.name,
        status: 'active',
        created_at: new Date().toISOString(),
        used_at: '',
        user_count: 0,
        notes: ''
      };
      allRefcodes.push(refcodeObj);
      channelCodes.push(code);
      index++;
    }
    mapping[channelKey] = {
      name: channelConfig.name,
      prefix: channelConfig.prefix,
      codes: channelCodes,
      tracking_url: `https://shenyuan.app?ref={ref_code}&channel=${channelKey}`
    };
  }

  return { allRefcodes, mapping };
}

function generateSingleChannelCodes(channelKey, count) {
  const channelConfig = CHANNELS[channelKey];
  if (!channelConfig) {
    throw new Error(`❌ 未知渠道: ${channelKey}\n可用渠道: ${Object.keys(CHANNELS).join(', ')}`);
  }

  const refcodes = [];
  for (let i = 0; i < count; i++) {
    const code = generateRefCode(channelConfig.prefix);
    refcodes.push({
      index: i + 1,
      ref_code: code,
      channel: channelKey,
      channel_name: channelConfig.name,
      status: 'active',
      created_at: new Date().toISOString(),
      used_at: '',
      user_count: 0,
      notes: ''
    });
  }

  return refcodes;
}

function exportToCSV(refcodes) {
  const headers = ['Index', 'Ref Code', 'Channel', 'Channel Name', 'Status', 'Created At', 'Used At', 'User Count', 'Notes'];
  const rows = refcodes.map(r => [
    r.index,
    r.ref_code,
    r.channel,
    r.channel_name,
    r.status,
    r.created_at,
    r.used_at,
    r.user_count,
    r.notes
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

function exportToJSON(data) {
  return JSON.stringify(data, null, 2);
}

function main() {
  const args = process.argv.slice(2);
  const timestamp = new Date().toISOString().split('T')[0];
  const dataDir = path.join(__dirname, '..', 'data');

  // 确保data目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let refcodes, mapping, filename, mode;

  if (args[0] === 'all') {
    // 生成所有渠道
    console.log('🚀 生成所有渠道的邀请码...\n');
    const result = generateMultiChannelCodes();
    refcodes = result.allRefcodes;
    mapping = result.mapping;
    filename = `refcodes-all-${timestamp}`;
    mode = 'all';
  } else if (args[0] && CHANNELS[args[0]]) {
    // 生成单个渠道
    const channelKey = args[0];
    const count = parseInt(args[1]) || CHANNELS[channelKey].count;
    console.log(`🚀 为 ${CHANNELS[channelKey].name} 生成 ${count} 个邀请码...\n`);
    refcodes = generateSingleChannelCodes(channelKey, count);
    mapping = { [channelKey]: { name: CHANNELS[channelKey].name, codes: refcodes.map(r => r.ref_code) } };
    filename = `refcodes-${channelKey}-${timestamp}`;
    mode = 'single';
  } else {
    // 默认：生成100个跨渠道混合
    console.log('🚀 生成100个跨渠道邀请码...\n');
    const result = generateMultiChannelCodes();
    refcodes = result.allRefcodes;
    mapping = result.mapping;
    filename = `refcodes-${timestamp}`;
    mode = 'mixed';
  }

  // 导出CSV
  const csvContent = exportToCSV(refcodes);
  const csvPath = path.join(dataDir, `${filename}.csv`);
  fs.writeFileSync(csvPath, csvContent);
  console.log(`✅ CSV已生成: data/${path.basename(csvPath)}`);

  // 导出JSON映射
  const jsonContent = exportToJSON(mapping);
  const jsonPath = path.join(dataDir, 'refcode-mapping.json');
  fs.writeFileSync(jsonPath, jsonContent);
  console.log(`✅ 映射表已生成: data/refcode-mapping.json`);

  // 导出可分享格式
  const shareableContent = refcodes.map(r => `${r.ref_code}\t${r.channel_name}`).join('\n');
  const shareablePath = path.join(dataDir, `${filename}.txt`);
  fs.writeFileSync(shareablePath, shareableContent);
  console.log(`✅ 可分享格式: data/${path.basename(shareablePath)}`);

  // 统计信息
  console.log(`\n📊 生成统计:`);
  console.log(`   - 总邀请码: ${refcodes.length}个`);

  if (mode === 'all' || mode === 'mixed') {
    const byChannel = {};
    refcodes.forEach(r => {
      byChannel[r.channel_name] = (byChannel[r.channel_name] || 0) + 1;
    });
    console.log(`   - 渠道分布:`);
    Object.entries(byChannel).forEach(([channel, count]) => {
      console.log(`     • ${channel}: ${count}个`);
    });
  }

  console.log(`\n🎯 前5个邀请码示例:`);
  refcodes.slice(0, 5).forEach(r => {
    console.log(`   ${r.ref_code} (${r.channel_name})`);
  });

  console.log(`\n✨ 投放邀请码生成完成！`);
  console.log(`📝 下一步: 复制CSV到Google Sheets，分配给各渠道负责人`);
  console.log(`🔗 追踪链接: https://shenyuan.app?ref={ref_code}&channel={channel}`);
}

main();
