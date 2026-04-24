"""
打印機自動發現模組
支援多種方法動態發現 Brother QL-820NWB 打印機的 IP 地址
"""

import socket
import subprocess
import re
import ipaddress
from typing import List, Dict, Optional
import threading
import time

try:
    from zeroconf import ServiceBrowser, Zeroconf, ServiceInfo
    ZEROCONF_AVAILABLE = True
except ImportError:
    ZEROCONF_AVAILABLE = False
    print("⚠️  zeroconf 未安裝，mDNS 發現功能不可用")

try:
    import netifaces
    NETIFACES_AVAILABLE = True
except ImportError:
    NETIFACES_AVAILABLE = False
    print("⚠️  netifaces 未安裝，網路介面掃描功能受限")


class PrinterDiscovery:
    """打印機發現類"""
    
    def __init__(self):
        self.discovered_printers = []
        self.brother_service_types = [
            '_pdl-datastream._tcp.local.',  # Brother 打印服務
            '_printer._tcp.local.',          # 通用打印服務
            '_ipp._tcp.local.',              # IPP 打印服務
        ]
    
    def get_local_network_range(self) -> List[str]:
        """
        獲取本地網路範圍
        返回所有可能的 IP 範圍列表
        """
        ranges = []
        
        if NETIFACES_AVAILABLE:
            try:
                # 獲取所有網路介面
                interfaces = netifaces.interfaces()
                for interface in interfaces:
                    addrs = netifaces.ifaddresses(interface)
                    if netifaces.AF_INET in addrs:
                        for addr_info in addrs[netifaces.AF_INET]:
                            ip = addr_info.get('addr')
                            netmask = addr_info.get('netmask')
                            if ip and netmask and not ip.startswith('127.'):
                                try:
                                    network = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                                    ranges.append(str(network))
                                except:
                                    pass
            except Exception as e:
                print(f"獲取網路範圍錯誤: {e}")
        
        # 如果無法自動獲取，使用常見的私有 IP 範圍
        if not ranges:
            ranges = [
                '192.168.1.0/24',
                '192.168.0.0/24',
                '10.0.0.0/24',
                '172.16.0.0/24'
            ]
        
        return ranges
    
    def discover_via_mdns(self, timeout=5) -> List[Dict]:
        """
        方法 1: 使用 mDNS/Bonjour 發現打印機
        這是 Brother 打印機最常用的發現方式
        """
        if not ZEROCONF_AVAILABLE:
            return []
        
        discovered = []
        
        class PrinterListener:
            def __init__(self):
                self.printers = []
            
            def add_service(self, zeroconf, service_type, name):
                info = zeroconf.get_service_info(service_type, name)
                if info:
                    # 檢查是否為 Brother 打印機
                    if 'brother' in name.lower() or 'ql' in name.lower():
                        ip = socket.inet_ntoa(info.addresses[0]) if info.addresses else None
                        if ip:
                            self.printers.append({
                                'ip': ip,
                                'name': name,
                                'port': info.port,
                                'method': 'mDNS',
                                'type': service_type
                            })
            
            def remove_service(self, zeroconf, service_type, name):
                pass
            
            def update_service(self, zeroconf, service_type, name):
                pass
        
        try:
            zeroconf = Zeroconf()
            listener = PrinterListener()
            
            # 瀏覽所有 Brother 相關服務
            browsers = []
            for service_type in self.brother_service_types:
                browser = ServiceBrowser(zeroconf, service_type, listener)
                browsers.append(browser)
            
            # 等待發現
            time.sleep(timeout)
            
            # 清理
            for browser in browsers:
                browser.cancel()
            zeroconf.close()
            
            discovered = listener.printers
            print(f"✅ mDNS 發現 {len(discovered)} 個打印機")
            
        except Exception as e:
            print(f"❌ mDNS 發現錯誤: {e}")
        
        return discovered
    
    def discover_via_cups(self) -> List[Dict]:
        """
        方法 2: 透過 CUPS 查詢已安裝的打印機
        適用於 Mac/Linux 系統
        """
        discovered = []
        
        try:
            # 使用 lpstat 命令查詢打印機
            result = subprocess.run(
                ['lpstat', '-p', '-d'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                # 解析打印機信息
                for line in result.stdout.split('\n'):
                    if 'printer' in line.lower() and 'is' in line.lower():
                        # 提取打印機名稱
                        match = re.search(r'printer\s+(\S+)', line, re.IGNORECASE)
                        if match:
                            printer_name = match.group(1)
                            
                            # 嘗試獲取打印機 URI
                            uri_result = subprocess.run(
                                ['lpstat', '-p', printer_name, '-v'],
                                capture_output=True,
                                text=True,
                                timeout=5
                            )
                            
                            if uri_result.returncode == 0:
                                # 從 URI 中提取 IP
                                uri_match = re.search(r'://([0-9.]+)', uri_result.stdout)
                                if uri_match:
                                    ip = uri_match.group(1)
                                    discovered.append({
                                        'ip': ip,
                                        'name': printer_name,
                                        'port': 9100,
                                        'method': 'CUPS',
                                        'uri': uri_result.stdout.strip()
                                    })
            
            if discovered:
                print(f"✅ CUPS 發現 {len(discovered)} 個打印機")
            
        except FileNotFoundError:
            print("⚠️  lpstat 命令未找到（CUPS 未安裝）")
        except Exception as e:
            print(f"❌ CUPS 查詢錯誤: {e}")
        
        return discovered
    
    def check_printer_port(self, ip: str, port: int = 9100, timeout: float = 1.0) -> bool:
        """
        檢查指定 IP 和端口是否為打印機
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except:
            return False
    
    def discover_via_network_scan(self, timeout_per_ip: float = 0.5) -> List[Dict]:
        """
        方法 3: 掃描網路尋找打印機端口（9100, 515, 631）
        這是最通用的方法，但可能較慢
        """
        discovered = []
        printer_ports = [9100, 515, 631]  # 常見的打印端口
        
        network_ranges = self.get_local_network_range()
        
        print(f"🔍 開始掃描網路... (範圍: {len(network_ranges)} 個)")
        
        for network_str in network_ranges:
            try:
                network = ipaddress.IPv4Network(network_str, strict=False)
                print(f"   掃描 {network_str}...")
                
                # 使用多線程加速掃描
                threads = []
                results = []
                
                def scan_ip(ip_str):
                    for port in printer_ports:
                        if self.check_printer_port(ip_str, port, timeout_per_ip):
                            results.append({
                                'ip': ip_str,
                                'port': port,
                                'method': 'Network Scan',
                                'name': f'Printer at {ip_str}'
                            })
                            break  # 找到一個端口就足夠了
                
                # 限制線程數量，避免過載
                for ip in network.hosts():
                    if len(threads) >= 50:  # 最多 50 個並發線程
                        for t in threads:
                            t.join()
                        threads = []
                    
                    t = threading.Thread(target=scan_ip, args=(str(ip),))
                    t.start()
                    threads.append(t)
                
                # 等待所有線程完成
                for t in threads:
                    t.join()
                
            except Exception as e:
                print(f"   掃描 {network_str} 時出錯: {e}")
        
        discovered = results
        if discovered:
            print(f"✅ 網路掃描發現 {len(discovered)} 個可能的打印機")
        
        return discovered
    
    def discover_via_snmp(self) -> List[Dict]:
        """
        方法 4: 使用 SNMP 查詢打印機信息
        需要安裝 python-netsnmp 或 pysnmp
        """
        discovered = []
        
        # 這裡可以實現 SNMP 查詢
        # 需要額外的依賴: pysnmp
        # 暫時跳過，因為需要額外配置
        
        return discovered
    
    def discover_all(self, use_mdns=True, use_cups=True, use_scan=True, scan_timeout=0.5) -> List[Dict]:
        """
        使用所有可用方法發現打印機
        返回去重後的打印機列表
        """
        all_printers = []
        
        print("🔍 開始發現打印機...")
        print("=" * 50)
        
        # 方法 1: mDNS (最快，最準確)
        if use_mdns:
            print("📡 方法 1: mDNS/Bonjour 發現...")
            mdns_printers = self.discover_via_mdns(timeout=5)
            all_printers.extend(mdns_printers)
        
        # 方法 2: CUPS 查詢
        if use_cups:
            print("\n💻 方法 2: CUPS 查詢...")
            cups_printers = self.discover_via_cups()
            all_printers.extend(cups_printers)
        
        # 方法 3: 網路掃描（最慢，但最全面）
        if use_scan:
            print("\n🌐 方法 3: 網路掃描...")
            scan_printers = self.discover_via_network_scan(timeout_per_ip=scan_timeout)
            all_printers.extend(scan_printers)
        
        # 去重（基於 IP）
        unique_printers = {}
        for printer in all_printers:
            ip = printer.get('ip')
            if ip and ip not in unique_printers:
                unique_printers[ip] = printer
        
        result = list(unique_printers.values())
        
        print("\n" + "=" * 50)
        print(f"✅ 總共發現 {len(result)} 個打印機:")
        for i, printer in enumerate(result, 1):
            print(f"   {i}. {printer.get('name', 'Unknown')} - {printer.get('ip')} (方法: {printer.get('method')})")
        
        return result
    
    def find_brother_ql820nwb(self) -> Optional[Dict]:
        """
        專門查找 Brother QL-820NWB 打印機
        """
        all_printers = self.discover_all()
        
        # 優先選擇名稱包含 "QL" 或 "820" 的打印機
        for printer in all_printers:
            name = printer.get('name', '').lower()
            if 'ql' in name or '820' in name or 'brother' in name:
                return printer
        
        # 如果沒找到，返回第一個（可能是，也可能不是）
        return all_printers[0] if all_printers else None


# 便捷函數
def discover_printer_ip() -> Optional[str]:
    """
    快速發現打印機 IP
    返回第一個找到的打印機 IP，或 None
    """
    discovery = PrinterDiscovery()
    printer = discovery.find_brother_ql820nwb()
    return printer.get('ip') if printer else None


def discover_all_printers() -> List[Dict]:
    """
    發現所有打印機
    返回打印機列表
    """
    discovery = PrinterDiscovery()
    return discovery.discover_all()


if __name__ == '__main__':
    # 測試發現功能
    print("🧪 測試打印機發現功能\n")
    
    discovery = PrinterDiscovery()
    printers = discovery.discover_all()
    
    if printers:
        print(f"\n🎉 成功發現 {len(printers)} 個打印機!")
        ql820 = discovery.find_brother_ql820nwb()
        if ql820:
            print(f"\n✅ 找到 Brother QL-820NWB: {ql820['ip']}")
    else:
        print("\n❌ 未發現任何打印機")

