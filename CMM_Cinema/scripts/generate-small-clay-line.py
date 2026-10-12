"""Generate an editable, shaded SVG tube and its inline Razor definitions.

No external packages: cubic centerlines, circular cross sections, and one
consistent softbox light replace the old bitmap-traced color islands.
Run from any directory with Python 3.
"""

from math import hypot, sqrt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "clay-small"
RADIUS = [48, 48, 54, 57, 48, 53]
CURVES = [
    [(648, 139), (478, 159), (368, 231), (313, 304)],
    [(313, 304), (243, 399), (330, 463), (413, 377)],
    [(413, 377), (531, 252), (463, 66), (302, 58)],
    [(302, 58), (124, 46), (40, 203), (49, 358)],
    [(49, 358), (57, 514), (137, 617), (267, 666)],
]
LIGHT = (-0.42, -0.52, 0.742)
HALF = (-0.225, -0.279, 0.934)


def sample(curve, t, radius):
    a, b, c, d = curve
    u = 1 - t
    p = tuple(u**3*a[j] + 3*u*u*t*b[j] + 3*u*t*t*c[j] + t**3*d[j] for j in (0, 1))
    tangent = tuple(3*u*u*(b[j]-a[j]) + 6*u*t*(c[j]-b[j]) + 3*t*t*(d[j]-c[j]) for j in (0, 1))
    length = hypot(*tangent)
    tx, ty = (v / length for v in tangent)
    return (*p, tx, ty, radius, 0)


def cap(section, start):
    x, y, tx, ty, radius, _ = section
    sections = []
    # Axial positions on a hemisphere. The lighting normals include the axial
    # component, so the end is rounded without a flat circular highlight.
    for i in range(1, 25):
        axial = (-1 + i/24) if start else i/24
        sections.append((x + tx*radius*axial, y + ty*radius*axial,
                         tx, ty, radius, axial))
    return sections


def edge(section, q):
    x, y, tx, ty, radius, axial = section
    width = radius * sqrt(max(0, 1 - axial*axial))
    return (x - ty*width*q, y + tx*width*q)


def point(p):
    return f"{p[0]:.3f} {p[1]:.3f}"


def polygon(points):
    return "M" + "L".join(point(p) for p in points) + "Z"


def shade(section, q, rear):
    _, _, tx, ty, _, axial = section
    lateral = q * sqrt(max(0, 1-axial*axial))
    normal = (-ty*lateral + tx*axial, tx*lateral + ty*axial,
              sqrt(max(0, 1-lateral*lateral-axial*axial)))
    diffuse = max(0, sum(a*b for a, b in zip(normal, LIGHT)))
    reflection = max(0, sum(a*b for a, b in zip(normal, HALF)))**28
    intensity = min(1, 0.18 + 0.76*diffuse + 0.12*reflection)
    # A slightly cooler rear strand reinforces the over/under relationship.
    dark, light = (43, 100, 153), (171, 225, 246)
    cooling = 4 * min(1, hypot(section[0]-313, section[1]-304)/100) if rear else 0
    color = [round(a + (b-a)*intensity - cooling) for a, b in zip(dark, light)]
    return "#" + "".join(f"{max(0, min(255, c)):02x}" for c in color)


