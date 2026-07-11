"""Direct test of Aliyun SMS API to capture full error response."""
import sys, os
os.chdir('/app')
sys.path.insert(0, '/app')

from app.shared.config import settings
from app.services.push_service.service import _aliyun_sign, _percent_encode
import urllib.request, urllib.error
import json, uuid
from datetime import datetime, timezone

endpoint = 'dysmsapi.aliyuncs.com'
action = 'SendSms'

params = {
    'PhoneNumbers': '19248998160',
    'SignName': settings.ALIYUN_SMS_SIGN_NAME,
    'TemplateCode': settings.ALIYUN_SMS_TEMPLATE_LOGIN_VERIFY,
    'TemplateParam': json.dumps({'code': '123456'}, ensure_ascii=False),
}

common = {
    'Format': 'JSON',
    'Version': '2017-05-25',
    'AccessKeyId': settings.ALIYUN_SMS_ACCESS_KEY_ID,
    'SignatureMethod': 'HMAC-SHA1',
    'SignatureVersion': '1.0',
    'SignatureNonce': uuid.uuid4().hex,
    'Timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'Action': action,
}
common.update(params)

sorted_items = sorted(common.items(), key=lambda x: x[0])
canonical = '&'.join(f'{_percent_encode(k)}={_percent_encode(v)}' for k, v in sorted_items)
string_to_sign = f'POST&{_percent_encode("/")}&{_percent_encode(canonical)}'
signature = _aliyun_sign('POST', common, settings.ALIYUN_SMS_ACCESS_KEY_SECRET)
common['Signature'] = signature

data = '&'.join(f'{_percent_encode(k)}={_percent_encode(v)}' for k, v in common.items()).encode('utf-8')

print('=== Request Details ===')
print('AccessKeyId:', settings.ALIYUN_SMS_ACCESS_KEY_ID[:8] + '...')
print('SignName:', settings.ALIYUN_SMS_SIGN_NAME)
print('TemplateCode:', settings.ALIYUN_SMS_TEMPLATE_LOGIN_VERIFY)
print('Phone:', '19248998160')

try:
    req = urllib.request.Request(
        f'https://{endpoint}',
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        print('\n=== Success Response ===')
        print(json.dumps(result, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8')
    print('\n=== HTTP Error ===')
    print('Status:', e.code)
    print('Body:', body)
    try:
        err_json = json.loads(body)
        print('\nCode:', err_json.get('Code'))
        print('Message:', err_json.get('Message'))
        print('Recommend:', err_json.get('Recommend', ''))
    except:
        pass
except Exception as e:
    print('\n=== Exception ===')
    print(type(e).__name__, ':', str(e))
