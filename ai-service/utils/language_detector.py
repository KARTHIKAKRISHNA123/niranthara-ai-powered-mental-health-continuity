# utils/language_detector.py — Tamil / Tanglish / English detector
#
# THIS IS ROUTING, NOT A CLINICAL DECISION.
# The project rule is "no keyword matching for clinical decisions". Language
# identification is not a clinical decision — it decides whether text is sent to
# Sarvam for translation before the (English-only) crisis and emotion models see
# it. Getting it wrong is nonetheless safety-critical, which is why the previous
# version was dangerous:
#
#   The old detector needed >=2 hits from a 33-word list, did not strip
#   punctuation, and included plain English words ("life", "feel", "chance").
#   Measured consequence — Tanglish suicidal ideation was scored as English:
#
#     "enakku saavanum nu thonuthu"                 -> 0.0081  NO ALERT
#     "I feel like I want to die"                   -> 0.9615  alert
#     "naan irundhu enna prayojanam, ellarukkum bharam" -> 0.0100 NO ALERT
#     "What is the point of me existing, I am a burden" -> 0.9951 alert
#
#   A Tamil-speaking user — the product's primary audience — could express
#   suicidal intent and reach nobody. The English words in the list also caused
#   the reverse error, tagging plain English as Tanglish.
#
# Design: high-precision distinctive markers (one is enough — these essentially
# never occur in English) plus romanised-Tamil morphology, which generalises far
# beyond any fixed vocabulary.

import re

# Words that are unmistakably romanised Tamil. A single hit is sufficient.
# Distress vocabulary is included deliberately: those are exactly the messages
# that must not be misrouted.
STRONG_MARKERS = {
    # distress / crisis register
    "saavanum", "saaganum", "saavu", "thatkolai", "bharam", "baaram",
    "mudiyala", "mudiyalai", "mudinjiduchu", "vetkam", "thanimai",
    "kavalai", "bayam", "azhuga", "azhukiren", "thonuthu", "thonudhu",
    # everyday high-frequency Tamil
    "enakku", "unakku", "avanukku", "avalukku", "namakku", "ellarukkum",
    "irukku", "irukken", "irukkiren", "irukkinga", "iruka", "irundhu",
    "romba", "konjam", "eppadi", "epdi", "yenna", "edhuku", "ethuku",
    "theriyala", "theriyalai", "theriyuma", "puriyala", "purinjukala",
    "pannunga", "panren", "pannuven", "sollunga", "solluven", "vendam",
    "kashtam", "kastam", "pidikala", "prayojanam", "nambikkai",
    "seri", "aama", "illa", "illai", "nalla", "paaru", "pogalam",
    "ippo", "innaiku", "naalaikku", "raatri", "thookam", "sapadu",
    "amma", "appa", "veedu", "velai", "padikka", "friends",
}

# Romanised Tamil morphology — case endings, verb inflections, negation.
# Catches vocabulary no list could enumerate ("kashtamaa", "varutham-aa irukku").
SUFFIX_PATTERNS = re.compile(
    r"\b\w{3,}("
    r"ukku|akku|kiren|kiraen|kitten|kirathu|"   # dative / present tense
    r"anum|aanum|num|"                          # necessitative "must/want to"
    r"uthu|udhu|athu|adhu|"                     # neuter verb endings
    r"ala|alai|illa|illai|"                     # negation
    r"aaga|aana|aai|aaya|"                      # adverbial / adjectival
    r"nga|ngo|unga"                             # honorific plural
    r")\b",
    re.IGNORECASE,
)

_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def detect_language(text: str) -> str:
    """
    Returns 'ta' | 'tanglish' | 'en'.

    'ta'       — Tamil script (U+0B80–U+0BFF)
    'tanglish' — romanised Tamil, with or without English mixed in
    'en'       — everything else

    Both 'ta' and 'tanglish' are translated to English before the crisis and
    emotion classifiers run, so a false 'en' is the failure mode that matters.
    """
    if not text or not text.strip():
        return "en"

    if len(re.findall(r"[஀-௿]", text)) > 3:
        return "ta"

    # Strip punctuation before matching — "prayojanam," never matched before.
    words = set(_PUNCT.sub(" ", text.lower()).split())

    if words & STRONG_MARKERS:
        return "tanglish"

    # Two independent morphology hits, so a stray English word ending in "-ala"
    # or "-nga" cannot flip the result on its own.
    if len(set(SUFFIX_PATTERNS.findall(text))) >= 2:
        return "tanglish"

    return "en"
