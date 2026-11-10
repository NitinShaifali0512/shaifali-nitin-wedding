"""
"Saxophone Serenade" - an original instrumental written for this wedding website.

Melody, harmony and arrangement are composed in this file. The instruments are
sampled sounds from the GeneralUser GS SoundFont, whose licence allows use in
any music, private or commercial. Nothing here is taken from an existing song.

Form (4/4, 66 beats per minute, E flat major):
  intro (2 bars) - A (8) - A' (8) - B (8) - A'' (8) - outro (2)
"""
import math, random, sys
import numpy as np
import tinysoundfont
from scipy import signal
from scipy.io import wavfile

SR = 44100
SF2 = 'GeneralUser-GS.sf2'
TEMPO = 66.0
TRANSPOSE = -2            # written in F major, sounding in E flat major
BARS = 36
BEATS = BARS * 4
rng = random.Random(5122026)

# ----------------------------------------------------------------- time map
RIT_START = 33 * 4 + 2.0   # the last two and a half bars slow down gently
RIT_END_TEMPO = 46.0

LEAD_IN = 0.45             # a breath of silence before the first note, so the loop restarts gently

def beat_to_sec(beat: float) -> float:
    return LEAD_IN + _beat_to_sec(beat)

def _beat_to_sec(beat: float) -> float:
    spb = 60.0 / TEMPO
    if beat <= RIT_START:
        return beat * spb
    # tempo falls linearly (in beats) from TEMPO to RIT_END_TEMPO
    total = BEATS - RIT_START
    n = 200
    t = RIT_START * spb
    step = (beat - RIT_START) / n
    for i in range(n):
        frac = ((i + 0.5) * step) / total
        tempo = TEMPO + (RIT_END_TEMPO - TEMPO) * min(1.0, frac)
        t += step * 60.0 / tempo
    return t

TOTAL_SEC = beat_to_sec(BEATS) + 4.0   # room for the last chord and reverb to fade

# ------------------------------------------------------------------ harmony
N = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def m(name: str) -> int:
    """'A4' -> MIDI number (C4 = 60)."""
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + N[pitch]

# chord -> (bass note, right-hand voicing low to high, extra colour tone)
CH = {
    'Fmaj7':  ('F2',  ['A3', 'C4', 'E4'], 'G4'),
    'Dm7':    ('D2',  ['F3', 'A3', 'C4'], 'E4'),
    'Gm7':    ('G2',  ['F3', 'Bb3', 'D4'], 'A4'),
    'C7':     ('C2',  ['E3', 'Bb3', 'D4'], 'G4'),
    'C7sus':  ('C2',  ['F3', 'Bb3', 'D4'], 'G4'),
    'Am7':    ('A2',  ['G3', 'C4', 'E4'], 'G4'),
    'Bbmaj7': ('Bb1', ['A3', 'D4', 'F4'], 'A4'),
    'A7':     ('A2',  ['G3', 'C#4', 'E4'], 'G4'),
    'G7':     ('G2',  ['F3', 'B3', 'D4'], 'F4'),
    'F7':     ('F2',  ['A3', 'C4', 'Eb4'], 'F4'),
    'Fmaj9':  ('F2',  ['A3', 'E4', 'G4'], 'C5'),
}

# one entry per bar: list of (chord, beats)
A_CH  = [[('Fmaj7', 4)], [('Dm7', 4)], [('Gm7', 4)], [('C7sus', 2), ('C7', 2)],
         [('Am7', 4)], [('Dm7', 4)], [('Gm7', 2), ('C7', 2)], [('Fmaj7', 4)]]
A2_CH = A_CH[:7] + [[('Fmaj7', 2), ('F7', 2)]]
B_CH  = [[('Bbmaj7', 4)], [('C7', 4)], [('Am7', 4)], [('Dm7', 4)],
         [('Gm7', 4)], [('A7', 4)], [('Dm7', 2), ('G7', 2)], [('C7sus', 2), ('C7', 2)]]
A3_CH = A_CH[:7] + [[('Fmaj7', 4)]]
HARMONY = [[('Fmaj7', 4)], [('C7sus', 4)]] + A_CH + A2_CH + B_CH + A3_CH + [[('Fmaj7', 4)], [('Fmaj9', 4)]]
assert len(HARMONY) == BARS

