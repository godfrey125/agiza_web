import re

BOT_PATTERN = re.compile(
    r'(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|'
    r'quora link preview|pinterest|vkshare|w3c_validator|whatsapp|telegrambot|'
    r'discordbot|headlesschrome|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot)',
    re.IGNORECASE,
)


def parse_user_agent(user_agent):
    """Return lightweight device/browser/OS information without extra packages."""
    ua = (user_agent or '').strip()
    lower = ua.lower()

    is_bot = bool(BOT_PATTERN.search(ua))

    if is_bot:
        device_type = 'bot'
    elif 'ipad' in lower or 'tablet' in lower or ('android' in lower and 'mobile' not in lower):
        device_type = 'tablet'
    elif any(token in lower for token in ('mobi', 'iphone', 'ipod', 'windows phone')):
        device_type = 'mobile'
    elif ua:
        device_type = 'desktop'
    else:
        device_type = 'unknown'

    if 'edg/' in lower or 'edge/' in lower:
        browser = 'Edge'
    elif 'opr/' in lower or 'opera' in lower:
        browser = 'Opera'
    elif 'samsungbrowser' in lower:
        browser = 'Samsung Internet'
    elif 'chrome' in lower or 'crios' in lower:
        browser = 'Chrome'
    elif 'firefox' in lower or 'fxios' in lower:
        browser = 'Firefox'
    elif 'safari' in lower:
        browser = 'Safari'
    elif is_bot:
        browser = 'Bot'
    else:
        browser = 'Unknown'

    if 'android' in lower:
        operating_system = 'Android'
    elif any(token in lower for token in ('iphone', 'ipad', 'ipod', 'ios')):
        operating_system = 'iOS'
    elif 'windows' in lower:
        operating_system = 'Windows'
    elif 'mac os' in lower or 'macintosh' in lower:
        operating_system = 'macOS'
    elif 'linux' in lower:
        operating_system = 'Linux'
    else:
        operating_system = 'Unknown'

    return {
        'is_bot': is_bot,
        'device_type': device_type,
        'browser': browser,
        'operating_system': operating_system,
    }
