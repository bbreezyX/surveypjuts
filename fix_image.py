with open('custom.js', 'r', encoding='utf-8') as f:
    js = f.read()

target1 = "'<img src=\"images/' + escapeHtml(photoPath) + '\" alt=\"Foto lokasi '"
repl1 = "'<img src=\"images/' + encodeURIComponent(photoPath).replace(/%20/g, \' \') + '\" alt=\"Foto lokasi '"  

# Actually, wait. encodeURI is a JS function. Wait, let me just replace escapeHtml(photoPath)
# with encodeURI(photoPath)
# Wait, why was encodeURI failing? If it has spaces, encodeURI encodes them.
# The correct way to encode a file path URL fragment safely: encodeURIComponent(photoPath)
# but wait. escapeHtml(photoPath) is used. Let's do it simple.

js = js.replace('escapeHtml(photoPath)', 'encodeURI(photoPath)')

with open('custom.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('Updated custom.js image links')
