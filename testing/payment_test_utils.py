#!/usr/bin/env python3
"""
善缘 - 支付和邀请系统测试工具库

包含以下功能：
  1. Stripe webhook 签名生成和验证
  2. 微信支付 XML 和签名处理
  3. 邀请码生成和批量创建
  4. 返佣计算和验证
  5. 模拟支付流程

用法：
  python3 payment_test_utils.py --help
  python3 payment_test_utils.py stripe-webhook <secret> <payload>
  python3 payment_test_utils.py wechat-sign <secret> <params>
  python3 payment_test_utils.py generate-refcodes <count>
"""

import sys
import json
import hashlib
import hmac
import time
import uuid
import argparse
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import xml.etree.ElementTree as ET
from urllib.parse import urlencode

# ═══════════════════════════════════════════════════════════════
# Stripe Webhook 工具
# ═══════════════════════════════════════════════════════════════

class StripeWebhookSigner:
    """生成和验证 Stripe webhook 签名"""

    @staticmethod
    def generate_signature(payload: str, secret: str) -> str:
        """
        生成 Stripe webhook 签名

        Args:
            payload: 完整的 webhook 请求体（JSON 字符串）
            secret: Stripe webhook 端点密钥

        Returns:
            Stripe-Signature 头值（格式: t=<timestamp>,v1=<hmac>）
        """
        timestamp = str(int(time.time()))
        signed_content = f"{timestamp}.{payload}"

        hmac_sig = hmac.new(
            secret.encode('utf-8'),
            signed_content.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        return f"t={timestamp},v1={hmac_sig}"

    @staticmethod
    def verify_signature(payload: str, signature_header: str, secret: str) -> Tuple[bool, str]:
        """
        验证 Stripe webhook 签名

        Args:
            payload: 完整的 webhook 请求体
            signature_header: Stripe-Signature 头值
            secret: Stripe webhook 端点密钥

        Returns:
            (is_valid, error_message)
        """
        try:
            parts = dict(part.split('=') for part in signature_header.split(','))
            timestamp = parts.get('t')
            v1_sig = parts.get('v1')

            if not timestamp or not v1_sig:
                return False, "缺少时间戳或签名"

            signed_content = f"{timestamp}.{payload}"
            expected_sig = hmac.new(
                secret.encode('utf-8'),
                signed_content.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            # 常数时间比较防止时序攻击
            if hmac.compare_digest(expected_sig, v1_sig):
                return True, "签名有效"
            else:
                return False, "签名不匹配"

        except Exception as e:
            return False, f"验证失败: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# 微信支付工具
# ═══════════════════════════════════════════════════════════════

class WeChatPaymentSigner:
    """微信支付 XML 签名和验证"""

    @staticmethod
    def dict_to_xml(data: Dict) -> str:
        """将字典转换为微信 XML 格式"""
        root = ET.Element('xml')
        for key, value in data.items():
            elem = ET.SubElement(root, key)
            elem.text = str(value)
        return ET.tostring(root, encoding='utf-8').decode('utf-8')

    @staticmethod
    def xml_to_dict(xml_str: str) -> Dict:
        """将微信 XML 解析为字典"""
        try:
            root = ET.fromstring(xml_str)
            result = {}
            for child in root:
                result[child.tag] = child.text
            return result
        except Exception as e:
            return {'error': f'XML 解析失败: {str(e)}'}

    @staticmethod
    def generate_sign(data: Dict, secret: str) -> str:
        """
        生成微信支付签名（MD5）

        Args:
            data: 支付参数字典
            secret: API 密钥

        Returns:
            签名字符串（大写 MD5）
        """
        # 排序 key
        sorted_keys = sorted(data.keys())

        # 构建签名字符串
        sign_parts = []
        for key in sorted_keys:
            if data[key]:  # 忽略空值
                sign_parts.append(f"{key}={data[key]}")

        sign_string = '&'.join(sign_parts) + f"&key={secret}"

        # MD5 签名
        sign = hashlib.md5(sign_string.encode('utf-8')).hexdigest().upper()
        return sign

    @staticmethod
    def verify_sign(data: Dict, provided_sign: str, secret: str) -> bool:
        """验证微信支付签名"""
        expected_sign = WeChatPaymentSigner.generate_sign(data, secret)
        return hmac.compare_digest(expected_sign, provided_sign)

    @staticmethod
    def create_notify_xml(order_no: str, amount: int, transaction_id: str,
                         success: bool = True) -> str:
        """
        创建微信支付回调 XML（用于测试）

        Args:
            order_no: 商户订单号
            amount: 金额（分）
            transaction_id: 微信交易 ID
            success: 是否成功

        Returns:
            XML 字符串
        """
        data = {
            'return_code': 'SUCCESS' if success else 'FAIL',
            'return_msg': 'OK' if success else 'FAIL',
            'result_code': 'SUCCESS' if success else 'FAIL',
            'mch_id': '1234567890',
            'appid': 'wx1234567890abcdef',
            'nonce_str': uuid.uuid4().hex[:8],
            'sign': 'TEST_SIGN',
            'openid': 'oUVf6xxxxxtest',
            'is_subscribe': 'N',
            'trade_type': 'NATIVE',
            'bank_type': 'ICBC_DEBIT',
            'total_fee': amount,
            'cash_fee': amount,
            'transaction_id': transaction_id,
            'out_trade_no': order_no,
            'time_end': datetime.now().strftime('%Y%m%d%H%M%S'),
        }

        return WeChatPaymentSigner.dict_to_xml(data)


# ═══════════════════════════════════════════════════════════════
# 支付宝工具
# ═══════════════════════════════════════════════════════════════

class AlipayPaymentSigner:
    """支付宝支付签名工具"""

    @staticmethod
    def generate_sign(params: Dict, secret: str, use_rsa: bool = False) -> str:
        """
        生成支付宝签名（MD5 或 RSA）

        注意：这是简化版本。生产环境应使用官方 SDK

        Args:
            params: 支付参数
            secret: MD5 密钥或 RSA 私钥
            use_rsa: 是否使用 RSA（默认 MD5）

        Returns:
            签名字符串
        """
        if use_rsa:
            # RSA 需要 PyOpenSSL，这里只演示 MD5
            raise NotImplementedError("RSA 签名需要额外库支持，请使用官方 SDK")

        # MD5 签名
        sorted_keys = sorted(params.keys())
        sign_parts = []
        for key in sorted_keys:
            if params[key]:
                sign_parts.append(f"{key}={params[key]}")

        sign_string = '&'.join(sign_parts) + secret
        sign = hashlib.md5(sign_string.encode('utf-8')).hexdigest().upper()
        return sign

    @staticmethod
    def verify_sign(params: Dict, provided_sign: str, secret: str) -> bool:
        """验证支付宝签名"""
        expected_sign = AlipayPaymentSigner.generate_sign(params, secret)
        return hmac.compare_digest(expected_sign, provided_sign)


# ═══════════════════════════════════════════════════════════════
# 邀请码生成
# ═══════════════════════════════════════════════════════════════

class ReferralCodeGenerator:
    """邀请码生成工具"""

    CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

    @staticmethod
    def generate_refcode() -> str:
        """生成单个 6 位邀请码"""
        import secrets
        return ''.join(secrets.choice(ReferralCodeGenerator.CHARSET) for _ in range(6))

    @staticmethod
    def generate_batch(count: int) -> List[str]:
        """
        生成批量邀请码

        Args:
            count: 生成数量

        Returns:
            邀请码列表
        """
        codes = set()
        max_attempts = count * 10  # 防止无限循环

        attempts = 0
        while len(codes) < count and attempts < max_attempts:
            codes.add(ReferralCodeGenerator.generate_refcode())
            attempts += 1

        return sorted(list(codes))[:count]

    @staticmethod
    def generate_with_prefix(prefix: str, count: int) -> List[str]:
        """生成带前缀的邀请码"""
        codes = []
        for i in range(count):
            suffix = f"{i:04d}"
            codes.append(f"{prefix}{suffix}")
        return codes

    @staticmethod
    def generate_share_urls(ref_codes: List[str], base_url: str) -> List[str]:
        """生成邀请分享链接"""
        return [f"{base_url}/?ref={code}" for code in ref_codes]


# ═══════════════════════════════════════════════════════════════
# 返佣计算
# ═══════════════════════════════════════════════════════════════

class CommissionCalculator:
    """返佣计算工具"""

    @staticmethod
    def calculate_commission(amount_usd: float, commission_rate: float) -> float:
        """
        计算单笔返佣

        Args:
            amount_usd: 订单金额（美元）
            commission_rate: 返佣比例（0.0-1.0）

        Returns:
            返佣金额（保留两位小数）
        """
        commission = amount_usd * commission_rate
        return round(commission, 2)

    @staticmethod
    def calculate_batch_commission(orders: List[Dict]) -> Dict:
        """
        计算批量订单返佣

        Args:
            orders: 订单列表，每个订单需要包含：
                   - amount_usd: 金额
                   - commission_rate: 比例
                   - ref_code: 邀请码（可选，用于统计）

        Returns:
            返佣汇总信息
        """
        total_revenue = 0
        total_commission = 0
        by_affiliate = {}

        for order in orders:
            amount = order.get('amount_usd', 0)
            rate = order.get('commission_rate', 0.15)
            ref_code = order.get('ref_code', 'unknown')

            commission = CommissionCalculator.calculate_commission(amount, rate)

            total_revenue += amount
            total_commission += commission

            if ref_code not in by_affiliate:
                by_affiliate[ref_code] = {
                    'count': 0,
                    'revenue': 0,
                    'commission': 0,
                    'rate': rate
                }

            by_affiliate[ref_code]['count'] += 1
            by_affiliate[ref_code]['revenue'] += amount
            by_affiliate[ref_code]['commission'] += commission

        return {
            'total_orders': len(orders),
            'total_revenue': round(total_revenue, 2),
            'total_commission': round(total_commission, 2),
            'average_commission_rate': round(total_commission / total_revenue, 3) if total_revenue > 0 else 0,
            'by_affiliate': by_affiliate
        }

    @staticmethod
    def verify_commission(order: Dict, expected_commission: float) -> Tuple[bool, str]:
        """
        验证单笔订单的返佣计算是否正确

        Args:
            order: 订单数据
            expected_commission: 预期返佣金额

        Returns:
            (is_correct, message)
        """
        calculated = CommissionCalculator.calculate_commission(
            order.get('amount_usd', 0),
            order.get('commission_rate', 0.15)
        )

        if abs(calculated - expected_commission) < 0.01:  # 允许浮点数误差
            return True, f"✓ 返佣正确: ${calculated} == ${expected_commission}"
        else:
            return False, f"✗ 返佣错误: 计算 ${calculated} 但期望 ${expected_commission}"


# ═══════════════════════════════════════════════════════════════
# 支付模拟器
# ═══════════════════════════════════════════════════════════════

class PaymentSimulator:
    """模拟支付流程"""

    @staticmethod
    def create_test_order(product_id: str, amount_usd: float = None) -> Dict:
        """创建测试订单"""
        from datetime import datetime

        # 产品价格表
        products = {
            'bazi_full': 19.90,
            'bazi_vip': 39.90,
            'member_monthly': 6.90,
            'member_yearly': 49.00,
            'hehun': 19.90,
            'tarot': 3.90,
        }

        price = amount_usd or products.get(product_id, 9.99)

        return {
            'order_no': f"SY-{int(time.time())}-{uuid.uuid4().hex[:8].upper()}",
            'product': product_id,
            'amount_usd': price,
            'created_at': datetime.now().isoformat(),
            'status': 'pending'
        }

    @staticmethod
    def simulate_payment_flow(product_id: str, ref_code: str = None,
                            commission_rate: float = 0.15) -> Dict:
        """
        模拟完整支付流程

        Returns:
            流程中的关键数据
        """
        order = PaymentSimulator.create_test_order(product_id)

        flow = {
            'order': order,
            'ref_code': ref_code,
            'commission_rate': commission_rate,
            'commission': 0,
            'steps': []
        }

        # 步骤 1: 订单创建
        flow['steps'].append({
            'step': 1,
            'action': 'create_order',
            'result': 'success',
            'data': {'order_no': order['order_no'], 'amount': order['amount_usd']}
        })

        # 步骤 2: 追踪邀请码（如果有）
        if ref_code:
            flow['steps'].append({
                'step': 2,
                'action': 'track_affiliate',
                'result': 'success',
                'data': {'ref_code': ref_code}
            })

        # 步骤 3: 发起支付
        flow['steps'].append({
            'step': 3 if not ref_code else 4,
            'action': 'initiate_payment',
            'result': 'success',
            'data': {'method': 'stripe', 'currency': 'usd'}
        })

        # 步骤 4: 支付完成
        flow['steps'].append({
            'step': 4 if not ref_code else 5,
            'action': 'payment_completed',
            'result': 'success',
            'data': {'order_no': order['order_no'], 'status': 'completed'}
        })

        # 步骤 5: 计算返佣（如果有）
        if ref_code:
            commission = CommissionCalculator.calculate_commission(
                order['amount_usd'],
                commission_rate
            )
            flow['commission'] = commission
            flow['steps'].append({
                'step': 6,
                'action': 'calculate_commission',
                'result': 'success',
                'data': {
                    'amount_usd': order['amount_usd'],
                    'rate': commission_rate,
                    'commission': commission
                }
            })

        return flow


# ═══════════════════════════════════════════════════════════════
# CLI 命令
# ═══════════════════════════════════════════════════════════════

def cmd_stripe_webhook(args):
    """生成和验证 Stripe webhook 签名"""
    if args.action == 'generate':
        payload = args.payload or '{"test": "payload"}'
        sig = StripeWebhookSigner.generate_signature(payload, args.secret)
        print(f"Payload: {payload}")
        print(f"Signature: {sig}")
    elif args.action == 'verify':
        payload = args.payload or '{}'
        sig = args.signature
        is_valid, msg = StripeWebhookSigner.verify_signature(payload, sig, args.secret)
        print(f"Valid: {is_valid}")
        print(f"Message: {msg}")

def cmd_wechat_sign(args):
    """生成微信支付签名"""
    try:
        params = json.loads(args.params)
        sign = WeChatPaymentSigner.generate_sign(params, args.secret)
        print(f"Params: {json.dumps(params, indent=2)}")
        print(f"Sign: {sign}")
    except json.JSONDecodeError:
        print("错误: 参数必须是有效的 JSON")
        sys.exit(1)

def cmd_wechat_notify(args):
    """创建微信支付回调 XML"""
    xml = WeChatPaymentSigner.create_notify_xml(
        args.order_no,
        int(args.amount),
        args.transaction_id,
        args.success
    )
    print("Created notification XML:")
    print(xml)

def cmd_generate_refcodes(args):
    """生成邀请码"""
    count = int(args.count)

    if args.prefix:
        codes = ReferralCodeGenerator.generate_with_prefix(args.prefix, count)
    else:
        codes = ReferralCodeGenerator.generate_batch(count)

    print(f"Generated {len(codes)} reference codes:")
    print()

    for i, code in enumerate(codes, 1):
        url = f"{args.base_url}/?ref={code}" if args.base_url else ""
        print(f"{i:3d}. {code}" + (f" → {url}" if url else ""))

    if args.output:
        with open(args.output, 'w') as f:
            for code in codes:
                f.write(f"{code}\n")
        print(f"\nCodes saved to: {args.output}")

def cmd_calculate_commission(args):
    """计算返佣"""
    amount = float(args.amount)
    rate = float(args.rate)

    commission = CommissionCalculator.calculate_commission(amount, rate)
    print(f"Amount: ${amount:.2f}")
    print(f"Commission Rate: {rate*100:.0f}%")
    print(f"Commission: ${commission:.2f}")

def cmd_simulate_payment(args):
    """模拟支付流程"""
    flow = PaymentSimulator.simulate_payment_flow(
        args.product,
        args.ref_code,
        float(args.commission_rate)
    )

    print(json.dumps(flow, indent=2))

def main():
    parser = argparse.ArgumentParser(
        description='善缘支付系统测试工具库',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  # 生成 Stripe webhook 签名
  python3 payment_test_utils.py stripe-webhook generate \\
    --secret whsec_xxxx --payload '{"type":"charge.completed"}'

  # 验证 Stripe 签名
  python3 payment_test_utils.py stripe-webhook verify \\
    --secret whsec_xxxx --signature "t=123,v1=abc" \\
    --payload '{"type":"charge.completed"}'

  # 生成微信支付签名
  python3 payment_test_utils.py wechat-sign \\
    --secret your_wx_secret \\
    --params '{"appid":"wx123","mch_id":"456"}'

  # 生成邀请码
  python3 payment_test_utils.py generate-refcodes 100 \\
    --output refcodes.txt --base-url "https://shenyuan.example.com"

  # 计算返佣
  python3 payment_test_utils.py calculate-commission \\
    --amount 49.00 --rate 0.15

  # 模拟支付流程
  python3 payment_test_utils.py simulate-payment \\
    --product bazi_full --ref-code PROMO01
        '''
    )

    subparsers = parser.add_subparsers(dest='command', help='命令')

    # stripe-webhook
    stripe_parser = subparsers.add_parser('stripe-webhook')
    stripe_parser.add_argument('action', choices=['generate', 'verify'])
    stripe_parser.add_argument('--secret', required=True, help='Webhook 端点密钥')
    stripe_parser.add_argument('--payload', help='JSON payload')
    stripe_parser.add_argument('--signature', help='现有签名（用于验证）')
    stripe_parser.set_defaults(func=cmd_stripe_webhook)

    # wechat-sign
    wechat_parser = subparsers.add_parser('wechat-sign')
    wechat_parser.add_argument('--secret', required=True, help='微信 API 密钥')
    wechat_parser.add_argument('--params', required=True, help='支付参数 JSON')
    wechat_parser.set_defaults(func=cmd_wechat_sign)

    # wechat-notify
    notify_parser = subparsers.add_parser('wechat-notify')
    notify_parser.add_argument('--order-no', required=True)
    notify_parser.add_argument('--amount', required=True, help='金额（分）')
    notify_parser.add_argument('--transaction-id', required=True)
    notify_parser.add_argument('--success', type=bool, default=True)
    notify_parser.set_defaults(func=cmd_wechat_notify)

    # generate-refcodes
    refcode_parser = subparsers.add_parser('generate-refcodes')
    refcode_parser.add_argument('count', type=int, help='生成数量')
    refcode_parser.add_argument('--prefix', help='前缀（例: PROMO）')
    refcode_parser.add_argument('--output', '-o', help='输出文件')
    refcode_parser.add_argument('--base-url', help='邀请链接基础 URL')
    refcode_parser.set_defaults(func=cmd_generate_refcodes)

    # calculate-commission
    commission_parser = subparsers.add_parser('calculate-commission')
    commission_parser.add_argument('--amount', required=True, help='订单金额 USD')
    commission_parser.add_argument('--rate', required=True, help='返佣比例 (0-1)')
    commission_parser.set_defaults(func=cmd_calculate_commission)

    # simulate-payment
    simulate_parser = subparsers.add_parser('simulate-payment')
    simulate_parser.add_argument('--product', required=True)
    simulate_parser.add_argument('--ref-code', help='邀请码')
    simulate_parser.add_argument('--commission-rate', default='0.15')
    simulate_parser.set_defaults(func=cmd_simulate_payment)

    args = parser.parse_args()

    if hasattr(args, 'func'):
        args.func(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
