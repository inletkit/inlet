import math, pathlib, sys

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
PAPER, PAPER2, INK, MUTED, SOFT, ACCENT, LINK = "#2d3142", "#393e53", "#f5f5f5", "#bfc0c0", "#8e98ac", "#f08a59", "#6a95d8"
RULE = "rgba(245,245,245,0.12)"
STYLES = {
    "focal": ("rgba(240,138,89,0.10)", ACCENT, "rgba(240,138,89,0.50)", ACCENT, None),
    "backend": (PAPER2, INK, "rgba(245,245,245,0.40)", INK, None),
    "store": ("rgba(245,245,245,0.05)", MUTED, "rgba(191,192,192,0.50)", MUTED, None),
    "external": ("rgba(245,245,245,0.03)", "rgba(245,245,245,0.30)", "rgba(245,245,245,0.22)", SOFT, None),
    "input": ("rgba(191,192,192,0.10)", SOFT, "rgba(142,152,172,0.40)", SOFT, None),
    "optional": ("rgba(245,245,245,0.02)", "rgba(245,245,245,0.28)", "rgba(245,245,245,0.22)", SOFT, "4,3"),
}
MONO = "'Geist Mono', monospace"
SANS = "'Geist', sans-serif"

def up4(v):
    return int(math.ceil(v / 4.0) * 4)

def tag_w(text):
    return max(28, up4(len(text) * 4.3 + 12))

def label_w(text):
    return max(32, up4(len(text) * 5 + 8))