# ------------------------------------------------------------------- melody
R = None  # rest
# each bar: list of (note or R, beats); bars must add up to 4 beats
A1 = [
    [('A4', 1.5), ('Bb4', 0.5), ('C5', 2.0)],
    [('D5', 1.0), ('C5', 1.0), ('A4', 1.5), (R, 0.5)],
    [('Bb4', 1.5), ('C5', 0.5), ('D5', 2.0)],
    [('E5', 1.0), ('D5', 1.0), ('C5', 1.5), (R, 0.5)],
    [('C5', 1.5), ('D5', 0.5), ('E5', 2.0)],
    [('F5', 1.0), ('E5', 0.5), ('D5', 0.5), ('A4', 2.0)],
    [('Bb4', 1.0), ('A4', 0.5), ('G4', 0.5), ('Bb4', 1.0), ('G4', 1.0)],
    [('A4', 3.0), (R, 1.0)],
]
A2 = [
    [('A4', 1.5), ('Bb4', 0.5), ('C5', 1.0), ('F5', 1.0)],
    [('E5', 0.5), ('D5', 0.5), ('C5', 1.0), ('A4', 1.5), (R, 0.5)],
    [('Bb4', 1.5), ('C5', 0.5), ('D5', 1.0), ('G5', 1.0)],
    [('F5', 0.5), ('E5', 0.5), ('D5', 1.0), ('C5', 1.5), (R, 0.5)],
    [('E5', 1.5), ('D5', 0.5), ('C5', 1.0), ('E5', 1.0)],
    [('D5', 1.5), ('C5', 0.5), ('A4', 1.0), ('F4', 1.0)],
    [('G4', 1.0), ('Bb4', 1.0), ('A4', 1.0), ('G4', 0.5), ('E4', 0.5)],
    [('F4', 2.5), (R, 0.5), ('A4', 0.5), ('C5', 0.5)],
]
B1 = [
    [('D5', 2.0), ('C5', 0.5), ('Bb4', 0.5), ('D5', 1.0)],
    [('C5', 2.0), ('Bb4', 0.5), ('G4', 0.5), ('E4', 1.0)],
    [('C5', 2.0), ('A4', 0.5), ('G4', 0.5), ('C5', 1.0)],
    [('A4', 2.5), (R, 0.5), ('D5', 0.5), ('E5', 0.5)],
    [('F5', 1.5), ('E5', 0.5), ('D5', 1.0), ('Bb4', 1.0)],
    [('C#5', 1.5), ('D5', 0.5), ('E5', 1.5), (R, 0.5)],
    [('F5', 1.0), ('D5', 1.0), ('F5', 1.0), ('D5', 0.5), ('B4', 0.5)],
    [('C5', 2.0), (R, 0.5), ('G4', 0.5), ('A4', 0.5), ('Bb4', 0.5)],
]
A3 = [
    [('C5', 1.5), ('Bb4', 0.5), ('A4', 2.0)],
    [('D5', 1.0), ('C5', 1.0), ('A4', 1.5), (R, 0.5)],
    [('Bb4', 1.5), ('C5', 0.5), ('D5', 2.0)],
    [('E5', 1.0), ('D5', 1.0), ('C5', 1.0), ('E5', 1.0)],
    [('G5', 2.0), ('E5', 1.0), ('C5', 1.0)],
    [('F5', 1.5), ('E5', 0.5), ('D5', 1.0), ('A4', 1.0)],
    [('Bb4', 1.0), ('D5', 1.0), ('C5', 1.0), ('G4', 0.5), ('E4', 0.5)],
    [('F4', 4.0)],
]
MELODY = [[(R, 4.0)], [(R, 4.0)]] + A1 + A2 + B1 + A3 + [[(R, 4.0)], [(R, 4.0)]]
assert len(MELODY) == BARS
for i, bar in enumerate(MELODY):
    assert abs(sum(d for _, d in bar) - 4.0) < 1e-9, f'bar {i} does not add up'

# loudness plan per bar (0..1): gentle start, fuller bridge, tender ending
def section_level(bar: int) -> float:
    if bar < 2: return 0.70
    if bar < 10: return 0.78
    if bar < 18: return 0.86
    if bar < 26: return 0.94
    if bar < 30: return 1.00
    if bar < 33: return 0.86
    return 0.70

