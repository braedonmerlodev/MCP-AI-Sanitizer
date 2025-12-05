import sys
import os
import json

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'agent', 'agent-development-env', 'backend'))

from api import sanitize_input

payload = {
    "sanitizationTests": {
        "zeroWidthCharacters": "Present\u200B",
        "controlCharacters": "Present\u0000",
        "invisibleCharacters": "Present",
        "symbolsAndSpecialChars": "1 2 3 4 5 6 7 8 ; < = > ? @ A B C D E F G H I J K L M N",
        "unicodeText": "OY}NuL < ;;3;PP",
        "potentialXSS": {
            "patterns": {
                "email": "email@test.com",
                "phone": "123-456-7890",
                "ssn": "123-45-6789"
            }
        },
        "mathematicalSymbols": '""""+""""""""""""""""""""""""" "!"'
    }
}

json_str = json.dumps(payload)
print(f"Original length: {len(json_str)}")

sanitized = sanitize_input(json_str)
print(f"Sanitized length: {len(sanitized)}")
print(f"Sanitized content: {sanitized}")

try:
    parsed = json.loads(sanitized)
    print("SUCCESS: Valid JSON")
    
    symbols = parsed["sanitizationTests"]["symbolsAndSpecialChars"]
    print(f"Sanitized Symbols: {symbols}")
    
    if any(c in symbols for c in ['<', ';', '@', '=', '?', '>']):
        print("FAILURE: Symbols NOT stripped")
    else:
        print("SUCCESS: Symbols stripped")

    math = parsed["sanitizationTests"]["mathematicalSymbols"]
    print(f"Sanitized Math: {math}")
    
    if any(c in math for c in ['"', '+', '!']):
        print("FAILURE: Math symbols NOT stripped")
    else:
        print("SUCCESS: Math symbols stripped")
    
except json.JSONDecodeError:
    print("FAILURE: Invalid JSON")
