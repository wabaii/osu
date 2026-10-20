# Storyboard: an osu!lazer motion graphic on official osu! music

1920×1080 at 60 fps, about 60.6 s. The video is cut to three official tracks from `osu-resources`.
Each scene follows its track's own timing points (from the bundled `.osz` files):

| Track | BPM | Used for |
| --- | --- | --- |
| nekodex – *welcome to osu!* | 120 | intro, main menu, song select, loader |
| nekodex – *circles!* | 184 | gameplay (8-bar intro used as a tutorial, then the kiai), results |
| cYsmix – *triangles* | 160 | back to the main menu, exit |

| Time | Scene | What happens (all lazer design language) |
| --- | --- | --- |
| 0.0–2.1 | **IntroWelcome** | The official "welcome to osu!" voice and reverb piano. `welcome_text` stretches open over a black circle ringed by a dark-blue audio visualiser, scaling 0.9→1 over 2142 ms, exactly as in `IntroWelcome.cs`. |
| 2.1–10.4 | **Main menu** | *welcome to osu!* starts. The lazer logo fades in (pink gradient, drifting outlined triangles, official white logo texture) with a beat ripple and a white visualiser driven by the real music. The song ticker shows the track. A click on the logo opens the dark button bar and toolbar: settings / play / edit / browse / exit in lazer's colours. Play leads to back / solo / multi / playlists / daily challenge, then solo. Buttons widen elastically on hover and their icons bounce on the beat. |
| 10.4–15.4 | **Song select V2** | Metadata wedge, "No records yet!" leaderboard, filter bar, and a carousel of the bundled beatmaps (circle the halls, circles!, triangles, welcome to osu!) scrolling from the current track to *circles!*. It expands to show its difficulties and "Tribute" is picked. The footer has back / mods / random / options, and clicking the logo starts the map. |
| 15.4–18.8 | **Player loader** | Beatmap metadata card with a loading spinner and the settings panels. *circles!* begins softly underneath. |
| 18.8–29.8 | **Gameplay: intro bars** | Argon skin and Argon HUD. Callouts label the approach circle, hit circle, slider ball, follow circle, repeat arrow and spinner. |
| 29.8–40.3 | **Gameplay: kiai** | Kiai star fountains, a background flash on each bar. Triangle and star jumps on 1/2, kick sliders, a 1/4 stream, triples, a spiral stream and a finish circle. "GREAT" judgements with ring bursts; segmented score, accuracy, pp and combo counters; health bar, density progress bar, key counter, hit-error bars. |
| 40.3–50.7 | **Results** | Expanded score panel (#555→#333) with avatar and beatmap info. The accuracy ring fills cyan→green over the graded rank rings, rank badges light up, and **SS** lands on a beat in the rank colour `#DE31AE`. Then 1,000,000 score, stats, GREAT/OK/MEH/MISS, and a timing-distribution panel. |
| 50.7–57.4 | **Back to menu, exit** | *triangles* takes over with a triangle background and the song ticker. A menu tip reads *rhythm is just a click away · osu.ppy.sh*. The cursor clicks exit, the official "see ya!" plays, and the logo returns to centre and fades. |
| 57.4–60.6 | **Credits** | Music, sound and texture credits (CC BY-NC 4.0), fan-made notice. |

## Sound
Everything comes from `osu-resources` (CC BY-NC 4.0): the three tracks; the Welcome intro voice,
piano and "see ya"; Argon hitsounds (hitnormal plus whistle / clap / finish, slider ticks and slide,
spinnerspin rising in pitch with progress, spinner bonus); menu button samples; song select samples;
results samples (panel appear, swoosh, score ticks, badge dinks, `rank-impact-pass-ss`, `applause-s`);
and the kiai `fountain-shoot`. `scripts/mix_audio.py` places them from the animation's cue list.
