import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERO = ROOT / 'wwwroot/images/hero'
NS = 'http://www.w3.org/2000/svg'
REFERENCE = re.compile(r'url\(#([^)]+)\)|href="#([^"]+)"')

LAYERS = [
    ('clay-line-large-vector.svg', 'clay-line-large-rear.svg', 'clay-large-up-surface', '-180 -180 1060 1053'),
    ('clay-line-large-vector.svg', 'clay-line-large-front.svg', 'clay-large-front-layer', '-180 -180 1060 1053'),
    ('clay-line-small-vector.svg', 'clay-line-small-rear.svg', 'clay-small-segment-0', '-180 -180 1060 1081'),
    ('clay-line-small-vector.svg', 'clay-line-small-front.svg', 'clay-small-segment-1', '-180 -180 1060 1081'),
]


def split(source, target, layer, view_box):
    defs = ET.parse(HERO / source).getroot().find(f'{{{NS}}}defs')
    by_id = {node.get('id'): node for node in defs}
    needed, pending = set(), [layer]
    while pending:
        name = pending.pop()
        if name in needed or name not in by_id:
            continue
        needed.add(name)
        pending += [a or b for a, b in REFERENCE.findall(ET.tostring(by_id[name], encoding='unicode'))]

    _, _, width, height = view_box.split()
    svg = ET.Element(f'{{{NS}}}svg', viewBox=view_box, width=width, height=height)
    kept = ET.SubElement(svg, f'{{{NS}}}defs')
    kept.extend(node for node in defs if node.get('id') in needed)
    ET.SubElement(svg, f'{{{NS}}}use', href=f'#{layer}')
    ET.ElementTree(svg).write(HERO / target)


def main():
    ET.register_namespace('', NS)
    for layer in LAYERS:
        split(*layer)


if __name__ == '__main__':
    main()
