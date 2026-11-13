from argparse import ArgumentParser
from base64 import b64encode
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MODULES = ("data", "decks", "engine", "bot", "effects", "ui", "forms", "controls")
ASSETS = {"FONT_DM": "dm.woff2", "FONT_SERIF": "serif.woff2", "HERO_GLACIER": "glacier.webp"}


def build():
    src = ROOT / "src"
    styles = (src / "style.css").read_text(encoding="utf-8")
    for marker, filename in ASSETS.items():
        encoded = b64encode((ROOT / filename).read_bytes()).decode("ascii")
        styles = styles.replace(marker, encoded)

    script = "\n\n".join((src / f"{module}.js").read_text(encoding="utf-8") for module in MODULES)
    licenses = "\n\n".join(
        (ROOT / f"{name}-OFL.txt").read_text(encoding="utf-8")
        for name in ("dmsans", "instrumentserif")
    )
    template = (src / "index.html").read_text(encoding="utf-8")
    return (
        template.replace("FONT_LICENSES", licenses.replace("--", "–"))
        .replace("/* APP_CSS */", styles)
        .replace("/* APP_JS */", script)
    ).encode("utf-8")


if __name__ == "__main__":
    parser = ArgumentParser(description="Build the self-contained Dominant Species solo companion.")
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "Dominant_Species_Solo.html")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(build())
    print(f"{args.output}: {args.output.stat().st_size:,} bytes")
