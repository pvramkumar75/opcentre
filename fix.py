with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any literal backslash + n
text = text.replace('\\n', '\n')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
