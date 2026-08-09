"""
Narrate the screen recording, in English and in Hindi.

    python3 scripts/make-demo-video.py "/path/to/recording.mp4"

Produces two files next to the deck:

    docs/deck/Dagar-Demo-EN.mp4
    docs/deck/Dagar-Demo-HI.mp4

── WHY SYNTHETIC NARRATION ─────────────────────────────────────────────────────
Two reasons, and the second is the real one. It keeps the demo re-recordable
when the product changes, which it will. And it means the Hindi version exists
at all, rather than waiting for someone to find an hour to record it.

Dagar's entire argument is that a learner should not have to work in their
second language to get help. A demo that existed only in English would
contradict that on the way out of the room.

── HOW ─────────────────────────────────────────────────────────────────────────
macOS ships the voices: Rishi (en_IN) and Lekha (hi_IN), so there is no API, no
key and no per-minute cost. `say` writes one clip per line, ffmpeg delays each
one to its cue and mixes them into a single track, and that track replaces the
original audio.

ffmpeg comes from the `imageio-ffmpeg` pip package rather than Homebrew, so
this runs on a machine with no brew installed.

── EDITING THE SCRIPT ──────────────────────────────────────────────────────────
`LINES` below is the whole thing: a cue in seconds, the English, the Hindi.
Keep each line comfortably shorter than the gap to the next cue or they will
overlap. `say -r` is set low deliberately: this is a demo for a room, and the
listener has never seen the screen before.
"""
import os
import pathlib
import subprocess
import sys

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = pathlib.Path("docs/deck")
WORK = pathlib.Path(".demo-build")

# Words per minute. 190 rather than the 175 default: at 165 the delivery
# dragged against the pace of the screen, leaving each line finished long
# before the next thing happened. Override without editing this file:
#
#     RATE=205 python3 scripts/make-demo-video.py <recording.mp4>
RATE = int(os.environ.get("RATE", 190))

# (cue seconds, English, Hindi)
LINES = [
    (1.5,
     "This is Dagar, opened for the first time.",
     "यह है डगर, पहली बार खोला गया।"),
    (5.5,
     "The first screen asks one question. Which language do you read in?",
     "पहली ही स्क्रीन एक सवाल पूछती है। तुम किस भाषा में पढ़ते हो?"),
    (12.0,
     "Hindi or English, chosen before anything else. For a Hindi medium "
     "learner, an English only app is not a missing feature. It is a locked "
     "door.",
     "हिंदी या अंग्रेज़ी, सबसे पहले। हिंदी माध्यम के बच्चे के लिए सिर्फ़ "
     "अंग्रेज़ी वाला ऐप कोई कमी नहीं, बंद दरवाज़ा है।"),
    (26.0,
     "There is a page written for parents, in plain language, with no jargon "
     "in it anywhere.",
     "माता-पिता के लिए एक पेज है, बिलकुल आसान भाषा में, कहीं कोई मुश्किल शब्द "
     "नहीं।"),
    (38.0,
     "It explains the two ways to follow a child's progress.",
     "इसमें बताया है कि बच्चे की प्रगति देखने के दो तरीके हैं।"),
    (48.0,
     "The quickest needs no account at all. The child shares a link, and the "
     "parent opens it whenever they like.",
     "सबसे आसान तरीके में कोई खाता नहीं चाहिए। बच्चा एक लिंक भेजता है, और "
     "माता-पिता जब चाहें उसे खोल लेते हैं।"),
    (62.0,
     "Or a parent can make their own account, using a six character code the "
     "child reads out to them.",
     "या माता-पिता अपना खाता बना सकते हैं, बच्चे के दिए छह अक्षरों के कोड से।"),
    (78.0,
     "This is the whole point. The parent we most want to reach is the one "
     "least likely to finish a sign up form.",
     "बात यही है। जिन माता-पिता तक हमें सबसे ज़्यादा पहुँचना है, वही फ़ॉर्म "
     "भरने में सबसे कम रुचि रखते हैं।"),
    (93.0,
     "Signing in. Google, or an email and a password.",
     "साइन इन। गूगल से, या ईमेल और पासवर्ड से।"),
    (105.0,
     "Settings. The language again, because a learner can change their mind, "
     "and the class they are in.",
     "सेटिंग्स। भाषा फिर से, क्योंकि बच्चा मन बदल सकता है, और उसकी कक्षा।"),
    (120.0,
     "A buzz when an answer is right. A daily reminder. And Dagar already on "
     "the home screen, with no app store and no download.",
     "सही जवाब पर हल्का सा कंपन। रोज़ाना एक याद दिलाना। और डगर पहले से होम "
     "स्क्रीन पर, बिना किसी ऐप स्टोर या डाउनलोड के।"),
    (137.0,
     "Sharing progress with a parent. One tap, and it goes on WhatsApp.",
     "प्रगति माता-पिता तक भेजना। एक टैप, और वह व्हाट्सएप पर चली जाती है।"),
    (150.0,
     "The link is live. It shows it has been opened twice, and the child can "
     "switch it off at any time. It is her progress, and it stays hers.",
     "लिंक चालू है। दिख रहा है कि दो बार खोला गया, और बच्ची जब चाहे इसे बंद कर "
     "सकती है। यह उसकी प्रगति है, उसी की रहती है।"),
    (170.0,
     "Everything Dagar keeps, written so a twelve year old could read it.",
     "डगर जो कुछ रखता है, सब कुछ ऐसे लिखा है कि बारह साल का बच्चा भी पढ़ ले।"),
    (182.0,
     "And three things it never does. It does not share her information, it "
     "does not carry advertising, and there is nothing here to sell her.",
     "और तीन चीज़ें जो यह कभी नहीं करता। उसकी जानकारी किसी को नहीं देता, कोई "
     "विज्ञापन नहीं दिखाता, और उसे कुछ बेचता नहीं।"),
    (200.0,
     "Now into the learning. Fractions, five lessons, laid out as a path so "
     "she always knows where she is.",
     "अब पढ़ाई की तरफ़। भिन्न, पाँच पाठ, एक रास्ते की तरह, ताकि उसे हमेशा पता "
     "रहे कि वह कहाँ है।"),
    (216.0,
     "A lesson. One idea per screen. Cut a roti in half, and eat one half.",
     "एक पाठ। एक स्क्रीन पर एक ही बात। एक रोटी को आधा काटो, और आधा खा लो।"),
    (230.0,
     "When she is stuck, she asks. In her own words, in Hinglish, exactly the "
     "way she types to anyone else.",
     "जब वह अटकती है, तो पूछती है। अपने शब्दों में, हिंग्लिश में, जैसे वह किसी "
     "और से बात करती है।"),
    (246.0,
     "And the tutor does not hand over the answer. It asks which part is "
     "tricky, and waits for her.",
     "और ट्यूटर सीधे जवाब नहीं देता। वह पूछता है कि कौन सा हिस्सा मुश्किल लग रहा "
     "है, और उसका इंतज़ार करता है।"),
    (262.0,
     "The next step. The same roti, cut into four this time, and two pieces "
     "eaten.",
     "अगला कदम। वही रोटी, इस बार चार टुकड़ों में, और दो टुकड़े खाए गए।"),
    (277.0,
     "Then the question that actually teaches. Did you eat more the second "
     "time?",
     "और फिर वह सवाल जो असल में सिखाता है। क्या दूसरी बार तुमने ज़्यादा खाया?"),
    (292.0,
     "Back to the path, with lesson three now under way.",
     "वापस रास्ते पर, तीसरा पाठ अब चल रहा है।"),
    (303.0,
     "And her dashboard. A streak, a goal she can finish tonight, and one "
     "clear thing to do next.",
     "और उसका डैशबोर्ड। एक स्ट्रीक, आज पूरा हो सकने वाला लक्ष्य, और अगला एक "
     "साफ़ काम।"),
]

