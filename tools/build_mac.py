# -*- coding: utf-8 -*-
"""build_mac.py — ประกอบ "Killian 2.app" สำหรับ macOS จากรันไทม์ Electron ทางการ

**ทำไมต้องเป็น zip → zip (ไม่แตกไฟล์)**
Electron.app มี symlink 14 จุด (Frameworks/*/Versions/Current …) และไฟล์ที่ต้องมีบิต
execute (Contents/MacOS/…) — Windows เก็บสองอย่างนี้ไม่ได้ ถ้าแตกไฟล์ลงดิสก์แล้วซิปกลับ
จะได้ .app ที่ macOS เปิดไม่ขึ้น (symlink กลายเป็นไฟล์ธรรมดา · ไบนารีไม่มีสิทธิ์รัน)

สคริปต์นี้จึงอ่านทีละ entry จากซิปต้นทางแล้วเขียนลงซิปปลายทางตรง ๆ พร้อม
คัดลอก `external_attr` (โหมด unix + ธง symlink) และ `create_system` มาทั้งดุ้น
→ ประกอบบน Windows/Linux ได้ผลเหมือนประกอบบน macOS

วิธีใช้:
    python tools/build_mac.py <electron-vX-darwin-x64.zip> <ปลายทาง.zip>
"""
import io
import json
import os
import stat
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APP_OLD = 'Electron.app'
APP_NEW = 'Killian 2.app'
EXE_NEW = 'Killian2'
BUNDLE_ID = 'com.topgraphix.killian2'
APP_NAME = 'Killian 2'

# ไฟล์/โฟลเดอร์ที่ต้องอยู่ใน Contents/Resources/app/ (ชุดเดียวกับ resources/app ของฝั่ง Windows)
APP_FILES = ['main.js', 'preload.js', 'package.json']
APP_DIRS = ['renderer', 'src', 'languages']
SKIP_DIR_NAMES = {'node_modules', '.git', '__pycache__'}


def app_version():
    with io.open(os.path.join(ROOT, 'package.json'), encoding='utf-8') as f:
        return json.load(f)['version']


def patch_plist(raw, version):
    """แก้ Info.plist ของ Electron ให้เป็นของ Killian 2

    ทำแบบแทนที่ข้อความตรง ๆ (plist เป็น XML ที่เรียงคีย์แน่นอน) — ไม่ต้องพึ่ง plistlib
    ที่จะเขียนไฟล์ใหม่ทั้งก้อนแล้วสลับลำดับคีย์จนต่างจากต้นฉบับโดยไม่จำเป็น
    """
    s = raw.decode('utf-8')

    def setkey(key, value):
        nonlocal s
        old = '<key>%s</key>\n\t<string>' % key
        i = s.find(old)
        if i < 0:
            raise SystemExit('ไม่พบคีย์ %s ใน Info.plist' % key)
        j = s.index('</string>', i)
        s = s[:i + len(old)] + value + s[j:]

    setkey('CFBundleDisplayName', APP_NAME)
    setkey('CFBundleName', APP_NAME)
    setkey('CFBundleExecutable', EXE_NEW)
    setkey('CFBundleIdentifier', BUNDLE_ID)
    setkey('CFBundleShortVersionString', version)
    setkey('CFBundleVersion', version)

    # ElectronAsarIntegrity ชี้ไปที่ Resources/default_app.asar ซึ่งเราลบทิ้ง
    # ปล่อยไว้ = Electron เช็ค integrity ของไฟล์ที่ไม่มีอยู่แล้วไม่ยอมเปิด
    i = s.find('<key>ElectronAsarIntegrity</key>')
    if i >= 0:
        j = s.index('</dict>', s.index('<dict>', i))
        j = s.index('</dict>', j + 1)          # ปิด dict ชั้นนอกของคีย์นี้
        s = s[:i] + s[j + len('</dict>') + 1:]
    return s.encode('utf-8')


