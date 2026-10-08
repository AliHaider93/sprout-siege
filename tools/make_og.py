#!/usr/bin/env python3
"""Render og.png (1200x630 Twitter/OpenGraph card) and icon-180.png with Pillow."""
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(3)


def font(size, bold=True):
    for c in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def shooter(d, x, y, s, col="#4ade80", dark="#15803d"):
    d.line((x, y + 30 * s, x, y + 2 * s), fill=dark, width=int(6 * s))
    d.ellipse((x - 16 * s, y - 16 * s, x + 16 * s, y + 16 * s), fill=col)
    d.rounded_rectangle((x - 10 * s, y - 32 * s, x + 10 * s, y - 14 * s), int(7 * s), fill=dark)
    d.ellipse((x - 6 * s, y - 29 * s, x + 6 * s, y - 22 * s), fill="#111827")
    d.ellipse((x - 7 * s, y - 3 * s, x - 3 * s, y + 1 * s), fill="#111827")
    d.ellipse((x + 3 * s, y - 3 * s, x + 7 * s, y + 1 * s), fill="#111827")


def sunbloom(d, x, y, s):
    d.line((x, y + 30 * s, x, y + 2 * s), fill="#15803d", width=int(6 * s))
    for i in range(10):
        import math
        a = i * math.tau / 10
        px, py = x + math.cos(a) * 18 * s, y + math.sin(a) * 18 * s
        d.ellipse((px - 7 * s, py - 7 * s, px + 7 * s, py + 7 * s), fill="#facc15")
    d.ellipse((x - 12 * s, y - 12 * s, x + 12 * s, y + 12 * s), fill="#f59e0b")
    d.ellipse((x - 6 * s, y - 4 * s, x - 2 * s, y), fill="#111827")
    d.ellipse((x + 2 * s, y - 4 * s, x + 6 * s, y), fill="#111827")


def nutwall(d, x, y, s):
    d.ellipse((x - 22 * s, y - 26 * s, x + 22 * s, y + 26 * s), fill="#78350f")
    d.ellipse((x - 17 * s, y - 22 * s, x + 11 * s, y + 12 * s), fill="#b45309")
    d.ellipse((x - 8 * s, y - 8 * s, x - 3 * s, y - 3 * s), fill="#111827")
    d.ellipse((x + 2 * s, y - 8 * s, x + 7 * s, y - 3 * s), fill="#111827")


def zombie(d, x, y, s, hat=None):
    d.rectangle((x - 8 * s, y + 8 * s, x - 2 * s, y + 22 * s), fill="#374151")
    d.rectangle((x + 2 * s, y + 8 * s, x + 8 * s, y + 22 * s), fill="#374151")
    d.rectangle((x - 26 * s, y - 4 * s, x - 12 * s, y + 2 * s), fill="#86efac")
    d.rounded_rectangle((x - 12 * s, y - 10 * s, x + 12 * s, y + 10 * s), int(5 * s), fill="#6b7280")
    d.ellipse((x - 11 * s, y - 32 * s, x + 11 * s, y - 10 * s), fill="#a3e635")
    d.ellipse((x - 6 * s, y - 24 * s, x - 2 * s, y - 20 * s), fill="#365314")
    d.ellipse((x + 2 * s, y - 23 * s, x + 5 * s, y - 20 * s), fill="#365314")
    if hat == "worker":
        d.rounded_rectangle((x - 9 * s, y - 8 * s, x + 9 * s, y + 8 * s), int(3 * s), fill="#f97316")
        d.rectangle((x - 9 * s, y - 2 * s, x + 9 * s, y + 1 * s), fill="#e5e7eb")
        d.pieslice((x - 11 * s, y - 42 * s, x + 11 * s, y - 20 * s), 180, 360, fill="#facc15")
        d.rectangle((x - 13 * s, y - 32 * s, x + 13 * s, y - 28 * s), fill="#facc15")
    if hat == "riot":
        d.pieslice((x - 12 * s, y - 44 * s, x + 12 * s, y - 20 * s), 180, 360, fill="#1f2937")
        d.rectangle((x - 12 * s, y - 32 * s, x + 12 * s, y - 26 * s), fill="#1f2937")
        d.rounded_rectangle((x - 9 * s, y - 31 * s, x + 9 * s, y - 23 * s), int(3 * s), fill=(125, 211, 252, 150))
        d.rounded_rectangle((x - 24 * s, y - 12 * s, x - 10 * s, y + 16 * s), int(4 * s), fill="#111827")


def card():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#1e293b")
    d = ImageDraw.Draw(img, "RGBA")
    # lawn with checker rows (landscape: zombies from the right)
    for r in range(5):
        for c in range(12):
            d.rectangle((c * 100, 130 + r * 100, c * 100 + 100, 230 + r * 100), fill="#65a30d" if (r + c) % 2 else "#84cc16")
    # graves top
    for i in range(14):
        d.rounded_rectangle((20 + i * 85, 80 - (i % 3) * 8, 60 + i * 85, 130), 8, fill="#334155")
    # plants
    for r in range(5):
        sunbloom(d, 150, 180 + r * 100, 1.5)
        shooter(d, 260, 180 + r * 100, 1.5)
        if r in (1, 3):
            shooter(d, 370, 180 + r * 100, 1.5, col="#38bdf8", dark="#0369a1")
        nutwall(d, 480, 180 + r * 100, 1.4)
    # seeds in flight
    for r in range(5):
        for k in range(3):
            x = 520 + k * 110 + random.randint(-20, 20)
            d.ellipse((x - 7, 170 + r * 100, x + 7, 190 + r * 100), fill="#65a30d")
    # zombies right
    for r in range(5):
        for k in range(2 + (r % 2)):
            x = 760 + k * 120 + random.randint(-25, 25)
            zombie(d, x, 190 + r * 100, 1.6, hat=[None, "worker", "riot", None, "worker"][(r + k) % 5])
    # title banner
    banner = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(banner)
    bd.rounded_rectangle((40, 450, 720, 596), 26, fill=(8, 12, 30, 225))
    img.paste(banner, (0, 0), banner)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((70, 462), "SPROUT SIEGE", font=font(72), fill="#bef264")
    d.text((72, 548), "Plant. Shoot. Hold the lawn against the horde.", font=font(26, bold=False), fill="#e2e8f0")
    img.save(os.path.join(ROOT, "og.png"), optimize=True)
    print("wrote og.png")


def icon():
    S = 180
    img = Image.new("RGB", (S, S), "#1e293b")
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 100, S, S), fill="#65a30d")
    d.rectangle((0, 140, S, S), fill="#84cc16")
    shooter(d, 80, 86, 2.2)
    zombie(d, 148, 118, 1.3)
    img.save(os.path.join(ROOT, "icon-180.png"), optimize=True)
    print("wrote icon-180.png")


if __name__ == "__main__":
    card()
    icon()
