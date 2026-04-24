"""
Brother QL-820NWB Printer Bridge
使用 Flask 建立打印橋接服務，控制 Brother QL-820NWB 標籤打印機
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import socket
import struct
import subprocess
import os
from PIL import Image, ImageDraw, ImageFont
import qrcode
import io
from printer_discovery import PrinterDiscovery, discover_printer_ip

app = Flask(__name__)
CORS(app)  # 允許跨域請求

# 打印機配置 - 嘗試自動發現
_PRINTER_IP = None
PRINTER_PORT = 9100  # Brother 打印機的標準端口

def get_printer_ip():
    """
    獲取打印機 IP，優先使用環境變量，否則自動發現
    """
    global _PRINTER_IP
    
    # 如果已經發現過，直接返回
    if _PRINTER_IP:
        return _PRINTER_IP
    
    # 優先使用環境變量
    env_ip = os.getenv('PRINTER_IP')
    if env_ip:
        _PRINTER_IP = env_ip
        return _PRINTER_IP
    
    # 自動發現
    print("🔍 自動發現打印機 IP...")
    discovered_ip = discover_printer_ip()
    if discovered_ip:
        _PRINTER_IP = discovered_ip
        print(f"✅ 發現打印機: {_PRINTER_IP}")
        return _PRINTER_IP
    
    # 如果都失敗，使用默認值
    _PRINTER_IP = '192.168.1.100'
    print(f"⚠️  使用默認 IP: {_PRINTER_IP}")
    return _PRINTER_IP

# 初始化時獲取 IP
PRINTER_IP = get_printer_ip()

# 標籤尺寸配置（62mm x 100mm）
LABEL_WIDTH_MM = 62
LABEL_HEIGHT_MM = 100
DPI = 300  # 打印解析度
LABEL_WIDTH_PX = int(LABEL_WIDTH_MM * DPI / 25.4)
LABEL_HEIGHT_PX = int(LABEL_HEIGHT_MM * DPI / 25.4)


def create_label_image(name, company, qr_data):
    """
    創建標籤圖像（62mm x 100mm）
    """
    # 創建白色背景
    img = Image.new('RGB', (LABEL_WIDTH_PX, LABEL_HEIGHT_PX), 'white')
    draw = ImageDraw.Draw(img)
    
    # 生成 QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # 調整 QR Code 大小（38mm）
    qr_size_mm = 38
    qr_size_px = int(qr_size_mm * DPI / 25.4)
    qr_img = qr_img.resize((qr_size_px, qr_size_px), Image.Resampling.LANCZOS)
    
    # 計算位置
    qr_x = (LABEL_WIDTH_PX - qr_size_px) // 2
    qr_y = 20  # 距離頂部 20px
    
    # 貼上 QR Code
    img.paste(qr_img, (qr_x, qr_y))
    
    # 添加姓名（22px 字體）
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    except:
        font_large = ImageFont.load_default()
    
    # 添加公司名稱（16px 字體）
    try:
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except:
        font_small = ImageFont.load_default()
    
    # 計算文字位置（在 QR Code 下方）
    text_y = qr_y + qr_size_px + 20
    
    # 繪製姓名（置中）
    name_bbox = draw.textbbox((0, 0), name, font=font_large)
    name_width = name_bbox[2] - name_bbox[0]
    name_x = (LABEL_WIDTH_PX - name_width) // 2
    draw.text((name_x, text_y), name, fill='black', font=font_large)
    
    # 繪製公司名稱（置中）
    company_bbox = draw.textbbox((0, 0), company, font=font_small)
    company_width = company_bbox[2] - company_bbox[0]
    company_x = (LABEL_WIDTH_PX - company_width) // 2
    draw.text((company_x, text_y + 30), company, fill='#666', font=font_small)
    
    return img


def send_to_printer_via_network(image_data, printer_ip, printer_port=9100):
    """
    透過網路發送打印數據到 Brother 打印機
    使用 ESC/P 命令或 P-touch Editor 格式
    """
    try:
        # 轉換圖像為打印機可接受的格式
        # Brother QL 系列使用特殊的打印格式
        # 這裡需要根據 Brother SDK 進行轉換
        
        # 方法 1: 使用 socket 直接連接
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((printer_ip, printer_port))
        
        # 發送打印命令（需要根據 Brother 協議格式）
        # 這裡是簡化版本，實際需要 Brother SDK
        sock.send(image_data)
        sock.close()
        
        return True
    except Exception as e:
        print(f"網路打印錯誤: {e}")
        return False


def send_to_printer_via_cups(image_path, printer_name='QL-820NWB'):
    """
    透過 CUPS (Unix 打印系統) 發送打印任務
    適用於 Mac/Linux
    """
    try:
        # 使用 lpr 命令打印
        subprocess.run([
            'lpr',
            '-P', printer_name,
            '-o', 'media=Custom.62x100mm',
            image_path
        ], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"CUPS 打印錯誤: {e}")
        return False
    except FileNotFoundError:
        print("lpr 命令未找到，請確保已安裝 CUPS")
        return False


@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    current_ip = get_printer_ip()
    return jsonify({
        'status': 'ok',
        'service': 'Printer Bridge',
        'printer_ip': current_ip
    })


@app.route('/discover', methods=['GET'])
def discover_printers():
    """
    發現打印機 API
    返回所有發現的打印機列表
    """
    try:
        discovery = PrinterDiscovery()
        printers = discovery.discover_all()
        
        return jsonify({
            'status': 'success',
            'count': len(printers),
            'printers': printers
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/discover/brother', methods=['GET'])
def discover_brother():
    """
    專門發現 Brother QL-820NWB 打印機
    """
    try:
        discovery = PrinterDiscovery()
        printer = discovery.find_brother_ql820nwb()
        
        if printer:
            # 更新全局 IP
            global _PRINTER_IP
            _PRINTER_IP = printer.get('ip')
            
            return jsonify({
                'status': 'success',
                'printer': printer
            })
        else:
            return jsonify({
                'status': 'not_found',
                'message': '未找到 Brother QL-820NWB 打印機'
            }), 404
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/print', methods=['POST'])
def print_label():
    """
    打印標籤 API
    接收 JSON 格式：
    {
        "name": "用戶姓名",
        "company": "公司名稱",
        "qrcode": "QR Code 數據"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無請求數據'}), 400
        
        name = data.get('name', '')
        company = data.get('company', '')
        qr_data = data.get('qrcode', name)  # 如果沒有提供，使用姓名
        
        if not name:
            return jsonify({'error': '缺少姓名參數'}), 400
        
        # 創建標籤圖像
        label_img = create_label_image(name, company, qr_data)
        
        # 保存為臨時文件
        temp_path = f'/tmp/label_{name.replace(" ", "_")}.png'
        label_img.save(temp_path, 'PNG')
        
        # 方法 1: 嘗試使用 CUPS 打印（Mac/Linux）
        success = send_to_printer_via_cups(temp_path)
        
        # 方法 2: 如果 CUPS 失敗，嘗試網路打印
        if not success:
            with open(temp_path, 'rb') as f:
                image_data = f.read()
            current_ip = get_printer_ip()  # 使用動態獲取的 IP
            success = send_to_printer_via_network(image_data, current_ip)
        
        # 清理臨時文件
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': f'已發送打印任務: {name}',
                'name': name,
                'company': company
            })
        else:
            return jsonify({
                'status': 'error',
                'message': '打印失敗，請檢查打印機連接'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/print/batch', methods=['POST'])
def print_batch():
    """
    批量打印標籤
    接收 JSON 數組格式
    """
    try:
        data = request.get_json()
        
        if not isinstance(data, list):
            return jsonify({'error': '需要數組格式'}), 400
        
        results = []
        for item in data:
            name = item.get('name', '')
            company = item.get('company', '')
            qr_data = item.get('qrcode', name)
            
            if name:
                label_img = create_label_image(name, company, qr_data)
                temp_path = f'/tmp/label_{name.replace(" ", "_")}.png'
                label_img.save(temp_path, 'PNG')
                
                success = send_to_printer_via_cups(temp_path)
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                
                results.append({
                    'name': name,
                    'status': 'success' if success else 'failed'
                })
        
        return jsonify({
            'status': 'completed',
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


if __name__ == '__main__':
    # 從環境變量讀取配置
    port = int(os.getenv('PRINTER_BRIDGE_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # 初始化時獲取打印機 IP
    initial_ip = get_printer_ip()
    
    print(f"🚀 Printer Bridge 啟動中...")
    print(f"📡 監聽端口: {port}")
    print(f"🖨️  打印機 IP: {initial_ip}")
    print(f"📏 標籤尺寸: {LABEL_WIDTH_MM}mm x {LABEL_HEIGHT_MM}mm")
    print(f"\n💡 提示:")
    print(f"   - GET /discover - 發現所有打印機")
    print(f"   - GET /discover/brother - 發現 Brother QL-820NWB")
    print(f"   - POST /print - 打印標籤")
    
    app.run(host='0.0.0.0', port=port, debug=debug)