HOWTO = u"""วิธีเปิด Killian 2 บน macOS (Intel / x86_64)
=============================================

โปรแกรมนี้ประกอบนอกเครื่อง Mac จึง **ไม่มีลายเซ็นของ Apple**
macOS จะไม่ยอมเปิดให้ทันที ต้องปลดล็อกครั้งเดียวก่อน (หลังจากนั้นเปิดได้ปกติตลอด)

1) แตกไฟล์ zip แล้วลาก "Killian 2.app" ไปไว้ในโฟลเดอร์ Applications
2) เปิด Terminal แล้วพิมพ์ 2 บรรทัดนี้ (ทีละบรรทัด):

   xattr -cr "/Applications/Killian 2.app"
   codesign --force --deep --sign - "/Applications/Killian 2.app"

3) ดับเบิลคลิกเปิดได้เลย

ถ้ายังขึ้นว่า "ไม่สามารถเปิดได้เพราะมาจากผู้พัฒนาที่ไม่ระบุตัวตน"
ให้คลิกขวาที่ไอคอนแอป → Open → กด Open ในกล่องที่เด้งขึ้นมา (ครั้งเดียวพอ)

ข้อกำหนด
--------
- macOS 12 (Monterey) ขึ้นไป — Electron 43 ไม่รองรับรุ่นเก่ากว่านี้
- เครื่อง Intel (x86_64) · ถ้าเป็น Apple Silicon (M1/M2/M3/M4) ไฟล์นี้ยังรันได้ผ่าน
  Rosetta 2 แต่ควรใช้รุ่น arm64 จะเร็วกว่า

ไฟล์งานของคุณ
------------
Killian 2 เก็บงานเป็น .md + .json ในโฟลเดอร์โปรเจกต์ที่คุณเลือกเอง
ย้ายข้ามเครื่อง Windows/Mac ได้ตรง ๆ และเปิดด้วย Killian v1 ได้เหมือนเดิม
"""


def add_file(zout, arcname, data, mode=0o644):
    zi = zipfile.ZipInfo(arcname)
    zi.create_system = 3                       # unix — ไม่งั้น external_attr ถูกอ่านเป็นแอตทริบิวต์ DOS
    zi.external_attr = (mode & 0xFFFF) << 16
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.date_time = (2025, 1, 1, 0, 0, 0)       # เวลาคงที่ = ซิปเดิมได้ผลเดิม (reproducible)
    zout.writestr(zi, data)


def walk_files(base):
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in sorted(dirnames) if d not in SKIP_DIR_NAMES]
        for f in sorted(filenames):
            yield os.path.join(dirpath, f)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src_zip, out_zip = sys.argv[1], sys.argv[2]
    version = app_version()
    res_app = '%s/Contents/Resources/app/' % APP_NEW
    n_sym = n_exec = n_app = 0

    with zipfile.ZipFile(src_zip) as zin, \
            zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
        for zi in zin.infolist():
            name = zi.filename
            if name.startswith(APP_OLD + '/Contents/Resources/default_app.asar'):
                continue                        # ใช้โฟลเดอร์ app/ ของเราแทน
            if not name.startswith(APP_OLD + '/'):
                if name in ('LICENSE', 'LICENSES.chromium.html'):
                    add_file(zout, name, zin.read(zi))
                continue                        # ทิ้ง version ฯลฯ ที่ไม่ใช่ตัวแอป

            new = APP_NEW + name[len(APP_OLD):]
            if name == APP_OLD + '/Contents/MacOS/Electron':
                new = '%s/Contents/MacOS/%s' % (APP_NEW, EXE_NEW)

            mode = zi.external_attr >> 16
            if stat.S_ISLNK(mode):
                n_sym += 1
            elif mode & 0o111:
                n_exec += 1

            out = zipfile.ZipInfo(new, date_time=zi.date_time)
            out.create_system = zi.create_system
            out.external_attr = zi.external_attr           # โหมด + ธง symlink ครบ
            out.internal_attr = zi.internal_attr
            out.compress_type = zi.compress_type

            if name == APP_OLD + '/Contents/Info.plist':
                zout.writestr(out, patch_plist(zin.read(zi), version))
                continue
            # สตรีมทีละก้อน — Electron Framework ใหญ่หลักร้อย MB
            with zin.open(zi) as fsrc, zout.open(out, 'w') as fdst:
                while True:
                    buf = fsrc.read(1 << 20)
                    if not buf:
                        break
                    fdst.write(buf)

        # ---- เนื้อแอปของเรา ----
        for f in APP_FILES:
            with io.open(os.path.join(ROOT, f), 'rb') as fh:
                add_file(zout, res_app + f, fh.read())
            n_app += 1
        for d in APP_DIRS:
            base = os.path.join(ROOT, d)
            if not os.path.isdir(base):
                continue
            for p in walk_files(base):
                rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
                with io.open(p, 'rb') as fh:
                    add_file(zout, res_app + rel, fh.read())
                n_app += 1
        add_file(zout, u'วิธีเปิดบน-macOS.txt', HOWTO.encode('utf-8'))

    size = os.path.getsize(out_zip)
    print('OK  %s' % out_zip)
    print('    version      : %s' % version)
    print('    symlinks     : %d (ต้องได้ 14)' % n_sym)
    print('    executables  : %d' % n_exec)
    print('    app files    : %d' % n_app)
    print('    size         : %.1f MB' % (size / 1048576.0))


if __name__ == '__main__':
    main()
