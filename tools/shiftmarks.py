# shiftmarks.py — เลื่อนสระ/วรรณยุกต์ของฟอนต์ไทยให้เข้าใกล้พยัญชนะ (แก้อาการ "ลอย")
#
# ฟอนต์ที่ส่งมาเว้นช่องว่างระหว่างพยัญชนะกับสระบน/วรรณยุกต์ ~7% ของ em
# ขณะที่ Courier New / Leelawadee / Tahoma เว้นแค่ ~3.5% → มองเป็น "ลอย"
# แก้ที่ต้นเหตุ = ขยับเส้นร่าง (outline) ของ glyph มาร์กลงมา ไม่แตะ advance/cmap/ตารางอื่น
#
# ห้ามแตะ F700 / F70F — สองตัวนี้เป็นพยัญชนะ ญ/ฐ แบบตัดเชิง (advance เต็มตัว) ไม่ใช่มาร์ก
import sys
from fontTools.ttLib import TTFont

ABOVE = [0x0E31, 0x0E34, 0x0E35, 0x0E36, 0x0E37, 0x0E47,
         0x0E48, 0x0E49, 0x0E4A, 0x0E4B, 0x0E4C, 0x0E4D, 0x0E4E]
BELOW = [0x0E38, 0x0E39, 0x0E3A]
PUA_MARKS = [c for c in range(0xF701, 0xF718) if c != 0xF70F]   # F700/F70F = พยัญชนะตัดเชิง

def shift_glyph(glyf, hmtx, name, dy):
    g = glyf[name]
    if g.numberOfContours == 0:
        return False
    if g.isComposite():
        for comp in g.components:
            comp.y += dy
    else:
        g.coordinates.translate((0, dy))
    g.recalcBounds(glyf)
    return True

def patch(src, dst, above_dy, below_dy, family=None):
    f = TTFont(src)
    cm = f.getBestCmap()
    glyf, hmtx = f['glyf'], f['hmtx']
    done = set()
    n = 0
    for cps, dy in ((ABOVE + PUA_MARKS, above_dy), (BELOW, below_dy)):
        if not dy:
            continue
        for cp in cps:
            gname = cm.get(cp)
            if not gname or gname in done:
                continue
            # กันพลาด: ขยับเฉพาะ glyph ที่ advance = 0 (เป็นมาร์กจริง ๆ)
            if hmtx[gname][0] != 0:
                continue
            done.add(gname)
            if shift_glyph(glyf, hmtx, gname, dy):
                n += 1
    f['head'].recalcBBoxes = True
    if family:
        for rec in f['name'].names:
            if rec.nameID in (1, 4):
                rec.string = family
            elif rec.nameID == 6:
                rec.string = family.replace(' ', '')
    f.save(dst)
    print(f'{dst}: ขยับ {n} glyph (บน {above_dy} · ล่าง {below_dy})')

if __name__ == '__main__':
    above = int(sys.argv[1]) if len(sys.argv) > 1 else -74
    below = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    patch('COURMON.TTF', 'CourierThaiMono-fix.ttf', above, below)
    patch('courpro.ttf', 'CourierThaiProp-fix.ttf', above, below)