VOICES = {"en": "Rishi", "hi": "Lekha"}


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def clip(lang, index, words):
    """One narration line as a wav, via macOS `say`."""
    aiff = WORK / f"{lang}-{index:02d}.aiff"
    wav = WORK / f"{lang}-{index:02d}.wav"
    run(["say", "-v", VOICES[lang], "-r", str(RATE), "-o", str(aiff), words])
    run([FFMPEG, "-v", "error", "-y", "-i", str(aiff), "-ar", "44100",
         "-ac", "1", str(wav)])
    return wav


def build(source, lang):
    clips = [clip(lang, i, line[1 if lang == "en" else 2])
             for i, line in enumerate(LINES)]

    # Each clip is delayed to its cue, then all of them are mixed into one
    # track. `amix` normalises by input count, so the volume is lifted back up
    # afterwards rather than arriving at a whisper.
    parts, labels = [], []
    for i, (line, path) in enumerate(zip(LINES, clips)):
        ms = int(line[0] * 1000)
        parts.append(f"[{i + 1}:a]adelay={ms}|{ms}[d{i}]")
        labels.append(f"[d{i}]")
    parts.append(
        "".join(labels)
        + f"amix=inputs={len(clips)}:dropout_transition=0:normalize=0[mix]"
    )

    out = OUT_DIR / f"Dagar-Demo-{lang.upper()}.mp4"
    args = [FFMPEG, "-v", "error", "-y", "-i", str(source)]
    for path in clips:
        args += ["-i", str(path)]
    args += [
        "-filter_complex", ";".join(parts),
        "-map", "0:v", "-map", "[mix]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
        "-shortest", str(out),
    ]
    run(args)
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: make-demo-video.py <recording.mp4>")
    source = pathlib.Path(sys.argv[1])
    if not source.exists():
        raise SystemExit(f"no such file: {source}")

    WORK.mkdir(exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for lang in ("en", "hi"):
        out = build(source, lang)
        size = os.path.getsize(out) / 1_000_000
        print(f"wrote {out}  ({size:.1f} MB)")
    print(f"\n{len(LINES)} narration lines, voices "
          f"{VOICES['en']} and {VOICES['hi']}, {RATE} wpm.")


if __name__ == "__main__":
    main()