class Svg:
    def __init__(self, slug, title, desc, w=1280, h=720):
        self.slug, self.title, self.desc, self.w, self.h = slug, title, desc, w, h
        self.zones, self.arrows, self.labels, self.nodes, self.legend = [], [], [], [], []

    def zone(self, x, y, w, h, text, dashed=False):
        dash = ' stroke-dasharray="4,4"' if dashed else ""
        mw = up4(len(text) * 4.3 + 16)
        self.zones.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(245,245,245,0.03)" stroke="rgba(245,245,245,0.10)" stroke-width="0.8"{dash}/>\n'
            f'<rect x="{x+16}" y="{y+4}" width="{mw}" height="12" rx="2" fill="{PAPER}"/>\n'
            f'<text x="{x+16+mw//2}" y="{y+13}" fill="rgba(245,245,245,0.35)" font-size="7" font-family="{MONO}" text-anchor="middle" letter-spacing="0.14em">{text}</text>'
        )

    def line(self, x1, y1, x2, y2, color=MUTED, dashed=False, marker="arrow", width=1.2):
        dash = f' stroke-dasharray="{dashed}"' if isinstance(dashed, str) else (' stroke-dasharray="5,4"' if dashed else "")
        m = f' marker-end="url(#{marker})"' if marker else ""
        self.arrows.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"{dash}{m}/>')

    def path(self, d, color=MUTED, dashed=False, marker="arrow", width=1.2):
        dash = f' stroke-dasharray="{dashed}"' if isinstance(dashed, str) else (' stroke-dasharray="5,4"' if dashed else "")
        m = f' marker-end="url(#{marker})"' if marker else ""
        self.arrows.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{dash}{m}/>')

    def label(self, x, y, text, color=MUTED, w=None, anchor="middle"):
        w = w or label_w(text)
        cx = x + w // 2
        self.labels.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="12" rx="2" fill="{PAPER}"/>\n'
            f'<text x="{cx}" y="{y+9}" fill="{color}" font-size="8" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{text}</text>'
        )

    def text(self, x, y, text, color=MUTED, size=8, family=MONO, anchor="start", weight=None, spacing=None, italic=False):
        extra = ""
        if weight: extra += f' font-weight="{weight}"'
        if spacing: extra += f' letter-spacing="{spacing}"'
        if italic: extra += ' font-style="italic"'
        self.labels.append(f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-family="{family}" text-anchor="{anchor}"{extra}>{text}</text>')

    def node(self, x, y, w, h, style, tag, name, sub=None, sub2=None, rx=6, name_size=12, badge=None):
        fill, stroke, tstroke, ttext, dash = STYLES[style]
        dasha = f' stroke-dasharray="{dash}"' if dash else ""
        tw = tag_w(tag)
        cx = x + w // 2
        parts = [
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{PAPER}"/>',
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="1"{dasha}/>',
            f'<rect x="{x+8}" y="{y+8}" width="{tw}" height="12" rx="2" fill="transparent" stroke="{tstroke}" stroke-width="0.8"/>',
            f'<text x="{x+8+tw//2}" y="{y+17}" fill="{ttext}" font-size="7" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{tag}</text>',
        ]
        if badge:
            bw = tag_w(badge)
            parts += [
                f'<rect x="{x+w-8-bw}" y="{y+8}" width="{bw}" height="12" rx="2" fill="transparent" stroke="{tstroke}" stroke-width="0.8"/>',
                f'<text x="{x+w-8-bw//2}" y="{y+17}" fill="{ttext}" font-size="8" font-family="{MONO}" text-anchor="middle">{badge}</text>',
            ]
        ny = y + 40 if h >= 64 else y + 36
        parts.append(f'<text x="{cx}" y="{ny}" fill="{INK}" font-size="{name_size}" font-weight="600" font-family="{SANS}" text-anchor="middle">{name}</text>')
        if sub:
            parts.append(f'<text x="{cx}" y="{ny+16}" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="middle">{sub}</text>')
        if sub2:
            parts.append(f'<text x="{cx}" y="{ny+30}" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="middle">{sub2}</text>')
        self.nodes.append("\n".join(parts))

    def chip(self, x, y, w, text, tag):
        self.nodes.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="24" rx="4" fill="rgba(245,245,245,0.05)" stroke="{MUTED}" stroke-width="0.8"/>\n'
            f'<text x="{x+8}" y="{y+16}" fill="{INK}" font-size="12" font-family="{SANS}">{text}</text>\n'
            f'<text x="{x+w-8}" y="{y+16}" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="end">{tag}</text>'
        )

    def raw_node(self, s):
        self.nodes.append(s)

    def legend_items(self, y, items):
        x = 40
        out = [f'<line x1="40" y1="{y-8}" x2="{self.w-40}" y2="{y-8}" stroke="rgba(245,245,245,0.10)" stroke-width="0.8"/>',
               f'<text x="40" y="{y+8}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.18em">LEGEND</text>']
        yy = y + 24
        for kind, text in items:
            if kind in STYLES:
                fill, stroke, _, _, dash = STYLES[kind]
                dasha = f' stroke-dasharray="{dash}"' if dash else ""
                out.append(f'<rect x="{x}" y="{yy}" width="14" height="10" rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1"{dasha}/>')
                tx = x + 20
            else:
                color, dashed, marker, width = kind
                dasha = f' stroke-dasharray="{dashed}"' if dashed else ""
                out.append(f'<line x1="{x}" y1="{yy+5}" x2="{x+28}" y2="{yy+5}" stroke="{color}" stroke-width="{width}"{dasha} marker-end="url(#{marker})"/>')
                tx = x + 36
            out.append(f'<text x="{tx}" y="{yy+8}" fill="{MUTED}" font-size="8" font-family="{SANS}">{text}</text>')
            x = tx + up4(len(text) * 4.6 + 24)
        self.legend = out

    def render(self, eyebrow, h1):
        body = "\n".join(self.zones + self.arrows + self.labels + self.nodes + self.legend)
        return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{h1} · Inlet</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{
      --color-paper:   {PAPER};
      --color-ink:     {INK};
      --color-muted:   {MUTED};
      --color-accent:  {ACCENT};
      --font-sans:     'Geist', system-ui, sans-serif;
      --font-serif:    'Instrument Serif', serif;
      --font-mono:     'Geist Mono', ui-monospace, monospace;
    }}
    body {{ font-family: var(--font-sans); background: var(--color-paper); color: var(--color-ink); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; }}
    .frame {{ max-width: 1280px; width: 100%; }}
    .eyebrow {{ font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }}
    h1 {{ font-family: var(--font-serif); font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2rem); font-weight: 400; letter-spacing: -0.02em; line-height: 1.15; color: var(--color-ink); margin-bottom: 1.5rem; }}
    svg {{ width: 100%; min-width: 900px; display: block; }}
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{h1}</h1>
    <svg viewBox="0 0 {self.w} {self.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{self.slug}-title {self.slug}-desc">
      <title id="{self.slug}-title">{self.title}</title>
      <desc id="{self.slug}-desc">{self.desc}</desc>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>
        <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{ACCENT}"/></marker>
        <marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{LINK}"/></marker>
        <marker id="arrow-open" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polyline points="0 0, 8 3, 0 6" fill="none" stroke="{MUTED}" stroke-width="1.2"/></marker>
      </defs>
      <rect width="100%" height="100%" fill="{PAPER}"/>
{body}
    </svg>
  </div>