# ------------------------------------------------------------ event helpers
class Part:
    def __init__(self, bank, preset, gain_db=0.0):
        self.bank, self.preset, self.gain = bank, preset, 10 ** (gain_db / 20)
        self.events = []   # (time_sec, order, kind, a, b)
    def on(self, t, key, vel): self.events.append((t, 2, 'on', key, int(max(1, min(127, vel)))))
    def off(self, t, key): self.events.append((t, 0, 'off', key, 0))
    def cc(self, t, num, val): self.events.append((t, 1, 'cc', num, int(max(0, min(127, val)))))
    def bend(self, t, cents): self.events.append((t, 1, 'bend', int(max(0, min(16383, 8192 + cents * 40.96))), 0))
    def render(self):
        synth = tinysoundfont.Synth(samplerate=SR, gain=-3)
        sf = synth.sfload(SF2)
        synth.program_select(0, sf, self.bank, self.preset)
        synth.pitchbend_range(0, 2.0)
        total = int(TOTAL_SEC * SR)
        out = np.zeros((total, 2), dtype=np.float32)
        pos = 0
        for t, _, kind, a, b in sorted(self.events):
            target = min(total, max(pos, int(t * SR)))
            if target > pos:
                buf = np.frombuffer(synth.generate(target - pos), dtype=np.float32).reshape(-1, 2)
                out[pos:target] = buf
                pos = target
            if kind == 'on': synth.noteon(0, a, b)
            elif kind == 'off': synth.noteoff(0, a)
            elif kind == 'cc': synth.control_change(0, a, b)
            elif kind == 'bend': synth.pitchbend(0, a)
        if pos < total:
            out[pos:] = np.frombuffer(synth.generate(total - pos), dtype=np.float32).reshape(-1, 2)
        return out * self.gain

# ---------------------------------------------------------------- saxophone
sax = Part(0, 65)          # Alto Sax
sax.cc(0.0, 7, 110); sax.cc(0.0, 11, 100); sax.bend(0.0, 0)

beat = 0.0
prev_was_rest = True
notes = []
for bar_index, bar in enumerate(MELODY):
    for name, dur in bar:
        if name is not None:
            notes.append((beat, dur, m(name) + TRANSPOSE, bar_index, prev_was_rest))
        prev_was_rest = name is None
        beat += dur

for idx, (b0, dur, key, bar_index, phrase_start) in enumerate(notes):
    nxt = notes[idx + 1] if idx + 1 < len(notes) else None
    legato = nxt is not None and abs(nxt[0] - (b0 + dur)) < 1e-6
    lay_back = 0.012 + rng.uniform(0, 0.014)                 # a relaxed, behind-the-beat feel
    t0 = beat_to_sec(b0) + lay_back
    t1 = beat_to_sec(b0 + dur) + (0.022 if legato else -0.09) + 0.012
    length = t1 - t0
    level = section_level(bar_index)
    strong = (b0 % 4.0) in (0.0, 2.0)
    vel = 74 + 22 * level + (5 if strong else 0) + rng.uniform(-3, 3)
    if dur <= 0.5: vel -= 5

    # breath and bow: each note swells slightly, long notes bloom and relax
    base = 84 + 26 * level
    if length > 0.9:
        steps = max(4, int(length / 0.045))
        for i in range(steps + 1):
            x = i / steps
            shape = 0.86 + 0.14 * math.sin(math.pi * min(1.0, x * 1.25)) - (0.16 * max(0.0, x - 0.72) / 0.28 if not legato else 0.0)
            sax.cc(t0 + x * length, 11, base * shape)
    else:
        sax.cc(t0 - 0.004, 11, base * (0.94 if not strong else 1.0))

    # scoop into phrase starts and into the higher notes, as a player would
    scoop = 0.0
    if phrase_start: scoop = -42.0
    elif key >= m('E5') + TRANSPOSE and dur >= 1.0: scoop = -26.0
    if scoop:
        ramp = 0.11
        for i in range(9):
            x = i / 8
            sax.bend(t0 - 0.003 + x * ramp, scoop * (1 - x) ** 1.6)
    else:
        sax.bend(t0 - 0.003, 0)

    # vibrato arrives late and widens, only on sustained notes
    if length > 0.72:
        rate = 5.1 + rng.uniform(-0.2, 0.35)
        depth = (9.0 + 7.0 * level) * (1.12 if length > 1.6 else 1.0)
        onset = 0.30 if length > 1.3 else 0.22
        t = t0 + max(onset, 0.13 if scoop else 0.0)
        phase = 0.0
        while t < t1 - 0.02:
            grow = min(1.0, (t - t0 - onset) / 0.45 + 0.15)
            fade = 1.0 if legato else min(1.0, (t1 - t) / 0.12)
            sax.bend(t, math.sin(phase) * depth * grow * fade)
            t += 0.012
            phase += 2 * math.pi * rate * 0.012
        sax.bend(t1 - 0.012, 0)

    sax.on(t0, key, vel)
    sax.off(t1, key)

