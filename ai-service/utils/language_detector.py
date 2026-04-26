# utils/language_detector.py — Tamil / Tanglish / English detector

import re

TANGLISH_WORDS = {
    "romba", "irukku", "irukken", "iruka", "illa", "illai", "vendam",
    "kastam", "kashtam", "nalla", "seri", "enna", "eppadi", "konjam",
    "paakalam", "sollu", "aama", "mudiyala", "paaru", "pakku", "pogalam",
    "theriyuma", "yenna", "thevai", "kedaikuma", "pidikala", "oru",
    "nambikkai", "supera", "chance", "life", "feel", "pannuven"
}


def detect_language(text: str) -> str:
    """
    Returns: 'ta' | 'tanglish' | 'en'
    Tamil detection: Unicode range U+0B80–U+0BFF
    Tanglish: romanised Tamil words mixed with English
    """
    if not text:
        return "en"

    # Check for Tamil script characters
    tamil_chars = len(re.findall(r'[\u0B80-\u0BFF]', text))
    if tamil_chars > 3:
        return "ta"

    # Check for Tanglish words
    words_lower = set(text.lower().split())
    tanglish_count = len(words_lower & TANGLISH_WORDS)
    if tanglish_count >= 2:
        return "tanglish"

    return "en"
