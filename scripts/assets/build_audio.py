"""Music and sound effects from free CC0 packs (OpenGameArt), see CREDITS.md.

Run from the repo root:  python scripts/assets/build_audio.py
Needs ffmpeg on PATH. Downloads go to .cache/audio-src/ (not committed);
outputs go to public/assets/audio/ as OGG Vorbis.

Music is loudness-normalised and kept stereo. The night versions are made at
runtime (src/audio/engine.ts: low-pass + reverb on the same track), so the
day→night change is a smooth crossfade of one recording.
"""
from __future__ import annotations

import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache/audio-src"
OUT = ROOT / "public/assets/audio"
OGA = "https://opengameart.org/sites/default/files/"

# Packs: name -> file on OpenGameArt (zips are unpacked next to them).
PACKS = {
    "kenney-rpg": "RPGsounds_Kenney.zip",  # Kenney, «50 RPG sound effects»
    "kenney-ui": "kenney_interfaceSounds.zip",  # Kenney, «Interface Sounds»
    "kenney-jingles": "jingleSounds_Kenney.zip",  # Kenney, «85 Short music jingles»
    "artisticdude": "rpg_sound_pack.zip",  # artisticdude, «RPG Sound Pack»
    "rubberduck-rpg": "80-CC0-RPG-SFX_0.zip",  # rubberduck, «80 CC0 RPG SFX»
    "rubberduck-water": "water-splash-slime-sfx.zip",  # rubberduck, «40 CC0 water/splash/slime SFX»
    # RandomMind (CC0) — one composer for every place, so the score feels whole.
    "harvest-season": "harvestseason.wav",  # «Medieval: Harvest Season»
    "exploration": "Exploration.wav",  # «Medieval: Exploration»
    "market-day": "Loop_Market_Day.wav",  # «Medieval: Market Day» (loop)
    "kings-feast": "Loop_Kings_Feast_0.wav",  # «Medieval: King's Feast» (loop)
    "bards-tale": "Loop_The_Bards_Tale.wav",  # «Medieval: The Bard's Tale» (loop)
    "rising-moon": "Rising_Moon_0.mp3",  # «Fantasy: Rising Moon»
}

MUSIC = {
    "homestead": "harvest-season",
    "forest": "exploration",
    "tower": "rising-moon",
    "market": "market-day",
    "forge": "kings-feast",
    "library": "bards-tale",
}

# Output name -> (pack, path inside the pack, extra ffmpeg filters).
SFX: dict[str, tuple[str, str, str]] = {
    **{f"step-{i}": ("kenney-rpg", f"OGG/footstep0{i}.ogg", "") for i in range(5)},
    "till": ("rubberduck-rpg", "stones_01.ogg", ""),
    "water": ("rubberduck-water", "loop_water_01.ogg", "atrim=0:0.8,afade=t=in:d=0.08,afade=t=out:st=0.5:d=0.3"),
    "plant": ("kenney-rpg", "OGG/cloth1.ogg", ""),
    "harvest": ("kenney-ui", "Audio/pluck_001.ogg", ""),
    "chop": ("kenney-rpg", "OGG/chop.ogg", ""),
    "mine": ("rubberduck-rpg", "item_stone_01.ogg", ""),
    "swing": ("artisticdude", "RPG Sound Pack/battle/swing.wav", ""),
    "shoot": ("rubberduck-rpg", "spell_01.ogg", ""),
    "spell": ("artisticdude", "RPG Sound Pack/battle/magic1.wav", ""),
    "enemy-hit": ("rubberduck-rpg", "creature_hurt_01.ogg", ""),
    "enemy-defeat": ("rubberduck-rpg", "creature_die_01.ogg", ""),
    "hurt": ("artisticdude", "RPG Sound Pack/inventory/cloth-heavy.wav", ""),
    "coins": ("kenney-rpg", "OGG/handleCoins.ogg", ""),
    "door": ("kenney-rpg", "OGG/doorOpen_1.ogg", ""),
    "book": ("kenney-rpg", "OGG/bookOpen.ogg", ""),
    "mail": ("kenney-rpg", "OGG/bookFlip2.ogg", ""),
    # Rewards: one jingle per rarity, richer and higher as the rarity grows.
    "reward-common": ("kenney-jingles", "OGG/jingles_NES/jingles_NES09.ogg", ""),
    "reward-rare": ("kenney-jingles", "OGG/jingles_NES/jingles_NES08.ogg", ""),
    "reward-epic": ("kenney-jingles", "OGG/jingles_NES/jingles_NES12.ogg", ""),
    "reward-legendary": ("kenney-jingles", "OGG/jingles_STEEL/jingles_STEEL02.ogg", ""),
}


def fetch(pack: str) -> Path:
    name = PACKS[pack]
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"  download {name}")
        urllib.request.urlretrieve(OGA + name, path)
    if path.suffix != ".zip":
        return path
    folder = CACHE / pack
    if not folder.exists():
        with zipfile.ZipFile(path) as z:
            z.extractall(folder)
    return folder


def find(folder: Path, rel: str) -> Path:
    """The path inside a pack; zips sometimes add a top folder."""
    hits = [p for p in folder.rglob(Path(rel).name) if p.as_posix().endswith(rel) and "__MACOSX" not in p.parts]
    if not hits:
        sys.exit(f"missing {rel} in {folder}")
    return hits[0]


def ffmpeg(src: Path, dst: Path, args: list[str]) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), *args, str(dst)], check=True)
    print(f"  {dst.relative_to(OUT).as_posix():28s} {dst.stat().st_size // 1024} KB")


def main() -> None:
    print("music")
    for place, pack in MUSIC.items():
        ffmpeg(fetch(pack), OUT / f"music/{place}.ogg", ["-af", "loudnorm=I=-20:TP=-2", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "2"])
    print("sfx")
    for name, (pack, rel, filters) in SFX.items():
        af = ",".join(f for f in [filters, "loudnorm=I=-16:TP=-1.5"] if f)
        ffmpeg(find(fetch(pack), rel), OUT / f"sfx/{name}.ogg", ["-af", af, "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "4"])


if __name__ == "__main__":
    main()