# -------------------------------------------------------------------- piano
piano = Part(0, 0, gain_db=-5.5)
strings = Part(0, 49, gain_db=-11.5)   # Slow Strings
bass = Part(0, 32, gain_db=-5.0)       # Acoustic Bass
strings.cc(0.0, 7, 100); strings.cc(0.0, 11, 70); bass.cc(0.0, 7, 105); piano.cc(0.0, 7, 108)

beat = 0.0
for bar_index, bar in enumerate(HARMONY):
    level = section_level(bar_index)
    last_bar = bar_index == BARS - 1
    for chord, beats in bar:
        root, voicing, colour = CH[chord]
        root_k = m(root) + TRANSPOSE
        keys = [m(v) + TRANSPOSE for v in voicing]
        colour_k = m(colour) + TRANSPOSE
        start = beat
        end = beat + beats
        t_end = beat_to_sec(end)

        # bass: the root, with a soft pick-up on the fifth before a long chord changes
        tb = beat_to_sec(start) + rng.uniform(-0.004, 0.006)
        bass.on(tb, root_k, 78 + 14 * level)
        bass.off(beat_to_sec(start + min(beats, 3.0)) - 0.05, root_k)
        if beats >= 4 and not last_bar and bar_index >= 2:
            fifth = root_k + 7
            tf = beat_to_sec(start + 3.0) + rng.uniform(-0.004, 0.008)
            bass.on(tf, fifth, 62 + 10 * level)
            bass.off(beat_to_sec(end) - 0.06, fifth)

        # strings: a soft bed that swells with the tune
        ts = beat_to_sec(start)
        for k in keys[1:] + [colour_k]:
            strings.on(ts, k, 52 + 14 * level)
            strings.off(t_end + 0.25, k)
        strings.cc(ts, 11, 52 + 44 * level)

        # piano: flowing broken chords in quavers; notes ring until the chord changes (as with the pedal down)
        if last_bar:
            # final rolled chord
            roll = [root_k, root_k + 12] + keys + [colour_k]
            for i, k in enumerate(roll):
                tt = beat_to_sec(start) + i * 0.085
                piano.on(tt, k, 60 - i * 1.5)
                piano.off(TOTAL_SEC - 0.6, k)
        else:
            pattern = [root_k + 12, keys[1], keys[2], keys[1], colour_k, keys[2], keys[1], keys[2]]
            steps = int(round(beats * 2))
            for i in range(steps):
                b = start + i * 0.5
                k = pattern[i % len(pattern)] if beats >= 4 else [root_k + 12, keys[1], keys[2], colour_k][i % 4]
                tt = beat_to_sec(b) + rng.uniform(-0.007, 0.009)
                accent = 6 if i == 0 else (2 if i % 2 == 0 else -3)
                piano.on(tt, k, 46 + 16 * level + accent + rng.uniform(-3, 3))
                piano.off(t_end - 0.02 + rng.uniform(0, 0.02), k)
            # left hand octave on the downbeat
            tl = beat_to_sec(start) + rng.uniform(-0.003, 0.004)
            piano.on(tl, root_k, 50 + 14 * level)
            piano.off(t_end - 0.03, root_k)
        beat = end

# ------------------------------------------------------------------- mixing
def butter(x, kind, freq, order=2):
    sos = signal.butter(order, freq, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)

