# Storyboard: "click the circles" (osu! motion graphic)

1920×1080 at 60 fps, 56 s, 160 BPM (one beat = 0.375 s, one bar = 1.5 s).
Every animation is keyed to the beat grid, and every hitsound lands on a visual hit.

| # | Bars | Time | Scene | What happens |
|---|------|------|-------|--------------|
| 0 | 0–3 | 0.0–6.0 | **Intro** | Black screen with a small white triangle and "welcome to osu!" typed in on 16th notes (a nod to the lazer intro). Approach circles close onto numbered hit circles 1…11, faster and faster. Big faint words: *click · to · the · beat*. A riser, then a white flash on the drop. |
| 1 | 4–7 | 6.0–12.0 | **Cookie / main menu** | The official cookie bounces in, pulsing on every beat, with menu-style visualiser rays and rising pink triangles. Tagline: *rhythm is just a click away*. The cookie slides left and the Play / Edit / Options / Exit buttons slide out. The cursor clicks **Play** and an iris wipe opens from the click. |
| 2 | 8–11 | 12.0–18.0 | **01 Hit circles** | Title card on the left. On the right, 12 circles in three combos (orange, green, blue) hit on the beat, with follow points, 300s and the cursor trail. Callouts label the *approach circle* and the *hit circle*. |
| 3 | 12–15 | 18.0–24.0 | **02 Sliders** | Mirrored layout. A snaking S-curve slider with a reverse arrow, then an arc slider and a straight slider. Ball, follow circle and ticks are labelled. |
| 4 | 16–19 | 24.0–30.0 | **03 Spinners** | "SPIN!", a disc tied to the cursor's spin, the RPM counter rising to about 477, the metre filling, "Clear!", +1000 bonuses. Then the classic *3 · 2 · 1 · GO!* countdown. |
| 5 | 20–27 | 30.0–42.0 | **Kiai gameplay** | Full playfield with the HUD: HP bar, score, accuracy, progress pie, combo counter, hit-error meter, K1/K2 key overlay. Jumps on 1/2, 1/4 streams, kick sliders and a star pattern, with a beat-punch camera and kiai star fountains. Background words: AIM · SPEED · FLOW · FOCUS. Ends on a big finish circle. |
| 6 | 28–31 | 42.0–48.0 | **Results** | A lazer-style accuracy ring fills to 100%, an **SS** grade slams in, and the stats slide in. The pp reads 727. |
| 7 | 32–35 | 48.0–54.0 (+2 s tail) | **Outro** | The cookie returns, then *rhythm is just a click away* and *osu.ppy.sh*. A last approach circle closes onto the cookie for the final click, then fade to black. |

## Visual rules
- Hit objects, sliders, spinners, the cursor, the HUD and the results screen are all redrawn in vector from
  the wiki references (see `references/README.md`). No skin sprites are used.
- The cookie is the official PNG, shown as-is. It is only scaled and faded: never rotated, outlined,
  recoloured or blurred (per the brand identity guidelines).
- Combo colours `#FFC000 #00CA00 #127CFF #F21839`, UI pink `#FF66AA`, purple `#8866EE`,
  judgement colours 300 `#66CCFF`, 100 `#B3D944`, 50 `#FFCC22`.
- Type is Exo 2 (OFL), which osu!'s website used for years.

## Audio
An original synth track generated in `scripts/make_audio.py`. The chords are the "royal road"
IV–V–iii–vi progression in D major, a J-pop staple. On top sit synthesised hitsounds, placed from
cue data exported by the renderer, so each click lands on the frame where its circle is hit.
Hitsounds are panned by on-screen x position, as they are in osu!.