</body>
</html>
'''

LEG_LINK = (LINK, None, "arrow-link", 1.2)
LEG_ACCENT = (ACCENT, None, "arrow-accent", 1.4)
LEG_MUTED = (MUTED, None, "arrow", 1.2)
LEG_DASH = (MUTED, "5,4", "arrow", 1)
LEG_DASH_ACCENT = (ACCENT, "5,4", "arrow-accent", 1)
LEG_DASH_LINK = (LINK, "5,4", "arrow-link", 1)

# ---------------------------------------------------------------- architecture
def architecture():
    s = Svg("architecture-dark", "How a deposit moves through Inlet",
            "Architecture diagram showing USDC leaving a user's wallet or Gateway balance on the source chain, landing at a per intent deposit address on Arc, being swept by the Inlet hub through CCTP to the receiver and adapter on the destination chain, where the protocol position is delivered, with the relayer and Circle attestation in the middle and the refund path back to the wallet.")
    s.zone(40, 136, 272, 288, "SOURCE CHAIN")
    s.zone(352, 136, 416, 288, "ARC · SETTLEMENT HUB")
    s.zone(800, 136, 440, 288, "DESTINATION CHAIN")

    # arrows
    s.line(144, 240, 144, 320, LINK, dashed="4,3", marker="arrow-link", width=1)                      # A1 wallet -> gateway
    s.line(216, 196, 384, 196, LINK, marker="arrow-link")                                             # A2 wallet -> deposit
    s.path("M 216,352 H 272 Q 280,352 280,344 V 228 Q 280,220 288,220 H 384", LINK, marker="arrow-link")  # A3 gateway -> deposit
    s.line(528, 208, 592, 208)                                                                        # A4 deposit -> hub
    s.line(736, 208, 816, 208, ACCENT, marker="arrow-accent", width=1.4)                             # A5 hub -> receiver
    s.path("M 456,384 V 504 Q 456,512 464,512 H 592", LINK, marker="arrow-link")                     # A6 attestation -> relayer
    s.path("M 736,512 H 880 Q 888,512 888,504 V 240")                                                 # A7 relayer -> receiver
    s.line(664, 480, 664, 240)                                                                        # A8 relayer -> hub
    s.line(960, 208, 1040, 208)                                                                       # A9 receiver -> adapter
    s.line(1112, 240, 1112, 320)                                                                      # A10 adapter -> position
    s.path("M 704,176 V 112 Q 704,104 696,104 H 152 Q 144,104 144,112 V 176", MUTED, dashed="4,3", width=1)  # A11 refund

    # labels
    s.label(152, 274, "DEPOSIT ONCE", LINK)
    s.label(272, 176, "CCTP BURN", LINK)
    s.label(288, 280, "GATEWAY MINT", LINK)
    s.label(540, 188, "SWEEP")
    s.label(744, 188, "CCTP + HOOK", ACCENT)
    s.label(464, 428, "ATTESTATION", LINK)
    s.label(896, 440, "EXECUTE")
    s.label(672, 436, "MINT · SWEEP")
    s.label(976, 188, "DEPOSIT", w=48)
    s.label(1120, 274, "TO BENEFICIARY")
    s.label(404, 84, "REFUND")

    # nodes
    s.node(72, 176, 144, 64, "input", "USER", "User wallet", "Privy or any wallet")
    s.node(72, 320, 144, 64, "external", "CIRCLE", "Gateway balance", "unified USDC balance")
    s.node(384, 176, 144, 64, "store", "ESCROW", "Deposit address", "per intent · CREATE2")
    s.node(592, 176, 144, 64, "focal", "HUB", "Inlet hub", "sweep · refund")
    s.node(384, 320, 144, 64, "external", "CIRCLE", "Attestation", "Iris API · signs burns")
    s.node(592, 480, 144, 64, "optional", "SERVICE", "Relayer", "anyone can run one")
    s.node(816, 176, 144, 64, "backend", "CONTRACT", "Inlet receiver", "verifies the CCTP mint")
    s.node(1040, 176, 144, 64, "backend", "CONTRACT", "Adapter", "one per protocol")
    s.node(1016, 320, 192, 80, "backend", "POSITION", "Protocol position", "Aave · Compound · Morpho", "Uniswap v4 · ERC 4626 vaults")

    s.legend_items(652, [
        ("focal", "Settlement hub on Arc"), ("backend", "Inlet contract"), ("external", "Circle"), ("store", "Escrow"),
        ("optional", "Relayer, permissionless"), (LEG_LINK, "Circle rail"), (LEG_ACCENT, "Settlement leg"), (LEG_DASH, "Refund or one time"),
    ])
    return s.render("Architecture · Inlet", "How a deposit moves through Inlet")

# ---------------------------------------------------------------- sequence
def sequence():
    s = Svg("deposit-sequence-dark", "One deposit, end to end",
            "Sequence diagram of an Inlet deposit: the wallet registers an intent with the relayer, funds the deposit address on Arc through either a signed Gateway burn intent or a CCTP burn, the relayer sweeps the hub, Circle attests the burn, and the destination receiver executes the adapter so the position reaches the user.")
    xs = {"user": 160, "relayer": 400, "circle": 640, "arc": 880, "dest": 1120}
    for cx in xs.values():
        s.zones.append(f'<line x1="{cx}" y1="112" x2="{cx}" y2="648" stroke="rgba(245,245,245,0.22)" stroke-width="1" stroke-dasharray="3,3"/>')

    def bar(cx, y1, y2):
        s.zones.append(f'<rect x="{cx-4}" y="{y1}" width="8" height="{y2-y1}" fill="rgba(245,245,245,0.06)" stroke="{MUTED}" stroke-width="0.8"/>')
    bar(400, 148, 188); bar(400, 268, 452); bar(400, 500, 604)
    bar(640, 300, 316); bar(640, 532, 572)
    bar(880, 332, 344); bar(880, 444, 456); bar(880, 500, 540)
    bar(1120, 596, 636)

    # fragment frame (before arrows so labels paint over it)
    s.zones.append(
        '<rect x="104" y="208" width="832" height="264" rx="4" fill="rgba(245,245,245,0.04)" stroke="rgba(245,245,245,0.22)" stroke-width="1"/>\n'
        f'<rect x="104" y="208" width="40" height="16" rx="2" fill="{PAPER}" stroke="rgba(245,245,245,0.22)" stroke-width="1"/>\n'
        f'<text x="124" y="220" fill="{MUTED}" font-size="8" font-family="{MONO}" text-anchor="middle" letter-spacing="0.12em">ALT</text>\n'
        f'<text x="116" y="240" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.04em">[gateway route · one signature, no gas]</text>\n'
        '<line x1="112" y1="360" x2="928" y2="360" stroke="rgba(245,245,245,0.20)" stroke-width="1" stroke-dasharray="4,3"/>\n'
        f'<text x="116" y="384" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.04em">[cctp route · approve and burn]</text>'
    )

    def msg(x1, x2, y, text, lcx, color=MUTED, dashed=False, marker="arrow", width=1.2):
        s.line(x1, y, x2, y, color, dashed=dashed, marker=marker, width=width)
        w = label_w(text)
        s.label(lcx - w // 2, y - 20, text, color, w=w)

    msg(160, 396, 152, "REGISTER INTENT", 280, LINK, marker="arrow-link")
    msg(404, 160, 184, "DEPOSIT ADDRESS", 280, MUTED, dashed=True)
    msg(160, 396, 272, "SIGNED BURN INTENT", 280, LINK, marker="arrow-link")
    msg(404, 636, 304, "GATEWAY TRANSFER", 520, LINK, marker="arrow-link")
    msg(404, 876, 336, "MINT ON ARC", 760)
    msg(160, 640, 416, "DEPOSIT FOR BURN", 280)
    msg(404, 876, 448, "RECEIVE MESSAGE", 760)
    msg(404, 876, 504, "SWEEP", 760)
    msg(876, 644, 536, "CCTP BURN", 760)
    msg(636, 404, 568, "ATTESTATION", 520, MUTED, dashed=True)
    msg(404, 1116, 600, "RECEIVE + EXECUTE", 1000)
    msg(1116, 160, 632, "POSITION DELIVERED", 280, ACCENT, marker="arrow-accent", width=1.4)

    def actor(cx, style, tag, name, sub):
        s.node(cx - 72, 56, 144, 56, style, tag, name, sub)
    actor(160, "input", "USER", "User wallet", "Privy or any wallet")
    actor(400, "backend", "SERVICE", "Relayer", "anyone can run one")
    actor(640, "external", "CIRCLE", "Circle", "Gateway · CCTP · Iris")
    actor(880, "focal", "ARC", "Arc hub", "Inlet hub · escrow")
    actor(1120, "backend", "CHAIN", "Destination", "receiver · adapter")

    s.legend_items(676, [
        ("focal", "Settlement on Arc"), ("input", "User"), ("external", "Circle"), (LEG_LINK, "API call"),
        (LEG_MUTED, "Transaction"), (LEG_DASH, "Return"), (LEG_ACCENT, "Position delivered"),
    ])
    return s.render("Sequence · Inlet", "One deposit, end to end")

# ---------------------------------------------------------------- state
def lifecycle():
    s = Svg("intent-lifecycle-dark", "Intent lifecycle",
            "State machine of an Inlet deposit intent from created through funded, swept, attested and executed, with claimable USDC when an adapter fails, a refund path after the deadline when funds arrived, and expiry when nothing arrived.")

    def state(x, y, style, name, sub):
        fill, stroke, tstroke, ttext, dash = STYLES[style]
        s.nodes.append(
            f'<rect x="{x}" y="{y}" width="152" height="80" rx="8" fill="{PAPER}"/>\n'
            f'<rect x="{x}" y="{y}" width="152" height="80" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1"/>\n'
            f'<rect x="{x+8}" y="{y+8}" width="40" height="12" rx="2" fill="transparent" stroke="{tstroke}" stroke-width="0.8"/>\n'
            f'<text x="{x+28}" y="{y+17}" fill="{ttext}" font-size="7" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">STATE</text>\n'
            f'<text x="{x+76}" y="{y+48}" fill="{INK}" font-size="14" font-weight="600" font-family="{SANS}" text-anchor="middle">{name}</text>\n'
            f'<text x="{x+76}" y="{y+64}" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="middle">{sub}</text>'
        )

    # transitions
    s.line(64, 216, 96, 216)                                                                  # start -> created
    s.line(248, 216, 312, 216)                                                                # created -> funded
    s.line(464, 216, 528, 216)                                                                # funded -> swept
    s.line(680, 216, 744, 216)                                                                # swept -> attested
    s.line(896, 216, 960, 216, ACCENT, marker="arrow-accent", width=1.4)                     # attested -> executed
    s.path("M 820,256 V 368 Q 820,376 828,376 H 960", MUTED, dashed="5,4", width=1)          # attested -> claimable
    s.line(148, 256, 148, 496, MUTED, dashed="5,4", width=1)                                 # created -> expired
    s.path("M 196,256 V 368 Q 196,376 204,376 H 312", MUTED, dashed="5,4", width=1)          # created -> refunding
    s.line(464, 376, 528, 376, MUTED, dashed="5,4", width=1)                                 # refunding -> refunded
    s.line(1112, 216, 1164, 216)                                                              # executed -> end
    s.line(1112, 376, 1164, 376)                                                              # claimable -> end

    s.label(258, 196, "USDC IN")
    s.label(476, 196, "SWEEP")
    s.label(692, 196, "ATTEST")
    s.label(906, 196, "EXECUTE", ACCENT)
    s.label(828, 300, "ADAPTER FAILS")
    s.label(44, 372, "EMPTY AT DEADLINE")
    s.label(204, 300, "FUNDS AT DEADLINE")
    s.label(468, 356, "MINT BACK")
    s.label(1120, 356, "CLAIM", w=36)

    s.nodes.append(f'<circle cx="56" cy="216" r="6" fill="{INK}"/>')
    state(96, 176, "backend", "Created", "intent registered")
    state(312, 176, "backend", "Funded", "USDC at deposit address")
    state(528, 176, "backend", "Swept", "burned to destination")
    state(744, 176, "backend", "Attested", "Circle attested")
    state(960, 176, "focal", "Executed", "position delivered")
    state(312, 336, "store", "Refunding", "burned back to source")
    state(528, 336, "store", "Refunded", "USDC back in the wallet")
    state(960, 336, "store", "Claimable", "user can claim USDC")
    state(96, 496, "store", "Expired", "nothing arrived · final")
    for cy in (216, 376):
        s.nodes.append(f'<circle cx="1176" cy="{cy}" r="8" fill="none" stroke="{INK}" stroke-width="1"/><circle cx="1176" cy="{cy}" r="5" fill="{INK}"/>')

    s.legend_items(652, [
        ("focal", "Goal state"), ("backend", "In flight"), ("store", "Safety state, final"), (LEG_ACCENT, "Happy path"),
        (LEG_MUTED, "Transition"), (LEG_DASH, "Safety transition"),
    ])
    return s.render("State machine · Inlet", "Intent lifecycle")

# ---------------------------------------------------------------- deployment
def deployment():
    s = Svg("deployment-dark", "Where Inlet runs on testnet",
            "Deployment diagram placing the Inlet widget in the user's browser, the playground and the relayer on Azure in West Europe, Circle's attestation and Gateway APIs, the Inlet hub on Arc testnet, and the receivers and adapters on Arbitrum, Base and Unichain Sepolia, with the network paths between them.")
    s.zone(232, 96, 288, 504, "AZURE · WEST EUROPE", dashed=True)
    s.zone(552, 96, 240, 208, "CIRCLE · TESTNET", dashed=True)
    s.zone(824, 96, 416, 504, "TESTNETS", dashed=True)

    s.path("M 200,376 H 216 Q 224,376 224,368 V 208 Q 224,200 232,200 H 256", LINK, marker="arrow-link")          # browser -> playground
    s.line(200, 408, 256, 408, LINK, marker="arrow-link")                                                            # browser -> relayer
    s.path("M 120,344 V 88 Q 120,80 128,80 H 712 Q 720,80 720,88 V 152", LINK, marker="arrow-link")              # browser -> circle
    s.path("M 120,440 V 512 Q 120,520 128,520 H 1024 Q 1032,520 1032,512 V 472", LINK, marker="arrow-link")        # browser -> evm chains
    s.path("M 400,344 V 324 Q 400,316 408,316 H 712 Q 720,316 720,308 V 280", LINK, marker="arrow-link")          # relayer -> circle
    s.path("M 496,384 H 808 Q 816,384 816,376 V 208 Q 816,200 824,200 H 856", LINK, marker="arrow-link")          # relayer -> arc
    s.line(496, 428, 856, 428, LINK, marker="arrow-link")                                                            # relayer -> evm chains
    s.line(1032, 248, 1032, 344, ACCENT, dashed="5,4", marker="arrow-accent", width=1)                             # arc -> evm chains (cctp)

    s.label(232, 280, "HTTPS", LINK, w=36)
    s.label(210, 388, "HTTPS", LINK, w=36)
    s.label(360, 60, "GATEWAY API", LINK)
    s.label(560, 500, "WALLET RPC", LINK)
    s.label(528, 296, "CIRCLE APIS", LINK)
    s.label(824, 280, "ARC RPC", LINK)
    s.label(636, 408, "RPC · EXECUTE", LINK)
    s.label(1040, 288, "CCTP V2", ACCENT)

    s.node(40, 344, 160, 96, "input", "CLIENT", "User's browser", "Privy or any wallet")
    s.chip(48, 408, 144, "Inlet widget", "Privy")
    s.node(256, 152, 240, 96, "external", "MANAGED", "inlet-playground", "Static Web App · Free tier")
    s.chip(264, 216, 224, "Next.js static export", "16.3")
    s.node(256, 344, 240, 128, "backend", "MANAGED", "inlet-relayer", "Container App · 0.5 vCPU · 1 GiB", badge="x1")
    s.chip(264, 408, 224, "Fastify + node:sqlite", "node 24")
    s.chip(264, 440, 224, "Azure Files share", "inlet.db")
    s.node(576, 152, 192, 128, "external", "MANAGED", "Circle testnet APIs", "sandbox endpoints")
    s.chip(584, 216, 176, "Iris attestations", "v2")
    s.chip(584, 248, 176, "Gateway API", "v1")
    s.node(856, 152, 352, 96, "focal", "L1", "Arc testnet", "chain 5042002 · CCTP domain 26")
    s.chip(864, 216, 336, "InletHub", "0x84f3…408B")
    s.node(856, 344, 352, 128, "backend", "EVM", "Sepolia testnets", "Arbitrum 3 · Base 6 · Unichain 10")
    s.chip(864, 408, 336, "receivers", "Arbitrum, Base, Unichain Sepolia")
    s.chip(864, 440, 336, "adapters", "Aave, Compound, Morpho, Uniswap, ERC 4626")

    s.legend_items(652, [
        ("focal", "New on Arc"), ("backend", "Runs Inlet code"), ("external", "Managed service"), ("input", "Client"),
        (LEG_LINK, "Network path"), (LEG_DASH_ACCENT, "CCTP burn and mint"),
    ])
    return s.render("Deployment · Inlet", "Where Inlet runs on testnet")

for name, fn in [("architecture", architecture), ("deposit-sequence", sequence), ("intent-lifecycle", lifecycle), ("deployment", deployment)]:
    (OUT / f"{name}.html").write_text(fn())
    print("wrote", OUT / f"{name}.html")
