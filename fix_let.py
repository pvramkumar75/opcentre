import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("let let selectedMach", "let selectedMach")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