def make_reverb(seconds=3.2, t60=2.5, seed=7):
    g = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = g.standard_normal(n)
        dark = butter(noise, 'low', 2400)
        bright = butter(noise, 'low', 7500) * np.exp(-t * 3.2)
        ir[:, c] = (0.75 * dark + 0.45 * bright) * np.exp(-6.91 * t / t60)
    ir = butter(ir, 'high', 220)
    pre = int(0.026 * SR)
    ir = np.vstack([np.zeros((pre, 2)), ir])
    ir *= np.clip(np.arange(len(ir)) / (0.012 * SR), 0, 1)[:, None] ** 0.5   # soften the onset
    return ir / np.sqrt((ir ** 2).sum(axis=0)).max()

def convolve(x, ir):
    out = np.zeros((len(x) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x[:, c], ir[:, c])
    return out[:len(x)]

print('rendering instruments...', flush=True)
stem_sax, stem_piano, stem_strings, stem_bass = (p.render().astype(np.float64) for p in (sax, piano, strings, bass))

# saxophone: remove rumble, soften the edge, add a little air
stem_sax = butter(stem_sax, 'high', 150)
stem_sax = 0.72 * butter(stem_sax, 'low', 5200) + 0.28 * stem_sax
stem_sax *= 1.25
stem_piano = butter(stem_piano, 'high', 70)
stem_piano = 0.8 * butter(stem_piano, 'low', 6000) + 0.2 * stem_piano
stem_strings = butter(butter(stem_strings, 'high', 180), 'low', 5000)
stem_bass = butter(stem_bass, 'low', 1800)

# balance the instruments against the saxophone, which carries the tune
def rms(x):
    return float(np.sqrt((x ** 2).mean()) + 1e-12)

def set_level(stem, db_below_sax):
    return stem * (rms(stem_sax) * 10 ** (-db_below_sax / 20) / rms(stem))

stem_piano = set_level(stem_piano, 6.5)
stem_strings = set_level(stem_strings, 12.0)
stem_bass = set_level(stem_bass, 8.0)

# a soft echo behind the saxophone (dotted quaver), then the room
echo_delay = int(SR * (60.0 / TEMPO) * 0.75)
echo = np.zeros_like(stem_sax)
echo[echo_delay:] = butter(stem_sax, 'low', 2600)[:-echo_delay] * 0.14
echo[:, 0], echo[:, 1] = echo[:, 0] * 0.7, echo[:, 1] * 1.0

ir = make_reverb()
send = 1.0 * stem_sax + 0.9 * echo + 0.6 * stem_piano + 0.9 * stem_strings + 0.08 * stem_bass
wet = convolve(send, ir)
wet = set_level(wet, 9.5)

mix = stem_sax + echo + stem_piano + stem_strings + stem_bass + wet
mix = butter(mix, 'high', 32)

# gentle glue compression, then a soft ceiling
env = np.abs(mix).max(axis=1)
win = int(0.05 * SR)
smooth = np.sqrt(signal.fftconvolve(env ** 2, np.ones(win) / win, mode='same').clip(min=0))
peak_ref = np.percentile(smooth, 99.5)
gain = np.minimum(1.0, (0.55 * peak_ref / np.maximum(smooth, 1e-6)) ** 0.35)
gain = signal.fftconvolve(gain, np.ones(win) / win, mode='same')
mix *= gain[:, None]
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix *= 10 ** (-7.0 / 20)

# fade in from silence and out to silence so that the loop point is seamless
n = len(mix)
fade_in = int(0.05 * SR); fade_out = int(3.2 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= (np.cos(np.linspace(0, math.pi, fade_out)) * 0.5 + 0.5)[:, None]

out = sys.argv[1] if len(sys.argv) > 1 else 'serenade.wav'
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
rms = float(np.sqrt((mix ** 2).mean()))
print(f'wrote {out}: {n / SR:.1f}s, peak {np.abs(mix).max():.3f}, rms {20 * math.log10(rms):.1f} dBFS')
np.save('stem_sax.npy', stem_sax.astype(np.float32))
for name, stem in [('sax', stem_sax), ('piano', stem_piano), ('strings', stem_strings), ('bass', stem_bass), ('wet', wet)]:
    print(f'  {name:8s} rms {20 * math.log10(np.sqrt((stem ** 2).mean()) + 1e-12):6.1f} dB  peak {np.abs(stem).max():.3f}')