def tube(indices, name, rear=False):
    body = []
    for index in indices:
        curve = CURVES[index]
        for i in range(81):
            if body and i == 0:
                continue
            t = i/80
            # Smooth radius interpolation avoids a kink at curve joins.
            blend = t*t*(3-2*t)
            radius = RADIUS[index] + (RADIUS[index+1]-RADIUS[index])*blend
            if index == 1:
                # Perspective taper at the tight inside bend keeps its inner
                # offset from folding over itself or pinching the opening.
                radius -= 15 * 16*t*t*(1-t)*(1-t)
            body.append(sample(curve, t, radius))
    if rear:
        # The split is only for revealing: there is no physical cap at the join.
        x, y, tx, ty, radius, axial = body[-1]
        sections = cap(body[0], True)[:-1] + body + [(x+2*tx, y+2*ty, tx, ty, radius, axial)]
    else:
        sections = body + cap(body[-1], False)
    outline = polygon([edge(s, -1) for s in sections] + [edge(s, 1) for s in reversed(sections)])
    definitions = [f'<path id="{PREFIX}-{name}-body" d="{outline}"/>',
                   f'<clipPath id="{PREFIX}-{name}-clip"><use href="#{PREFIX}-{name}-body"/></clipPath>']
    patches = []
    for i, (a, b) in enumerate(zip(sections, sections[1:])):
        mid = tuple((v+w)/2 for v, w in zip(a, b))
        first, last = edge(mid, -1), edge(mid, 1)
        gradient = f"{PREFIX}-{name}-shade-{i}"
        stops = ''.join(f'<stop offset="{j/24:.5f}" stop-color="{shade(mid, -1+j/12, rear)}"/>' for j in range(25))
        definitions.append(f'<linearGradient id="{gradient}" gradientUnits="userSpaceOnUse" x1="{first[0]:.3f}" y1="{first[1]:.3f}" x2="{last[0]:.3f}" y2="{last[1]:.3f}">{stops}</linearGradient>')
        # Subpixel overlap plus a small blur removes antialiasing seams between
        # adjacent gradient sections. The exact outline clips the outer edge.
        aa = (a[0]-a[2]*0.8, a[1]-a[3]*0.8, *a[2:])
        bb = (b[0]+b[2]*0.8, b[1]+b[3]*0.8, *b[2:])
        d = polygon([edge(aa, -1), edge(aa, 1), edge(bb, 1), edge(bb, -1)])
        patches.append(f'<path fill="url(#{gradient})" d="{d}"/>')
    surface = (f'<g id="{PREFIX}-{name}-surface" clip-path="url(#{PREFIX}-{name}-clip)">'
               f'<use href="#{PREFIX}-{name}-body" fill="#79bddf"/>'
               f'<g filter="url(#{PREFIX}-smooth)">{"".join(patches)}</g></g>')
    definitions.append(surface)
    return '\n'.join(definitions)


def main():
    definitions = [
        f'<filter id="{PREFIX}-smooth" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.55"/></filter>',
        f'<filter id="{PREFIX}-contact-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>',
        f'<clipPath id="{PREFIX}-crossing-area"><ellipse cx="475" cy="190" rx="90" ry="105"/></clipPath>',
        tube([0], 'rear', rear=True),
        tube([1, 2, 3, 4], 'front'),
        f'<g id="{PREFIX}-segment-0"><use href="#{PREFIX}-rear-surface"/></g>',
        f'<g id="{PREFIX}-segment-1">'
        f'<g clip-path="url(#{PREFIX}-rear-clip)"><g clip-path="url(#{PREFIX}-crossing-area)"><use href="#{PREFIX}-front-body" transform="translate(7 12)" fill="#123d60" opacity="0.42" filter="url(#{PREFIX}-contact-shadow)"/></g></g>'
        f'<use href="#{PREFIX}-front-surface"/></g>',
    ]
    defs = '<defs>\n' + '\n'.join(definitions) + '\n</defs>'
    artwork = f'<g id="{PREFIX}-artwork" opacity="0.65"><use href="#{PREFIX}-segment-0"/><use href="#{PREFIX}-segment-1"/></g>'
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="721" viewBox="0 0 700 721" fill="none">\n'
           '<title>Small blue clay loop</title>\n'
           '<desc>Smooth vector tube with continuous softbox shading, rounded ends and a rear-to-front crossing shadow.</desc>\n'
           + defs + '\n' + artwork + '\n</svg>\n')
    (ROOT / 'wwwroot/images/hero/clay-line-small-vector.svg').write_text(svg)
    (ROOT / 'Views/Shared/_ClayLineSmallGeometry.cshtml').write_text(
        '@* Generated by scripts/generate-small-clay-line.py. *@\n' + defs + '\n')


if __name__ == '__main__':
    main()
