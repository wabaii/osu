# osu! reference material

Reference images and gameplay used to design the motion graphic in this repo.
All images in `images/` come from the official osu! wiki
([ppy/osu-wiki](https://github.com/ppy/osu-wiki)), which is licensed
[CC-BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The "osu!" name
and cookie logo are trademarks of ppy Pty Ltd and are used here under the
[brand identity guidelines](https://osu.ppy.sh/wiki/en/Brand_identity_guidelines)
for a non-commercial fan project.

## Image sources

| Folder | What | Source page |
| --- | --- | --- |
| `images/gameplay/osu-gameplay.jpg` | Full in-game screenshot: circles 1-2-3, slider, 300/激 judgements, HUD | [osu! (game mode)](https://osu.ppy.sh/wiki/en/Game_mode/osu%21) |
| `images/gameplay/osu_hitcircles.jpg` | Numbered hit circles with approach circles | [Hit object](https://osu.ppy.sh/wiki/en/Gameplay/Hit_object) |
| `images/gameplay/osu_slider.jpg` | Slider: head, body, ball, follow circle, reverse arrow | [Slider](https://osu.ppy.sh/wiki/en/Gameplay/Hit_object/Slider) |
| `images/gameplay/osu_spinner.jpg` | Spinner "Clear" state with RPM counter | [Spinner](https://osu.ppy.sh/wiki/en/Gameplay/Hit_object/Spinner) |
| `images/gameplay/Ouendan.jpg` | Osu! Tatakae! Ouendan, the DS game that inspired osu! | [osu! (game mode)](https://osu.ppy.sh/wiki/en/Game_mode/osu%21) |
| `images/judgement/` | 300 / 100 / 50 / miss and geki/katu judgement sprites | [Judgement](https://osu.ppy.sh/wiki/en/Gameplay/Judgement/osu%21) |
| `images/skin_elements/` | Default skin parts: hitcircle, overlay, approach circle, numbers, slider ball, follow circle, reverse arrow, spinner parts | [Skinning/osu!](https://osu.ppy.sh/wiki/en/Skinning/osu%21) |
| `images/interface/` | Main menu, song select, results, mod select, intro screen | [Client/Interface](https://osu.ppy.sh/wiki/en/Client/Interface) |
| `images/brand/` | Official cookie logos (2016 stable, present lazer) and logo usage rules | [Brand identity guidelines](https://osu.ppy.sh/wiki/en/Brand_identity_guidelines), [Cookie](https://osu.ppy.sh/wiki/en/Client/Interface/Cookie) |

`wiki_md/` holds the raw wiki text for the same pages (hit objects, judgement,
score, health, grades, skinning, brand guidelines).

## Gameplay footage studied

The YouTube streams themselves can't be downloaded from this environment, so the
storyboard thumbnails (one frame every few seconds) were pulled with `yt-dlp -f sb0`
and studied for layout and pacing. These frames are not committed.

- [what is lazer?](https://www.youtube.com/watch?v=ut_SOreClcc), official osu!
  channel. Lazer UI, menu, gameplay HUD, pink accent colour.
- [New osu!lazer intro (Triangles Intro)](https://www.youtube.com/watch?v=X9EbQUorstk).
  Black screen, then "welcome to osu!" with a small triangle, a ring sweep, a white
  flash, and the pink cookie pulsing on a triangle background.
- [12.16⭐ CRYSTALIA FC | 1872pp](https://www.youtube.com/watch?v=7Lb4exu5ikg), mrekk.
  Top-level play: black background, minimal skin, cyan approach circles, yellow
  cursor trail, wide jumps and streams, the HUD around the edges.

## What the video borrows from the references

**Hit circles.** A filled disc in the combo colour with a thick white border and a
white combo number. A thin ring in the same colour (the approach circle) starts at
about 3-4× the radius and shrinks onto the border exactly on the beat. On a hit the
circle swells to about 1.4× and fades out in roughly 250 ms. A judgement number
(300 blue, 100 green, 50 yellow, red ✕ for a miss) rises and fades.

**Follow points.** Small chevrons between consecutive objects, pointing in the
direction of travel.

**Sliders.** A thick rounded track with a white border and a darker combo-colour
body. The ball travels along it inside a larger ring (the orange follow circle in
the default skin). A white reverse arrow marks a repeat. Small tick dots sit along
the body.

**Spinners.** A large disc that fills a metre as you spin, a "SPIN!" prompt, an RPM
counter at the bottom, then "Clear" and bonus score numbers.

**HUD.** Health bar top-left. 8-digit score top-right with accuracy (100.00%) and a
progress pie under it. Combo counter (`64x`) bottom-left. Hit-error meter
bottom-centre, with blue, green and orange zones. Key overlay (K1/K2/M1/M2) on the
right edge.

**Combo colours** (default skin): `#FFC000` orange, `#00CA00` green, `#127CFF` blue,
`#F21839` red.

**Lazer palette** (osu! UI colours): pink `#FF66AA`, purple `#8866EE`, blue
`#66CCFF`, yellow `#FFCC22`. UI backgrounds are dark plum/navy with drifting
translucent triangles.

**Main menu.** A big pink cookie that pulses on the beat, with visualiser rays
around it. Purple slanted buttons (Play / Edit / Options / Exit) slide out to the
right.

**Results.** A huge grade letter (S / SS) on the right. Score, judgement counts,
max combo and accuracy on the left.

**Logo rules.** Use the original file and keep it sharp. Don't rotate it, outline
it, recolour the full-colour version, or put anything inside it. Scaling and
fading it as a whole is fine.
